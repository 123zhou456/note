import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/tags - List all tags
export async function GET() {
  try {
    const tags = await db.tag.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: { notes: true },
        },
      },
    })

    return NextResponse.json(
      tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        noteCount: tag._count.notes,
      }))
    )
  } catch (error) {
    console.error('Failed to fetch tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

// POST /api/tags - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '标签名称不能为空' }, { status: 400 })
    }

    // Check if tag name already exists
    const existing = await db.tag.findUnique({
      where: { name: name.trim() },
    })

    if (existing) {
      return NextResponse.json({ error: '标签名称已存在' }, { status: 409 })
    }

    const tag = await db.tag.create({
      data: { name: name.trim() },
    })

    return NextResponse.json({
      id: tag.id,
      name: tag.name,
      noteCount: 0,
    })
  } catch (error) {
    console.error('Failed to create tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
