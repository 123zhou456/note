'use client'

import React, { useCallback, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, ChevronDown, X, ZoomIn } from 'lucide-react'

interface MarkdownRendererProps {
  content: string
  foldStates: Record<string, boolean>
  onToggleFold: (headingId: string) => void
  images?: Record<string, string>
}

// ---------- 预处理：让编辑体验更接近文档而非代码 ----------

// 1. 将 [c:color]text[/c] 转换为 HTML 彩色 span
function resolveColorSpans(md: string): string {
  return md.replace(
    /\[c:([a-z0-9#]+)\]([\s\S]*?)\[\/c\]/g,
    (_m, color, text) => `<span style="color:${color}">${text}</span>`
  )
}

// 2. 回车即分段（跳过代码块内的内容）
function normalizeParagraphs(md: string): string {
  const codeBlockRegex = /(`{3,}[\s\S]*?`{3,})/g
  const parts = md.split(codeBlockRegex)
  return parts.map((part, i) => {
    // 奇数索引是代码块（split 的捕获组）
    if (i % 2 === 1) return part
    return part.replace(/(\S)\n(?!\n)/g, '$1\n\n')
  }).join('')
}

// ---------- Blob URL 缓存（以 uuid 为 key）----------
const blobUrlCache = new Map<string, string>()

function getOrCreateBlobUrl(uuid: string, dataUrl: string): string {
  const cached = blobUrlCache.get(uuid)
  if (cached) return cached

  try {
    const [header, base64Data] = dataUrl.split(',')
    if (!header || !base64Data) return dataUrl
    const mimeMatch = header.match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/png'
    const binary = atob(base64Data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })
    const url = URL.createObjectURL(blob)
    blobUrlCache.set(uuid, url)
    return url
  } catch {
    return dataUrl
  }
}

// 3. 将 ![alt](img:uuid) 和 ![alt](hw:uuid) 替换为 Blob URL
function resolveImageUrls(md: string, images: Record<string, string>): string {
  return md.replace(
    /!\[([^\]]*)\]\((?:img|hw):([^)]+)\)/g,
    (_match, alt, uuid) => {
      const dataUrl = images[uuid]
      if (dataUrl) {
        const blobUrl = getOrCreateBlobUrl(uuid, dataUrl)
        return `![${alt}](${blobUrl})`
      }
      return `![${alt}]()`
    }
  )
}

// 4. 统一预处理管道
export function preprocessMarkdown(md: string, images: Record<string, string> = {}): string {
  if (!md) return md
  return normalizeParagraphs(resolveImageUrls(resolveColorSpans(md), images))
}

// ---------- 标题树数据结构 ----------
export interface HeadingNode {
  id: string
  text: string
  level: 1 | 2 | 3
  content: string
  children: HeadingNode[]
}

export function buildHeadingTree(markdown: string): { tree: HeadingNode[]; leadingContent: string } {
  const lines = markdown.split('\n')
  const tree: HeadingNode[] = []
  let leadingContent = ''

  const allNodes: HeadingNode[] = []
  let beforeFirstHeading: string[] = []

  let i = 0
  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/)
    const h2Match = line.match(/^## (.+)$/)
    const h3Match = line.match(/^### (.+)$/)

    if (h1Match) {
      const text = h1Match[1].trim()
      const id = `h1-${toSlug(text)}-${allNodes.length}`
      allNodes.push({ id, text, level: 1, content: '', children: [] })
    } else if (h2Match) {
      const text = h2Match[1].trim()
      const id = `h2-${toSlug(text)}-${allNodes.length}`
      allNodes.push({ id, text, level: 2, content: '', children: [] })
    } else if (h3Match) {
      const text = h3Match[1].trim()
      const id = `h3-${toSlug(text)}-${allNodes.length}`
      allNodes.push({ id, text, level: 3, content: '', children: [] })
    } else if (allNodes.length === 0) {
      beforeFirstHeading.push(line)
    } else {
      const last = allNodes[allNodes.length - 1]
      if (last.content.length > 0) last.content += '\n'
      last.content += line
    }
    i++
  }

  leadingContent = beforeFirstHeading.join('\n')

  const path: HeadingNode[] = []

  for (const node of allNodes) {
    if (node.level === 1) {
      tree.push(node)
      path.length = 0
      path.push(node)
    } else if (node.level === 2) {
      let parent: HeadingNode | null = null
      for (let j = path.length - 1; j >= 0; j--) {
        if (path[j].level <= 1) {
          parent = path[j]
          break
        }
      }
      if (parent) {
        parent.children.push(node)
      } else {
        tree.push(node)
      }
      while (path.length > 0 && path[path.length - 1].level >= node.level) {
        path.pop()
      }
      path.push(node)
    } else if (node.level === 3) {
      let parent: HeadingNode | null = null
      for (let j = path.length - 1; j >= 0; j--) {
        if (path[j].level <= 2) {
          parent = path[j]
          break
        }
      }
      if (parent) {
        parent.children.push(node)
      } else {
        tree.push(node)
      }
      while (path.length > 0 && path[path.length - 1].level >= node.level) {
        path.pop()
      }
      path.push(node)
    }
  }

  return { tree, leadingContent }
}

