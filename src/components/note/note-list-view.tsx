'use client'

import React, { useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { getContentPreview } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, ArrowUpDown, Tag as TagIcon, Image as ImageIcon, Settings, X, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

// Swipeable note card component
function SwipeableNoteCard({ note, onEdit, onDelete }: {
  note: { id: string; title: string; content: string; createdAt: string; tags: { id: string; name: string }[] }
  onEdit: () => void
  onDelete: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [offsetX, setOffsetX] = useState(0)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)
  const isDragging = useRef(false)
  const DELETE_THRESHOLD = -70

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
      {/* Delete button underneath */}
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

      {/* Card content */}
      <div
        ref={cardRef}
        className="relative z-10 bg-card border rounded-lg transition-transform"
        style={{ transform: `translateX(${offsetX}px)` }}
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
                  <Badge key={tag.id} variant="secondary" className="text-xs">
                    {tag.name}
                  </Badge>
                ))}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
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
    removeNote,
  } = useAppStore()

  const displayNotes = filteredNotes()

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

  return (
    <div className="flex flex-col h-full relative">
      {/* Background image layer */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}

      {/* Content layer */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 bg-background/80 backdrop-blur-sm border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">日记便签</h1>
            <div className="flex items-center gap-1">
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
                    className="cursor-pointer text-xs select-none transition-colors"
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
    </div>
  )
}
