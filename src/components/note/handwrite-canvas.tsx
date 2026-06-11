'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { X, Check, RotateCcw } from 'lucide-react'

const PEN_COLORS = [
  { label: '黑', value: '#1a1a1a' },
  { label: '蓝', value: '#2563eb' },
  { label: '红', value: '#dc2626' },
  { label: '绿', value: '#16a34a' },
  { label: '橙', value: '#ea580c' },
  { label: '紫', value: '#9333ea' },
]

const PEN_SIZES = [
  { label: '细', value: 2 },
  { label: '中', value: 4 },
  { label: '粗', value: 7 },
]

interface HandwriteCanvasProps {
  onSave: (dataUrl: string) => void
  onCancel: () => void
}

export default function HandwriteCanvas({ onSave, onCancel }: HandwriteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [color, setColor] = useState(PEN_COLORS[0].value)
  const [size, setSize] = useState(PEN_SIZES[1].value)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  // 初始化 canvas 大小
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, rect.width, rect.height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }, [])

  const getPoint = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }, [])

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    setIsDrawing(true)
    const pt = getPoint(e)
    lastPoint.current = pt
  }, [getPoint])

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const pt = getPoint(e)
    if (!pt || !lastPoint.current) return

    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()

    lastPoint.current = pt
    setHasDrawn(true)
  }, [isDrawing, color, size, getPoint])

  const endDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    setIsDrawing(false)
    lastPoint.current = null
  }, [])

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setHasDrawn(false)
  }, [])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    onSave(dataUrl)
  }, [onSave, hasDrawn])

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* 顶部工具栏 */}
      <div className="shrink-0 px-3 py-2 border-b bg-background/95 backdrop-blur-sm flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1 h-8">
          <X className="h-4 w-4" />
          取消
        </Button>

        <span className="text-xs font-medium text-muted-foreground">手写</span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 w-8 p-0"
            title="清除"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasDrawn}
            className="gap-1 h-8 bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      {/* 画笔工具 */}
      <div className="shrink-0 px-3 py-2 border-b bg-muted/30 flex items-center gap-3">
        {/* 颜色选择 */}
        <div className="flex items-center gap-1.5">
          {PEN_COLORS.map((c) => (
            <button
              key={c.value}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c.value ? 'border-foreground scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c.value }}
              onClick={() => setColor(c.value)}
              title={c.label}
            />
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* 粗细选择 */}
        <div className="flex items-center gap-1.5">
          {PEN_SIZES.map((s) => (
            <button
              key={s.value}
              className={`h-7 px-2 text-xs rounded-md transition-colors ${
                size === s.value
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground'
              }`}
              onClick={() => setSize(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 画布区域 */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
        />
      </div>
    </div>
  )
}
