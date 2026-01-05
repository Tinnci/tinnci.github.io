# 航线图 (Roadmap) - Tinnci.io

基于当前 **Vite + React + Markdown** 的静态站点架构，以下是博客系统的演进规划。

## 🟢 阶段 1：基础建设 (已完成)
- [x] **Neo-brutalism UI**: 建立基于 Bento Box 的视觉风格。
- [x] **内容系统**: 实现从 `content/posts/` 读取 Markdown 的解耦方案。
- [x] **路由兼容性**: 使用 `HashRouter` 确保 GitHub Pages 兼容。
- [x] **搜索功能**: 集成 `Fuse.js` 实现轻量级本地搜索。
- [x] **分类 & 标签**: 完成元数据解析与筛选逻辑。
- [x] **暗黑模式**: 支持 CSS 变量切换与持久化存储。
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
