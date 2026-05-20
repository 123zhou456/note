import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

function formatNote(note: {
  id: string
  title: string
  content: string
  images: string
  foldStates: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  tags: { tag: { id: string; name: string } }[]
}) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    images: JSON.parse(note.images || '{}'),
    foldStates: JSON.parse(note.foldStates),
    deletedAt: note.deletedAt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    tags: note.tags.map((nt) => nt.tag),
  }
}

// GET /api/notes - List all notes (optionally include deleted)
export async function GET(request: NextRequest) {
  try {
    const includeDeleted = request.nextUrl.searchParams.get('deleted') === 'true'

    const notes = await db.note.findMany({
      where: includeDeleted ? {} : { deletedAt: null },
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

    return NextResponse.json(notes.map(formatNote))
  } catch (error) {
    console.error('Failed to fetch notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

// POST /api/notes - Create a new note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, images, tagIds } = body

    const note = await db.note.create({
      data: {
        title: title || '无标题',
        content: content || '',
        images: JSON.stringify(images || {}),
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

    return NextResponse.json(formatNote(created!))
  } catch (error) {
    console.error('Failed to create note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
