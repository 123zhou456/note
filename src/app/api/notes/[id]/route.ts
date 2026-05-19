import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

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

    return NextResponse.json({
      id: note.id,
      title: note.title,
      contentBlocks: JSON.parse(note.contentBlocks),
      foldStates: JSON.parse(note.foldStates),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      tags: note.tags.map((nt) => nt.tag),
    })
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
    const { title, contentBlocks, foldStates, tagIds } = body

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (contentBlocks !== undefined) updateData.contentBlocks = JSON.stringify(contentBlocks)
    if (foldStates !== undefined) updateData.foldStates = JSON.stringify(foldStates)

    // Update tag associations if provided
    if (tagIds !== undefined) {
      // Delete existing associations
      await db.noteTag.deleteMany({
        where: { noteId: id },
      })
      // Create new associations
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

    return NextResponse.json({
      id: note.id,
      title: note.title,
      contentBlocks: JSON.parse(note.contentBlocks),
      foldStates: JSON.parse(note.foldStates),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      tags: note.tags.map((nt) => nt.tag),
    })
  } catch (error) {
    console.error('Failed to update note:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

// DELETE /api/notes/[id] - Delete a note
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.note.delete({
      where: { id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete note:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
