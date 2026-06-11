'use client'

import React, { useCallback, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ArrowLeft, RotateCcw, Trash2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

export default function RecycleBinView() {
  const { notes, updateNote, removeNote, setView } = useAppStore()
  const { toast } = useToast()
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null)

  const trashNotes = notes.filter((n) => !!n.deletedAt)

  const handleRestore = useCallback(async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedAt: null }),
      })
      if (res.ok) {
        const updated = await res.json()
        updateNote(updated)
        toast({ title: '已恢复便签' })
      }
    } catch {
      toast({ title: '恢复失败', variant: 'destructive' })
    }
  }, [updateNote, toast])

  const handlePermanentDelete = useCallback(async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}?permanent=true`, { method: 'DELETE' })
      if (res.ok) {
        removeNote(noteId)
        setPermanentDeleteId(null)
        toast({ title: '已永久删除' })
      }
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    }
  }, [removeNote, toast])

  const handleClearAll = useCallback(async () => {
    try {
      await Promise.all(
        trashNotes.map((note) =>
          fetch(`/api/notes/${note.id}?permanent=true`, { method: 'DELETE' })
        )
      )
      trashNotes.forEach((note) => removeNote(note.id))
      toast({ title: '回收站已清空' })
    } catch {
      toast({ title: '清空失败', variant: 'destructive' })
    }
  }, [trashNotes, removeNote, toast])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setView('list')} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <h1 className="text-lg font-semibold">回收站</h1>
        {trashNotes.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs">
                清空
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清空回收站</AlertDialogTitle>
                <AlertDialogDescription>
                  将永久删除回收站中的所有便签，此操作无法撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-white hover:bg-destructive/90">
                  清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Trash list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
        {trashNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Trash2 className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">回收站为空</p>
          </div>
        ) : (
          trashNotes.map((note) => (
            <div
              key={note.id}
              className="border rounded-lg p-4 bg-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base line-clamp-1">
                    {note.title || '无标题'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    删除于 {format(new Date(note.deletedAt!), 'yyyy年MM月dd日 HH:mm')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    创建于 {format(new Date(note.createdAt), 'yyyy年MM月dd日 HH:mm')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-emerald-600 hover:text-emerald-700"
                    onClick={() => handleRestore(note.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    恢复
                  </Button>
                  <AlertDialog open={permanentDeleteId === note.id} onOpenChange={(open) => !open && setPermanentDeleteId(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-destructive hover:text-destructive"
                        onClick={() => setPermanentDeleteId(note.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>永久删除</AlertDialogTitle>
                        <AlertDialogDescription>
                          确定要永久删除便签「{note.title || '无标题'}」吗？此操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handlePermanentDelete(note.id)}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          永久删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
