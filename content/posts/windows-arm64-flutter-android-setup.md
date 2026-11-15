---
title: Windows 11 ARM64 (Snapdragon X Elite) 原生 Flutter + Android SDK 配置与升级指南
date: 2026-11-15
slug: windows-arm64-flutter-android-setup
featured: false
color: var(--accent-1)
category: DevOps
tags:
  - Windows
  - ARM64
  - Flutter
  - Dart
  - Android
excerpt: 在 Snapdragon X Elite (Windows 11 ARM64) 上配置原生 ARM64 Flutter 3.50.0、Dart 3.14.0 与最新 Android SDK 的完整步骤，以及 Flutter 升级后如何重新切换回原生 ARM64。
---

在 **Windows 11 ARM64**（如 Snapdragon X Elite）上，Google 官方发布的 Flutter Windows 安装包（包括 `3.50.0`）默认仍打包 `x64` 版 Dart SDK 与预编译快照。但从 **Flutter 3.44.0** 起，官方存储桶已提供原生的 `windows-arm64` Dart SDK 与 Flutter Engine 二进制文件（详见 [`flutter/flutter#186730`](https://github.com/flutter/flutter/issues/186730#issuecomment-4573214964)）。

以下是本机（`Flutter 3.50.0` + `Dart 3.14.0 windows_arm64` + `Android SDK 37.0.0 / API 36`）的完整配置记录与升级恢复步骤。

---

## 1. 基础环境与路径约定

- **Flutter SDK**: `%LOCALAPPDATA%\Programs\flutter`
- **Android SDK (`ANDROID_HOME`)**: `%LOCALAPPDATA%\Android\Sdk`
- **JDK 21 (`JAVA_HOME`)**: `%LOCALAPPDATA%\Programs\jdk21`（Temurin OpenJDK 21.0.12.1 **原生 ARM64 `0xAA64`**）
- **Visual Studio**: Visual Studio 生成工具 2022 (`17.14.45`) + Windows 10/11 SDK (`10.0.26100.0`)

### User `PATH` 顺序

```text
%LOCALAPPDATA%\Programs\flutter\bin
%LOCALAPPDATA%\Android\Sdk\platform-tools
%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin
```

> **说明**：原生 ARM64 的 `java.exe` 会让 Gradle、`javac`、`kotlinc`、D8/R8 全部原生运行在 ARM64 上；Google 的 `android.exe`、`adb.exe`、`aapt2.exe` 目前仍为 `x64`，通过 Windows 11 Prism 转译透明运行。

---

## 2. 将 Flutter 切换为原生 ARM64（新装或重装必做）

官方压缩包解压后，由于 `bin\cache\engine-dart-sdk.stamp` 锁定了 `x64` 版本，且 `flutter_tools.snapshot` 是为 `x64` 预编译的，需要手动触发一次原生 ARM64 重建。

请在 **原生 ARM64 PowerShell**（默认即是，`$env:PROCESSOR_ARCHITECTURE` 应为 `ARM64`）中执行：

```powershell
$flutter = "$env:LOCALAPPDATA\Programs\flutter"

# 1. 移除 x64 Dart SDK 锁定标记
Remove-Item "$flutter\bin\cache\engine-dart-sdk.stamp" -Force -ErrorAction SilentlyContinue

# 2. 拉取原生 windows-arm64 Dart SDK
& "$flutter\bin\internal\update_dart_sdk.ps1"

# 3. 删除 x64 预编译的 flutter_tools 快照，强制使用 ARM64 Dart VM 重编
Remove-Item "$flutter\bin\cache\flutter_tools.snapshot", "$flutter\bin\cache\flutter_tools.stamp" -Force -ErrorAction SilentlyContinue

# 4. 重建工具快照、拉取 windows-arm64 Engine 并自检
flutter doctor -v
```

### 验证原生 ARM64 是否生效

1. 运行 `dart --version`，输出应包含 **`on "windows_arm64"`**：
   ```text
   Dart SDK version: 3.14.0 (stable) ... on "windows_arm64"
   ```
2. 运行 `flutter doctor -v`，Connected device 应显示 **`windows-arm64`**，且全部检查项为 `[✓]`（`No issues found!`）：
   ```text
   • Windows (desktop) • windows • windows-arm64
   ```

---

## 3. 日后 `flutter upgrade` 的注意事项

- **常规升级**：直接在 **原生 ARM64 PowerShell** 中运行 `flutter upgrade`。`update_dart_sdk.ps1` 会检测 `$env:PROCESSOR_ARCHITECTURE -eq "ARM64"`，自动拉取对应新版本的 `windows-arm64` Dart SDK 与 Engine。
- **如果升级后出现 `Snapshot not compatible with the current VM configuration` 或意外回退到 `x64`**：重新执行第 2 节的 4 条命令即可瞬间恢复原生 ARM64。

---

## 4. Android SDK 管理（`android` CLI 与 `sdkmanager`）

从 Android Command-Line Tools `23.0.0` 起，旧的 `sdkmanager` 已标记为 deprecated，由新的统一 CLI **`android`**（`android sdk`）替代：

```powershell
# 查看环境与已安装组件
android info
android sdk list

# 安装或更新组件示例（PowerShell 中注意用引号包裹分号参数）
android sdk install "platform-tools" "platforms;android-36" "build-tools;37.0.0"
```

*(如后续项目需要 C/C++ 原生编译，可按需安装 `ndk;<version>` 与 `cmake;<version>`。)*
