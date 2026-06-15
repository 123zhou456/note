# 日记便签

纯离线 Android Markdown 笔记应用，基于 Next.js + Capacitor 构建。数据存储在本地 IndexedDB，无需网络连接。

> 本项目通过 vibe coding 完成，代码由 AI 辅助生成。

## 功能

- Markdown 编辑与预览双模式切换，支持 GFM 扩展语法、多级标题折叠
- 标签分类与多标签 AND 筛选
- 插图（相册选取）与手写输入，图片支持二次涂鸦编辑、替换、保存到本地
- 导出 TXT / MD / CSV（单篇、全部、按标签）
- 导入 TXT / MD / CSV，自动解析标签
- 一键同步备份到设备存储
- 深色模式、自定义背景图、磨砂玻璃卡片风格与透明度调节
- 回收站（软删除与恢复）、撤销（最多 50 步）、目录跳转

## 技术栈

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Capacitor 8 · Zustand · IndexedDB · Framer Motion · react-markdown

## 开发

```bash
npm install
npm run dev
```

构建并打包 APK：

```bash
npm run build
npx cap sync android
npx cap open android
```
