export interface Tag {
  id: string
  name: string
  noteCount?: number
}

export interface Note {
  id: string
  title: string
  content: string // Markdown with short references like ![图片](img:uuid)
  images: Record<string, string> // Map of uuid -> base64 data URL
  foldStates: Record<string, boolean>
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  tags: Tag[]
}

export type ViewType = 'list' | 'edit' | 'tags' | 'trash' | 'storage' | 'sync'

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
    .replace(/!\[.*?\]\(img:.*?\)/g, '[图片]')
    .replace(/!\[.*?\]\(hw:.*?\)/g, '[手写]')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
    .replace(/<span[^>]*>(.*?)<\/span>/g, '$1')
    .replace(/<[^>]+>/g, '')
  return plain.substring(0, 120).trim()
}
