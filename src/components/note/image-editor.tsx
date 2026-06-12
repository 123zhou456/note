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
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number; drawX: number; drawY: number; drawW: number; drawH: number } | null>(null)

  // 根据「图片自然尺寸 + 显示画布尺寸」计算 contain 适配几何
  // 显示坐标(CSS px) → 图片像素坐标 的映射依赖这套几何，导出时必须用相同算法重算，保证一致
  const computeContain = useCallback(
    (natW: number, natH: number, cw: number, ch: number) => {
      const imgRatio = natW / natH
      const canvasRatio = cw / ch
      let drawW: number, drawH: number, drawX: number, drawY: number
      if (imgRatio > canvasRatio) {
        drawW = cw
        drawH = cw / imgRatio
        drawX = 0
        drawY = (ch - drawH) / 2
      } else {
        drawH = ch
        drawW = ch * imgRatio
        drawX = (cw - drawW) / 2
        drawY = 0
      }
      return { drawX, drawY, drawW, drawH }
    },
    []
  )

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

      // 用真实像素尺寸（naturalWidth/Height），避免 img.width/height 受布局影响导致尺寸漂移
      const natW = img.naturalWidth || img.width
      const natH = img.naturalHeight || img.height

      // Fit image within canvas (contain)
      const { drawX, drawY, drawW, drawH } = computeContain(natW, natH, w, h)
      bgCtx.drawImage(img, drawX, drawY, drawW, drawH)

      // Store image info for proper export（width/height 为图片真实像素尺寸）
      setImageInfo({
        width: natW,
        height: natH,
        drawX,
        drawY,
        drawW,
        drawH,
      })
    }
    img.src = imageDataUrl

    // Setup drawing canvas context
    const drawCtx = drawCanvas.getContext('2d')
    if (drawCtx) {
      drawCtx.scale(dpr, dpr)
      drawCtx.lineCap = 'round'
      drawCtx.lineJoin = 'round'
    }
  }, [imageDataUrl, computeContain])

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
    if (!bgCanvas || !drawCanvas || !canvasSize.width || !imageInfo) return

    // 源图是否为「可能含透明通道」的格式（手写/PNG/WebP/GIF）
    // 这类图必须保留透明，绝不能填白底，否则透明区域会变成白块（即所谓「白边」）
    const isAlphaFormat = /^data:image\/(png|webp|gif)/i.test(imageDataUrl)

    // 重新加载源图，一切以源图「真实像素尺寸」为基准导出，保证输出形状/尺寸 = 原图
    const img = new Image()
    img.onload = () => {
      const natW = img.naturalWidth || img.width || imageInfo.width
      const natH = img.naturalHeight || img.height || imageInfo.height
      if (!natW || !natH) return

      // 导出画布严格等于源图像素尺寸（不放大、不留白边）
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = natW
      exportCanvas.height = natH
      const exportCtx = exportCanvas.getContext('2d')
      if (!exportCtx) return

      // 仅对不透明的 JPEG 源铺白底；PNG/手写等保留透明，不填白
      if (!isAlphaFormat) {
        exportCtx.fillStyle = '#ffffff'
        exportCtx.fillRect(0, 0, natW, natH)
      }

      // 源图铺满整张导出画布（与画布同尺寸，绝不产生 letterbox 白边）
      exportCtx.drawImage(img, 0, 0, natW, natH)

      // 用「自然尺寸 + 当前显示画布尺寸」重算 contain 几何，使笔迹坐标映射与显示完全一致
      const { drawX, drawY, drawW, drawH } = computeContain(
        natW,
        natH,
        canvasSize.width,
        canvasSize.height
      )
      const scaleX = natW / drawW
      const scaleY = natH / drawH

      // 笔迹单独画在一张图层上：橡皮用 destination-out 只擦除笔迹本身，
      // 与屏幕上一致（擦掉笔迹、露出底图，而非涂白），同时不破坏底图/透明区域
      if (strokes.length > 0) {
        const strokeCanvas = document.createElement('canvas')
        strokeCanvas.width = natW
        strokeCanvas.height = natH
        const sctx = strokeCanvas.getContext('2d')
        if (sctx) {
          sctx.save()
          sctx.scale(scaleX, scaleY)
          sctx.translate(-drawX, -drawY)
          sctx.lineCap = 'round'
          sctx.lineJoin = 'round'
          for (const s of strokes) {
            if (s.points.length < 2) continue
            if (s.tool === 'eraser') {
              sctx.globalCompositeOperation = 'destination-out'
              sctx.strokeStyle = 'rgba(0,0,0,1)'
            } else {
              sctx.globalCompositeOperation = 'source-over'
              sctx.strokeStyle = s.color
            }
            sctx.lineWidth = s.size
            sctx.beginPath()
            sctx.moveTo(s.points[0].x, s.points[0].y)
            for (let i = 1; i < s.points.length; i++) {
              sctx.lineTo(s.points[i].x, s.points[i].y)
            }
            sctx.stroke()
          }
          sctx.restore()
          // 笔迹层（橡皮已在层内生效，只影响笔迹）叠加到导出画布
          exportCtx.drawImage(strokeCanvas, 0, 0)
        }
      }

      // 导出：透明格式 → PNG（保留透明）；否则 → JPEG。尺寸恒等于源图
      const dataUrl = isAlphaFormat
        ? exportCanvas.toDataURL('image/png')
        : exportCanvas.toDataURL('image/jpeg', 0.85)
      onSave(dataUrl)

      // Restore background canvas (remove drawing overlay) for potential re-edit
      const bgCtx = bgCanvas.getContext('2d')
      if (bgCtx) {
        const dpr = window.devicePixelRatio || 1
        bgCtx.save()
        bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        bgCtx.fillStyle = '#ffffff'
        bgCtx.fillRect(0, 0, canvasSize.width, canvasSize.height)
        bgCtx.drawImage(img, drawX, drawY, drawW, drawH)
        bgCtx.restore()
      }
    }
    img.src = imageDataUrl
  }, [canvasSize, imageInfo, strokes, onSave, imageDataUrl, computeContain])

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
