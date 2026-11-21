---
title: 把 Inkling 2 Mini 搬上 Snapdragon X Elite NPU（二）：dense 与 MoE 的实际分工边界
date: 2026-11-21
slug: snapdragon-x-elite-dense-vs-moe-boundary
featured: false
color: var(--accent-2)
category: AI Systems
series: Inkling 2 Mini on Snapdragon X Elite NPU
seriesOrder: 2
tags:
  - Snapdragon X Elite
  - Hexagon NPU
  - Adreno GPU
  - GenieX
  - MoE
  - 基准测试
excerpt: 在同一台 Snapdragon X Elite 上对 0.6B dense、8B dense（QNN 与 GGUF 两种形态）和 26B MoE 做 CPU / GPU / NPU / hybrid 四路对照，得出 dense 归 CPU、MoE 归 NPU 的分工边界，并记录 GPU 崩溃与 hybrid 失效的现场。
---

上一篇得出一个反直觉的结论：本机 NPU 对 MoE 有专门优化，却跑不了 NVFP4。那么**实际上这台机器的 NPU 到底该跑什么**？

这一篇用同一台机器、同一套 GenieX 版本，把 dense 与 MoE 在 CPU / GPU / NPU / hybrid 四条路径上跑一遍，给出可复用的选型规则。

---

## 1. 测试台

| 项目 | 配置 |
| :--- | :--- |
| 设备 | Snapdragon X Elite CRD（HTP v73） |
| 内存 | 31.6 GB LPDDR5x |
| 系统 | Windows 11 ARM64 |
| 运行时 | GenieX CLI v0.11.0 / QAIRT 2.50 / llama.cpp `93cf736` |
| 后端 | ggml-cpu、ggml-opencl（Adreno）、ggml-hexagon（HTP v73）、qairt（QNN HTP） |

三个被测模型：

- **Qwen3-0.6B Q4_0**（dense，364 MiB）——小模型基准
- **Qwen3-8B** 两种形态：`qualcomm/Qwen3-8B`（**QNN 预编译 w4a16**，5.2 GiB）与自行拉取的 **Q4_K_M GGUF**（4.7 GiB）——同一模型、两条运行栈，用来隔离"QNN 编译"与"ggml 运行期反量化"的差价
- **gemma-4-26B-A4B**（**26B MoE / 4B 激活**，Q4_0，13.45 GiB）——与 Inkling 2 Mini 同量级的探针

---

## 2. 实测矩阵

单位 tok/s。单次运行、未预热；`max-tokens` 8-32，`nctx` 512-2048。

| 模型 | 结构 | CPU | GPU | NPU | hybrid | QNN 编译版 |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: |
| Qwen3-0.6B Q4_0 | 0.6B dense | 99.2 | 69.0 | 75.1 | 69.8 | — |
| Qwen3-8B Q4_K_M | 8B dense | **13.7** | 10.0 | 7.0 | 8.6\* | **14.0** |
| gemma-4-26B-A4B Q4_0 | 26B MoE / 4B 激活 | 8.9 | 崩溃 | **14.0** | 卡死 | — |

\* 8B 的 hybrid 在 5-16 token 处报 `SDKError(Text generation failed)`；26B 的 hybrid 在 9 GB 常驻后陷入分页，242 秒无输出后终止。

**注意：8B 这一行的模型是从 Hugging Face 自行导入的 GGUF，实测输出是退化的（见 4.4 节），因此该行只代表吞吐量，不能作为质量依据。QNN 编译版（14.0）输出正常。**

---

## 3. 三条边界

### 边界一：1B 以下没有调度价值

0.6B 三个后端全在 69-99 tok/s，差距来自启动开销而非算力。CPU 99.2 甚至最高。这个量级随便选。

### 边界二：8B dense 归 CPU，NPU 反而最慢

**13.7（CPU）> 10.0（GPU）> 7.0（NPU）**。

原因是 ggml-hexagon 对每个 token 都要把 q4_k 权重按 tile 反量化成 fp16 再喂 HMX，等效访存量翻倍，还多一层转换开销。8B dense 每 token 必须把 4.7 GB 权重全读一遍，这个惩罚是致命的。

