---
title: 把 Inkling 2 Mini 搬上 Snapdragon X Elite NPU（四）：CPU、Vulkan 与 OpenCL 三方实测
date: 2026-11-21
slug: inkling-2-mini-cpu-gpu-vulkan-opencl
featured: false
color: var(--accent-2)
category: AI Systems
series: Inkling 2 Mini on Snapdragon X Elite NPU
seriesOrder: 4
tags:
  - Inkling 2 Mini
  - Vulkan
  - OpenCL
  - Adreno
  - llama.cpp
  - 基准测试
excerpt: NPU 被签名挡在门外之后，退而求其次把 Inkling 2 Mini 跑在 CPU 与两个 GPU 后端上。结果有点反直觉：最好的 GPU 方案在生成上只和 CPU 打平，在 prefill 上落后十倍。
---

第三节我们停在"NPU 不可用"这一格。这一篇把模型放到还能用的地方——CPU、Vulkan、OpenCL——看看它到底能跑多快，以及为什么 GPU 这次帮不上忙。

用的模型是 **Inkling-2-Mini-UD-Q2_K_XL**（8.50 GiB，26.07B 参数，Q2_K）。选 Q2 是为了先把"能跑"这件事跑通，而 17.6 GB 的 Q4_K_XL 在这台 32 GB 的机器上需要 18 GB 以上连续空闲内存，首轮不适合。

---

## 1. 构建矩阵

| 变体 | 编译器 | 后端 | 用途 |
| :--- | :--- | :--- | :--- |
| build-cpu | MSVC 19.44 | CPU | 对照组 |
| build-npu | clang 23.1.5 | CPU + OpenCL + Hexagon | 主力构建 |
| build-vk | clang 23.1.5 | Vulkan | 本篇新增 |

关键的两个踩坑点：

**编译器必须用 clang。** 上游的 Hexagon 后端头文件里用了 `__fp16`、`__builtin_ctz`，MSVC 不认识——必须先过 clang 这一关，后面的 NPU 才谈得上。顺带发现，这同时影响 CPU 性能（见下文）。

**Vulkan 后端需要 SDK。** llama.cpp 在**编译期**就要 Vulkan 头文件、`vulkan-1.lib` 和 `glslc`（把 kernel 编成 SPIR-V）。Windows SDK 里不带这些，必须装 LunarG 的 Vulkan SDK（本篇用的是 1.4.363.0）。

还差一个隐蔽的运行时依赖：clang 编出来的 DLL 会静态依赖 `libomp140.aarch64.dll`，缺了会报 `0xC0000135`（进程起不来），而这个 DLL 只随 VS/GenieX 一起发。

---

## 2. 测量方法

统一用 `llama-bench`，参数 `-p 32 -n 16 -r 2 -t 12`（除注明外）。`-r 2` 是必要的——单次测量的方差能到 ±30%。

Vulkan 的设备信息很关键：

```text
Qualcomm(R) Adreno(TM) X1-85 GPU | uma: 1 | rebar: 1 | fp16: 1 | bf16: 0 | fp4: 0
warp size: 64 | shared memory: 32768 | int dot: 1 | matrix cores: none
```

`matrix cores: none` 和 `uma: 1` 这两个字段解释了后面所有现象。

---

## 3. 实测结果

| 后端 | 编译 | 提示处理 | 生成 | 备注 |
| :--- | :--- | ---: | ---: | :--- |
| **CPU** | clang | **25.6 t/s**（pp32） | **9.5 t/s**（tg16） | 12 线程 |
| CPU | MSVC | 7.4 t/s（pp32） | 3.6 t/s（tg8） | 同代码，仅换编译器 |
| **Vulkan** | clang | 2.4 t/s（pp32） | 6.9 t/s（tg16） | 8.5 GB 正常载入 |
| OpenCL | clang | ~5.0 t/s（pp8） | 3.4 t/s（tg4） | 参数不同，仅供参考 |

补一句方差：CPU 的 tg16 在三次重复下是 6.2 ± 0.8，另一次是 9.5 ± 1.5。同一份二进制、同一台机器，波动接近 50%，所以表里的数字只适合看量级，不适合做小数点级别的比较。

---

## 4. 三个结论

### 一、编译器比硬件选择影响还大

同一份 C++ 代码、同一个 CPU、同样的线程数：

```text
clang 23.1.5  (-march=armv8.7-a -fvectorize) : pp 25.6 t/s, tg 9.5 t/s
MSVC 19.44    (GGML_NATIVE=ON)               : pp  7.4 t/s, tg 3.6 t/s
```

**差 2.6 倍**。原因是 MSVC 在 ARM64 上不会为量化的点积生成 dot-product / i8mm 指令，Q2_K 的反量化乘加只能走通用路径。

