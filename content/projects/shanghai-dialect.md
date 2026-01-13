---
title: Shanghai Dialect Exercises Digitization
description: 1910年《上海方言练习》数字化项目：结合 Gemini 3.0 Flash 视觉识别与 JPEG XL 极致压缩的语言学文献保护实践。
link: "https://github.com/Tinnci/shanghai-dialect-1910"
tags: [Python, Digitization, JPEG XL, Linguistics, Gemini-3.0-Flash]
status: completed
featured: true
---

## 项目背景 | Background

《上海方言练习》（*Shanghai Dialect Exercises in Romanized and Character*）由 D.H. Davis 编写，于1910年在上海土山湾印书馆出版。这部作品是老派上海话（尖团分明、保留入声）的活化石。

本项目旨在将这份公有领域（Public Domain）的珍贵文献，通过现代 AI 技术与前沿图像压缩技术，转化为一个结构化的、高性能的数字化档案。

## 数字化工作流 | Workflow

不同于简单的 PDF 转图片，我们采用了深度语义化的处理逻辑：

1.  **原始提取 (Raw Extraction)**:
    *   使用 `PyMuPDF` 从原始 PDF 中直接提取 294 张嵌入的原始 JPEG 图像，确保不经过二次渲染的无损品质。
2.  **AI 识别与梳理 (AI-Powered Analysis)**:
    *   **Gemini 3.0 Flash**: 核心识别引擎。利用其强大的长上下文与多模态能力，直接对提取的每一页图像进行 OCR 识别，并对晦涩的罗马字拼写与清末方言词汇进行归纳。
    *   项目索引 ([PAGE_INDEX.md](https://github.com/Tinnci/shanghai-dialect-1910/blob/main/digitized/PAGE_INDEX.md)) 的 3000 余行对话记录，见证了 AI 对 155 课内容的精细解析。
3.  **极致压缩 (JXL Optimization)**:
    *   引入 `JPEG XL (JXL)` 格式。在保留 150 DPI 高保真细节的前提下，将存储体积从 2.5 GB（PNG/JPEG 混杂）压缩至 **725 MB**。

## 语言学亮点 | Linguistic Highlights

通过本项目，您可以方便地查阅 1910 年代地道的上海话表达：

*   **社会生活**: 像 **“閒散閒散”** ('an-san 'an-san, 散步) 时的惬意，或是 **“勞力做生活”** (lau-lih tsoo sang-weh, 出苦力) 的艰辛。
*   **职业印记**: 记录了老上海特有的 **“包打聽”** (Pau-tang-thing, 侦探) 与 **“门差”** (Mung-tsha, 门警) 之间的职业对话。
*   **时代印记**: 文中甚至捕捉到了 1910 年 **“哈利掃帚星”** (Halley's Comet) 回归时引发的社会趣闻。

## 目录结构 | Structure (Johnny Decimal)

项目采用 **Johnny Decimal** 索引系统，不仅让文件有序，更让知识可索引：

*   `10-19 Preliminary`: 封面、序言与详尽目录。
*   `20-29 Pronunciation Guide`: 核心发音指南（音标与声调）。
*   `30-39 Lessons`: 155 门精心分级的方言练习课。
*   `40-49 Appendices`: 包含英文索引与极其珍贵的四页勘误表（Errata）。

---

> **“光陰如箭，日月如梭”** —— 这一数字化副本让百年前的方言不再随风而逝。
