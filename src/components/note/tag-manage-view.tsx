'use client'

import React, { useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, Tag as TagIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function TagManageView() {
  const { tags, setView, addTag, updateTag, removeTag } = useAppStore()
  const { toast } = useToast()

  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null)

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
        setNewTagName('')
      } else {
        const data = await res.json()
        toast({ title: '创建失败', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: '创建失败', variant: 'destructive' })
    }
  }, [newTagName, addTag, toast])

  const handleRenameTag = useCallback(async (tagId: string) => {
    if (!editingTagName.trim() || editingTagId !== tagId) return
    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTagName.trim() }),
      })
      if (res.ok) {
        const tag = await res.json()
        updateTag(tag)
        setEditingTagId(null)
        setEditingTagName('')
      } else {
        const data = await res.json()
        toast({ title: '重命名失败', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: '重命名失败', variant: 'destructive' })
    }
  }, [editingTagName, editingTagId, updateTag, toast])

  const handleDeleteTag = useCallback(async (tagId: string) => {
    try {
      const res = await fetch(`/api/tags/${tagId}`, { method: 'DELETE' })
      if (res.ok) {
        removeTag(tagId)
        setDeleteTagId(null)
      } else {
        toast({ title: '删除失败', variant: 'destructive' })
      }
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    }
  }, [removeTag, toast])

  const startEditing = (tagId: string, currentName: string) => {
    setEditingTagId(tagId)
    setEditingTagName(currentName)
  }

  const cancelEditing = () => {
    setEditingTagId(null)
    setEditingTagName('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setView('list')} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <h1 className="text-lg font-semibold">标签管理</h1>
      </div>

      {/* Create new tag */}
      <div className="px-4 py-3 border-b">
        <div className="flex gap-2">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="输入标签名称"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTag()
            }}
          />
          <Button onClick={handleCreateTag} disabled={!newTagName.trim()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" />
            创建
          </Button>
        </div>
      </div>

      {/* Tag list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <TagIcon className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">暂无标签</p>
            <p className="text-xs mt-1">在上方输入标签名称创建标签</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                {editingTagId === tag.id ? (
                  <>
                    <Input
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      className="flex-1 h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameTag(tag.id)
                        if (e.key === 'Escape') cancelEditing()
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-emerald-600"
                      onClick={() => handleRenameTag(tag.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={cancelEditing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="text-sm font-medium">{tag.name}</span>
                      {tag.noteCount !== undefined && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {tag.noteCount}篇便签
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startEditing(tag.id, tag.name)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog open={deleteTagId === tag.id} onOpenChange={(open) => !open && setDeleteTagId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTagId(tag.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除标签「{tag.name}」吗？关联该标签的便签不会被删除，仅移除标签关联。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTag(tag.id)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
