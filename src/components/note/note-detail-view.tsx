'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import type { ContentBlock } from '@/types'
import MarkdownRenderer from './markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

export default function NoteDetailView() {
  const { viewParams, setView, updateNote, removeNote } = useAppStore()
  const allNotes = useAppStore((s) => s.notes)
  const note = useMemo(
    () => allNotes.find((n) => n.id === viewParams.noteId) ?? null,
    [allNotes, viewParams.noteId]
  )
  const [foldStates, setFoldStates] = useState<Record<string, boolean>>({})

  // Initialize fold states from note data
  const noteFoldStates = note?.foldStates ?? {}
  React.useEffect(() => {
    setFoldStates(noteFoldStates)
  }, [note?.id, noteFoldStates])

  const handleToggleFold = useCallback(
    (headingId: string) => {
      const newFoldStates = {
        ...foldStates,
        [headingId]: !foldStates[headingId],
      }
      setFoldStates(newFoldStates)

      // Save fold states to backend
      if (note) {
        const updatedNote = { ...note, foldStates: newFoldStates }
        updateNote(updatedNote)
        fetch(`/api/notes/${note.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foldStates: newFoldStates }),
        }).catch(console.error)
      }
    },
    [foldStates, note, updateNote]
  )

  const handleDelete = async () => {
    if (!note) return
    try {
      await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
      removeNote(note.id)
      setView('list')
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  const renderBlock = (block: ContentBlock, index: number) => {
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
            <img
              src={block.data}
              alt="便签图片"
              className="max-w-full rounded-lg shadow-sm"
            />
          </div>
        )
      case 'handwriting':
        return (
          <div key={block.id || index} className="mb-4">
            <img
              src={block.data}
              alt="手写内容"
              className="max-w-full rounded-lg shadow-sm border"
            />
          </div>
        )
      default:
        return null
    }
  }

  if (!note) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">便签不存在</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setView('list')} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('edit', { noteId: note.id })}
            className="gap-1"
          >
            <Pencil className="h-4 w-4" />
            编辑
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除便签「{note.title || '无标题'}」吗？此操作无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <h1 className="text-2xl font-bold mb-3">{note.title || '无标题'}</h1>
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <span>{format(new Date(note.createdAt), 'yyyy年MM月dd日 HH:mm')}</span>
        </div>
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {note.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
        <div className="border-t pt-4">
          {note.contentBlocks.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无内容</p>
          ) : (
            note.contentBlocks.map((block, index) => renderBlock(block, index))
          )}
        </div>
      </div>
    </div>
  )
}
