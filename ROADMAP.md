# 航线图 (Roadmap) - Tinnci.io

基于当前 **Vite + React + Markdown** 的静态站点架构，以下是博客系统的演进规划。

## 🟢 阶段 1：基础建设 (已完成)
- [x] **Neo-brutalism UI**: 建立基于 Bento Box 的视觉风格。
- [x] **内容系统**: 实现从 `content/posts/` & `content/projects/` 读取 Markdown 的解耦方案。
- [x] **项目系统 (Projects)**: 实现独立的项目列表与详情页，支持元数据驱动。
- [x] **智能配色系统**:
    - [x] **动态调色盘**: 实现暗黑模式下的随机色彩库旋转。
    - [x] **自动对比度**: 利用 CSS `oklch` 相对颜色语法实现文字对背景的感知自适应。
    - [x] **全局色调控制**: 自动在暗黑模式下降低色彩饱和度，提升优雅感。
- [x] **路由兼容性**: 使用 `HashRouter` 确保 GitHub Pages 兼容。
- [x] **搜索功能**: 集成 `Fuse.js` 实现轻量级本地搜索。
- [x] **交互体验**: 实现平滑的主题切换动画 (0.4s 呼吸感过渡)。
- [x] **自动部署**: 配置 GitHub Actions 实现推送即发布。

## 🟡 阶段 2：体验增强 (短期规划)
- [ ] **评论系统**: 集成 [Giscus](https://giscus.app/)，利用 GitHub Discussions 实现零成本互动。
- [ ] **目录导航 (TOC)**: 自动提取 Markdown 标题生成侧边栏目录。
- [ ] **SEO 强化**: 
    - [ ] 自动生成 `sitemap.xml`。
    - [ ] 动态生成每篇文章的 Meta Tags。
- [ ] **RSS Feed**: 生成 `feed.xml` 方便订阅工具抓取。
- [ ] **阅读进度条**: 顶部细线显示当前阅读进度。

## 🟠 阶段 3：多媒体与社交 (中期规划)
- [ ] **代码高亮优化**: 集成 `shiki` 或 `prismjs` 提供更精美的代码配色。
- [ ] **OpenGraph 支持**: 自动生成社交媒体分享时的预览图 (OG Image)。
- [ ] **图片优化**: 
    - [ ] 图片懒加载。
    - [ ] 支持内容图片灯箱效果 (Lightbox)。
- [ ] **PWA 支持**: 支持离线访问与图标安装。

## 🔴 阶段 4：进阶功能 (长期愿景)
- [ ] **无头 CMS 集成**: 若文章量激增，考虑集成 [Keystatic](https://keystatic.com/) 或 [TinaCMS](https://tina.io/) 提供可视化编辑界面。
- [ ] **隐私友好统计**: 集成 [Umami](https://umami.is/) 或 Google Analytics 了解访客行为。
- [ ] **Newsletter**: 集成邮件列表订阅功能。

---

*“数字花园，终身耕耘。”*
