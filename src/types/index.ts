export interface TextBlock {
  id: string
  type: 'text'
  data: string
  color?: string
}

export interface ImageBlock {
  id: string
  type: 'image'
  data: string // base64
}

export interface HandwritingBlock {
  id: string
  type: 'handwriting'
  data: string // base64
}

export type ContentBlock = TextBlock | ImageBlock | HandwritingBlock

export interface Tag {
  id: string
  name: string
  noteCount?: number
}

export interface Note {
  id: string
  title: string
  contentBlocks: ContentBlock[]
  foldStates: Record<string, boolean>
  createdAt: string
  updatedAt: string
  tags: Tag[]
}

export type ViewType = 'list' | 'detail' | 'edit' | 'tags'

export type SortOrder = 'time-desc' | 'time-asc' | 'tag'

export interface AppState {
  view: ViewType
  viewParams: { noteId?: string }
  selectedTagIds: string[]
  sortOrder: SortOrder
  backgroundImage: string | null
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

export function createTextBlock(data: string = '', color?: string): TextBlock {
  return { id: generateId(), type: 'text', data, color }
}

export function createImageBlock(data: string): ImageBlock {
  return { id: generateId(), type: 'image', data }
}

export function createHandwritingBlock(data: string): HandwritingBlock {
  return { id: generateId(), type: 'handwriting', data }
}

export function getBlockPreviewText(blocks: ContentBlock[]): string {
  const textBlocks = blocks.filter((b) => b.type === 'text') as TextBlock[]
  if (textBlocks.length === 0) return ''
  const firstText = textBlocks[0].data
  // Strip markdown syntax for preview
  const plain = firstText
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '[图片]')
  return plain.substring(0, 100)
}
