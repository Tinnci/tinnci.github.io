# TINNCI.IO ⚡

A high-performance, Neobrutalist-inspired personal blog and portfolio system built with **React**, **Vite**, and **Bun**. This project serves as a digital garden and experimental lab for showcasing low-level systems insights and creative web design.

![Bento UI Style](https://raw.githubusercontent.com/Tinnci/tinnci.github.io/main/public/preview.png) *(Placeholder: Add a real screenshot later)*

## ✨ Key Features

- **🍱 Bento Box Layout**: A modern, responsive grid-based UI following Neobrutalist design principles.
- **📝 Markdown-Driven Content**: Fully decoupled content system. Manage blog posts and projects directly in `/content` using Markdown and YAML frontmatter.
- **🎨 Intelligent Palette System**:
    - **Dynamic Rotation**: Dark mode features 11+ randomly rotating color palettes (Cyberpunk, Sunset, Ocean, etc.).
    - **Auto-Contrast**: Uses CSS `oklch` relative color syntax to automatically calculate the best text contrast against any background color.
    - **Global Shading**: Ambient color-mixing for an elegant, non-glaring dark mode experience.
- **🔍 Fast Search**: Client-side fuzzy search powered by `fuse.js`.
- **🌙 Breathing Themes**: Smooth 0.4s CSS transitions for a natural, breathing feel when switching between light and dark modes.
- **🚀 Blazing Fast**: Powered by Bun for development and GitHub Actions for automated deployment to GitHub Pages.

## 🛠️ Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Runtime/Package Manager**: Bun
- **Animations**: Framer Motion 12
- **Icons**: Lucide React
- **Markdown**: Marked + JS-YAML (Browser compatible parsing)
- **Search**: Fuse.js

## 📁 Project Structure

```text
├── content/
│   ├── posts/      # Markdown blog articles
│   └── projects/   # Markdown project spotlights
├── src/
│   ├── lib/        # Content parsers and logic
│   ├── App.tsx     # Main application & routing
│   └── index.css   # Neobrutalist design system
├── .github/        # Deployment workflows
└── ROADMAP.md      # Future evolution plans
```

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   bun install
   ```

2. **Run Development Server**:
   ```bash
   bun run dev
   ```

3. **Build optimized production bundle**:
   ```bash
   bun run build
   ```

## 📖 Content Management

To add a new post or project, simply create a `.md` file in the respective `/content` directory.

**Example Frontmatter:**
```yaml
---
title: "My New Article"
date: 2026-01-06
slug: "my-new-article"
category: "Systems"
tags: [Rust, Kernel]
featured: true
excerpt: "A brief summary for the bento card..."
---
Markdown content starts here...
```

## 🗺️ Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and future phases.

---
Built with ⌨️ by [Tinnci](https://github.com/Tinnci)
