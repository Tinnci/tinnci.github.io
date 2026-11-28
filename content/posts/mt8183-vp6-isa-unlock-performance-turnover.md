---
title: 把 Lenovo Chromebook Duet (MT8183) 搬上主线 Linux（六）：MVPU6_0226 隐藏指令解锁、零溢出汇编微内核与全栈性能跃迁
date: 2026-11-28
slug: mt8183-vp6-isa-unlock-performance-turnover
featured: false
color: var(--accent-3)
category: AI Systems
series: MT8183 Mainline Camera & Vision P6 NPU Bring-Up
seriesOrder: 6
tags:
  - MT8183
  - Edge NPU
  - VP6
  - Xtensa
  - Assembly
  - TFLite
  - Home Assistant
  - Performance
excerpt: 通过真机异常探测摸清 MT8183 MVPU6_0226 硅片上被 sample_controller 工具链雪藏的 Xtensa LX7 标量指令（mulsh/muluh/quou/sext/clamps），踩平 GCC LRA 寄存器重分配与 25 次栈溢出陷阱，并用纯汇编 TCM 微内核将 GEMM 周期压低 5.41×、DepthNetRGB 推上 15.54 FPS、MobileNetV1 压进 119 ms。
---

在[第（五）篇](/posts/mt8183-vp6-npu-architecture-toolchain-ha-deployment)把 **MT8183 双核 Vision P6 (`MVPU6_0226`)** 的 `L1 I-Cache` 与 `256 KiB` TCM 图执行架构交代清楚之后，一个非常现实的工程问题摆在面前：**Zephyr `xtensa-sample_controller_zephyr-elf-gcc` 默认按最保守的 `sample_controller` 配置生成代码，它究竟漏掉了多少 `MVPU6_0226` 硅片上明明已经焊在电路里的免费算力？**

本文记录完整的一次 **Phase 2（标量硬件指令解锁）→ Phase 3（`tcm_dot.S` 零溢出纯汇编微内核 + `115 KiB` 动态 TCM 分块）** 真机改造过程：不仅有每项算子与 Home Assistant 现网模型的对比实测数据，也正面回答一个更关键的架构选择——**在标量边界被推高 ~1.4×–5.4× 之后，多出来的算力应该用来降低端到端延迟，还是换取更复杂的模型？**

---

## 1. 不猜规格书：用异常安全探针盘点 `MVPU6_0226` 真实标量指令

没有联发科 NDA `core-isa.h`，绝不能靠盲目开启 GCC 编译选项碰运气——一旦发射了一条未综合指令，DSP 就会直接触发 `IllegalInstructionCause` 宕机。我们在 `firmware/start.S` + `firmware/hw_probe.c` 中用 `apu_probe_exec()` 构造了一个带异常恢复的现场沙盒，在两颗核上逐条试探并回读计算结果：

| 探测目标 | 原始机器码 / 汇编测试 | Core 0 / Core 1 真机结果 | 实际算力价值 |
|---|---|---|---|
| `CONFIGID0 / CONFIGID1` | `rsr` (`SR 176 / 177`) | `0xc0f3dbfe` / `0x21069682` | 确认两核硬件对称，对应 `MVPU6_0226` |
| `CPENABLE` (`SR 224`) | 写 `0xff` 后 `rsync` 回读 | `init = 0x0` → 黏滞掩码 **`0x00000007`** | 证实 3 个闭源 TIE 协处理器硬件槽位 |
| **`mulsh` (`32×32→高32有符号`)** | `.byte 0x40, 0x23, 0xb2` (`-1e9 * 1e9`) | **`0xf21f494c`（精确匹配）** | 替代 4×`mul16u` + 64-bit 移位链，干掉 Q31 重量化瓶颈 |
| **`muluh` (`32×32→高32无符号`)** | `.byte 0x40, 0x23, 0xa2` (`2^31 * 2^31`) | **`0x40000000`（精确匹配）** | 高位无符号整数乘 |
| **`quou`（硬件无符号除法）** | `quou a2, a3, a4` (`100000 / 7`) | **`0x000037cd` (`14285`)** | 消除 32 轮软件长除循环 |
| **`sext`（符号扩展）** | `sext a2, a3, 7` (`0xff`) | **`0xffffffff` (`-1`)** | 优化 `int8 → int16` 解包装填 |
| **`clamps`（饱和钳位）** | `.byte 0x00, 0x23, 0x33` (`±200, 7`) | **`0x0000007f` / `0xffffff80`** | 单条完成 `[-128, 127]` 钳位 |
| `ER 0x110000` (`IDMA_REG_SETTINGS`) | `rer` 外部寄存器空间 | **`0x000000cc`**（未异常） | 确认 Xtensa iDMA 控制寄存器块在位 |
| `ACCLO` (`MAC16`) / 标量 `FPU` / 硬件 `loop` | `rsr.acclo` / `add.s` / `loop` | **全部 `UNSUPPORTED`（捕获异常）** | 彻底排除幻想，明确内层优化边界 |

