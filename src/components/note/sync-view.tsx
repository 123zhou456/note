'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, RefreshCw, Clock } from 'lucide-react'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { inlineImagesForExport } from '@/lib/image-io'

function isCapacitorApp(): boolean {
  try { return !!(window as any).Capacitor?.isPluginAvailable?.('Filesystem') }
  catch { return false }
}

export default function SyncView() {
  const { setView } = useAppStore()
  const [syncStatus, setSyncStatus] = useState('')
  const [lastSync, setLastSync] = useState('')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('diary_last_sync')
    if (t) setLastSync(new Date(parseInt(t)).toLocaleString())
  }, [])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncStatus('同步中...')

    const activeNotes = useAppStore.getState().notes.filter((n) => !n.deletedAt)
    if (activeNotes.length === 0) {
      setSyncStatus('没有笔记可同步')
      setSyncing(false)
      return
    }

    // 生成 TXT 内容
    const sections = activeNotes.map((note) => {
      const tagStr = note.tags.length > 0 ? note.tags.map((t) => t.name).join(', ') : '未分类'
      const inlinedContent = inlineImagesForExport(note.content || '', note.images || {})
      return `---\ntitle: ${note.title || '无标题'}\ntags: ${tagStr}\ncreatedAt: ${note.createdAt}\nupdatedAt: ${note.updatedAt}\n---\n${inlinedContent}`
    })
    const content = sections.join('\n=====\n') + '\n'
    const filename = `diary_sync_${new Date().toISOString().slice(0, 10)}.txt`

    if (isCapacitorApp()) {
      try {
        await Filesystem.writeFile({
          path: `Download/日记便签/${filename}`,
          data: content,
          directory: Directory.ExternalStorage,
          encoding: 'utf8' as any,
          recursive: true,
        })
        const now = Date.now()
        localStorage.setItem('diary_last_sync', String(now))
        setLastSync(new Date(now).toLocaleString())
        setSyncStatus(`✅ 已同步 ${activeNotes.length} 篇笔记到\n内部存储/Download/日记便签/${filename}`)
      } catch (err) {
        setSyncStatus('❌ 写入失败，请检查存储权限')
      }
    } else {
      // 桌面回退：浏览器下载
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      const now = Date.now()
      localStorage.setItem('diary_last_sync', String(now))
      setLastSync(new Date(now).toLocaleString())
      setSyncStatus('✅ 已下载到浏览器下载目录')
    }
    setSyncing(false)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 bg-background/80 backdrop-blur-sm border-b px-4 py-2 flex items-center justify-between z-10">
        <Button variant="ghost" size="sm" onClick={() => setView('list')} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <h1 className="text-sm font-semibold">同步到本地</h1>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-emerald-600" />
            一键同步
          </h2>
          <p className="text-xs text-muted-foreground">
            点击下方按钮，将全部笔记导出为 TXT 文件保存到手机的 <code className="text-foreground/70">Download/日记便签/</code> 目录。
            文件可通过「文件管理」App 查看，也可导入到其他设备。
          </p>

          <button
            className={`w-full py-3 rounded-lg text-sm font-medium transition-all ${
              syncing
                ? 'bg-muted text-muted-foreground'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]'
            }`}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                同步中...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Download className="h-4 w-4" />
                同步到本地存储
              </span>
            )}
          </button>

          {syncStatus && (
            <div className="text-xs whitespace-pre-line bg-emerald-600/5 rounded-lg px-3 py-2 text-emerald-700 dark:text-emerald-400">
              {syncStatus}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-card/40 p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            同步信息
          </h2>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>上次同步: <span className="text-foreground/70">{lastSync || '从未同步'}</span></p>
            <p>存储位置: <span className="text-foreground/70">内部存储/Download/日记便签/diary_sync_XXXX-XX-XX.txt</span></p>
            <p>格式: TXT (YAML 元数据头，可重新导入)</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-600/20 bg-amber-600/5 p-3">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">提示</p>
          <ul className="text-[11px] text-amber-600/80 dark:text-amber-400/70 space-y-0.5 list-disc list-inside">
            <li>同步会导出全部笔记为一个 TXT 文件</li>
            <li>每次同步会覆盖之前的同步文件</li>
            <li>如需导出不同格式或多文件备份，请使用存储设置中的导出功能</li>
            <li>建议定期点击同步以保最新的本地备份</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
