export interface Tag {
  id: string
  name: string
  noteCount?: number
}

export interface Note {
  id: string
  title: string
  content: string // Single markdown string with inline images/handwriting
  foldStates: Record<string, boolean>
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  tags: Tag[]
}

export type ViewType = 'list' | 'edit' | 'tags' | 'trash'

export type SortOrder = 'time-desc' | 'time-asc' | 'tag'

export function getContentPreview(content: string): string {
  if (!content) return ''
  // Strip markdown syntax for preview
  const plain = content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/<span[^>]*>(.*?)<\/span>/g, '$1')
    .replace(/<[^>]+>/g, '')
  return plain.substring(0, 120).trim()
}
