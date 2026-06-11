/**
 * 客户端 API 处理器
 *
 * 拦截全局 fetch('/api/*') 请求，将所有 CRUD 操作映射到浏览器 IndexedDB。
 * 替代服务端 Prisma + SQLite，使 Next.js 可以静态导出并离线运行。
 *
 * 数据模型与 prisma/schema.prisma 保持一致：
 * - notes: 笔记
 * - tags: 标签
 * - noteTags: 笔记-标签关联
 * - settings: 设置
 */

// ---------- ID 生成 ----------
function generateId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 10)
  return `c${ts}${rand}`
}

// ---------- IndexedDB 工具 ----------
const DB_NAME = 'diary-notes-db'
const DB_VERSION = 1

interface NoteRow {
  id: string
  title: string
  content: string
  images: string   // JSON string
  foldStates: string // JSON string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

interface TagRow {
  id: string
  name: string
}

interface NoteTagRow {
  noteId: string
  tagId: string
}

interface SettingRow {
  key: string
  value: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // notes store
      if (!db.objectStoreNames.contains('notes')) {
        const store = db.createObjectStore('notes', { keyPath: 'id' })
        store.createIndex('deletedAt', 'deletedAt', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // tags store
      if (!db.objectStoreNames.contains('tags')) {
        const store = db.createObjectStore('tags', { keyPath: 'id' })
        store.createIndex('name', 'name', { unique: true })
      }

      // noteTags store (composite key)
      if (!db.objectStoreNames.contains('noteTags')) {
        const store = db.createObjectStore('noteTags', { keyPath: ['noteId', 'tagId'] })
        store.createIndex('noteId', 'noteId', { unique: false })
        store.createIndex('tagId', 'tagId', { unique: false })
      }

      // settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function storeGet<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  })
}

function storeGetAll<T>(storeName: string, indexName?: string, range?: IDBKeyRange): Promise<T[]> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const source = indexName ? store.index(indexName) : store
      const req = source.getAll(range)
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  })
}

function storePut<T>(storeName: string, value: T): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.put(value)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  })
}

function storeDelete(storeName: string, key: IDBValidKey): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  })
}

function storeClear(storeName: string): Promise<void> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    })
  })
}

// ---------- 工具函数 ----------
function parseUrl(pathname: string): { base: string; id?: string } {
  // /api/notes/xxx -> { base: '/api/notes', id: 'xxx' }
  // /api/notes -> { base: '/api/notes' }
  const parts = pathname.replace(/\/+$/, '').split('/')
  if (parts.length >= 4 && parts[1] === 'api') {
    return { base: `/api/${parts[2]}`, id: parts[3] }
  }
  return { base: pathname }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------- Note 格式化（与服务端 formatNote 一致） ----------
function formatNote(note: NoteRow, tags: { id: string; name: string }[]) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    images: JSON.parse(note.images || '{}'),
    foldStates: JSON.parse(note.foldStates || '{}'),
    deletedAt: note.deletedAt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    tags,
  }
}

// ---------- 首次使用的示例数据 ----------
const DEMO_NOTE_CONTENT = `# 📝 Markdown 使用指南

欢迎使用 **日记便签**！这是一款支持 Markdown 语法的移动端笔记应用。

---

## 基础语法

### 文字样式

- **加粗**：用 \\*\\*文字\\*\\*
- *斜体*：用 \\*文字\\*
- ~~删除线~~：用 \\~\\~文字\\~\\~
- \`行内代码\`：用反引号包裹

### 列表

无序列表：
- 苹果
- 香蕉
  - 海南香蕉
  - 进口香蕉
- 橙子

有序列表：
1. 第一步：打开应用
2. 第二步：新建笔记
3. 第三步：开始记录

### 引用

> 生活不是等待风暴过去，而是学会在雨中翩翩起舞。
> —— 佚名

### 代码块

\`\`\`javascript
function hello() {
  console.log("Hello, 日记便签!");
}
\`\`\`

### 任务清单

- [x] 了解 Markdown 语法
- [x] 创建第一篇笔记
- [ ] 插入图片
- [ ] 使用标签分类

---

## 进阶功能

### 折叠标题

点击标题左侧的 ▶ 图标，可以折叠/展开该章节的内容。试试点击下面这个标题：

### 子标题也能折叠

H3 级别的标题同样支持折叠，方便你管理多层级的笔记结构。

### 插入图片

点击工具栏中的「图片」按钮，可以从相册选择图片插入到笔记中。

### 手写功能

点击工具栏中的「手写」按钮，可以在画板上手写内容并插入笔记。

---

> 💡 **提示**：本篇指南可随时编辑或删除，现在就动手试试吧！`

