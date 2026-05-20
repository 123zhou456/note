'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import MarkdownRenderer from './markdown-renderer'
import HandwritingCanvas from './handwriting-canvas'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ArrowLeft, Eye, Edit3, Image as ImageIcon, PenTool, Palette, Tag as TagIcon, Bold, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const COLOR_OPTIONS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#795548',
]

export default function NoteEditView() {
  const { viewParams, setView, addNote, updateNote, tags, addTag } = useAppStore()
  const { toast } = useToast()

  // Use a ref to track the actual note ID for saves
  const currentNoteIdRef = useRef<string | null>(viewParams.noteId ?? null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [foldStates, setFoldStates] = useState<Record<string, boolean>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [showHandwriting, setShowHandwriting] = useState(false)
  const [isNewTagOpen, setIsNewTagOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadRef = useRef(false)
  const hasUnsavedChanges = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Store latest values in refs for unmount save
  const titleRef = useRef(title)
  const contentRef = useRef(content)
  const foldStatesRef = useRef(foldStates)
  const selectedTagIdsRef = useRef(selectedTagIds)

  titleRef.current = title
  contentRef.current = content
  foldStatesRef.current = foldStates
  selectedTagIdsRef.current = selectedTagIds

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
      }
    }
  }, [viewParams.noteId])

  // Auto-save with debounce
  const saveNote = useCallback(async () => {
    const noteId = currentNoteIdRef.current
    const noteData = {
      title: titleRef.current || '无标题',
      content: contentRef.current,
      foldStates: foldStatesRef.current,
      tagIds: selectedTagIdsRef.current,
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

  // Debounced auto-save
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
    if (!textarea) return

    const start = textarea.selectionStart
    const newContent = content.substring(0, start) + text + content.substring(start)

    setContent(newContent)
    triggerAutoSave()

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    })
  }, [content, triggerAutoSave])

  // Bold
  const handleBold = useCallback(() => {
    wrapSelection('**', '**')
  }, [wrapSelection])

  // Color - wrap selected text with span
  const handleColor = useCallback((color: string) => {
    wrapSelection(`<span style="color:${color}">`, '</span>')
  }, [wrapSelection])

  // Image insertion - inline in markdown
  const handleInsertImage = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        if (!result) return
        insertAtCursor(`\n![图片](${result})\n`)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }, [insertAtCursor])

  // Handwriting insertion - inline in markdown
  const handleHandwritingComplete = useCallback((base64Data: string) => {
    if (!base64Data) return
    insertAtCursor(`\n![手写](${base64Data})\n`)
    setShowHandwriting(false)
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm border-b px-4 py-2 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中...' : '未保存'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-1"
          >
            {showPreview ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? '编辑' : '预览'}
          </Button>
          <Button size="sm" onClick={saveNote} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
            <Save className="h-4 w-4" />
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

      {/* Tags */}
      <div className="shrink-0 px-4 py-2 flex flex-wrap gap-1.5 items-center">
        {selectedTagIds.map((tagId) => {
          const tag = tags.find((t) => t.id === tagId)
          if (!tag) return null
          return (
            <Badge key={tag.id} variant="secondary" className="text-xs gap-1">
              {tag.name}
            </Badge>
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

      {/* Toolbar - between tags and text area */}
      {!showPreview && (
        <div className="shrink-0 px-4 py-1.5 border-y bg-muted/30 flex items-center gap-1 overflow-x-auto">
          {/* Bold */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 font-bold"
            onClick={handleBold}
            title="加粗"
          >
            <Bold className="h-4 w-4" />
          </Button>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Color picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 shrink-0" title="文字颜色">
                <Palette className="h-4 w-4" />
                <span className="text-xs">颜色</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    className="w-7 h-7 rounded-full border-2 border-transparent transition-transform hover:scale-110 hover:border-foreground/50"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Insert image */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 shrink-0"
            onClick={handleInsertImage}
            title="插入图片"
          >
            <ImageIcon className="h-4 w-4" />
            <span className="text-xs">图片</span>
          </Button>

          {/* Insert handwriting */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 shrink-0"
            onClick={() => setShowHandwriting(true)}
            title="插入手写"
          >
            <PenTool className="h-4 w-4" />
            <span className="text-xs">手写</span>
          </Button>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
        {showPreview ? (
          <div className="py-3">
            <MarkdownRenderer
              content={content}
              foldStates={foldStates}
              onToggleFold={handleToggleFold}
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              triggerAutoSave()
            }}
            placeholder="输入Markdown内容..."
            className="w-full h-full min-h-[300px] resize-none border-0 bg-transparent focus:outline-none text-sm font-mono leading-relaxed py-3"
          />
        )}
      </div>

      {/* Handwriting canvas overlay */}
      {showHandwriting && (
        <HandwritingCanvas
          onComplete={handleHandwritingComplete}
          onCancel={() => setShowHandwriting(false)}
        />
      )}
    </div>
  )
}
