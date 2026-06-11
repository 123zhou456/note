'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { X, Check, Undo2, Eraser, Pen } from 'lucide-react'

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

interface Stroke {
  points: { x: number; y: number }[]
  color: string
  size: number
  tool: 'pen' | 'eraser'
}

interface ImageEditorProps {
  imageDataUrl: string
  onSave: (newDataUrl: string) => void
  onCancel: () => void
}

export default function ImageEditor({ imageDataUrl, onSave, onCancel }: ImageEditorProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState(PEN_COLORS[0].value)
  const [size, setSize] = useState(PEN_SIZES[1].value)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Initialize canvases and load image
  useEffect(() => {
    const bgCanvas = bgCanvasRef.current
    const drawCanvas = drawCanvasRef.current
    const container = containerRef.current
    if (!bgCanvas || !drawCanvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = rect.width
    const h = rect.height

    bgCanvas.width = w * dpr
    bgCanvas.height = h * dpr
    bgCanvas.style.width = `${w}px`
    bgCanvas.style.height = `${h}px`

    drawCanvas.width = w * dpr
    drawCanvas.height = h * dpr
    drawCanvas.style.width = `${w}px`
    drawCanvas.style.height = `${h}px`

    setCanvasSize({ width: w, height: h })

    // Load image onto background canvas
    const img = new Image()
    img.onload = () => {
      const bgCtx = bgCanvas.getContext('2d')
      if (!bgCtx) return
      bgCtx.scale(dpr, dpr)

      // Fill white background
      bgCtx.fillStyle = '#ffffff'
      bgCtx.fillRect(0, 0, w, h)

      // Fit image within canvas (contain)
      const imgRatio = img.width / img.height
      const canvasRatio = w / h
      let drawW: number, drawH: number, drawX: number, drawY: number
      if (imgRatio > canvasRatio) {
        drawW = w
        drawH = w / imgRatio
        drawX = 0
        drawY = (h - drawH) / 2
      } else {
        drawH = h
        drawW = h * imgRatio
        drawX = (w - drawW) / 2
        drawY = 0
      }
      bgCtx.drawImage(img, drawX, drawY, drawW, drawH)
    }
    img.src = imageDataUrl

    // Setup drawing canvas context
    const drawCtx = drawCanvas.getContext('2d')
    if (drawCtx) {
      drawCtx.scale(dpr, dpr)
      drawCtx.lineCap = 'round'
      drawCtx.lineJoin = 'round'
    }
  }, [imageDataUrl])

  const getPoint = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }, [])

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = stroke.color
    }
    ctx.lineWidth = stroke.size
    ctx.beginPath()
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
    ctx.restore()
  }, [])

  const redrawAll = useCallback((strokeList: Stroke[]) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of strokeList) {
      if (s.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = s.color
      }
      ctx.lineWidth = s.size
      if (s.points.length >= 2) {
        ctx.beginPath()
        ctx.moveTo(s.points[0].x, s.points[0].y)
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y)
        }
        ctx.stroke()
      }
    }
    ctx.restore()
  }, [])

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const pt = getPoint(e)
    if (!pt) return
    setIsDrawing(true)
    const stroke: Stroke = { points: [pt], color, size, tool }
    setCurrentStroke(stroke)
  }, [getPoint, color, size, tool])

  const doDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDrawing || !currentStroke) return
    const pt = getPoint(e)
    if (!pt) return

    const updated = { ...currentStroke, points: [...currentStroke.points, pt] }
    setCurrentStroke(updated)

    // Draw incremental segment
    const canvas = drawCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const pts = updated.points
    if (pts.length < 2) return

    ctx.save()
    if (updated.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = updated.color
    }
    ctx.lineWidth = updated.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y)
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.stroke()
    ctx.restore()
  }, [isDrawing, currentStroke, getPoint])

  const endDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (currentStroke && currentStroke.points.length > 1) {
      setStrokes(prev => [...prev, currentStroke])
    }
    setCurrentStroke(null)
    setIsDrawing(false)
  }, [currentStroke])

  const handleUndo = useCallback(() => {
    setStrokes(prev => {
      const next = prev.slice(0, -1)
      requestAnimationFrame(() => redrawAll(next))
      return next
    })
  }, [redrawAll])

  const handleSave = useCallback(() => {
    const bgCanvas = bgCanvasRef.current
    const drawCanvas = drawCanvasRef.current
    if (!bgCanvas || !drawCanvas || !canvasSize.width) return

    // Merge drawing onto background
    const bgCtx = bgCanvas.getContext('2d')
    if (!bgCtx) return
    bgCtx.save()
    bgCtx.setTransform(1, 0, 0, 1, 0, 0)
    bgCtx.drawImage(drawCanvas, 0, 0)
    bgCtx.restore()

    // Export as JPEG
    const dataUrl = bgCanvas.toDataURL('image/jpeg', 0.85)
    onSave(dataUrl)

    // Restore background canvas (remove drawing overlay) for potential re-edit
    const img = new Image()
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1
      bgCtx.save()
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bgCtx.fillStyle = '#ffffff'
      bgCtx.fillRect(0, 0, canvasSize.width, canvasSize.height)
      const imgRatio = img.width / img.height
      const canvasRatio = canvasSize.width / canvasSize.height
      let drawW: number, drawH: number, drawX: number, drawY: number
      if (imgRatio > canvasRatio) {
        drawW = canvasSize.width
        drawH = canvasSize.width / imgRatio
        drawX = 0
        drawY = (canvasSize.height - drawH) / 2
      } else {
        drawH = canvasSize.height
        drawW = canvasSize.height * imgRatio
        drawX = (canvasSize.width - drawW) / 2
        drawY = 0
      }
      bgCtx.drawImage(img, drawX, drawY, drawW, drawH)
      bgCtx.restore()
    }
    img.src = imageDataUrl
  }, [canvasSize, onSave, imageDataUrl])

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-white/10 bg-black/80 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1 h-8 text-white hover:text-white hover:bg-white/10">
          <X className="h-4 w-4" />
          取消
        </Button>

        <span className="text-xs font-medium text-white/70">图片编辑</span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="h-8 w-8 p-0 text-white hover:text-white hover:bg-white/10 disabled:opacity-30"
            title="撤销"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="gap-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      {/* Tools */}
      <div className="shrink-0 px-3 py-2 border-b border-white/10 bg-black/60 flex items-center gap-3 flex-wrap">
        {/* Tool toggle */}
        <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
          <button
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
              tool === 'pen' ? 'bg-white/20 text-white' : 'text-white/50'
            }`}
            onClick={() => setTool('pen')}
            title="画笔"
          >
            <Pen className="h-3.5 w-3.5" />
          </button>
          <button
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
              tool === 'eraser' ? 'bg-white/20 text-white' : 'text-white/50'
            }`}
            onClick={() => setTool('eraser')}
            title="橡皮"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="w-px h-5 bg-white/20" />

        {/* Colors (only shown when pen is active) */}
        {tool === 'pen' && (
          <div className="flex items-center gap-1.5">
            {PEN_COLORS.map((c) => (
              <button
                key={c.value}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  color === c.value ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => setColor(c.value)}
                title={c.label}
              />
            ))}
          </div>
        )}

        {tool === 'pen' && <div className="w-px h-5 bg-white/20" />}

        {/* Sizes */}
        <div className="flex items-center gap-1.5">
          {PEN_SIZES.map((s) => (
            <button
              key={s.value}
              className={`h-7 px-2 text-xs rounded-md transition-colors ${
                size === s.value
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
              onClick={() => setSize(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden touch-none">
        <canvas
          ref={bgCanvasRef}
          className="absolute inset-0"
        />
        <canvas
          ref={drawCanvasRef}
          className="absolute inset-0"
          onTouchStart={startDraw}
          onTouchMove={doDraw}
          onTouchEnd={endDraw}
          onMouseDown={startDraw}
          onMouseMove={doDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
        />
      </div>
    </div>
  )
}
