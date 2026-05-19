'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import type { ContentBlock, TextBlock } from '@/types'
import { createTextBlock, createImageBlock, createHandwritingBlock } from '@/types'
import MarkdownRenderer from './markdown-renderer'
import HandwritingCanvas from './handwriting-canvas'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ArrowLeft, Eye, Edit3, Image as ImageIcon, PenTool, Palette, Tag as TagIcon, Plus, X, Trash2, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const COLOR_OPTIONS = [
  '#000000', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#795548',
]

export default function NoteEditView() {
  const { viewParams, setView, addNote, updateNote, tags, addTag } = useAppStore()
  const { toast } = useToast()

  // Use a ref to track the actual note ID for saves (avoids mutating viewParams)
  const currentNoteIdRef = useRef<string | null>(viewParams.noteId ?? null)

  const [title, setTitle] = useState('')
  const [blocks, setBlocks] = useState<ContentBlock[]>([createTextBlock()])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [foldStates, setFoldStates] = useState<Record<string, boolean>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [showHandwriting, setShowHandwriting] = useState(false)
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const [currentColor, setCurrentColor] = useState<string | undefined>(undefined)
  const [isNewTagOpen, setIsNewTagOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadRef = useRef(false)
  const hasUnsavedChanges = useRef(false)
  // Store latest values in refs for unmount save
  const titleRef = useRef(title)
  const blocksRef = useRef(blocks)
  const foldStatesRef = useRef(foldStates)
  const selectedTagIdsRef = useRef(selectedTagIds)

  // Keep refs in sync
  titleRef.current = title
  blocksRef.current = blocks
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
        setBlocks(existing.contentBlocks.length > 0 ? existing.contentBlocks : [createTextBlock()])
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
      contentBlocks: blocksRef.current,
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
          // Update the ref so subsequent saves are updates
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
          contentBlocks: blocksRef.current,
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

  // Block management
  const updateBlock = useCallback((blockId: string, updates: Partial<ContentBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b))
    )
    triggerAutoSave()
  }, [triggerAutoSave])

  const removeBlock = useCallback((blockId: string) => {
    setBlocks((prev) => {
      const filtered = prev.filter((b) => b.id !== blockId)
      return filtered.length === 0 ? [createTextBlock()] : filtered
    })
    triggerAutoSave()
  }, [triggerAutoSave])

  const insertBlockAfter = useCallback((afterBlockId: string | null, block: ContentBlock) => {
    setBlocks((prev) => {
      if (!afterBlockId) {
        return [...prev, block]
      }
      const index = prev.findIndex((b) => b.id === afterBlockId)
      if (index === -1) return [...prev, block]
      const newBlocks = [...prev]
      newBlocks.splice(index + 1, 0, block)
      return newBlocks
    })
    setActiveBlockId(block.id)
    triggerAutoSave()
  }, [triggerAutoSave])

  // Image insertion
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
        const imageBlock = createImageBlock(result)
        insertBlockAfter(activeBlockId, imageBlock)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }, [activeBlockId, insertBlockAfter])

  // Handwriting insertion
  const handleHandwritingComplete = useCallback((base64Data: string) => {
    const hwBlock = createHandwritingBlock(base64Data)
    insertBlockAfter(activeBlockId, hwBlock)
    setShowHandwriting(false)
  }, [activeBlockId, insertBlockAfter])

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
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => toggleTag(tag.id)}
              />
            </Badge>
          )
        })}
        <Popover open={isNewTagOpen} onOpenChange={setIsNewTagOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
              <TagIcon className="h-3 w-3" />
              添加标签
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-2">
              {tags
                .filter((t) => !selectedTagIds.includes(t.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded"
                    onClick={() => {
                      toggleTag(tag.id)
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              {tags.filter((t) => !selectedTagIds.includes(t.id)).length > 0 && (
                <div className="border-t pt-2" />
              )}
              <div className={tags.filter((t) => !selectedTagIds.includes(t.id)).length > 0 ? '' : ''}>
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
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
        {showPreview ? (
          // Preview mode
          <div className="py-2">
            {blocks.map((block, index) => {
              switch (block.type) {
                case 'text':
                  return (
                    <div key={block.id || index} className="mb-4">
                      <MarkdownRenderer
                        content={block.data}
                        color={block.color}
                        foldStates={foldStates}
                        onToggleFold={handleToggleFold}
                      />
                    </div>
                  )
                case 'image':
                  return (
                    <div key={block.id || index} className="mb-4">
                      <img src={block.data} alt="图片" className="max-w-full rounded-lg" />
                    </div>
                  )
                case 'handwriting':
                  return (
                    <div key={block.id || index} className="mb-4">
                      <img src={block.data} alt="手写内容" className="max-w-full rounded-lg border" />
                    </div>
                  )
                default:
                  return null
              }
            })}
          </div>
        ) : (
          // Edit mode
          <div className="py-2 space-y-3">
            {blocks.map((block, index) => {
              switch (block.type) {
                case 'text':
                  return (
                    <div
                      key={block.id || index}
                      className={`relative border rounded-lg p-2 transition-colors ${
                        activeBlockId === block.id ? 'border-emerald-400 bg-emerald-50/50' : 'border-border'
                      }`}
                      onClick={() => setActiveBlockId(block.id)}
                    >
                      {block.color && (
                        <div
                          className="absolute top-1 right-8 w-3 h-3 rounded-full border"
                          style={{ backgroundColor: block.color }}
                        />
                      )}
                      <textarea
                        value={block.data}
                        onChange={(e) => {
                          updateBlock(block.id, { data: e.target.value } as Partial<TextBlock>)
                        }}
                        onFocus={() => setActiveBlockId(block.id)}
                        placeholder="输入Markdown内容..."
                        className="w-full min-h-[80px] resize-y border-0 bg-transparent focus:outline-none text-sm font-mono"
                        style={block.color ? { color: block.color } : undefined}
                      />
                      {blocks.length > 1 && (
                        <button
                          className="absolute top-1 right-1 p-0.5 text-muted-foreground hover:text-destructive"
                          onClick={() => setShowDeleteDialog(block.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {/* Live mini preview */}
                      {block.data.trim() && (
                        <div className="mt-2 pt-2 border-t border-dashed">
                          <p className="text-xs text-muted-foreground mb-1">预览:</p>
                          <MarkdownRenderer
                            content={block.data}
                            color={block.color}
                            foldStates={foldStates}
                            onToggleFold={handleToggleFold}
                          />
                        </div>
                      )}
                    </div>
                  )
                case 'image':
                  return (
                    <div
                      key={block.id || index}
                      className={`relative border rounded-lg p-2 transition-colors ${
                        activeBlockId === block.id ? 'border-emerald-400' : 'border-border'
                      }`}
                      onClick={() => setActiveBlockId(block.id)}
                    >
                      <img src={block.data} alt="图片" className="max-w-full rounded" />
                      <button
                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                        onClick={() => setShowDeleteDialog(block.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                case 'handwriting':
                  return (
                    <div
                      key={block.id || index}
                      className={`relative border rounded-lg p-2 transition-colors ${
                        activeBlockId === block.id ? 'border-emerald-400' : 'border-border'
                      }`}
                      onClick={() => setActiveBlockId(block.id)}
                    >
                      <img src={block.data} alt="手写内容" className="max-w-full rounded" />
                      <button
                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                        onClick={() => setShowDeleteDialog(block.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                default:
                  return null
              }
            })}

            {/* Add block buttons */}
            <div className="flex items-center gap-2 py-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  const newBlock = createTextBlock('', currentColor)
                  insertBlockAfter(activeBlockId, newBlock)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                文本
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleInsertImage}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                图片
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setShowHandwriting(true)}
              >
                <PenTool className="h-3.5 w-3.5" />
                手写
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm border-t px-4 py-2 flex items-center gap-2">
        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <Palette className="h-4 w-4" />
              <span className="text-xs">颜色</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    currentColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setCurrentColor(color === '#000000' ? undefined : color)
                    if (activeBlockId) {
                      updateBlock(activeBlockId, { color: color === '#000000' ? undefined : color } as Partial<TextBlock>)
                    }
                  }}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => {
                setCurrentColor(undefined)
                if (activeBlockId) {
                  updateBlock(activeBlockId, { color: undefined } as Partial<TextBlock>)
                }
              }}
            >
              默认颜色
            </Button>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" className="gap-1" onClick={handleInsertImage}>
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setShowHandwriting(true)}>
          <PenTool className="h-4 w-4" />
        </Button>
      </div>

      {/* Handwriting canvas overlay */}
      {showHandwriting && (
        <HandwritingCanvas
          onComplete={handleHandwritingComplete}
          onCancel={() => setShowHandwriting(false)}
        />
      )}

      {/* Delete block confirmation */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={(open) => !open && setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个内容块吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (showDeleteDialog) {
                  removeBlock(showDeleteDialog)
                  setShowDeleteDialog(null)
                }
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
