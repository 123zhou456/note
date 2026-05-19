'use client'

import React, { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import NoteListView from '@/components/note/note-list-view'
import NoteDetailView from '@/components/note/note-detail-view'
import NoteEditView from '@/components/note/note-edit-view'
import TagManageView from '@/components/note/tag-manage-view'
import { motion, AnimatePresence } from 'framer-motion'

export default function Home() {
  const { view, setNotes, setTags, setBackgroundImage } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [notesRes, tagsRes, bgRes] = await Promise.all([
          fetch('/api/notes'),
          fetch('/api/tags'),
          fetch('/api/settings?key=backgroundImage'),
        ])

        if (notesRes.ok) {
          const notes = await notesRes.json()
          setNotes(notes)
        }

        if (tagsRes.ok) {
          const tags = await tagsRes.json()
          setTags(tags)
        }

        if (bgRes.ok) {
          const bgData = await bgRes.json()
          if (bgData.value) {
            setBackgroundImage(bgData.value)
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [setNotes, setTags, setBackgroundImage])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center max-w-lg mx-auto">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  const showFooter = view === 'list'

  const getSlideDirection = (currentView: string) => {
    if (currentView === 'list') return { x: -300, opacity: 0 }
    return { x: 300, opacity: 0 }
  }

  return (
    <div className="h-full flex flex-col max-w-lg mx-auto bg-background shadow-xl relative">
      <main className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={getSlideDirection(view)}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: view === 'list' ? 300 : -300, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {view === 'list' && <NoteListView />}
            {view === 'detail' && <NoteDetailView />}
            {view === 'edit' && <NoteEditView />}
            {view === 'tags' && <TagManageView />}
          </motion.div>
        </AnimatePresence>
      </main>
      {showFooter && (
        <footer className="py-2 text-center text-xs text-muted-foreground border-t bg-background/80 shrink-0">
          日记便签
        </footer>
      )}
    </div>
  )
}
