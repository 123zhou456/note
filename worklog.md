---
Task ID: 2
Agent: Main Agent
Task: Refactor diary notes app with swipe-to-delete, recycle bin, inline content, toolbar redesign

Work Log:
- Redesigned data model: replaced contentBlocks (JSON array) with single content (markdown string) field
- Added deletedAt field for soft delete / recycle bin functionality
- Updated Prisma schema and pushed to DB (with data loss accepted for test data)
- Regenerated Prisma client for new schema
- Updated all API routes: notes CRUD now uses content field, DELETE supports soft delete (default) and permanent delete (?permanent=true), GET supports ?deleted=true param
- Simplified types: removed ContentBlock/TextBlock/ImageBlock/HandwritingBlock, replaced with single content string
- Added getContentPreview() helper for extracting plain text from markdown
- Updated ViewType: removed 'detail', added 'trash'
- Updated store: added activeNotes(), trashNotes(), filteredNotes() now filters out deleted notes
- Rebuilt NoteListView: added SwipeableNoteCard with touch/mouse swipe-to-delete, click goes to edit (not detail), added 回收站 menu entry
- Rebuilt NoteEditView: single textarea, toolbar (Bold/Color/Image/Handwriting) positioned between tags and text area, inline image/handwriting insertion as markdown, bold wraps selection with **, color wraps with <span style="color:...">, image inserts ![图片](data:...), handwriting inserts ![手写](data:...)
- Built RecycleBinView: shows soft-deleted notes, restore button, permanent delete with confirmation, clear all button
- Updated MarkdownRenderer: removed color prop (now uses inline HTML), added custom img component for base64 images
- Updated page.tsx: loads all notes including deleted ones, routes include trash view instead of detail
- All lint checks pass
- Browser testing confirmed: click-to-edit, toolbar position, preview mode, swipe-to-delete, recycle bin all working

Stage Summary:
- Key UX changes: click note → edit directly (no separate detail view), toolbar between tags and text, inline images/handwriting in markdown, swipe-left-to-delete, recycle bin with restore/permanent delete
- Content model simplified from block array to single markdown string with inline elements
- Soft delete architecture: notes marked with deletedAt, filtered from main list, shown in recycle bin