**同一模型走 QNN 预编译（w4a16）能到 14.0 tok/s，正好是 ggml-HTP 路径的两倍。** 这个 2× 就是「编译期把权重排好」与「运行期临时反量化」的差价。

### 边界三：MoE 反转，NPU 快 1.6 倍

26B MoE 只激活 4B，每 token 触碰的权重量骤降，CPU 的带宽劣势被放大到极致（8.9 tok/s），而 HMX 的 `hmx_mm_id_2d_f32` 专家分组 GEMM 正好吃到红利（14.0 tok/s）。

这也解释了为什么 26B MoE 的 NPU 数字（14.0）反而高于 8B dense 的 NPU 数字（7.0）——**激活参数量而非总参数量，才是 NPU 路径的决定因素**。

---

## 4. 异常现场

### Adreno 在 26B 上直接 abort

```text
🌍loading model...
Could not allocate enough memory for the printf device buffer.
C:/a/GenieX/GenieX/third-party/llama.cpp/ggml/src/ggml-opencl/ggml-opencl.cpp:15748:
GGML_ASSERT(0) failed
fatal: backend aborted (SIGABRT)
```

Adreno 走共享内存，OpenCL 后端连 printf 缓冲都分配不出来就 assert 了。8B 时还能跑（10.0），到 26B 直接过线。**GPU 路径在 20 GB 级模型上不可用。**

### hybrid 模式目前是坏的

26B 上必卡，且卡点非常稳定：工作集停在 **9.0 GB**（私有内存 7.2 GB）不再增长，CPU 满载空转（实测 12 秒墙钟烧掉 118 秒 CPU 时间，约 10 核并行），日志最后一行固定停在 `threadpool attached`，之后再无任何输出。四次复现分别是 72 / 150 / 242 / 316 秒被动终止，而同样是这个模型走纯 NPU 只要 **44.8 秒**。

关掉睡眠、留出 15 GB 以上空闲内存后仍然照旧，所以不是电源也不是内存，而是 hybrid 路径在这个 26B VLM 上自己的问题（卡点早于 mmproj 加载，加 `--vit-compute CPU` 也一样卡在同处）。

8B 上则时好时坏：一次跑完 16 token，一次在 5 token 处 `SDKError(Text generation failed)`。**原版 v0.11.0 的 hybrid 不要放进生产路径。**

### 换一个运行时，hybrid 就正常了

上面的结论只对**官方原版（LlamaCPP 基线 `93cf736`）**成立。换成自建的 fork（`c400d3b`，带 PR #24423 移植与 NPU 侧 `.*_exps` CPU 回退保护）后，同一个 26B 模型、同样参数：

| 运行时 | hybrid | 纯 NPU |
| :--- | :--- | :--- |
| 官方 `93cf736` | **>90 秒无输出（必卡）** | 13.7 tok/s |
| 自建 `c400d3b` | **30.9 秒完成，16.3 tok/s** | 12.8 tok/s |

fork 下 hybrid 不但不卡，还比纯 NPU 略快（16.3 vs 12.8）。原因不难理解：`exps`（MoE 专家）回退保护正是针对专家层跨设备切分的，恰好命中原版卡死的那条路径。

反过来，**8B GGUF 的输出塌陷在两个运行时下完全一致**（同一串 `confirmationstrokestrokeách…`），说明那是模型/加载层的问题，跟运行时分支无关。

这条差异很重要：**同一台机器、同一个模型，仅换运行时就能把"hybrid 不可用"变成"hybrid 最快"**，所以任何性能结论都必须标注运行时 commit。

