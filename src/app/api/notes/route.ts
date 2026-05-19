import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/notes - List all notes with tags
export async function GET() {
  try {
    const notes = await db.note.findMany({
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const formatted = notes.map((note) => ({
      id: note.id,
      title: note.title,
      contentBlocks: JSON.parse(note.contentBlocks),
      foldStates: JSON.parse(note.foldStates),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      tags: note.tags.map((nt) => nt.tag),
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Failed to fetch notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

// POST /api/notes - Create a new note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, contentBlocks, tagIds } = body

    const note = await db.note.create({
      data: {
        title: title || '无标题',
        contentBlocks: JSON.stringify(contentBlocks || []),
        foldStates: JSON.stringify({}),
      },
    })

    // Create tag associations
    if (tagIds && tagIds.length > 0) {
      await db.noteTag.createMany({
        data: tagIds.map((tagId: string) => ({
          noteId: note.id,
          tagId,
        })),
      })
    }

    // Return the created note with tags
    const created = await db.note.findUnique({
      where: { id: note.id },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    return NextResponse.json({
      id: created!.id,
      title: created!.title,
      contentBlocks: JSON.parse(created!.contentBlocks),
      foldStates: JSON.parse(created!.foldStates),
      createdAt: created!.createdAt,
      updatedAt: created!.updatedAt,
      tags: created!.tags.map((nt) => nt.tag),
    })
  } catch (error) {
    console.error('Failed to create note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