function toSlug(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9一-鿿]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

// ---------- 全屏看图 ----------
function Lightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt={alt || ''}
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

// ---------- 缩略图（可点击放大）----------
function Thumbnail({ src, alt }: { src?: string; alt?: string }) {
  const [showLightbox, setShowLightbox] = useState(false)

  if (!src) return null

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setShowLightbox(true)
  }

  return (
    <>
      <div
        className="relative inline-block my-2 cursor-pointer"
        onClick={handleClick}
      >
        <img
          src={src}
          alt={alt || ''}
          className="max-h-48 w-auto rounded-lg shadow-sm object-cover"
          loading="lazy"
          onClick={handleClick}
        />
        {/* 右下角始终显示放大图标 */}
        <div className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center pointer-events-none">
          <ZoomIn className="h-4 w-4 text-white" />
        </div>
      </div>
      {showLightbox && (
        <Lightbox src={src} alt={alt} onClose={() => setShowLightbox(false)} />
      )}
    </>
  )
}

// ---------- 递归渲染 ----------
function renderNode(
  node: HeadingNode,
  foldStates: Record<string, boolean>,
  onToggleFold: (id: string) => void,
  renderMarkdown: (md: string) => React.ReactNode,
  depth: number,
): React.ReactNode {
  const isCollapsed = foldStates[node.id] === true

  const headingClasses = ['text-xl font-bold', 'text-lg font-semibold', 'text-base font-medium']
  const headingClass = headingClasses[Math.min(node.level - 1, 2)] || 'text-base font-medium'

  const indent = depth > 0 ? 'ml-5' : ''

  return (
    <div key={node.id} data-heading-id={node.id} className={`my-1.5 ${indent}`}>
      <Collapsible
        open={!isCollapsed}
        onOpenChange={() => onToggleFold(node.id)}
      >
        <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left hover:bg-accent/50 rounded-md px-1.5 py-1 transition-colors">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className={headingClass}>{node.text}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1">
            {node.content.trim() && (
              <div className={node.children.length > 0 ? 'mb-2' : ''}>
                {renderMarkdown(node.content)}
              </div>
            )}
            {node.children.map((child) =>
              renderNode(child, foldStates, onToggleFold, renderMarkdown, depth + 1)
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ---------- 组件 ----------
export default function MarkdownRenderer({ content, foldStates, onToggleFold, images = {} }: MarkdownRendererProps) {
  const renderMarkdown = useCallback(
    (md: string) => {
      return (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            urlTransform={(url) => url}
            components={{
              img: ({ src, alt }) => <Thumbnail src={src} alt={alt} />,
            }}
          >
            {md}
          </ReactMarkdown>
        </div>
      )
    },
    []
  )

  if (!content || !content.trim()) {
    return null
  }

  const processed = preprocessMarkdown(content, images)

  const { tree, leadingContent } = buildHeadingTree(processed)

  if (tree.length === 0) {
    return <>{renderMarkdown(processed)}</>
  }

  return (
    <div className="space-y-1">
      {leadingContent.trim() && (
        <div className="mb-3">{renderMarkdown(leadingContent)}</div>
      )}

      {tree.map((node) =>
        renderNode(node, foldStates, onToggleFold, renderMarkdown, 0)
      )}
    </div>
  )
}