这个结论有普遍性：任何在 Windows ARM64 上做量化推理的基准，如果用的是 MSVC 构建，数字都可能是被严重低估的。之前那篇 gemma 的 CPU 数据（8.9 t/s）就是 GenieX 官方 MSVC 构建，大概率偏慢。

### 二、Vulkan 是三个 GPU 后端里最好的，但只在生成上

```text
生成 (tg) : Vulkan 6.9  ≈  CPU 9.5  >  OpenCL 3.4
提示 (pp) : CPU 25.6  >>  OpenCL 5.0  >  Vulkan 2.4
```

Vulkan 的生成速度已经逼近 CPU，比 OpenCL 快一倍；但 **prefill 慢十倍**，只有 2.4 t/s。

原因就藏在设备信息里：

- `matrix cores: none`——Adreno 没暴露矩阵加速单元，prefill 这种计算密集的大批量 GEMM 只能走通用 ALU
- `fp4: 0 / bf16: 0`——Q2_K 的反量化在 shader 里是标量循环，没法向量化

decode 是带宽密集型，Adreno 和 CPU 共用同一块 LPDDR5x，所以还能打平；prefill 是算力密集型，这里直接崩盘。

### 三、GPU 的价值在"能不能装下"，不在"快不快"

一个实测出来的内存边界：

| 后端 | 模型体积 | 结果 |
| :--- | :--- | :--- |
| OpenCL | 13.45 GB（gemma Q4_0） | `GGML_ASSERT: printf device buffer alloc failed`，直接 abort |
| OpenCL | 8.50 GB（Inkling Q2_K） | 能跑，3.4 t/s |
| Vulkan | 8.50 GB | 正常，6.9 t/s，无内存告警 |

Vulkan 在内存分配上比 OpenCL 宽松（支持 host-visible 内存、内存类型更灵活），所以**同样一台机器，Vulkan 能装下的模型比 OpenCL 大**。如果哪天要跑 13 GB 以上的模型，Vulkan 可能是唯一能过线的 GPU 路径。

---

## 5. 为什么 GPU 这次帮不上忙

把数字换算成带宽就看得很清楚了。

Inkling 2 Mini 激活 3.4B 参数，Q2 量化每 token 约读取 **1.7 GB** 权重。9.5 t/s 对应有效带宽约 **16 GB/s**，而 X Elite 的 LPDDR5x 理论带宽是 135 GB/s——**只用到 12%**。

这说明瓶颈不只是带宽，还有反量化开销和循环三遍的调度。但无论瓶颈具体在哪，Adreno 和 CPU 用的是同一块内存，**GPU 并不会凭空变出带宽**。它的优势在并行算力，而 decode 阶段根本没有足够多的并行计算来喂饱它。

---

## 6. 选型建议

| 场景 | 推荐 | 理由 |
| :--- | :--- | :--- |
| 短提示、长生成（对话、代码补全） | Vulkan 或 CPU | 两者 tg 接近，Vulkan 不占 CPU |
| 长文档、长上下文（RAG、整篇分析） | **必须 CPU** | Vulkan prefill 2.4 t/s，长文档会等到无法接受 |
| 追求最快 | clang 编译的 CPU 版 | pp 和 tg 都最优 |
| 模型 > 10 GB | Vulkan（如果能装下） | OpenCL 会在分配阶段崩 |

---

## 7. 复现命令

```powershell
$m = "C:\models\inkling2mini\Inkling-2-Mini-UD-Q2_K_XL.gguf"

# CPU（clang 构建，最快）
& "C:\Users\shiso\dev\llama-inkling\build-npu\bin\llama-bench.exe" `
  -m $m -dev none -p 32 -n 16 -r 3 -t 12

# Vulkan
& "C:\Users\shiso\dev\llama-inkling\build-vk\bin\llama-bench.exe" `
  -m $m -ngl 99 -p 32 -n 16 -r 2

# OpenCL
& "C:\Users\shiso\dev\llama-inkling\build-cpu\bin\llama-bench.exe" `
  -m $m -ngl 99 -p 32 -n 8 -r 2 -t 12
```

---

## 8. 这一轮的结论

**在这台机器上，GPU 对这类量化 MoE 模型的帮助接近于零。** 最好的 GPU 方案在生成上和 CPU 打平、在 prefill 上落后十倍，唯一的优势是内存分配更宽松、能把更大的模型装进去。

真正能改变这个局面的仍然是 NPU——HMX 矩阵单元理论上能把 prefill 拉起来一个数量级。可惜它卡在签名和协议两道门上，也就是第三节说的那件事。

所以现在的现实是：**Inkling 2 Mini 在 Snapdragon X Elite 上能跑，CPU 约 9.5 tok/s，Vulkan 约 6.9 tok/s，NPU 不可用。** 这个数字放在 26B 参数、3.4B 激活的模型上不算难看，但它清楚地说明：没有可用的 NPU，这台机器的 AI 算力只发挥了一半不到。
