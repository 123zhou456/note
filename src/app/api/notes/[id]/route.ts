import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

function formatNote(note: {
  id: string
  title: string
  content: string
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
    foldStates: JSON.parse(note.foldStates),
    deletedAt: note.deletedAt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    tags: note.tags.map((nt) => nt.tag),
  }
}

// GET /api/notes/[id] - Get a single note
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const note = await db.note.findUnique({
      where: { id },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json(formatNote(note))
  } catch (error) {
    console.error('Failed to fetch note:', error)
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 })
  }
}

// PUT /api/notes/[id] - Update a note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, content, foldStates, tagIds, deletedAt } = body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (foldStates !== undefined) updateData.foldStates = JSON.stringify(foldStates)
    // Support soft delete / restore
    if (deletedAt !== undefined) updateData.deletedAt = deletedAt

    // Update tag associations if provided
    if (tagIds !== undefined) {
      await db.noteTag.deleteMany({
        where: { noteId: id },
      })
      if (tagIds.length > 0) {
        await db.noteTag.createMany({
          data: tagIds.map((tagId: string) => ({
            noteId: id,
            tagId,
          })),
        })
      }
    }

    const note = await db.note.update({
      where: { id },
      data: updateData,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    return NextResponse.json(formatNote(note))
  } catch (error) {
    console.error('Failed to update note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

// DELETE /api/notes/[id] - Soft delete (move to trash) or permanent delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const permanent = request.nextUrl.searchParams.get('permanent') === 'true'

    if (permanent) {
      // Permanently delete
      await db.note.delete({
        where: { id },
      })
    } else {
      // Soft delete - move to trash
      await db.note.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
