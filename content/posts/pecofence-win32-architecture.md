---
title: PecoFence 架构笔记：用 Rust 实现 Windows 11 桌面栅栏与 Peek 交互
date: 2026-11-15
slug: pecofence-win32-architecture
featured: false
color: var(--accent-2)
category: Engineering
tags:
  - Rust
  - Windows 11
  - Win32
  - Desktop
excerpt: 拆解 PecoFence 如何通过 Win32 Desktop WorkerW 挂载、DWM 毛玻璃材质与状态机实现零安装便携的桌面栅栏体验。
---

[PecoFence](https://github.com/Tinnci/PecoFence) 是我在 Windows 11 上用 **Rust** 编写的开源桌面整理工具（Stardock Fences 替代品），支持毛玻璃栅栏、实时文件夹映射、多标签页与 Peek 呼出。

这篇文章用几张结构图梳理它的核心模块与消息流。

---

## 1. 整体模块架构

```mermaid
flowchart TB
    Tray["System Tray & Global Hotkey"] --> Core["Fence Manager (State & Layout)"]
    Core --> Win32["Win32 Windowing & WorkerW Hook"]
    Core --> DWM["DWM Acrylic / Mica Backdrop"]
    Core --> FS["Live Folder Watcher (ReadDirectoryChangesW)"]
    Core --> I18n["10-Language Localization"]
    Win32 --> Shell["IShellFolder / Icon & Context Menu"]
    FS --> Core
```

---

## 2. Peek 呼出与桌面层挂载流程

为了让栅栏窗口既能贴附在桌面壁纸之上、又不遮挡普通应用窗口，同时在快捷键触发时瞬间浮现（Peek），消息流转如下：

```mermaid
sequenceDiagram
    participant User as 用户 / 全局快捷键
    participant Tray as Hotkey Listener
    participant Mgr as Fence Manager
    participant Win as Win32 HWND

    User->>Tray: 按下 Peek 快捷键
    Tray->>Mgr: 派发 TogglePeek 事件
    alt 当前处于桌面底层
        Mgr->>Win: SetWindowPos(HWND_TOPMOST) + ShowWindow
        Win-->>User: 栅栏置顶浮现（可拖拽/点击文件）
    else 当前处于 Peek 置顶状态
        Mgr->>Win: 恢复 WorkerW / HWND_BOTTOM 层级
        Win-->>User: 退回桌面层，不干扰前台工作
    end
```

---

## 3. 设计取舍

- **零安装便携**：配置与布局状态序列化为本地 JSON，单文件即可随身携带。
- **原生 Win32 + Rust**：避免嵌入重型 WebView 带来的常驻内存开销，保持后台静默占用极低。
- **跨文章关联**：可以在站点的 **Knowledge Graph** 页面中查看它与其他 Rust / Windows 11 文章和项目的关联。