async function seedDemoData(): Promise<void> {
  const existingNotes = await storeGetAll<NoteRow>('notes')
  if (existingNotes.length > 0) return // 已有笔记则不重复创建

  const now = new Date().toISOString()
  const noteId = generateId()
  const tagId = generateId()

  // 创建示例笔记（图片已直接嵌入 DEMO_NOTE_CONTENT 中）
  const note: NoteRow = {
    id: noteId,
    title: 'Markdown 使用指南 📖',
    content: DEMO_NOTE_CONTENT,
    images: JSON.stringify({}),
    foldStates: JSON.stringify({}),
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  // 创建示例标签
  const tag: TagRow = {
    id: tagId,
    name: '入门',
  }

  await storePut('notes', note)
  await storePut('tags', tag)
  await storePut<NoteTagRow>('noteTags', { noteId, tagId })
}

// ---------- API 路由处理 ----------
async function handleApiRequest(url: string, init?: RequestInit): Promise<Response> {
  const urlObj = new URL(url, window.location.origin)
  const { base, id } = parseUrl(urlObj.pathname)
  const method = (init?.method || 'GET').toUpperCase()
  const searchParams = urlObj.searchParams

  try {
    // ========== 健康检查 ==========
    if (base === '/api' && method === 'GET') {
      return jsonResponse({ status: 'ok', app: '日记便签' })
    }

    // ========== Notes ==========
    if (base === '/api/notes') {
      if (method === 'GET') {
        // GET /api/notes?deleted=true
        const includeDeleted = searchParams.get('deleted') === 'true'

        // 首次使用：数据库为空时自动创建示例笔记（无论是否包含已删除）
        const allNotes = await storeGetAll<NoteRow>('notes')
        if (allNotes.length === 0) {
          await seedDemoData()
        }

        const freshNotes = await storeGetAll<NoteRow>('notes')

        let notes = freshNotes
        if (!includeDeleted) {
          notes = freshNotes.filter((n) => !n.deletedAt)
        }

        // Sort by createdAt desc
        notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        // Attach tags
        const noteTags = await storeGetAll<NoteTagRow>('noteTags')
        const allTags = await storeGetAll<TagRow>('tags')
        const tagMap = new Map(allTags.map((t) => [t.id, t]))

        const result = notes.map((note) => {
          const tagIds = noteTags.filter((nt) => nt.noteId === note.id).map((nt) => nt.tagId)
          const tags = tagIds.map((tid) => tagMap.get(tid)).filter(Boolean) as { id: string; name: string }[]
          return formatNote(note, tags)
        })

        return jsonResponse(result)
      }

      if (method === 'POST') {
        // POST /api/notes - Create a note
        const body = await (init?.body ? new Response(init.body).json() : {})
        const { title, content, images, tagIds } = body

        const now = new Date().toISOString()
        const note: NoteRow = {
          id: generateId(),
          title: title || '无标题',
          content: content || '',
          images: JSON.stringify(images || {}),
          foldStates: JSON.stringify({}),
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        }

        await storePut('notes', note)

        // Create tag associations
        if (tagIds && Array.isArray(tagIds) && tagIds.length > 0) {
          for (const tagId of tagIds) {
            await storePut<NoteTagRow>('noteTags', { noteId: note.id, tagId })
          }
        }

        // Return with tags
        const allTags = await storeGetAll<TagRow>('tags')
        const tagMap = new Map(allTags.map((t) => [t.id, t]))
        const attachedTags = (tagIds || []).map((tid: string) => tagMap.get(tid)).filter(Boolean) as { id: string; name: string }[]

        return jsonResponse(formatNote(note, attachedTags), 200)
      }
    }

    // ========== Notes/[id] ==========
    if (base === '/api/notes' && id) {
      if (method === 'GET') {
        const note = await storeGet<NoteRow>('notes', id)
        if (!note) {
          return jsonResponse({ error: 'Note not found' }, 404)
        }

        const noteTags = await storeGetAll<NoteTagRow>('noteTags')
        const allTags = await storeGetAll<TagRow>('tags')
        const tagMap = new Map(allTags.map((t) => [t.id, t]))
        const tagIds = noteTags.filter((nt) => nt.noteId === id).map((nt) => nt.tagId)
        const tags = tagIds.map((tid) => tagMap.get(tid)).filter(Boolean) as { id: string; name: string }[]

        return jsonResponse(formatNote(note, tags))
      }

      if (method === 'PUT') {
        const body = await (init?.body ? new Response(init.body).json() : {})
        const { title, content, images, foldStates, tagIds, deletedAt } = body

        const existing = await storeGet<NoteRow>('notes', id)
        if (!existing) {
          return jsonResponse({ error: 'Note not found' }, 404)
        }

        const updateData: Partial<NoteRow> = { ...existing, updatedAt: new Date().toISOString() }
        if (title !== undefined) updateData.title = title
        if (content !== undefined) updateData.content = content
        if (images !== undefined) updateData.images = JSON.stringify(images)
        if (foldStates !== undefined) updateData.foldStates = JSON.stringify(foldStates)
        if (deletedAt !== undefined) updateData.deletedAt = deletedAt

        await storePut('notes', updateData as NoteRow)

        // Update tag associations
        if (tagIds !== undefined) {
          // Remove existing
          const existingNoteTags = await storeGetAll<NoteTagRow>('noteTags')
          for (const nt of existingNoteTags.filter((nt) => nt.noteId === id)) {
            await storeDelete('noteTags', [nt.noteId, nt.tagId])
          }
          // Add new
          if (Array.isArray(tagIds) && tagIds.length > 0) {
            for (const tagId of tagIds) {
              await storePut<NoteTagRow>('noteTags', { noteId: id, tagId })
            }
          }
        }

        // Return with tags
        const allTags = await storeGetAll<TagRow>('tags')
        const tagMap = new Map(allTags.map((t) => [t.id, t]))
        const finalNote = await storeGet<NoteRow>('notes', id)!
        const noteTags = await storeGetAll<NoteTagRow>('noteTags')
        const finalTagIds = noteTags.filter((nt) => nt.noteId === id).map((nt) => nt.tagId)
        const tags = finalTagIds.map((tid) => tagMap.get(tid)).filter(Boolean) as { id: string; name: string }[]

        return jsonResponse(formatNote(finalNote!, tags))
      }

      if (method === 'DELETE') {
        const permanent = searchParams.get('permanent') === 'true'

        if (permanent) {
          // Permanent delete
          await storeDelete('notes', id)
          // Also delete tag associations
          const noteTags = await storeGetAll<NoteTagRow>('noteTags')
          for (const nt of noteTags.filter((nt) => nt.noteId === id)) {
            await storeDelete('noteTags', [nt.noteId, nt.tagId])
          }
        } else {
          // Soft delete
          const existing = await storeGet<NoteRow>('notes', id)
          if (existing) {
            existing.deletedAt = new Date().toISOString()
            existing.updatedAt = existing.deletedAt
            await storePut('notes', existing)
          }
        }

        return jsonResponse({ success: true })
      }
    }

    // ========== Tags ==========
    if (base === '/api/tags' && !id) {
      if (method === 'GET') {
        const allTags = await storeGetAll<TagRow>('tags')
        allTags.sort((a, b) => a.name.localeCompare(b.name))

        // Count notes per tag
        const noteTags = await storeGetAll<NoteTagRow>('noteTags')
        const notes = await storeGetAll<NoteRow>('notes')
        const activeNoteIds = new Set(notes.filter((n) => !n.deletedAt).map((n) => n.id))

        const result = allTags.map((tag) => {
          const count = noteTags.filter(
            (nt) => nt.tagId === tag.id && activeNoteIds.has(nt.noteId)
          ).length
          return { id: tag.id, name: tag.name, noteCount: count }
        })

        return jsonResponse(result)
      }

      if (method === 'POST') {
        const body = await (init?.body ? new Response(init.body).json() : {})
        const { name } = body

        if (!name || !name.trim()) {
          return jsonResponse({ error: '标签名称不能为空' }, 400)
        }

        // Check for duplicate
        const allTags = await storeGetAll<TagRow>('tags')
        if (allTags.some((t) => t.name === name.trim())) {
          return jsonResponse({ error: '标签名称已存在' }, 409)
        }

        const tag: TagRow = { id: generateId(), name: name.trim() }
        await storePut('tags', tag)

        return jsonResponse({ id: tag.id, name: tag.name, noteCount: 0 })
      }
    }

    // ========== Tags/[id] ==========
    if (base === '/api/tags' && id) {
      if (method === 'PUT') {
        const body = await (init?.body ? new Response(init.body).json() : {})
        const { name } = body

        if (!name || !name.trim()) {
          return jsonResponse({ error: '标签名称不能为空' }, 400)
        }

        // Check duplicate
        const allTags = await storeGetAll<TagRow>('tags')
        const duplicate = allTags.find((t) => t.name === name.trim() && t.id !== id)
        if (duplicate) {
          return jsonResponse({ error: '标签名称已存在' }, 409)
        }

        const existing = await storeGet<TagRow>('tags', id)
        if (!existing) {
          return jsonResponse({ error: 'Tag not found' }, 404)
        }

        existing.name = name.trim()
        await storePut('tags', existing)

        // Count notes
        const noteTags = await storeGetAll<NoteTagRow>('noteTags')
        const notes = await storeGetAll<NoteRow>('notes')
        const activeNoteIds = new Set(notes.filter((n) => !n.deletedAt).map((n) => n.id))
        const count = noteTags.filter(
          (nt) => nt.tagId === id && activeNoteIds.has(nt.noteId)
        ).length

        return jsonResponse({ id: existing.id, name: existing.name, noteCount: count })
      }

      if (method === 'DELETE') {
        await storeDelete('tags', id)
        // Remove tag associations
        const noteTags = await storeGetAll<NoteTagRow>('noteTags')
        for (const nt of noteTags.filter((nt) => nt.tagId === id)) {
          await storeDelete('noteTags', [nt.noteId, nt.tagId])
        }
        return jsonResponse({ success: true })
      }
    }

    // ========== Settings ==========
    if (base === '/api/settings') {
      if (method === 'GET') {
        const key = searchParams.get('key')
        if (!key) {
          return jsonResponse({ error: 'Key is required' }, 400)
        }
        const setting = await storeGet<SettingRow>('settings', key)
        return jsonResponse({ key, value: setting?.value || '' })
      }

      if (method === 'PUT') {
        const body = await (init?.body ? new Response(init.body).json() : {})
        const { key, value } = body

        if (!key) {
          return jsonResponse({ error: 'Key is required' }, 400)
        }

        await storePut<SettingRow>('settings', { key, value: value || '' })
        return jsonResponse({ key, value: value || '' })
      }
    }

    // ========== 未匹配的路由 ==========
    return jsonResponse({ error: 'Not found' }, 404)
  } catch (error) {
    console.error('[API Handler] Error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}

// ---------- 拦截器安装 ----------
let installed = false

export function installApiInterceptor(): void {
  if (installed) return
  if (typeof window === 'undefined') return // SSR guard

  installed = true
  const originalFetch = window.fetch.bind(window)

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url

    if (url.startsWith('/api/') || url.startsWith('/api')) {
      return handleApiRequest(url, init)
    }

    return originalFetch(input, init)
  } as typeof window.fetch

  console.log('[API Handler] Fetch interceptor installed')
}
