/**
 * 图片导入导出工具
 *
 * 导出时将 ![alt](img:uuid) 和 ![alt](hw:uuid) 替换为实际 data URL，使文件自包含。
 * 导入时从内容中提取 data URL 图片，存入 images 映射并替换为 img:uuid 引用。
 */

/** 安全 UUID 生成 */
export function safeUUID(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}

/**
 * 导出内联：将 img:uuid / hw:uuid 替换为实际 data URL
 * @param content Markdown 内容
 * @param images 图片映射 { uuid -> dataUrl }
 * @returns 内联后的 Markdown 内容
 */
export function inlineImagesForExport(content: string, images: Record<string, string>): string {
  if (!content || !images) return content || ''
  return content.replace(
    /!\[([^\]]*)\]\((?:img|hw):([^)]+)\)/g,
    (_match, alt, uuid) => {
      const dataUrl = images[uuid]
      if (dataUrl) return `![${alt}](${dataUrl})`
      return _match // 找不到就保留原样
    }
  )
}

/**
 * 导入提取：从 Markdown 内容中提取 data URL 图片，生成 images 映射
 * @param content 导入的 Markdown 内容
 * @returns { content: 替换后的内容, images: 提取的图片映射 }
 */
export function extractImagesOnImport(content: string): { content: string; images: Record<string, string> } {
  if (!content) return { content: '', images: {} }

  const images: Record<string, string> = {}

  const replaced = content.replace(
    /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]+)\)/g,
    (_match, alt, dataUrl) => {
      const uuid = safeUUID()
      // 去除 dataUrl 中可能的换行/空格
      const cleanUrl = dataUrl.replace(/\s/g, '')
      images[uuid] = cleanUrl
      const prefix = alt.includes('手写') ? 'hw' : 'img'
      return `![${alt}](${prefix}:${uuid})`
    }
  )

  return { content: replaced, images }
}
