'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { getContentPreview } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Slider } from '@/components/ui/slider'
import { Plus, ArrowUpDown, Tag as TagIcon, Image as ImageIcon, Settings, X, Trash2, Moon, Sun, Download, Upload, FileDown, RefreshCw, Droplets } from 'lucide-react'
import { Filesystem, Directory } from '@capacitor/filesystem'

// 检查是否运行在 Capacitor 原生环境（手机）还是纯浏览器（桌面 PWA）
function isCapacitorApp(): boolean {
  try { return !!(window as any).Capacitor?.isPluginAvailable?.('Filesystem') }
  catch { return false }
}
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { inlineImagesForExport, extractImagesOnImport } from '@/lib/image-io'

// Swipeable note card component with glass effect
function SwipeableNoteCard({ note, onEdit, onDelete, onExport, cardOpacity = 70 }: {
  note: { id: string; title: string; content: string; createdAt: string; tags: { id: string; name: string }[] }
  onEdit: () => void
  onDelete: () => void
  onExport: () => void
  cardOpacity?: number
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [offsetX, setOffsetX] = useState(0)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)
  const isDragging = useRef(false)
  const DELETE_THRESHOLD = -70
  const { theme } = useTheme()

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    currentXRef.current = offsetX
    isDragging.current = true
  }, [offsetX])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    const diff = e.touches[0].clientX - startXRef.current
    const newOffset = Math.min(0, Math.max(-120, currentXRef.current + diff))
    setOffsetX(newOffset)
  }, [])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
    // Snap to open or closed position
    if (offsetX < DELETE_THRESHOLD) {
      setOffsetX(-80)
    } else {
      setOffsetX(0)
    }
  }, [offsetX, DELETE_THRESHOLD])

  // Mouse support for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startXRef.current = e.clientX
    currentXRef.current = offsetX
    isDragging.current = true

    const handleMouseMove = (moveE: MouseEvent) => {
      if (!isDragging.current) return
      const diff = moveE.clientX - startXRef.current
      const newOffset = Math.min(0, Math.max(-120, currentXRef.current + diff))
      setOffsetX(newOffset)
    }

    const handleMouseUp = () => {
      isDragging.current = false
      setOffsetX((prev) => {
        if (prev < DELETE_THRESHOLD) return -80
        return 0
      })
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [offsetX, DELETE_THRESHOLD])

  const handleClick = useCallback(() => {
    if (offsetX === 0) {
      onEdit()
    } else {
      setOffsetX(0)
    }
  }, [offsetX, onEdit])

  const preview = getContentPreview(note.content)

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete button underneath — 仅在左滑时渲染 */}
      {offsetX < 0 && (
        <div className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-destructive z-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-destructive/80 h-full w-full gap-1"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
        </div>
      )}

      {/* Card content - glass effect */}
      <div
        ref={cardRef}
        className="relative z-10 border border-border/50 rounded-lg transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          backgroundColor: theme === 'dark'
            ? `rgba(30, 30, 30, ${cardOpacity / 100})`
            : `rgba(255, 255, 255, ${cardOpacity / 100})`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <div className="p-4">
          <div className="flex flex-col gap-1.5">
            <h3 className="font-semibold text-base line-clamp-1">
              {note.title || '无标题'}
            </h3>
            {preview && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {preview}
              </p>
            )}
            <div className="flex items-center justify-between mt-1">
              <div className="flex flex-wrap gap-1">
                {note.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="text-xs bg-secondary/50">
                    {tag.name}
                  </Badge>
                ))}
              </div>
                <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <button
                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent/50 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onExport() }}
                  title="导出这篇"
                >
                  <FileDown className="h-3 w-3" />
                </button>
                {format(new Date(note.createdAt), 'MM/dd HH:mm')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NoteListView() {
  const {
    notes,
    tags,
    selectedTagIds,
    sortOrder,
    backgroundImage,
    setView,
    toggleTagSelection,
    clearTagSelection,
    setSortOrder,
    filteredNotes,
    updateNote,
  } = useAppStore()

  const { theme, setTheme } = useTheme()
  const displayNotes = filteredNotes()
  const [singleExportNoteId, setSingleExportNoteId] = useState<string | null>(null)

  // 卡片透明度（0-100），持久化到 localStorage
  const [cardOpacity, setCardOpacity] = useState(() => {
    try { return parseInt(localStorage.getItem('cardOpacity') || '70', 10) }
    catch { return 70 }
  })
  useEffect(() => {
    try { localStorage.setItem('cardOpacity', String(cardOpacity)) } catch {}
  }, [cardOpacity])

  // ─── 导出核心函数：生成可重新导入的格式 ───
  const exportNotesAs = useCallback(async (notesToExport: typeof notes, format: 'txt' | 'md' | 'csv', tagName?: string) => {
    if (notesToExport.length === 0) return

    const isSingle = notesToExport.length === 1
    let baseName: string
    if (isSingle) {
      baseName = notesToExport[0].title || '笔记'
    } else if (tagName) {
      baseName = `标签_${tagName}`
    } else {
      baseName = 'diary'
    }
    const safeName = baseName.replace(/[<>:"\/\\|?*]/g, '_').substring(0, 50)

    let content: string

    switch (format) {
      case 'txt': {
        const sections = notesToExport.map((note) => {
          const tagStr = note.tags.map((t) => t.name).join(', ')
          const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
          return `---\ntitle: ${note.title || '无标题'}\ntags: ${tagStr || '未分类'}\ncreatedAt: ${note.createdAt}\nupdatedAt: ${note.updatedAt}\n---\n${inlinedContent}`
        })
        content = sections.join('\n=====\n') + '\n'
        break
      }
      case 'md': {
        const sections = notesToExport.map((note) => {
          const tagsArr = note.tags.map((t) => `"${t.name}"`).join(', ')
          const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
          return `---\ntitle: "${(note.title || '无标题').replace(/"/g, '\\"')}"\ntags: [${tagsArr || '"未分类"'}]\ncreatedAt: "${note.createdAt}"\nupdatedAt: "${note.updatedAt}"\n---\n\n${inlinedContent}`
        })
        content = sections.join('\n=====\n') + '\n'
        break
      }
      case 'csv': {
        const header = 'id,title,content,created_at,updated_at,tags'
        const rows = notesToExport.map((note) => {
          const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
          const safeContent = inlinedContent.replace(/"/g, '""')
          const safeTitle = (note.title || '').replace(/"/g, '""')
          const tagStr = note.tags.map((t) => t.name).join(';')
          return `"${note.id}","${safeTitle}","${safeContent}","${note.createdAt}","${note.updatedAt}","${tagStr}"`
        })
        content = header + '\n' + rows.join('\n') + '\n'
        break
      }
    }

    const isPhone = isCapacitorApp()

    // 手机端用 Capacitor Filesystem，桌面端用浏览器下载
    if (isPhone) {
      try {
        const filename = `${safeName}.${format}`
        await Filesystem.writeFile({
          path: `Download/日记便签/${filename}`,
          data: content,
          directory: Directory.ExternalStorage,
          encoding: 'utf8' as any,
          recursive: true,
        })
        alert(`✅ 已导出 ${notesToExport.length} 篇笔记\n位置: 内部存储/Download/日记便签/${filename}`)
        return
      } catch (err) {
        console.error('Filesystem export failed:', err)
      }
    }

    // 桌面端 / 回退：浏览器下载
    const mimeTypes: Record<string, string> = { txt: 'text/plain', md: 'text/markdown', csv: 'text/csv' }
    const blob = new Blob([content], { type: mimeTypes[format] + ';charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeName}.${format}`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    alert(`✅ 已下载: ${safeName}.${format}\n请按 Ctrl+J 打开浏览器下载列表查看`)
  }, [])

  const handleExportAll = useCallback((format: 'txt' | 'md' | 'csv') => {
    const all = useAppStore.getState().notes.filter((n) => !n.deletedAt)
    exportNotesAs(all, format)
  }, [exportNotesAs])

  const handleExportTag = useCallback((tagName: string, format: 'txt' | 'md' | 'csv') => {
    const all = useAppStore.getState().notes.filter((n) => !n.deletedAt)
    const filtered = all.filter((n) => n.tags.some((t) => t.name === tagName))
    exportNotesAs(filtered, format, tagName)
  }, [exportNotesAs])

  const handleExportSingle = useCallback((noteId: string, format: 'txt' | 'md' | 'csv') => {
    const all = useAppStore.getState().notes.filter((n) => !n.deletedAt)
    const note = all.find((n) => n.id === noteId)
    if (note) exportNotesAs([note], format)
  }, [exportNotesAs])

  // ─── 导入 ───
  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.md,.csv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const lines = text.split('\n')

      const createdNotes: Array<{ title: string; content: string; tags: string[]; createdAt: string; updatedAt: string }> = []

      if (file.name.endsWith('.csv')) {
        // 解析 CSV
        const csvLines = lines.filter((l) => l.trim() && !l.startsWith('id,'))
        for (const row of csvLines) {
          const cols: string[] = []
          let cur = ''
          let inQuotes = false
          for (const ch of row) {
            if (ch === '"') inQuotes = !inQuotes
            else if (ch === ',' && !inQuotes) { cols.push(cur); cur = '' }
            else cur += ch
          }
          cols.push(cur)
          // CSV: id,title,content,created_at,updated_at,tags
          const title = cols[1] || ''
          const content = cols[2] || ''
          const tags = (cols[5] || '').split(';').map((t) => t.trim()).filter((t) => t.length > 0 && !t.match(/^\d{4}-\d{2}-\d{2}T/))
          createdNotes.push({
            title,
            content,
            tags,
            createdAt: cols[3] || new Date().toISOString(),
            updatedAt: cols[4] || new Date().toISOString(),
          })
        }
      } else {
        // 解析 TXT / MD — 支持 YAML front matter
        const raw = text
        // 按分隔符拆多篇笔记
        // TXT 和 MD 统一用 ===== 分隔多篇笔记
        const sections = text.split('\n=====\n').map((s) => s.trim()).filter((s) => s.length > 0)

        for (const section of sections) {
          const trimmed = section.trim()
          if (!trimmed) continue

          let title = ''
          let content = trimmed
          let tags: string[] = []
          let createdAt = ''
          let updatedAt = ''

          // 尝试解析 YAML front matter (--- ... ---)
          const yamlMatch = trimmed.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
          if (yamlMatch) {
            const meta = yamlMatch[1]
            content = yamlMatch[2].trim()
            // 提取 title
            const titleM = meta.match(/^title:\s*"?([^"\n]+)"?\s*$/m)
            if (titleM) title = titleM[1]
            // 提取 tags
            const tagsM = meta.match(/^tags:\s*\[?([^\]]*?)\]?\s*$/m)
            if (tagsM) {
              tags = tagsM[1]
                .split(',')
                .map((t) => t.trim().replace(/^["\s]+|["\s]+$/g, ''))
                .filter((t) => t.length > 0 && !t.match(/^\d{4}-\d{2}-\d{2}T/) && t !== 'null' && t !== 'undefined')
            }
            // 提取 createdAt / updatedAt
            const caM = meta.match(/^createdAt:\s*"?([^"\n]+)"?\s*$/m)
            if (caM) createdAt = caM[1]
            const uaM = meta.match(/^updatedAt:\s*"?([^"\n]+)"?\s*$/m)
            if (uaM) updatedAt = uaM[1]
          } else {
            // 无 front matter：第一行作为标题
            const firstLine = trimmed.split('\n')[0]
            title = firstLine.replace(/^#\s*/, '').substring(0, 80)
          }

          createdNotes.push({
            title: title || '导入笔记',
            content,
            tags,
            createdAt: createdAt || new Date().toISOString(),
            updatedAt: updatedAt || new Date().toISOString(),
          })
        }
      }

      // 批量导入：先创建标签，再把标签ID一起传给笔记
      const store = useAppStore.getState()
      for (const n of createdNotes) {
        const tagIds: string[] = []
        for (const tagName of n.tags) {
          if (!tagName) continue
          let existing = store.tags.find((t) => t.name === tagName)
          if (!existing) {
            const tr = await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: tagName }) })
            if (tr.ok) { existing = await tr.json(); store.addTag(existing) }
          }
          if (existing) tagIds.push(existing.id)
        }

        // 从导入内容中提取 data URL 图片
        const { content: processedContent, images: extractedImages } = extractImagesOnImport(n.content)

        await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: n.title, content: processedContent, images: extractedImages, foldStates: {}, tagIds }),
        })
      }
      const nr = await fetch('/api/notes?deleted=true')
      if (nr.ok) store.setNotes(await nr.json())
      const tr = await fetch('/api/tags')
      if (tr.ok) store.setTags(await tr.json())

      if (createdNotes.length > 0) {
        alert(`成功导入 ${createdNotes.length} 篇笔记`)
      }
    }
    input.click()
  }, [])

  const handleBackgroundImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        useAppStore.getState().setBackgroundImage(result)
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'backgroundImage', value: result }),
        }).catch(console.error)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const handleExport = useCallback((format: 'txt' | 'md' | 'csv') => {
    const allNotes = useAppStore.getState().notes.filter((n) => !n.deletedAt)
    if (allNotes.length === 0) return

    let content: string
    let filename: string
    let mimeType: string

    switch (format) {
      case 'txt': {
        const lines = allNotes.map((note) => {
          const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
          const plain = `${note.title || '无标题'}\n${getContentPreview(inlinedContent)}\n`
          return `---\n${plain}`
        })
        content = `日记便签导出 (${new Date().toLocaleDateString()})\n${'='.repeat(40)}\n\n${lines.join('\n')}\n`
        filename = `diary_${Date.now()}.txt`
        mimeType = 'text/plain'
        break
      }
      case 'md': {
        const sections = allNotes.map((note) => {
          const tags = note.tags.map((t) => `\`${t.name}\``).join(' ')
          const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
          return `# ${note.title || '无标题'}\n\n> ${new Date(note.createdAt).toLocaleString()} ${tags ? '| 标签: ' + tags : ''}\n\n${inlinedContent}`
        })
        content = `# 日记便签导出\n\n导出时间: ${new Date().toLocaleString()}\n共 ${allNotes.length} 篇\n\n---\n\n${sections.join('\n\n---\n\n')}`
        filename = `diary_${Date.now()}.md`
        mimeType = 'text/markdown'
        break
      }
      case 'csv': {
        const header = 'id,title,content,created_at,updated_at,tags'
        const rows = allNotes.map((note) => {
          const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
          const safeContent = inlinedContent.replace(/"/g, '""')
          const safeTitle = (note.title || '').replace(/"/g, '""')
          const tagStr = note.tags.map((t) => t.name).join(';')
          return `"${note.id}","${safeTitle}","${safeContent}","${note.createdAt}","${note.updatedAt}","${tagStr}"`
        })
        content = header + '\n' + rows.join('\n')
        filename = `diary_${Date.now()}.csv`
        mimeType = 'text/csv'
        break
      }
    }

    // Trigger download
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const handleClearBackground = () => {
    useAppStore.getState().setBackgroundImage(null)
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'backgroundImage', value: '' }),
    }).catch(console.error)
  }

  const handleSoftDelete = async (noteId: string) => {
    try {
      await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
      const note = notes.find((n) => n.id === noteId)
      if (note) {
        updateNote({ ...note, deletedAt: new Date().toISOString() })
      }
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Background image layer */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}

      {/* Content layer */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header - semi-transparent */}
        <div className="shrink-0 bg-background/85 dark:bg-background/75 backdrop-blur-xl border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">日记便签</h1>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleDarkMode} title="切换深色模式">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleBackgroundImage}>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    设置背景图
                  </DropdownMenuItem>
                  {backgroundImage && (
                    <DropdownMenuItem onClick={handleClearBackground}>
                      <X className="h-4 w-4 mr-2" />
                      清除背景图
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Droplets className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">卡片透明度</span>
                      <span className="text-xs text-muted-foreground ml-auto">{cardOpacity}%</span>
                    </div>
                    <Slider
                      value={[cardOpacity]}
                      onValueChange={(v) => setCardOpacity(v[0])}
                      min={30}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleImport}>
                    <Upload className="h-4 w-4 mr-2" />
                    导入笔记
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setView('storage')}>
                    <FileDown className="h-4 w-4 mr-2" />
                    存储设置
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('sync')}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    同步到本地
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Download className="h-4 w-4 mr-2" />
                      导出全部
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => handleExportAll('txt')}>TXT (.txt)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportAll('md')}>Markdown (.md)</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportAll('csv')}>CSV (.csv)</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {tags.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <TagIcon className="h-4 w-4 mr-2" />
                        按标签导出
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {tags.map((tag) => (
                          <DropdownMenuSub key={tag.id}>
                            <DropdownMenuSubTrigger>{tag.name}</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => handleExportTag(tag.name, 'txt')}>TXT (.txt)</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportTag(tag.name, 'md')}>Markdown (.md)</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportTag(tag.name, 'csv')}>CSV (.csv)</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setView('tags')}>
                    <TagIcon className="h-4 w-4 mr-2" />
                    标签管理
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView('trash')}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    回收站
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {sortOrder === 'time-desc' ? '最新' : sortOrder === 'time-asc' ? '最早' : '标签'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortOrder('time-desc')}>
                    按时间倒序
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder('time-asc')}>
                    按时间正序
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder('tag')}>
                    按标签排序
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Tag filter bar */}
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              {selectedTagIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2 text-muted-foreground"
                  onClick={clearTagSelection}
                >
                  清除筛选
                </Button>
              )}
              {tags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <Badge
                    key={tag.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className={`cursor-pointer text-xs select-none transition-colors ${isSelected ? '' : 'bg-background/40'}`}
                    onClick={() => toggleTagSelection(tag.id)}
                  >
                    {tag.name}
                    {isSelected && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                )
              })}
            </div>
          )}
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
          {displayNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              {selectedTagIds.length > 0 ? (
                <>
                  <TagIcon className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">没有匹配的便签</p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-sm">暂无便签</p>
                  <p className="text-xs mt-1">点击右下角按钮创建第一个便签</p>
                </>
              )}
            </div>
          ) : (
            displayNotes.map((note) => (
              <SwipeableNoteCard
                key={note.id}
                note={note}
                onEdit={() => setView('edit', { noteId: note.id })}
                onDelete={() => handleSoftDelete(note.id)}
                onExport={() => setSingleExportNoteId(note.id)}
                cardOpacity={cardOpacity}
              />
            ))
          )}
        </div>

        {/* FAB - New note button */}
        <button
          onClick={() => setView('edit', { noteId: undefined })}
          className="absolute bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          aria-label="新建便签"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* 单篇导出格式选择浮层 */}
      {singleExportNoteId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSingleExportNoteId(null)}>
          <div className="bg-background rounded-xl shadow-2xl p-4 w-56" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3 text-center">导出格式</h3>
            <div className="space-y-1.5">
              {(['txt', 'md', 'csv'] as const).map((fmt) => (
                <button
                  key={fmt}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                  onClick={() => {
                    handleExportSingle(singleExportNoteId, fmt)
                    setSingleExportNoteId(null)
                  }}
                >
                  {fmt === 'txt' ? 'TXT (.txt)' : fmt === 'md' ? 'Markdown (.md)' : 'CSV (.csv)'}
                </button>
              ))}
            </div>
            <button
              className="w-full mt-2 pt-2 border-t border-border text-xs text-muted-foreground text-center hover:text-foreground py-1"
              onClick={() => setSingleExportNoteId(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
