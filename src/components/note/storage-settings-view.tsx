'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, FolderOpen, Download, Database, Upload, FileText, Smartphone } from 'lucide-react'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { inlineImagesForExport } from '@/lib/image-io'

// 桌面端检测
function isCapacitorApp(): boolean {
  try { return !!(window as any).Capacitor?.isPluginAvailable?.('Filesystem') }
  catch { return false }
}

const EXPORT_DIR = 'Download/日记便签'

export default function StorageSettingsView() {
  const { setView } = useAppStore()

  const [storageInfo, setStorageInfo] = useState({ notes: 0, dbSize: '计算中...' })
  const [exportPath, setExportPath] = useState('')
  const [saveStatus, setSaveStatus] = useState('')

  useEffect(() => {
    const notes = useAppStore.getState().notes
    setStorageInfo((s) => ({ ...s, notes: notes.length }))
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      ;(navigator.storage as any).estimate().then((est: any) => {
        const usage = est.usage ? (est.usage / 1024 / 1024).toFixed(1) + ' MB' : '未知'
        setStorageInfo((s) => ({ ...s, dbSize: usage }))
      }).catch(() => {})
    }
    // 显示导出路径
    setExportPath('内部存储/Download/日记便签/')
  }, [])

  // 使用 Capacitor Filesystem 写入文件
  const saveFile = useCallback(async (filename: string, content: string) => {
    if (!isCapacitorApp()) return false // 桌面端用浏览器下载
    try {
      await Filesystem.writeFile({
        path: `${EXPORT_DIR}/${filename}`,
        data: content,
        directory: Directory.ExternalStorage,
        encoding: 'utf8' as any,
        recursive: true,
      })
      return true
    } catch {
      return false
    }
  }, [])

  // 全量备份
  const handleFullBackup = useCallback(async () => {
    const activeNotes = useAppStore.getState().notes.filter((n) => !n.deletedAt)
    if (activeNotes.length === 0) { alert('没有笔记可备份'); return }

    setSaveStatus('备份中...')
    const sections = activeNotes.map((note) => {
      const tagsArr = note.tags.map((t) => `"${t.name}"`).join(', ')
      const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
      return `---\ntitle: "${(note.title || '').replace(/"/g, '\\"')}"\ntags: [${tagsArr || ''}]\ncreatedAt: "${note.createdAt}"\nupdatedAt: "${note.updatedAt}"\n---\n\n${inlinedContent}`
    })
    const content = sections.join('\n\n---\n\n') + '\n'
    const filename = `diary_backup_${new Date().toISOString().slice(0, 10)}.md`

    const ok = await saveFile(filename, content)
    if (ok) {
      setSaveStatus(`✅ 已保存: 内部存储/Download/日记便签/${filename}`)
    } else {
      // 桌面端 / 回退：浏览器下载
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSaveStatus(`✅ 已下载: ${filename}\n请检查浏览器下载列表`)
    }
  }, [saveFile])

  // 导出为独立文件（按日期分目录）
  const handleExportFiles = useCallback(async () => {
    const activeNotes = useAppStore.getState().notes.filter((n) => !n.deletedAt)
    if (activeNotes.length === 0) { alert('没有笔记可导出'); return }

    setSaveStatus('导出中...')
    let count = 0
    let useFallback = false

    for (const note of activeNotes) {
      const title = note.title || '无标题'
      const safeName = title.replace(/[<>:"\/\\|?*]/g, '_').substring(0, 40)
      const dateDir = note.createdAt.slice(0, 10)
      const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
      const content = `---\ntitle: "${title.replace(/"/g, '\\"')}"\ntags: [${note.tags.map(t => `"${t.name}"`).join(', ')}]\ncreatedAt: "${note.createdAt}"\n---\n\n${inlinedContent}`
      const filePath = `${EXPORT_DIR}/${dateDir}/${safeName}.md`

      try {
        await Filesystem.writeFile({
          path: filePath,
          data: content,
          directory: Directory.Documents,
          encoding: 'utf8' as any,
        })
        count++
      } catch {
        useFallback = true
        // 单文件逐个下载
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${safeName}.md`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        URL.revokeObjectURL(url)
        count++
      }
    }

    if (useFallback) {
      setSaveStatus(`✅ 已下载 ${count} 个文件到系统下载目录`)
    } else {
      setSaveStatus(`✅ 已导出 ${count} 篇笔记到 Documents/${EXPORT_DIR}/`)
    }
  }, [saveFile])

  // 导出全部为一个大文件
  const handleExportAll = useCallback(async () => {
    const activeNotes = useAppStore.getState().notes.filter((n) => !n.deletedAt)
    if (activeNotes.length === 0) { alert('没有笔记可导出'); return }

    setSaveStatus('导出中...')
    const sections = activeNotes.map((note) => {
      const tagsArr = note.tags.map((t) => `"${t.name}"`).join(', ')
      const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
      return `---\ntitle: "${(note.title || '').replace(/"/g, '\\"')}"\ntags: [${tagsArr || ''}]\ncreatedAt: "${note.createdAt}"\nupdatedAt: "${note.updatedAt}"\n---\n\n${inlinedContent}`
    })
    const content = sections.join('\n\n---\n\n') + '\n'
    const filename = `diary_${new Date().toISOString().slice(0, 10)}.md`

    const ok = await saveFile(filename, content)
    if (ok) {
      setSaveStatus(`✅ 已保存: 内部存储/Download/日记便签/${filename}`)
    } else {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSaveStatus(`✅ 已下载: ${filename}\n请检查浏览器下载列表`)
    }
  }, [saveFile])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-background/80 backdrop-blur-sm border-b px-4 py-2 flex items-center justify-between z-10">
        <Button variant="ghost" size="sm" onClick={() => setView('list')} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <h1 className="text-sm font-semibold">存储设置</h1>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 存储信息 */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-600" />
            存储用量
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-muted-foreground">笔记数量</p>
              <p className="text-lg font-semibold mt-0.5">{storageInfo.notes}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-muted-foreground">本地位</p>
              <p className="text-lg font-semibold mt-0.5">{storageInfo.dbSize}</p>
            </div>
          </div>
        </div>

        {/* 导出路径 */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-blue-600" />
            导出位置
          </h2>
          <div className="bg-muted/30 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground/80">{exportPath || 'Documents/日记便签/'}</span>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-1.5 pl-6">
              文件将保存到手机 Documents/日记便签/ 目录<br />
              可通过「文件管理」App 查看
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Download className="h-4 w-4 text-emerald-600" />
            导出操作
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button className="py-3 px-2 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 text-xs text-center transition-colors" onClick={handleFullBackup}>
              <Download className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
              备份全部 (1个文件)
            </button>
            <button className="py-3 px-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/20 text-xs text-center transition-colors" onClick={handleExportFiles}>
              <FileText className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              导出为独立文件
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button className="py-3 px-2 rounded-lg bg-amber-600/10 hover:bg-amber-600/20 border border-amber-600/20 text-xs text-center transition-colors" onClick={handleExportAll}>
              <FileText className="h-5 w-5 mx-auto mb-1 text-amber-600" />
              导出全部 (Markdown 大文件)
            </button>
          </div>

          {/* 状态提示 */}
          {saveStatus && (
            <div className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-600/5 rounded-lg px-3 py-2">
              {saveStatus}
            </div>
          )}
        </div>

        {/* 版本 */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-3">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>日记便签</span>
            <span>版本 1.0.0 (build 20250301)</span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            覆盖安装时数据保留，卸载后数据丢失。建议定期导出备份到手机本地。
          </p>
        </div>
      </div>
    </div>
  )
}
