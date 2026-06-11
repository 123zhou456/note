---
Task ID: 1
Agent: Main Agent
Task: Fix base64 image display in editor, semi-transparent cards, and dark mode support

Work Log:
- Updated Prisma schema to add `images` field (JSON string) to Note model for storing base64 data separately from markdown content
- Pushed schema to database with `bun run db:push`
- Updated Note type in types/index.ts to include `images: Record<string, string>`
- Updated getContentPreview to handle img:uuid and hw:uuid references
- Updated both API route files (notes/route.ts, notes/[id]/route.ts) to handle the images field in formatNote, POST, and PUT handlers
- Rewrote note-edit-view.tsx to use short image references (img:uuid for images, hw:uuid for handwriting) instead of inline base64 in markdown content
- Rewrote markdown-renderer.tsx to resolve img:uuid/hw:uuid references to actual base64 data URLs before rendering
- Updated note-list-view.tsx with semi-transparent glass-effect cards (bg-card/60 backdrop-blur-md) and dark mode toggle button
- Added ThemeProvider component using next-themes
- Updated layout.tsx to wrap app with ThemeProvider
- Updated page.tsx with semi-transparent main container and footer
- Fixed null safety for images field in formatNote (handles existing notes without images data)
- All lint checks pass

Stage Summary:
- Images/handwriting now stored separately with short references in markdown (e.g., ![图片](img:abc123))
- Editor textarea shows clean short references instead of huge base64 strings
- Markdown renderer resolves references to actual data URLs for display
- Note cards are semi-transparent with glass effect to show background image
- Dark mode fully supported with toggle button in header
- Existing notes with inline base64 images continue to work (backward compatible)
