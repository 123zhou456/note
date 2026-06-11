'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { ListOrdered } from 'lucide-react'
import { buildHeadingTree, HeadingNode } from './markdown-renderer'

interface TableOfContentsProps {
  content: string
  containerRef: React.RefObject<HTMLDivElement | null>
  onNavigate?: (headingId: string) => void
  isEditing?: boolean
}

// 递归渲染目录条目
function TocItem({ node, depth, onNavigate }: {
  node: HeadingNode
  depth: number
  onNavigate: (id: string) => void
}) {
  const indentMap = ['', 'ml-3', 'ml-6']
  const dotColors = ['bg-emerald-500', 'bg-blue-500', 'bg-amber-500']

  return (
    <div>
      <button
        className={`w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-2 ${indentMap[Math.min(depth, 2)]}`}
        onClick={() => onNavigate(node.id)}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[Math.min(node.level - 1, 2)]}`} />
        <span className="truncate text-foreground/80 hover:text-foreground">
          {node.text}
        </span>
      </button>
      {node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TocItem key={child.id} node={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TableOfContents({ content, containerRef, onNavigate, isEditing }: TableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const { tree } = buildHeadingTree(content || '')

  // 点击外部关闭面板
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    // 延迟注册，避免点击按钮本身触发关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // 跳转到标题
  const handleNavigate = useCallback((headingId: string) => {
    setIsOpen(false)

    // 如果提供了外部导航函数，优先使用（支持编辑模式定位光标）
    if (onNavigate) {
      // 延迟一帧等待 TOC 面板 DOM 关闭后再导航，避免遮挡 target
      requestAnimationFrame(() => onNavigate(headingId))
      return
    }

    // 默认：查找带有 data-heading-id 的元素
    const el = document.querySelector(`[data-heading-id="${headingId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    // 兜底：查找 h1/h2/h3 元素
    const headingEl = document.querySelector(`h1[id="${headingId}"], h2[id="${headingId}"], h3[id="${headingId}"]`)
    if (headingEl) {
      headingEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [onNavigate])

  // 没有标题时不显示
  if (!content || tree.length === 0) return null

  return (
    <div className="relative" ref={panelRef}>
      {/* 浮动按钮 */}
      <button
        className={`fixed bottom-20 right-4 z-40 h-10 w-10 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          isOpen
            ? 'bg-emerald-600 text-white'
            : 'bg-background/90 dark:bg-background/80 border border-border/50 text-foreground/70 hover:text-foreground hover:shadow-xl'
        }`}
        onClick={() => setIsOpen(!isOpen)}
        title="目录"
      >
        <ListOrdered className="h-5 w-5" />
      </button>

      {/* 目录面板 */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 z-50 w-64 max-h-[50vh] overflow-y-auto bg-background/95 dark:bg-background/90 backdrop-blur-lg border border-border/50 rounded-xl shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/30">
            <h3 className="text-sm font-semibold text-foreground/80">📖 目录</h3>
            <span className="text-xs text-muted-foreground">{countHeadings(tree)} 个标题</span>
          </div>
          <div className="space-y-0.5">
            {tree.map((node) => (
              <TocItem key={node.id} node={node} depth={0} onNavigate={handleNavigate} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function countHeadings(tree: HeadingNode[]): number {
  let count = 0
  for (const node of tree) {
    count += 1 + countHeadings(node.children)
  }
  return count
}
