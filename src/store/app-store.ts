import { create } from 'zustand'
import type { ViewType, SortOrder, Note, Tag } from '@/types'

interface AppStore {
  // View state
  view: ViewType
  viewParams: { noteId?: string }
  setView: (view: ViewType, params?: { noteId?: string }) => void

  // Data
  notes: Note[]
  tags: Tag[]
  setNotes: (notes: Note[]) => void
  setTags: (tags: Tag[]) => void
  addNote: (note: Note) => void
  updateNote: (note: Note) => void
  removeNote: (id: string) => void
  addTag: (tag: Tag) => void
  updateTag: (tag: Tag) => void
  removeTag: (id: string) => void

  // Filter & sort
  selectedTagIds: string[]
  sortOrder: SortOrder
  setSelectedTagIds: (ids: string[]) => void
  toggleTagSelection: (tagId: string) => void
  clearTagSelection: () => void
  setSortOrder: (order: SortOrder) => void

  // Background image
  backgroundImage: string | null
  setBackgroundImage: (url: string | null) => void

  // Computed: filtered and sorted notes
  filteredNotes: () => Note[]
}

export const useAppStore = create<AppStore>((set, get) => ({
  view: 'list',
  viewParams: {},
  setView: (view, params = {}) => set({ view, viewParams: params }),

  notes: [],
  tags: [],
  setNotes: (notes) => set({ notes }),
  setTags: (tags) => set({ tags }),
  addNote: (note) => set((state) => ({ notes: [note, ...state.notes] })),
  updateNote: (note) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === note.id ? note : n)),
    })),
  removeNote: (id) =>
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
    })),
  addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
  updateTag: (tag) =>
    set((state) => ({
      tags: state.tags.map((t) => (t.id === tag.id ? tag : t)),
      notes: state.notes.map((n) => ({
        ...n,
        tags: n.tags.map((t) => (t.id === tag.id ? tag : t)),
      })),
    })),
  removeTag: (id) =>
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== id),
      notes: state.notes.map((n) => ({
        ...n,
        tags: n.tags.filter((t) => t.id !== id),
      })),
    })),

  selectedTagIds: [],
  sortOrder: 'time-desc',
  setSelectedTagIds: (ids) => set({ selectedTagIds: ids }),
  toggleTagSelection: (tagId) =>
    set((state) => ({
      selectedTagIds: state.selectedTagIds.includes(tagId)
        ? state.selectedTagIds.filter((id) => id !== tagId)
        : [...state.selectedTagIds, tagId],
    })),
  clearTagSelection: () => set({ selectedTagIds: [] }),
  setSortOrder: (order) => set({ sortOrder: order }),

  backgroundImage: null,
  setBackgroundImage: (url) => set({ backgroundImage: url }),

  filteredNotes: () => {
    const { notes, selectedTagIds, sortOrder } = get()

    let filtered = notes

    // Multi-tag AND filter
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter((note) =>
        selectedTagIds.every((tagId) =>
          note.tags.some((tag) => tag.id === tagId)
        )
      )
    }

    // Sort
    switch (sortOrder) {
      case 'time-desc':
        filtered = [...filtered].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        break
      case 'time-asc':
        filtered = [...filtered].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        break
      case 'tag':
        filtered = [...filtered].sort((a, b) => {
          const aName = a.tags[0]?.name || 'zzz'
          const bName = b.tags[0]?.name || 'zzz'
          return aName.localeCompare(bName)
        })
        break
    }

    return filtered
  },
}))
