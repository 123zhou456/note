'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import MarkdownRenderer, { buildHeadingTree, HeadingNode } from './markdown-renderer'



import TableOfContents from './table-of-contents'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ArrowLeft, Palette, Tag as TagIcon, Bold, Save, Undo2, X, ImageIcon, Pen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera'
import HandwriteCanvas from './handwrite-canvas'

const COLOR_OPTIONS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#795548',
]

/** 安全的 UUID 生成，兼容旧版 WebView */
function safeUUID(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}



export default function NoteEditView() {
  const { viewParams, setView, addNote, updateNote, tags, addTag } = useAppStore()
  const { toast } = useToast()

  // Use a ref to track the actual note ID for saves
  const currentNoteIdRef = useRef<string | null>(viewParams.noteId ?? null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [foldStates, setFoldStates] = useState<Record<string, boolean>>({})
  const [isEditing, setIsEditing] = useState(false)

  const savedCursorPos = useRef(0) // 保存编辑/预览切换时的光标位置
  const [isNewTagOpen, setIsNewTagOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [images, setImages] = useState<Record<string, string>>({})
  const [isHandwriting, setIsHandwriting] = useState(false)
  const [swipedTagId, setSwipedTagId] = useState<string | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  // Store latest values in refs for unmount save（必须先于 useCallback）
  const titleRef = useRef(title)
  const contentRef = useRef(content)
  const foldStatesRef = useRef(foldStates)
  const selectedTagIdsRef = useRef(selectedTagIds)
  const imagesRef = useRef(images)

  titleRef.current = title
  contentRef.current = content
  foldStatesRef.current = foldStates
  selectedTagIdsRef.current = selectedTagIds
  imagesRef.current = images

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadRef = useRef(false)
  const hasUnsavedChanges = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // 撤销历史
  const [canUndo, setCanUndo] = useState(false)
  const historyRef = useRef<string[]>([])
  const MAX_HISTORY = 50

  const pushHistory = useCallback(() => {
    const prev = contentRef.current
    if (!prev) return
    historyRef.current.push(prev)
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    }
    setCanUndo(true)
  }, [])

  // Auto-save with debounce（必须先于 handleUndo）
  const saveNote = useCallback(async () => {
    const noteId = currentNoteIdRef.current
    const noteData = {
      title: titleRef.current || '无标题',
      content: contentRef.current,
      foldStates: foldStatesRef.current,
      tagIds: selectedTagIdsRef.current,
      images: imagesRef.current,
    }

    setSaveStatus('saving')

    try {
      if (noteId) {
        const res = await fetch(`/api/notes/${noteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteData),
        })
        if (res.ok) {
          const updated = await res.json()
          updateNote(updated)
        } else {
          throw new Error('Save failed')
        }
      } else {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteData),
        })
        if (res.ok) {
          const created = await res.json()
          addNote(created)
          currentNoteIdRef.current = created.id
        } else {
          throw new Error('Save failed')
        }
      }
      setSaveStatus('saved')
      hasUnsavedChanges.current = false
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('unsaved')
      toast({ title: '保存失败', description: '请检查网络连接后重试', variant: 'destructive' })
    }
  }, [updateNote, addNote, toast])

  // Debounced auto-save（必须先于 handleUndo）
  const triggerAutoSave = useCallback(() => {
    hasUnsavedChanges.current = true
    setSaveStatus('unsaved')
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      saveNote()
    }, 1500)
  }, [saveNote])

  const handleUndo = useCallback(() => {
    const stack = historyRef.current
    if (stack.length === 0) return
    const prev = stack.pop()!
    setContent(prev)
    contentRef.current = prev
    triggerAutoSave()
    if (stack.length === 0) setCanUndo(false)
    if (!isEditing) setIsEditing(true)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(prev.length, prev.length)
      }
    })
  }, [triggerAutoSave, isEditing])

  // Load existing note data
  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true

    const noteId = viewParams.noteId
    if (noteId) {
      const notes = useAppStore.getState().notes
      const existing = notes.find((n) => n.id === noteId)
      if (existing) {
        setTitle(existing.title)
        setContent(existing.content || '')
        setSelectedTagIds(existing.tags.map((t) => t.id))
        setFoldStates(existing.foldStates || {})
        setImages(existing.images || {})
      }
    }
  }, [viewParams.noteId])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (hasUnsavedChanges.current) {
        const noteId = currentNoteIdRef.current
        const noteData = {
          title: titleRef.current || '无标题',
          content: contentRef.current,
          foldStates: foldStatesRef.current,
          tagIds: selectedTagIdsRef.current,
          images: imagesRef.current,
        }
        if (noteId) {
          fetch(`/api/notes/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(noteData),
          }).catch(console.error)
        } else {
          fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(noteData),
          }).catch(console.error)
        }
      }
    }
  }, [])

  const handleBack = () => {
    if (hasUnsavedChanges.current) {
      saveNote()
    }
    setView('list')
  }

  // Textarea helpers
  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end)

    setContent(newContent)
    triggerAutoSave()

    // Restore cursor position
    requestAnimationFrame(() => {
      textarea.focus()
      const newCursorPos = start + before.length + selectedText.length
      textarea.setSelectionRange(start + before.length, newCursorPos)
    })
  }, [content, triggerAutoSave])

  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      // 没有 textarea 引用时追加到末尾
      const newContent = content + text
      setContent(newContent)
      contentRef.current = newContent
      triggerAutoSave()
      return
    }

    const start = textarea.selectionStart ?? content.length
    const newContent = content.substring(0, start) + text + content.substring(start)

    setContent(newContent)
    contentRef.current = newContent
    triggerAutoSave()

    requestAnimationFrame(() => {
      textarea.focus()
      const newPos = start + text.length
      textarea.setSelectionRange(newPos, newPos)
    })
  }, [content, triggerAutoSave])

  // Bold
  const handleBold = useCallback(() => {
    wrapSelection('**', '**')
  }, [wrapSelection])

  // Color — 用短语法 [c:color]文字[/c] 代替冗长 HTML span
  const handleColor = useCallback((color: string) => {
    wrapSelection(`[c:${color}]`, '[/c]')
  }, [wrapSelection])

  // 插图：从设备相册选图
  const handleInsertImage = useCallback(async () => {
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Photos,
        resultType: CameraResultType.Base64,
        quality: 60,
        width: 1200,
        height: 1200,
      })
      if (!photo.base64String) return

      const uuid = safeUUID()
      const format = photo.format || 'jpeg'
      const dataUrl = `data:image/${format};base64,${photo.base64String}`

      setImages(prev => ({ ...prev, [uuid]: dataUrl }))
      setIsEditing(true)
      requestAnimationFrame(() => {
        insertAtCursor(`\n![插图](img:${uuid})\n`)
      })
    } catch (err) {
      // 用户取消选图时不报错
      if ((err as Error)?.message?.includes('cancelled')) return
      toast({ title: '插入图片失败', description: String(err), variant: 'destructive' })
    }
  }, [insertAtCursor, toast])

  // 手写保存
  const handleHandwriteSave = useCallback((dataUrl: string) => {
    const uuid = safeUUID()
    setImages(prev => ({ ...prev, [uuid]: dataUrl }))
    setIsHandwriting(false)
    setIsEditing(true)
    requestAnimationFrame(() => {
      insertAtCursor(`\n![手写](hw:${uuid})\n`)
    })
  }, [insertAtCursor])

  // Tag management
  const handleCreateTag = useCallback(async () => {
    if (!newTagName.trim()) return
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      })
      if (res.ok) {
        const tag = await res.json()
        addTag(tag)
        setSelectedTagIds((prev) => [...prev, tag.id])
        setNewTagName('')
        setIsNewTagOpen(false)
        triggerAutoSave()
      } else {
        const data = await res.json()
        toast({ title: '创建标签失败', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: '创建标签失败', variant: 'destructive' })
    }
  }, [newTagName, addTag, triggerAutoSave, toast])

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
    triggerAutoSave()
  }, [triggerAutoSave])

  const handleToggleFold = useCallback((headingId: string) => {
    setFoldStates((prev) => ({
      ...prev,
      [headingId]: !prev[headingId],
    }))
  }, [])

  // TOC 跳转：编辑模式定位光标，预览模式滚动视图
  const handleTocNavigate = useCallback((headingId: string) => {
    if (isEditing) {
      const textarea = textareaRef.current
      if (!textarea) return
      const { tree } = buildHeadingTree(content)
      let headingText = ''
      const findText = (nodes: HeadingNode[]): boolean => {
        for (const n of nodes) {
          if (n.id === headingId) { headingText = n.text; return true }
          if (findText(n.children)) return true
        }
        return false
      }
      findText(tree)
      if (!headingText) return
      const lines = content.split('\n')
      let targetLine = -1
      for (let li = 0; li < lines.length; li++) {
        if (lines[li].includes(headingText)) { targetLine = li; break }
      }
      if (targetLine < 0) return
      let pos = 0
      for (let li = 0; li < targetLine; li++) pos += lines[li].length + 1
      textarea.focus()
      textarea.setSelectionRange(pos, pos)
      textarea.scrollTop = Math.max(0, targetLine * 24 - 60)
    } else {
      const el = document.querySelector(`[data-heading-id="${headingId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [isEditing, content])

  // 预览点击 → 精确定位光标
  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    // 如果点击在折叠按钮（button/chevron 图标），不触发编辑切换
    if ((e.target as HTMLElement).closest('button')) {
      return
    }

    // 如果点击在图片上，不触发编辑切换（图片有自己的放大功能）
    if ((e.target as HTMLElement).closest('img')) {
      return
    }

    if (!content.trim()) {
      setIsEditing(true)
      return
    }

    // 从点击的 DOM 元素提取文字
    let target = e.target as HTMLElement
    let clickedText = ''
    const previewDiv = previewRef.current

    // 向上找有文字的最近元素（限制长度避免取到整个容器的文字）
    while (target && target !== previewDiv) {
      if (target.childNodes.length === 1 && target.childNodes[0].nodeType === 3) {
        // 直接文字节点 — 最精确
        clickedText = target.textContent!.trim()
        break
      }
      const tc = target.textContent?.trim()
      if (tc && tc.length > 0 && tc.length < 200) {
        clickedText = tc
        break
      }
      target = target.parentElement as HTMLElement
    }

    let pos = 0
    if (clickedText) {
      // 在 content 中搜索点击的文字
      const searchText = clickedText.substring(0, 80)
      const idx = content.indexOf(searchText)
      if (idx >= 0) {
        pos = idx
      } else {
        // 尝试只搜索前 20 个字符
        const shortText = searchText.substring(0, 20)
        const shortIdx = content.indexOf(shortText)
        pos = shortIdx >= 0 ? shortIdx : 0
      }
    } else {
      // 兜底：按点击位置的比例估算
      if (previewDiv) {
        const rect = previewDiv.getBoundingClientRect()
        const clickY = e.clientY - rect.top + previewDiv.scrollTop
        const ratio = Math.min(1, Math.max(0, previewDiv.scrollHeight > 0 ? clickY / previewDiv.scrollHeight : 0))
        pos = Math.floor(content.length * ratio)
      }
    }

    savedCursorPos.current = pos
    setIsEditing(true)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(pos, pos)
      // 估算行号并滚动
      const lines = content.substring(0, pos).split('\n').length - 1
      textarea.scrollTop = Math.max(0, lines * 24 - 60)
    })
  }, [content])

  // 完成编辑 → 返回预览，按比例同步滚动位置
  const handleDoneEditing = useCallback(() => {
    const textarea = textareaRef.current
    let ratio = 0.5
    if (textarea) {
      const savedPos = textarea.selectionStart
      savedCursorPos.current = savedPos
      // 计算光标在内容中的比例位置
      ratio = textarea.scrollHeight > 0 ? savedPos / content.length : 0
      ratio = Math.min(1, Math.max(0, ratio))
    }
    setIsEditing(false)
    // 下一帧按比例滚动预览
    requestAnimationFrame(() => {
      const previewDiv = previewRef.current
      if (previewDiv && previewDiv.scrollHeight > 0) {
        previewDiv.scrollTop = previewDiv.scrollHeight * ratio
      }
    })
  }, [content])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm border-b px-4 py-2 flex items-center justify-between z-10">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中...' : '未保存'}
          </span>
          <Button size="sm" onClick={saveNote} className="gap-1 bg-emerald-600 hover:bg-emerald-700 h-8 px-3 text-xs">
            <Save className="h-3.5 w-3.5" />
            保存
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="shrink-0 px-4 pt-3">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            triggerAutoSave()
          }}
          placeholder="便签标题"
          className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Tags — 左滑出现删除按钮 */}
      <div
        className="shrink-0 px-4 py-2 flex flex-wrap gap-1.5 items-center"
        onClick={() => { if (swipedTagId) setSwipedTagId(null) }}
      >
        {selectedTagIds.map((tagId) => {
          const tag = tags.find((t) => t.id === tagId)
          if (!tag) return null
          const isSwiped = swipedTagId === tag.id
          return (
            <div
              key={tag.id}
              className="relative overflow-hidden rounded-full"
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0].clientX
                touchStartY.current = e.touches[0].clientY
              }}
              onTouchEnd={(e) => {
                const dx = e.changedTouches[0].clientX - touchStartX.current
                const dy = e.changedTouches[0].clientY - touchStartY.current
                if (dx < -30 && Math.abs(dy) < Math.abs(dx)) {
                  e.stopPropagation()
                  setSwipedTagId(tag.id)
                }
              }}
              onClick={(e) => {
                if (isSwiped) {
                  e.stopPropagation()
                  toggleTag(tag.id)
                  setSwipedTagId(null)
                }
              }}
            >
              <Badge
                variant="secondary"
                className={`text-xs gap-1 pr-1 transition-all duration-200 ${
                  isSwiped ? 'opacity-30 pr-7' : ''
                }`}
              >
                {tag.name}
              </Badge>
              {isSwiped && (
                <button
                  className="absolute right-0 top-0 bottom-0 px-2 flex items-center bg-red-500 text-white rounded-r-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleTag(tag.id)
                    setSwipedTagId(null)
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )
        })}
        <Popover open={isNewTagOpen} onOpenChange={setIsNewTagOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
              <TagIcon className="h-3 w-3" />
              标签
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1.5">
              {selectedTagIds.length > 0 && (
                <>
                  <div className="text-[10px] text-muted-foreground font-medium px-1 mb-1">
                    已选标签（点击移除）
                  </div>
                  {tags.filter((t) => selectedTagIds.includes(t.id)).map((tag) => (
                    <button
                      key={tag.id}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-destructive/10 rounded flex items-center justify-between"
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span>{tag.name}</span>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  ))}
                  <div className="border-t my-1" />
                </>
              )}
              <div className="text-[10px] text-muted-foreground font-medium px-1 mb-1">
                添加标签
              </div>
              {tags
                .filter((t) => !selectedTagIds.includes(t.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              {tags.filter((t) => !selectedTagIds.includes(t.id)).length > 0 && (
                <div className="border-t my-1" />
              )}
              <div className="flex gap-1">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="新标签名称"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateTag()
                  }}
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleCreateTag}>
                  创建
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Toolbar — 固定在标签栏下 */}
      <div className="shrink-0 px-4 py-1.5 border-y bg-muted/30 flex items-center gap-1 overflow-x-auto z-10">
        <button
          className="h-7 px-2 text-xs rounded-md bg-muted/50 hover:bg-muted transition-colors shrink-0 font-mono font-bold text-emerald-600"
          onClick={() => { setIsEditing(true); requestAnimationFrame(() => insertAtCursor('# ')) }}
          title="一级标题"
        >
          H1
        </button>
        <button
          className="h-7 px-2 text-xs rounded-md bg-muted/50 hover:bg-muted transition-colors shrink-0 font-mono font-semibold text-blue-600"
          onClick={() => { setIsEditing(true); requestAnimationFrame(() => insertAtCursor('## ')) }}
          title="二级标题"
        >
          H2
        </button>
        <button
          className="h-7 px-2 text-xs rounded-md bg-muted/50 hover:bg-muted transition-colors shrink-0 font-mono font-medium text-amber-600"
          onClick={() => { setIsEditing(true); requestAnimationFrame(() => insertAtCursor('### ')) }}
          title="三级标题"
        >
          H3
        </button>

        <div className="w-px h-5 bg-border shrink-0" />

        <button
          className="h-7 w-7 flex items-center justify-center rounded-md bg-muted/50 hover:bg-muted transition-colors shrink-0"
          onClick={() => { setIsEditing(true); requestAnimationFrame(() => handleBold()) }}
          title="加粗"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <Popover>
          <PopoverTrigger asChild>
            <button className="h-7 w-7 flex items-center justify-center rounded-md bg-muted/50 hover:bg-muted transition-colors shrink-0" title="文字颜色">
              <Palette className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  className="w-7 h-7 rounded-full border-2 border-transparent transition-transform hover:scale-110 hover:border-foreground/50"
                  style={{ backgroundColor: color }}
                  onClick={() => { setIsEditing(true); handleColor(color) }}
                  title={color}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* 插图 */}
        <button
          className="h-7 w-7 flex items-center justify-center rounded-md bg-muted/50 hover:bg-muted transition-colors shrink-0"
          onClick={handleInsertImage}
          title="插入图片"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>

        {/* 手写 */}
        <button
          className="h-7 w-7 flex items-center justify-center rounded-md bg-muted/50 hover:bg-muted transition-colors shrink-0"
          onClick={() => setIsHandwriting(true)}
          title="手写"
        >
          <Pen className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* 撤销 */}
        <button
          className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors shrink-0 ${
            canUndo ? 'bg-muted/50 hover:bg-muted text-foreground' : 'text-muted-foreground/30 cursor-not-allowed'
          }`}
          onClick={() => canUndo && handleUndo()}
          title="撤销"
          disabled={!canUndo}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 内容区：单一视图 */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* 预览模式 — 点击内容进入编辑 */}
        {!isEditing && (
          <div
            ref={previewRef}
            className="h-full overflow-y-auto px-4 pb-4 custom-scrollbar cursor-pointer"
            onClick={handlePreviewClick}
          >
            <div className="py-3">
              {!content.trim() ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground select-none">
                  <p className="text-sm">点击此处开始编辑</p>
                  <p className="text-xs mt-2">回车即分段，# 空格=标题，**加粗**</p>
                </div>
              ) : (
                <MarkdownRenderer
                  content={content}
                  foldStates={foldStates}
                  onToggleFold={handleToggleFold}
                  images={images}
                />
              )}
            </div>
          </div>
        )}

        {/* 编辑模式 */}
        {isEditing && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/30 bg-muted/20 shrink-0">
              <span className="text-xs text-muted-foreground">编辑 (点击「完成」查看预览)</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{content.length} 字</span>
                <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700" onClick={handleDoneEditing}>
                  完成 ✓
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                const prev = contentRef.current
                setContent(e.target.value)
                contentRef.current = e.target.value
                triggerAutoSave()
                if (undoDebounceRef.current) clearTimeout(undoDebounceRef.current)
                undoDebounceRef.current = setTimeout(() => {
                  if (prev && !historyRef.current.includes(prev)) {
                    historyRef.current.push(prev)
                    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
                    setCanUndo(true)
                  }
                }, 2000)
              }}
              placeholder="输入内容..."
              className="flex-1 w-full resize-none border-0 bg-transparent focus:outline-none text-base px-4 py-3"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* 目录导航 — 两者模式均可用 */}
      <TableOfContents
        content={content}
        containerRef={previewRef}
        onNavigate={handleTocNavigate}
        isEditing={isEditing}
      />

      {/* 手写画布覆盖层 */}
      {isHandwriting && (
        <HandwriteCanvas
          onSave={handleHandwriteSave}
          onCancel={() => setIsHandwriting(false)}
        />
      )}

    </div>
  )
}
