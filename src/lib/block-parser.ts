// Markdown 块解析器：将 Markdown 内容拆分为独立的可编辑块

export interface MarkdownBlock {
  id: string
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'blockquote' | 'hr'
  content: string       // 原始 Markdown 文本
  level?: 1 | 2 | 3    // 仅 heading 类型使用
}

let _blockCounter = 0

export function resetBlockCounter() {
  _blockCounter = 0
}

/**
 * 将 Markdown 文本拆分为块列表。
 *
 * 块类型：
 *  - heading   : ATX 标题行 (# / ## / ###)
 *  - code      : 围栏代码块 (```...```)，保留围栏标记
 *  - list      : 连续列表行 (- / * / 1. 等)
 *  - blockquote: 连续引用行 (> ...)
 *  - hr        : 水平线 (--- / *** / ___)
 *  - paragraph : 其它连续非空行
 */
export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  if (!content || !content.trim()) {
    return [{ id: `blk-${_blockCounter++}`, type: 'paragraph', content: '' }]
  }

  const lines = content.split('\n')
  const blocks: MarkdownBlock[] = []
  let i = 0

  const flush = (type: MarkdownBlock['type'], buf: string[], extra?: Partial<MarkdownBlock>) => {
    if (buf.length === 0) return
    blocks.push({
      id: `blk-${_blockCounter++}`,
      type,
      content: buf.join('\n'),
      ...extra,
    })
  }

  while (i < lines.length) {
    const line = lines[i]

    // 空行 → 块分隔符
    if (line.trim() === '') {
      i++
      continue
    }

    // --- 围栏代码块 ---
    if (/^`{3,}/.test(line)) {
      const buf = [line]
      i++
      while (i < lines.length) {
        buf.push(lines[i])
        if (/^`{3,}\s*$/.test(lines[i]) && buf.length > 1) { i++; break }
        i++
      }
      flush('code', buf)
      continue
    }

    // --- ATX 标题 ---
    const hMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (hMatch) {
      flush('heading', [line], { level: hMatch[1].length as 1 | 2 | 3 })
      i++
      continue
    }

    // --- 列表（有序 / 无序）---
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      const buf = [line]
      i++
      while (i < lines.length && /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      flush('list', buf)
      continue
    }

    // --- 引用 ---
    if (/^>\s*/.test(line)) {
      const buf = [line]
      i++
      while (i < lines.length && /^>\s*/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      flush('blockquote', buf)
      continue
    }

    // --- 水平线 ---
    if (/^\s*(?:[-*_])\s*(?:[-*_])\s*(?:[-*_\s])+$/.test(line) && /[-_*]/.test(line)) {
      flush('hr', [line])
      i++
      continue
    }

    // --- 普通段落 ---
    const buf = [line]
    i++
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      buf.push(lines[i])
      i++
    }
    flush('paragraph', buf)
  }

  if (blocks.length === 0) {
    return [{ id: `blk-${_blockCounter++}`, type: 'paragraph', content: '' }]
  }

  // ---- 合并 Pass：标题块吸收后续内容直到遇到同级或更高级标题 ----
  const merged: MarkdownBlock[] = []
  let currentHeading: MarkdownBlock | null = null

  for (const block of blocks) {
    if (block.type === 'heading') {
      // 遇到同级或更高级标题 → 结束前一个标题的吸收
      if (currentHeading && block.level! <= currentHeading.level!) {
        merged.push(currentHeading)
        currentHeading = null
      }
      if (!currentHeading) {
        // 开始新的标题吸收
        currentHeading = { ...block }
      } else {
        // 子标题 → 合并进当前标题
        currentHeading = {
          ...currentHeading,
          content: currentHeading.content + '\n\n' + block.content,
        }
      }
    } else {
      // 非标题块 → 合并进当前标题（如果有）
      if (currentHeading) {
        currentHeading = {
          ...currentHeading,
          content: currentHeading.content + '\n\n' + block.content,
        }
      } else {
        merged.push(block)
      }
    }
  }

  if (currentHeading) merged.push(currentHeading)

  return merged
}

/** 判断一行是否是某种块的起始行（用于段落终止检测） */
function isBlockStart(line: string): boolean {
  if (line.trim() === '') return true
  if (/^`{3,}/.test(line)) return true
  if (/^#{1,3}\s+/.test(line)) return true
  if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) return true
  if (/^>\s*/.test(line)) return true
  if (/^\s*(?:[-*_])\s*(?:[-*_])\s*(?:[-*_\s])+$/.test(line)) return true
  return false
}
