import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 格式化转写结果
function formatTranscript(data: {
  text: string
  utterances?: Array<{
    speaker: string
    text: string
    start: number
    end: number
    confidence: number
  }>
  audio_duration?: number
}): string {
  // 如果有说话人分段，使用 utterances
  if (data.utterances && data.utterances.length > 0) {
    const lines: string[] = []
    
    // 格式化每段对话
    for (const utterance of data.utterances) {
      const startSec = Math.floor(utterance.start / 1000)
      const hours = Math.floor(startSec / 3600)
      const minutes = Math.floor((startSec % 3600) / 60)
      const seconds = startSec % 60
      const timestamp = hours > 0
        ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      
      lines.push(`**Speaker ${utterance.speaker}** (${timestamp})`)
      lines.push(utterance.text)
      lines.push('')
    }
    
    return lines.join('\n')
  }
  
  // 没有说话人分段，直接返回文本
  return data.text || ''
}

// 查询转写状态
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AssemblyAI API key not configured' },
        { status: 500 }
      )
    }

    const transcriptId = params.id

    // 查询 AssemblyAI 转写状态
    // 重要：必须禁用缓存，否则会一直返回旧状态
    const response = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: {
          'Authorization': apiKey,
        },
        cache: 'no-store', // 禁用 Next.js fetch 缓存
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AssemblyAI status error:', errorText)
      return NextResponse.json(
        { error: 'Failed to get transcript status' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // 根据状态返回不同内容
    if (data.status === 'completed') {
      return NextResponse.json({
        status: 'completed',
        text: data.text,
        formatted: formatTranscript(data),
        audio_duration: data.audio_duration,
        utterances: data.utterances,
        words: data.words,
      })
    } else if (data.status === 'error') {
      return NextResponse.json({
        status: 'error',
        error: data.error || 'Transcription failed',
      })
    } else {
      // queued 或 processing
      return NextResponse.json({
        status: data.status,
      })
    }
  } catch (error) {
    console.error('Status API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

