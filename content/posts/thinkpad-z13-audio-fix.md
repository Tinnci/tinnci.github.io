---
title: Lenovo ThinkPad Z13 (Gen 1) Linux CS35L41 音频修复指南
date: 2026-01-05
slug: thinkpad-z13-audio-fix
featured: false
color: var(--accent-2)
category: Troubleshooting
tags:
  - Linux
  - ThinkPad
  - Audio
  - Kernel
  - ACPI
excerpt: 针对 Lenovo ThinkPad Z13 Gen 1 在 Linux 下扬声器无声问题的深度排查与修复流程总结。从固件缺失到 ACPI DSDT 修复的全过程。
---

我们要解决的是 **Lenovo ThinkPad Z13 Gen 1 (AMD) EVT** 在 Linux 下扬声器无声的问题。

整个过程跌宕起伏，从驱动缺失到 BIOS Bug，再到内核解析逻辑的坑，最后通过“降维打击”（扁平化配置）成功修复。以下是本次完整排查与修复流程总结。

## 1. 初步诊断：固件缺失 (The Firmware Issue)

**现象**：`dmesg` 报错 `Firmware missing`。

**原因**：`/lib/firmware/cirrus/` 下缺少针对 ThinkPad Z13 子系统 ID (`17aa:22f1`) 的固件文件。

**修复**：通过创建软链接，将 CachyOS 自带的通用 Halo 固件 (`halo_cspl_RAM...wmfw`) 指向 `17aa22f1.wmfw` 和 `.bin`。

**结果**：解决了固件找不到的问题，但驱动依然无法启动。

## 2. 核心阻碍 I：中断丢失 (The IRQ Issue)

**现象**：`dmesg` 报错 `CSC3551:00: error -ENXIO: IRQ index 0 not found`。

**原因**：联想 BIOS 的 ACPI DSDT 表中，将连接到放大器的 GPIO 引脚（Pin `0x0059`）定义为了 `GpioIo` (普通输入输出)，而 Linux 驱动要求它必须是 `GpioInt` (中断触发)。

**修复**：
1. 提取并反编译 DSDT (`iasl -d`)。
2. 修改代码，将 `GpioIo` 改为 `GpioInt (Edge, ActiveLow, ...)`。
3. 编译并打包为 `acpi_override`。
4. 配置 rEFInd 在启动时加载此覆盖文件。

**结果**：报错消失，内核显示 `Instantiated 2 I2C devices`。硬件“通电”了。

## 3. 核心阻碍 II：属性解析失败 (The Property Issue)

**现象**：驱动加载了，但报错 `error -EINVAL (-22): Platform not supported` 和 `Failed property cirrus,dev-index`。

**弯路**：
- 我们最初尝试按照 ACPI 规范，构建 **分层结构 (Hierarchical)**：`_DSD -> AMP0 -> 属性`。
- 我们怀疑是数据类型问题，尝试将 `Integer 0` 改为 `0x00000000` 甚至 `Buffer` 来绕过编译器优化。

**结果**：依然报 `-22` 或 `-19`。原因是 Linux 的 `cs35l41` I2C 驱动并不支持这种分层写法。

## 4. 终极方案：扁平化配置 (The Flat Config)

**启示**：对于 ThinkPad Z13 这种 I2C 连接的设备，内核驱动倾向于通过 I2C 物理地址 (`0x40`, `0x41`) 直接匹配，而不是通过逻辑索引。

**修复关键**：
- 放弃 `AMP0`/`AMP1` 子节点结构。
- 在 `_DSD` 中直接定义属性数组，使用 **扁平结构**。
- 关键属性 `cirrus,dev-index` 被设定为 `Package() { 0x40, 0x41 }`。

---

## 🛠️ 快速修复步骤指南

### 1. 准备环境
```bash
sudo pacman -S iasl cpio  # Arch/Manjaro/CachyOS
# sudo apt install acpica-tools cpio  # Debian/Ubuntu
mkdir -p ~/acpi_fix && cd ~/acpi_fix
```

### 2. 提取并反编译 DSDT
```bash
sudo cat /sys/firmware/acpi/tables/DSDT > dsdt.dat
iasl -d dsdt.dat  # 生成 dsdt.dsl
```

### 3. 构建正确的平面 _DSD 块
在 `Device (SPKR)` 内部，替换原有 `_DSD` 为以下结构：

```asl
Name (_DSD, Package ()  // _DSD: Device-Specific Data
{
    ToUUID ("daffd814-6eba-4d8c-8a91-bc9bbf4aa301"),
    Package ()
    {
        Package () { "cirrus,dev-index", Package () { 0x40, 0x41 } },
        Package () { "reset-gpios", Package () {
            SPKR, Zero, Zero, Zero,
            SPKR, Zero, Zero, Zero
        } },
        Package () { "cirrus,speaker-position", Package () { Zero, One } },
        Package () { "cirrus,gpio1-func", Package () { One, One } },
        Package () { "cirrus,gpio2-func", Package () { 0x02, 0x02 } },
        Package () { "cirrus,boost-type", Package () { One, One } }
    }
})
```

### 4. 编译并打包
```bash
iasl -oa -tc dsdt.dsl
mkdir -p kernel/firmware/acpi
cp dsdt.aml kernel/firmware/acpi/dsdt.aml
find kernel | cpio -H newc --create > acpi_override
```

### 5. 重启验证
成功标志：
```text
[    6.782481] cs35l41-hda i2c-CSC3551:00-cs35l41-hda.0: Cirrus Logic CS35L41 (35a40), Revision: B2
[    7.730736] cs35l41-hda i2c-CSC3551:00-cs35l41-hda.0: Firmware Loaded - Type: spk-prot, Gain: 16
[    7.731065] cs35l41-hda i2c-CSC3551:00-cs35l41-hda.0: CS35L41 Bound - SSID: 17AA22F1
```

**声音恢复！🎸**