结论非常干脆：联发科在 `MVPU6_0226` 里裁掉了 `MAC16`、`FPU` 和零开销 `loop` 寄存器组，**却完整保留了全套 32-bit 上位乘法 (`mulsh`/`muluh`/`mull`)、硬件除法 (`quou`/`quos`)、`sext`、`min`/`max` 与 `clamps`**。而开源 GCC 之所以迟迟没用上它们，是因为 `sample_controller` 这套通用目标既不主动发射 `mulsh`/`quou`，连它的 `as` 汇编器都不认 `mulsh`/`clamps` 助记符。

---

## 2. 两次实测翻车教训：GCC LRA 寄存器覆盖与 25 次栈溢出

在解锁这些硬件指令并向极致压榨周期的过程中，真机测试直接抓出了两个极隐蔽的编译器坑：

### 坑一：`register __asm__("a2")` 在 4× 展开循环中遭 GCC LRA 静默重分配
因为 `xtensa-sample_controller_zephyr-elf-as` 不认 `mulsh`/`clamps` 助记符，我们最早按常见裸机套路用 `.byte` 写内联函数，并以局部变量 `register int32_t r __asm__("a2")` 绑定寄存器。

然而上线一跑 `test_daemons.py`，虽然 `MobileNetV1` 测试顺利通过，Core 0 `VP6AudioVAD` 的 **80 Hz 交流工频抗干扰单元测试当场失败**（`score = 0.456`，阈值要求 `< 0.45`）。用 Python 精确对照一拍，发现启用了 ReLU 的 `GEMM_I8` 出现了大量 `-100484 → 1`、`124089 → 0` 的错值！

反汇编 `requant_row_i32_to_i8` 瞬间真相大白：当 `-O3` 把逐元素重缩放循环 **4 路展开** 时，GCC 的本地寄存器分配器（LRA）为了给相邻展开槽腾寄存器，**完全无视了 `register __asm__("a2")` 约束**——把第一路输出写进 `a2` 的 `.byte` (`clamps`) 结果丢在原地，紧接着下一条指令又误读取未被更新的 `a9`/`a10`，甚至被下一路的 `.byte` (`mulsh`) 直接覆写掉 `a2`！

**根治办法**：
1. 放弃用固定硬寄存器封装单指令 `clamps`，改回编译器原生认识的 `max` + `min`（在循环外将 `-128`/`127` 提至寄存器，同样仅需 2 个周期且零寄存器约束冲突）；
2. 内联 `hw_mulsh()` 时显式声明输出早破坏 `"=&a"` 与 `"a2", "a3", "a4"` clobber 列表（并在热路径汇编内核里彻底写死寄存器分配）。改完后 `80 Hz AC hum` 得分直接归 **`0.000`**。

### 坑二：从 `71.8M` 反弹回 `89.5M`——揭穿 `per_ch` 重缩放与 DW3×3 栈溢出
第一版调整 `requant_row_i32_to_i8_per_ch`（改成单循环 `word |= b << (lane << 3)` 动态字节打包，想省掉 C 层 4 份展开膨胀）并加上动态 GEMM 分块后，`GEMM_I8 64×64×64` 立刻冲到了 `1.54M` 周期，可 **Core 1 的两张 CNN 却集体重度倒退**：
- `person_detect.tflite`：`71.76M → 89.50M` 周期（**`+76.5` 周期/输出元素**）
- `VP6SpatialDepthNetRGB`：`39.48M → 50.46M` 周期（**`+72.0` 周期/输出元素**）

做完分层剖面 + 反汇编 `run_conv2d_i8_core`，一下子揪出两个真凶：
1. **动态位打包重缩放太重**：`person_detect` 有 `231,554` 次逐通道重缩放，`DepthNetRGB` 有 `152,784` 次。`lane = c & 3; ssa8b + sll + bnall` 外加循环内从 TCM 栈帧反复重载 `act_max` (`l32i a9, a1, 64`)，每元素平白烧掉几十个周期。
2. **GCC 在 `DEPTHWISE_CONV2D_I8` 3×3 内层里产生大量寄存器溢出**：`VP6SpatialDepthNetRGB` 的 4 层 DW3×3 加起来居然烧掉了 **约 `26M` 周期（`61–86 cycles/MAC`）**！打开 `objdump` 一看，`r0/r1/r2` 与 `f0/f1/f2` 共 6 路指针同时活跃超出了 Xtensa call0 可用寄存器上限，GCC 在每个输出通道上插了密密麻麻的 `s32i`/`l32i` 栈溢出（即使栈在 1-cycle TCM 上，也平白多出几十条访存与地址计算指令）。

