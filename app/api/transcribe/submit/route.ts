import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 提交转写任务
export async function POST(request: Request) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      )
    }

    const { audio_url, language_code = 'zh', speaker_labels = true } = await request.json()

    if (!audio_url) {
      return NextResponse.json(
        { error: 'audio_url is required' },
        { status: 400 }
      )
    }

    // 提交转写任务到 AssemblyAI
    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url,
        language_code,
        speaker_labels,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AssemblyAI submit error:', errorText)
      return NextResponse.json(
        { error: 'Failed to submit transcription' },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      transcript_id: data.id,
      status: data.status,
    })
  } catch (error) {
    console.error('Submit API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

