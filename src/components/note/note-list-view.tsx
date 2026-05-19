'use client'

import React, { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { getBlockPreviewText } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, ArrowUpDown, Tag as TagIcon, Image as ImageIcon, Settings, X } from 'lucide-react'
import { format } from 'date-fns'

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
        // Save to server
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
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b px-4 py-3">
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
              <Card
                key={note.id}
                className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => setView('detail', { noteId: note.id })}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-1.5">
                    <h3 className="font-semibold text-base line-clamp-1">
                      {note.title || '无标题'}
                    </h3>
                    {getBlockPreviewText(note.contentBlocks) && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {getBlockPreviewText(note.contentBlocks)}
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
                    {/* Show image/handwriting indicators */}
                    {note.contentBlocks.some((b) => b.type === 'image' || b.type === 'handwriting') && (
                      <div className="flex gap-1.5 mt-1">
                        {note.contentBlocks
                          .filter((b) => b.type === 'image' || b.type === 'handwriting')
                          .slice(0, 3)
                          .map((block) => (
                            <div
                              key={block.id}
                              className="w-12 h-12 rounded overflow-hidden bg-muted"
                            >
                              <img
                                src={block.data}
                                alt={block.type === 'image' ? '图片' : '手写'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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
