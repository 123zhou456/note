import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/settings?key=xxx - Get a setting value
export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key')
    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const setting = await db.setting.findUnique({
      where: { key },
    })

    return NextResponse.json({
      key,
      value: setting?.value || '',
    })
  } catch (error) {
    console.error('Failed to fetch setting:', error)
    return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 })
  }
}

// PUT /api/settings - Update a setting value
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const setting = await db.setting.upsert({
      where: { key },
      update: { value: value || '' },
      create: { key, value: value || '' },
    })

    return NextResponse.json({
      key: setting.key,
      value: setting.value,
    })
  } catch (error) {
    console.error('Failed to update setting:', error)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }
}