顺带一提，这几个症状不是本机独有。[GenieX#1690](https://github.com/qualcomm/GenieX/issues/1690) 与 [#1691](https://github.com/qualcomm/GenieX/issues/1691) 在 Snapdragon X2 Elite 上记录了几乎一样的东西：`host buffer exceeds max_vmem`、`hybrid` 永不完成、崩溃后必须重启才能重新打开 HTP session。所以本篇的 26B 结论（9 GB 卡死、hybrid 不可用）可以和上游 issue 对照着看，不是环境问题。

### 8B GGUF 的输出是退化的

8B 这一行的数据有个必须交代的问题：**输出是退化的**。

用 HF 自行导入的两份 GGUF 做过对照——Qwen3-8B Q4_K_M 与 Llama-3.1-8B-Instruct Q4_K_M，贪心解码（`--temperature 0.1 --top-k 1`）下都是同一个症状：连续吐出 16 个 `!`，也就是 token id 0，logits 完全塌陷。

为了排除量化格式的嫌疑，又拉了 Llama-3.1-8B 的 **Q4_0** 版本做对照，结果一样是 `!!!!!!!!!!!!!!!!`。所以问题不在 Q4_K_M 与 Q4_0 的差别。

对照之下，**Qualcomm AI Hub 直接分发的 GGUF 是正常的**：Qwen3-0.6B Q4_0 能输出完整推理过程（"Okay, so the user is asking..."），gemma-4-26B-A4B Q4_0 也能正常回 "Hello!"。同一个 GenieX、同一台机器、同样走 llama_cpp 插件。

为了定位，又做了三步排除：

1. **注册链路不是原因**：把 AI Hub 那份已知正常的 Qwen3-0.6B GGUF 复制到自建目录、手写同样的 `geniex.json`，输出完全正常。手工注册这条路本身没问题。
2. **不是 CPU 路径的锅**：同一份 Llama-3.1-8B 换成 `-c npu` 跑，7.1 tok/s，输出全是替换字符 `��������`，照样退化。
3. **不是 GGUF 版本差异**：四个文件的头部都是 `GGUF version=3`，正常与异常两组一致。

所以问题落在**这两个 HF 来源的 8B GGUF 本身**——同一运行时吃 AI Hub 的产物没事，吃它们就是塌的。根因尚未定位（可能是权重布局、张量命名或元数据上的某个差异），但工程上的结论已经够用：**HF 裸 GGUF 在这套运行时下必须先用已知正常的样本验一遍**，别直接拿来做基准。

这意味着 8B 那一行的 tok/s 只能当作"计算路径吞吐"参考，不能用来比较输出质量。要做 8B 的质量结论，只能用 AI Hub 分发的产物（本机的 QNN 版 8B 就是正常的）。

### 关于"卡死"的澄清

第一次尝试 26B MoE 时进程卡在驱动里、`taskkill` 报"没有运行实例"但 WMI 仍显示 15 GB 常驻、整机只剩 1 GB 可用内存。当时判断是 NPU 驱动 bug。

重启后留出 15 GB 空闲内存，**同一模型、同一条 NPU 路径 49 秒跑完，14.0 tok/s**。所以那不是驱动缺陷，是内存不足导致的假死——**26B 级 Q4 模型需要 14 GB 以上连续空闲内存**，开着 Chrome/飞书只剩 12-15 GB，很容易踩到。

### 复测：睡眠是不是元凶？

一度怀疑是机器进入睡眠打断了长任务。查事件日志后确认怀疑有理：本机 **Modern Standby 交流电超时是 300 秒**，而整个测试期间日志里密集记录着待机进出（11:18、11:23、11:25、11:32 各有一次 `Kernel-Power 506/507`），确实有几次正好落在长任务中间。

所以做了一组对照——先把睡眠彻底关掉（`powercfg /change standby-timeout-ac 0`，显示器同理），然后复测三个失败场景：

| 场景 | 关闭睡眠后 | 结论 |
| :--- | :--- | :--- |
| 26B MoE · NPU · 默认 `nctx 4096`（最初"卡死"的那条） | 44.8 秒完成，**13.7 tok/s** | 恢复正常，与睡眠无关 |
| 26B MoE · hybrid | 仍卡在 9 GB 常驻，**316 秒零输出** | 睡眠无关，稳定复现 |
| 26B MoE · GPU | 仍然 abort：`q6_K set_tensor: temp upload buffer alloc failed` | 睡眠无关，稳定复现 |

**结论：睡眠是真实存在的干扰项，但不是这三次失败的原因。** NPU 那次是内存不足，hybrid 与 GPU 是各自独立的问题，关掉睡眠后全部原样复现。

### 第二次睡眠：只关待机超时还不够

随后又踩了一次：测试中途机器再次进入 Modern Standby（`11:57:31` 进、`11:59:03` 出，共 92 秒），恰好夹在一次 8B 推理中间。那次运行的读数直接变成 **0.3 tok/s**，输出也碎成乱码——同一条命令在正常状态下的读数是 6-13 tok/s。**这证明睡眠不只打断任务，还会污染测量结果。**

原因是我只改了交流电待机超时，而合盖动作、直流电策略和现代待机的其他触发条件都还在。真正要压住它需要三件事一起做：

```powershell
# 1) 交流/直流待机与熄屏全部关闭
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
# 2) 合盖不睡眠（LIDACTION = 0）
powercfg /setacvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0
powercfg /setactive SCHEME_CURRENT
# 3) 持有唤醒锁（SetThreadExecutionState，无需管理员）
```

第 3 条用一个循环调用 `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED)` 的后台进程实现，比改电源计划更可靠。

**加上唤醒锁后再测 hybrid：整段窗口 0 次待机事件，仍然卡在 9 GB 无输出。** 所以 4.2 节关于 hybrid 的结论维持不变——它是运行时自身的问题，不是电源管理造成的。

顺带一个代价：如果只改 AC 超时，长任务期间仍会被睡眠偷袭，而**被睡眠打断的测量值看起来像是"模型很慢"**，非常容易误判。

---

## 5. 参数的真实语义

**`-c` 对 qairt 模型是空操作。** `qualcomm/Qwen3-8B` 是 QNN 预编译二进制，计算单元在编译期焊死在 HTP 上：不加 `-c` 是 14.0，`-c hybrid` 是 14.1，`-c cpu` 也一样。**要比较 CPU/GPU/NPU，必须用 `PluginId=llama_cpp` 的 GGUF**——这也是本文额外拉一份 Qwen3-8B Q4_K_M 的原因。

**`--vit-compute` 对纯文本模型静默无效。** 在 Qwen3-8B 上写 `--vit-compute HTP2` 不报错也不改变行为。它只在带 mmproj 的 VLM 上有意义，且需要真实图像输入才会触发视觉编码器。

---

## 6. 对 Inkling 2 Mini 的含义

| 结论 | 对移植的影响 |
| :--- | :--- |
| MoE 归 NPU（1.6×） | 26.4B/3.4B 的 Inkling 应当主攻 HTP 路径 |
| ggml-HTP 比 QNN 慢 2× | 说明运行期反量化是主要成本，路线 B 的瓦片复用有明确收益空间 |
| 循环三遍会放大读权重 | 不优化就是 3× 带宽惩罚，P4 的跨 pass 瓦片复用是刚需而非优化项 |
| 需要 14 GB+ 空闲内存 | 32 GB 机器必须先腾内存，否则复现假死 |

复现命令（Q4_K_M 已导入缓存，名称 `qualcomm/qwen3-8b-q4km`）：

```powershell
$g = "C:\Users\shiso\AppData\Local\GenieX CLI\geniex.exe"

& $g infer "qualcomm/qwen3-8b-q4km" -p "hi" --max-tokens 32 --think=false -c cpu  --nctx 2048
& $g infer "qualcomm/qwen3-8b-q4km" -p "hi" --max-tokens 32 --think=false -c npu  --nctx 2048
& $g infer "qualcomm/gemma-4-26B-A4B" -p "hi" --max-tokens 8  --think=false -c npu  --nctx 512
```

---

## 7. 一句话选型规则

> **激活参数小于 1B 随便选；dense 8B 用 CPU；MoE 且内存够 14 GB 用 NPU；GPU 只在 8B 以下、且不在乎比 CPU 慢的情况下考虑；hybrid 暂时禁用。**
