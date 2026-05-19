import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// PUT /api/tags/[id] - Rename a tag
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '标签名称不能为空' }, { status: 400 })
    }

    // Check if new name already exists (and it's not the same tag)
    const existing = await db.tag.findUnique({
      where: { name: name.trim() },
    })

    if (existing && existing.id !== id) {
      return NextResponse.json({ error: '标签名称已存在' }, { status: 409 })
    }

    const tag = await db.tag.update({
      where: { id },
      data: { name: name.trim() },
      include: {
        _count: {
          select: { notes: true },
        },
      },
    })

    return NextResponse.json({
      id: tag.id,
      name: tag.name,
      noteCount: tag._count.notes,
    })
  } catch (error) {
    console.error('Failed to update tag:', error)
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
  }
}

// DELETE /api/tags/[id] - Delete a tag
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.tag.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}