---

## 3. Phase 3 终极优化：三把 `tcm_dot.S` 零溢出纯汇编手术刀 + `115 KiB` 动态 TCM 分块

既然找到精确瓶颈，我们在 [`firmware/tcm_dot.S`](https://github.com/Tinnci/mt8183-apu) 与 [`firmware/ops.c`](https://github.com/Tinnci/mt8183-apu) 中同时落地四项改进（整套 `.text` 体积反而压紧至 **`~36 KiB` (`0x8fba B`)**，稳稳锁在 L1 I-Cache 内）：

1. **纯汇编 `tcm_gemm_2x2_pair_asm`**：一次调用吞下完整一整行的 **所有偶数列对 (`bn_pairs`)**，省掉原先每 `2×2` 小块都要走一次的 `call0` 压栈/退栈开销，8× 展开内层 **0 栈溢出**、严格把 `l16si` 加载与 `mul16s` 乘、累加拆开。
2. **`115 KiB` 动态 GEMM TCM 分块**：原先固定 `TM=32, TN=32` 仅占用 `~38 KiB` TCM，剩下 `~80 KiB` 白白闲置；现在把下段 TCM 划出 **`64 KiB` (`B_tcm`) + `32 KiB` (`A_tcm`) + `16 KiB` (`C_tcm`)**，在 `k <= 256` 时动态拉大 `tn_max`（可达 `256`）与 `tm_max`（可达 `64`），直接减少 `2×–8×` 重复的输入矩阵 `A` 拆包次数；并在 `CONV2D_I8` 加入 **`in_c == 3` RGB 直读快速路径**。
3. **纯汇编 `tcm_dw1x3_row_asm`**：一次只处理 `1×3` 行片（`r0, r1, r2` 与 `f0, f1, f2` 共 6 个指针 + 读写累加指针 + 尾指针，精确卡满 15 个 call0 GPR 中的 **9 个指针 + 6 个暂存器**），4 路展开内层彻底消除所有 `s32i/l32i` 寄存器溢出，调用三次即完成完整 `3×3` 卷积累加。
4. **纯汇编 `requant_row_i32_to_i8_per_ch_asm` + `rshift >= 2` 免 `mull` 快速路径**：
   - 当量化右移 `rshift >= 2`（在 `VP6SpatialDepthNetRGB` 全部 **485** 个逐通道参数中占 **100%**，`rshift ∈ [5, 12]`）且输出累加值为非负时，低 32 位乘积会被彻底右移丢弃且不可能产生进位——直接省略 `hw_mull_u32()`，只发 1 条 `mulsh a2, a3, a4`！
   - 循环常驻 `a3=acc, a4=mult, a2=m_hi`，连 `mov.n` 搬运都全部省掉，配合硬件 `max` / `min` + `s8i` 零栈溢出完成。

---

## 4. 三阶段真机实测总表 (`MT8183 @ 525 MHz`)

所有数据均在同一台 **Lenovo Chromebook Duet (`google,krane-sku0`)** 上停掉后台互斥服务后单核无竞争实测，全部工作负载保持 **100% Bit-Exact（`max_err = 0`）**：

| 真实工作负载 | Phase 0/1 (I-Cache + TCM 基线) | Phase 2 (ISA 解锁 + C `-O3`) | **Phase 3 (`tcm_dot.S` + 动态分块)** | 综合提升幅度 |
|---|---|---|---|---|
| **`GEMM_I8` `64×64×64`** (Core 0, `262k MACs`) | `~8.3M cyc` / `17–26 ms` | `1,707,201 cyc` / `11.90 ms` | **`1,534,913 cyc` / `11.77 ms`** (`179.3 MOPS`) | **`5.41×`** (`5.85 cyc/MAC`) |
| **`VP6AudioVAD`** (Core 0, `160 ms` 语音帧) | `669k–675k cyc` | `671,590 cyc` / `25.37 ms` | **`670,072 cyc` / `25.32 ms`** (`23.90 ms` 测试流) | 远低于实时窗，误触发 `0.000` |
| **`microWakeWord` `alexa.tflite`** (Core 0, `30 ms` 块, `24k MACs`) | `~3.1M cyc` / `9.1–11.6 ms` | `1,794,454 cyc` | **`1,659,481 cyc` / `8.33 ms`** | **`-46.5%` VP6 周期 (`1.87×`)** |
| **`VP6SpatialDepthNetRGB`** (Core 1, `96×96×3`, `3.86M MACs`) | `45.8M cyc` / `87.2 ms` (`10.78 FPS`) | `39,484,278 cyc` / `83.90 ms` (`11.92 FPS`) | **`31,216,030 cyc` / `64.35 ms` (`15.54 FPS`)** | **`-31.8%` 周期 (`+44.2% FPS`)** |
| **`person_detect.tflite`** (`MobileNetV1 0.25×`, `7.16M MACs`) | `82.1M cyc` / `156.3–160.1 ms` | `71,762,158 cyc` / `140.3–144.0 ms` | **`59,772,180 cyc` / `118.85 ms`** (`person=0.9408`) | **`-27.2%` 周期 (`1.37×`)** |
| **`bench_nn.py`** (`8× CNN+MLP`) | `639.79 ms` (1C) / `333.29 ms` (2C) | `449.03 ms` (1C) / `265.30 ms` (2C) | **`3.54M cyc/帧` (`softmax err = 1.49e-09`)** | 单/双核均 bit-exact 通过 |

---

## 5. 架构问答：多出来的算力，意味着“更低延迟”还是“更大模型 + 更快推理”？

这是一个非常有价值的系统设计问题，答案**在两颗核上并不相同**，必须结合我们的层级别结构拆开算账：

### 1. 我们解锁的是“标量算力密度”和“非 MAC 开销”，不是新算子家族
先把能力边界说透：本次解锁的 `mulsh` / `quou` / `sext` / `clamps` 和 3 个纯汇编 TCM 微内核，扩展的是 **INT8 定点通用计算吞吐 (`10–96 MOPS → 125–179 MOPS`) 与硬件除法/重缩放效率**；但受限于 **缺少物理 FPU 与未开放的 512-bit TIE**，当前算子面依然专注 **全整型 INT8 CNN / MLP / 深度可分离卷积 / 平均池化 / 流式状态移位**，且最佳工作区仍需把单层峰值激活张量压在 **`<= 64 KiB`**（以吃满 `TCM_PINGPONG`）。

### 2. Core 0（音频流式推理）：几乎直接转化为“多任务并发空间”，而非单纯降延迟
看清两组观测数字：
- `alexa.tflite`（`30 ms` 块）只有 **`23,968` MACs**，它的 VP6 周期从 `~3.1M` 暴跌到 **`1.66M`**（`3.16 ms` 纯计算耗时 + ~`5 ms` 端到端 IPC/读取）；
- 即使每 `30 ms` 推理一次，当前 `microWakeWord` 在 Core 0 上也只占 **`~10.5%`** 算力余量（`1.66M / 15.75M` 周期预算）！
- **这意味着**：对于语音来说，`11 ms` 缩到 `8 ms` 体感区别不大，**真正的红利是“大模型 / 多模型同时常驻”**——你完全可以在 Core 0 的同一块 `30 ms` 帧周期内，在不突破 `30 ms` 实时线的前提下 **把多关键词并行（如双唤醒词 + 本地指令集）或 4–5× 更大的流式声音事件模型** 塞进同一个 Core 0。

### 3. Core 1（视觉在席与深度推理）：同模型“稳态低延迟”与“模型换代扩容”二选一兼得
看 Core 1 真机算力密度（已实测稳定在 **`~125–130 MOPS`** 整网效率）：
- **路线一：现有模型直接吃掉低延迟 / 高帧率**
  - `VP6SpatialDepthNetRGB` (`3.86M MACs`) 从 `87.2 ms` (`10.78 FPS`) 降到 **`64.35 ms` (`15.54 FPS`)**，已经逼近前置 `ov02a10` + Micro-ISP `~14 FPS` 上限，实时在席追踪几乎零等待；
  - `person_detect.tflite` (`7.16M MACs`) 从 `156–160 ms` 降到 **`118.85 ms`**，整个“入镜→屏幕点亮”闭环白赚 **`~40 ms`** 响应时间。
- **路线二：锁死旧延迟预算（`~87–156 ms`），直接把模型放大 `1.37×–1.47×` 甚至“更大模型依然更快”**
  - 按当前实测 **`8.0–8.4 cycles/MAC`** 整网成本反推：只要新模型满足 `max_act_bytes <= 64 KiB`（例如通过 `stride=2` 首层保持 `48×48×16 = 36 KiB`），你在 **`120 ms` 预算** 内可以容纳 **~`7.5M MACs`**（超过原先 `person_detect` 的容量，却比原先的 `156 ms` **快整整 37 ms**！）；
  - 在原先 `DepthNetRGB` 的 **`87 ms` 预算** 内，如今可以轻松塞进 **`~5.5M MACs`** 的更深主干或 **更高分辨率输入（如 `112×112`）**，比旧模型 **参数更厚、精度更高，推理依然比以前更快**！

### 4. 下一步如果继续榨干模型/固件还能改哪里？
- **FIRMWARE 侧的剩余免费金矿**：目前 `CONV2D_I8` 在调用通用 `im2col + gemm_i16_tcm_accum` 前，会在 `P_tcm` 做全字节零点减去拆包，且 `requant_row_i32_to_i8()`（非 per-channel）仍用 C 循环写字节；此外，`ER 0x110000` 探测已确认 **Xtensa iDMA 引擎就绪**，后续如果把 DRAM 权重/激活预取改造成真异步 double-buffer，还能继续消掉外部突发访存等待。
- **MODEL 侧的甜点配方**：在 MT8183 开源栈下，**`1×1 PW` 密集乘已经压到 `7.37 cycles/MAC`，而 `3×3 DW` 即使纯汇编之后仍在 `25–40 cycles/MAC` 左右**（通道并行度天生受限于单通道）。因此新模型设计时**减少过多小通道 `DWConv` 堆叠、适当使用 `3×3` 分组或把计算量往 `1×1 PW` / 宽通道汇聚**，可以在相同 MAC 预算下继续再榨出 **15%–25%** 的实际加速。

---

## 6. 把省出来的算力变现成混淆矩阵红利：级联多视角 TTA 实测

前面反复强调一点：**固件侧的 `mulsh`/`quou`/`tcm_dot.S` 优化是 100% 数值 bit-exact 的**。这意味着单张图送进去，吐出来的 softmax 概率与优化前一模一样——`person.bmp` 依然是 `0.9408`，`no_person.bmp` 依然是 `0.2711`，模型本身的表达力并不会因为跑得快而凭空长出来。

但**真实中控场景下用户最在乎的指标，优先级依次是什么？** 在 Home Assistant 墙面/桌面中控平板上，答案非常明确：
1. **第一优先级：FPR（低误唤醒 / 零幽灵点亮）与状态一致性**：无人看屏幕时因为阴影或噪点突然半夜自亮屏，或者在 `near/empty` 间反复横跳，对用户体验伤害最大；因此**高精度（低 FP）是底线约束**。
2. **第二优先级：FNR（低漏检 / 高 Recall）**：人走近想点操作时如果视而不见（漏检），要站着等 2 秒才亮屏会显得机器迟钝；而在门外远距离/半遮挡路过场景尽量检出则能提升 `presence` 在席感知完整度。
3. **第三优先级：门槛内延迟（Latency Envelope）**：一旦端到端耗时已压到人类交互阈值（`< 150–250 ms`）以内，再往下压 `30 ms` 的边际收益，**远远小于用这 `119 ms` 再加一重验证来干掉 False Positive / 挽救 False Negative**。

### 级联多视角确认 (`evaluate_multiview_presence` + `v4l2_cam_center_zoom_u8`)

正是因为 Phase 3 把 `person_detect.tflite` 单次推理从 `156 ms` 压到了 **`118.85 ms` (`59.77M` cyc)**，我们在 [`vp6_proximity.py`](https://github.com/Tinnci/mt8183-apu) 中正式上线了**仅在需要时触发的二级级联多视角推理**：
1. **清晰无人 (`raw_prob < 0.25`)**：直接返回 **1-pass (`118.85 ms`)**——空房间待机不仅没变慢，反而比优化前**更快了 `37 ms`**。
2. **高分候选触发水平镜像对抗验证 (`raw_prob >= 0.52` → `hflip_gray96` Pass 2)**：要求原图与水平翻转镜像同时达标（`Near Wake`: `avg >= 0.74` 且 `min >= 0.62`；`Far+`: `avg >= 0.56` 且 `min >= 0.44`）。只靠单侧纹理碰巧激活的非对称背景噪点会被瞬间过滤。
3. **灰区触发中心放大找回 (`0.25 <= raw_prob < 0.52` 且有运动 → C 端固定点双线性缩放 `v4l2_cam_center_zoom_u8` `frac=0.72` Pass 2)**：在 C 层 `< 0.5 ms` 完成中心放大 `96×96` 推理（`zoom >= 0.72`），专治远距小目标与下半身遮挡——而且硬性规定 Zoom 通道**只能断言 `far` 在席，永远不会直接触发 `near` 亮屏**，守住 `0%` 误亮屏底线。

在 `datasets/presence_synth/edge_real/` 全部 **300 张实拍边界退化样本 (`245 pos / 55 neg`)** 上的混淆矩阵前后实测对比：

| 策略与评估工作点 (`n = 300`) | TP | FP | FN | TN | Precision | Recall | **FPR (误报)** | F1 | 空房待机耗时 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **旧单次 `Near Wake` (`raw >= 0.78`)** | 105 | **4** | 140 | 51 | `96.3%` | `42.9%` | **`7.3%`** | `59.3%` | `156 ms` |
| **新级联 `Near Wake` (`HFlip avg>=0.74, min>=0.62`)** | **105** | **`0`** | 140 | **55** | **`100.0%`** | `42.9%` | **`0.0%`** | **`60.0%`** | **`118.85 ms`** |
| **旧单次 `Far+` 在席 (`raw >= 0.52`)** | 149 | **22** | 96 | 33 | `87.1%` | `60.8%` | **`40.0%`** | `71.6%` | `156 ms` |
| **新级联 `Far+` 在席 (`HFlip` 去误报 + `Zoom` 召回)** | **153** | **`11`** | **92** | **44** | **`93.3%`** | **`62.4%`** | **`20.0%`** | **`74.8%`** | **`118.85 ms`** |

- **`Near Wake` 误亮屏直接清零（`FP: 4 → 0`, `FPR: 7.3% → 0.0%`）**，且 Recall `42.9%` 一分未损；
- **`Far+` 在席检出误报腰斩（`FP: 22 → 11`, `FPR: 40.0% → 20.0%`）** 的同时还从 **`149 → 153` 找回了 4 个远距/半遮挡漏检样本**（`Recall: 60.8% → 62.4%`, `F1: 71.6% → 74.8%`），在真机 `ha` 上也已通过 `test_daemons.py` 与 24/7 健康巡检。

### 进一步把双核空闲余量变现到应用融合层

光靠多视角 TTA 镜像对齐还无法拦住所有干扰：比如室内对称的家具/摆件依然能通过 `HFlip` 检查成为静止背景误报（实拍难负例 `14_hard_negative_empty`）、曝光增益切换瞬间可能制造假运动分数、而语音侧的 Core 0 在跑完 `microWakeWord` 后仍有 **~74% 算力完全闲置**。因此我们继续在应用推理层落了两项零回退增压：

1. **Core 1 异构双模型空间深度融合 + 空房参考帧 + AE 跳变防抖 (`vp6_proximity.py`)**：
   - 利用 Phase 3 将 RGB 空间深度网络 `VP6SpatialDepthNetRGB` 从 `87.2 ms` 压到 **`59.5–64.35 ms`** 的实测余量，默认在候选/在席帧及 `10 s`  idle 心跳上按需运行（空房平稳待机仍保持 `118.85 ms` 1-pass）；真机 `test_daemons.py` 实拍空房一帧即可见其互补价值——当 `MobileNetV1` 给出 `person=0.6459` 临界误报时，`VP6SpatialDepthNetRGB` 仅用 `59.5 ms` 即判为 `spatial=empty(0.188)`。
   - **静态背景双保险否决 (`static_bg_veto`)**：用 NEON `motion_mad(gray96, bg_ref_gray96)` 对照慢更新空房参考帧（`1/16` 整数 EMA），仅当画面静止在背景参考附近（`bg_diff_mad < 5.5`）且空间网络同判为空（`spatial_prob < 0.25`）时才把未确认的 `far` 候选（`raw < 0.72`）压回 `empty`，保留真实走动/入座召回。
   - **米级深度边界精修 (`spatial_near_promote` / `spatial_far_holdback`)**：用单目深度修复 `person_detect` 与物理距离无关（`Pearson r = 0.042`）的痛点——低照度下仅达 `far`（`prob >= 0.56`）但深度落在 `0.25–1.05 m`（`spatial_prob >= 0.65`）时晋升为 `near` 亮屏；`person_prob < 0.80` 却远在 `>= 2.20 m` 时按住不误亮屏。
   - **AE 曝光跳变防抖 (`ae_guard`)**：自动曝光/增益调节后的下一帧自动屏蔽 `fast_wake` 并暂停更新空房参考，防止开灯/云层明暗变化被当作人体移动瞬间唤醒。
2. **Core 0 双级语音共振峰校验 (`microWakeWord + VP6AudioVAD` 共享 DRM 句柄，`vp6_vad_proxy.py`)**：
   - 在维持单一 DRM 设备句柄的前提下，把 `VP6AudioVAD`（Hann DFT + INT8 2-layer MLP，单次 **`671,999` cyc / ~`1.28 ms` VP6 纯计算**）挂载到 `VP6MicroWakeWord.apu` 上：平时以 `1 Hz` 慢速更新 16 频带背景噪底（占 Core 0 仅 `~0.13%`），当 `microWakeWord` 触发 `det_hit` 的毫秒级窗口内同步对最近 `160 ms`（`5120 B`）PCM 环形缓冲做一次共振峰复核（`should_veto_mww_detection`）。
   - 真机硅片验证可与 `microWakeWord` 零干扰共存：当 `vad_score < 0.30` 且唤醒概率低于轻声高置信直通阈值（`0.985`）时自动拦截（实测 `80 Hz` 空调低频嗡鸣 `score=0.000`、`5.2 kHz` 高频嘶声 `score=0.015`，正常语音共振峰 `score=1.000`）。

在真机 `ha` 上重新执行 `test_daemons.py` 与 24/7 健康巡检后，全部 Core 0 / Core 1 用例通过，`vp6-proximity.service`（`spatial=True, multiview=True`, `/run/user/10000/vp6-sensors.json` 实时输出 `spatial_zone` / `spatial_prob` / `depth_m`）与 `vp6-vad-proxy.service`（`vad_gate=True`, `/run/user/10000/vp6-vad.json` 实时输出 `vad_score` / `vetoed_detections`）均稳态在线，`ha_health.py` 返回 `OVERALL: HEALTHY`（`iommu_faults_since_boot: 0`）。

---

## 7. Phase 4 固件深挖 + 非 GPU 专用硬件 ASIC 实测（让 Mali-G72 专心留给 UI 动画）

在常驻监听/视觉在席这类 24/7 后台任务上，有一个比“盲目堆算力”更重要的系统边界：**绝对不把 `Mali-G72 MP3`（`/dev/dri/renderD128`）挪作常驻 AI 推理之用**——GPU 需要保持完全空闲，确保墙面中控触控切换与系统动画始终满帧顺滑。因此我们只继续挖掘两块“不抢 UI 资源”的硬件资产：**VP6 DSP 本身的 Phase 4 固件细节** 与 **片上专用固定功能媒体 ASIC**。

### 1. VP6 Phase 4 固件优化（实测真机 A/B 对照）

在 Phase 3 的基础上，我们在 [`tcm_dot.S`](https://github.com/Tinnci/mt8183-apu) 与 [`ops.c`](https://github.com/Tinnci/mt8183-apu) 中验证并保留了几项纯开源、数值 100% bit-exact（`max_err = 0`）的底层优化：
- **非 Per-Channel 纯汇编重标定（`requant_row_i32_to_i8_asm`）**：由于非 Per-Channel 算子的 `mult` / `rshift` / `round` 与 `SAR` 对整行保持不变，直接把这组移位常量全部提升（hoist）到循环外，并在 4 字节对齐 DRAM 输出时每 4 个结果拼成一次 `s32i` 突发写出。
- **独立 `CONV2D_I8` 输入上区 TCM 预摆渡 + 内点零点折叠（`run_conv2d_dense_tcm`）**：当外部直接调用 `APU_CMD_CONV2D_I8`（输入与输出都在 DRAM 且输入 `<= 128 KiB`）时，先用 32 字节突发循环将整张输入搬进闲置的上半区 `128 KiB` TCM（`0x7ff20000`），避免 `im2col` 从无 D-Cache 的 DRAM 反复按字节读取同一像素；同时当 `zp_filt == 0` 时在通道加载阶段预计算 `bias - zp_in * sum(W)`，所有非边界（interior）像素直接在 TCM 中做无零点减法的 `unpack_i8_raw`，并解包参数结构体避免编译器每层生成 60 余条 `l8ui` 拼装指令。
- **融合 3×3 深度卷积核（`tcm_dw3x3_pixel_asm`）**：将权重重排为 `[oc][9]`（放在 `0x7ff04000` 闲置间隙），以零栈溢出汇编按 2 通道并行一次扫完 `r0/r1/r2` 共 9 个采样点，消除原来 3 次调用 `tcm_dw1x3_row_asm` 对 `C_tcm` 的往返重载。
- **两个诚实的真机 A/B 教训（同样重要）**：
  1. 当我们尝试也在 `requant_row_i32_to_i8_per_ch_asm`（主要配合 `APU_GRAPH_FLAG_TCM_PINGPONG` 写回单周期 TCM）里逐元素拼 `s32i` 时，循环内多出的 14 条打包/分支指令反而让 `person_detect` 从 **`59.77M` 退步到 `64.74M`**——写回目标在单周期 TCM 时，1 条直接的 `s8i` 远胜复杂的寄存器字节拼装。
  2. 通过独立对照测得，`tcm_dw3x3_pixel_asm` 确实比 `tcm_dw1x3_row_asm` 在 `person_detect` 上实打实快出 **`~1.12M` cycles**（`59.95M → 61.08M` 反转验证）。

| 真机硅片工作负载（Phase 3 vs Phase 4） | Phase 3 实测 | Phase 4 实测 | 净变化 / 精度校验 |
| :--- | ---: | ---: | :--- |
| **`bench_nn.py` (`CONV2D + GEMM + Softmax`, Core 0)** | `3,544,722` cyc | **`2,938,520` cyc** | **`-17.1%`**（Core 1 **`-20.3%`**, 双核 **`1.90×`**, `max_err=1.49e-09`） |
| **`GEMM_I8 64×64×64` ReLU i8 (非 per-ch)** | `1,534,913` min cyc | **`1,436,273` min cyc** | **`-6.4%`**（`max_err = 0`） |
| **`VP6AudioVAD` (`160 ms` Core 0)** | `670,072` min cyc | **`667,177` cyc** | 微幅优化，80 Hz / 5.2 kHz / 语音全通过 |
| **`person_detect.tflite` (`7.16M MACs`, `person.bmp`)** | `59,772,180` cyc (`118.85 ms`) | **`59,705,852` cyc (`116.4 ms`)** | `0.9408` / `0.2711` bit-exact，`test_daemons.py` 全过 |
| **`VP6SpatialDepthNetRGB` (`3.86M MACs`)** | `64.35 ms` min | `64.72 ms` min (`15.45 FPS`) | 误差带持平（~`+0.37 ms`） |

### 2. Xtensa iDMA (`ER 0x110000`) 硅片寄存器边界实测

我们在 `hw_probe.c` 中对 `ER 0x110000..0x110020` 做了安全只读与受控 `CONTROL` 探测：
- `ER 0x110000..0x110020` 全段均可无异常访问（`0x110000 = 0x000000cc`，`0x04..0x20` 上电初值均为 `0`）；
- 向 `0x110010`（`NUM_DESC_INCR`）写入 `1` 确实会把 `0x11000c`（`NUM_DESC`）推进为 `1`，而连续写 `0..3` 到 `0x110014`（`CONTROL`）的回读序列为 `0x00010202`（其中 bit 1 为清零/复位位，会把队列清空并使 `curr_desc=0`）。但由于缺少 Cadence Xtensa iDMA 私有配置头（如使能与突发门控位/bus-bridge 定义），标准开源 1D 描述符在 `CONTROL = 1` 下仍未实际搬运数据到 TCM（`match/16 = 0`），因此我们已将其完整记录在案而未强行阻塞启动路径。

### 3. 零 GPU 固定功能媒体 ASIC 摸底与 `mtk-jpeg-enc` 实测（`userspace/bench_media_asic.c`）

对 `ha` 上已加载但闲置（`use count = 0`）的片上专用多媒体硬核（V4L2 M2M）做了实测：
- **`mtk-jpeg-enc`（`/dev/video8`，`jpeg-encoder@17030000`）**：**一次跑通且极致高速，完全不占 CPU / GPU**。由于 MediaTek JPEG 硬件引擎对 CAPTURE `bytesused` 做 DMA 突发对齐补零，扫描有效 JFIF 头尾（`0xFF 0xD8 ... 0xFF 0xD9`）校验后实测：
  - `320×240 YUYV → JPEG` (`q=85`, `7,869 B`)：平均 **`0.32–0.35 ms`**，最低 **`0.18 ms`**；
  - `640×480 YUYV → JPEG` (`q=85`, `27,775 B`)：平均 **`0.65–0.73 ms`**，最低 **`0.57 ms`**。
  （后续可零开销直接给 Home Assistant / 抓拍快照提供亚毫秒级硬编 JPEG，不再用 ARM CPU 软件压缩。）
- **`mtk-vcodec-enc`（`/dev/video9`）与 `mtk-vcodec-dec`（`/dev/video10`）**：确认均在内核在线就绪，编码支持 `H.264`（`160×128` 至 `1920×1088`）、解码支持 `S264 → MM21`。
- **`mtk-mdp3:m2m`（`/dev/video3`）**：V4L2 队列配置（`YUYV`/`RGB24`/`GREY`、旋转、HFlip、`S_SELECTION`）均返回成功且 M2M 在 `0.15–0.39 ms` 返回，但内核 `dmesg` 报告底层 SCP 侧拒绝处理（`VPU MDP failure:-22`, 输出全零 `cksum=0`），说明当前设备上的 `mediatek/mt8183/scp.img` MDP 任务参数协议仍需额外逆向适配，因此视觉预处理继续稳妥留给我们已跑在 `< 0.5 ms`（中心放大）与全 NEON 加速路径的 `libv4l2_cam.so`。

最终 `mtk-apu.service`、`vp6-proximity.service`、`vp6-vad-proxy.service` 与整机全部服务重新拉起，`ha_health.py` 返回 `OVERALL: HEALTHY`（`iommu_faults_since_boot: 0`）。
