import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})

// 生成标题
async function generateTitle(originalText: string, resultText: string, type: string): Promise<string> {
  try {
    const typeLabel = type === 'refine' ? '文本精修' : type === 'translate' ? '翻译' : '处理'
    
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: `你是一个标题生成专家。请根据以下${typeLabel}任务的内容，生成一个简洁的中文标题（10-20字）。
标题应该概括内容的主题或关键信息。
只输出标题，不要有任何其他文字、引号或标点。`
        },
        {
          role: 'user',
          content: `原文开头：${originalText.slice(0, 500)}...\n\n结果开头：${resultText.slice(0, 500)}...`
        }
      ],
      temperature: 0.3,
      max_tokens: 50,
    })
    
    return response.choices[0].message.content?.trim() || `${typeLabel}任务 ${new Date().toLocaleDateString('zh-CN')}`
  } catch (error) {
    console.error('Failed to generate title:', error)
    const typeLabel = type === 'refine' ? '精修' : type === 'translate' ? '翻译' : '处理'
    return `${typeLabel}任务 ${new Date().toLocaleDateString('zh-CN')}`
  }
}

// POST: 保存历史记录
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, originalText, resultText } = await request.json()

    if (!type || !originalText || !resultText) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 生成标题
    const title = await generateTitle(originalText, resultText, type)

    // 保存到数据库
    const { data, error } = await supabase
      .from('project_history')
      .insert({
        user_id: user.id,
        type,
        title,
        original_text: originalText,
        result_text: resultText,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save history:', error)
      return Response.json({ error: 'Failed to save history' }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (error) {
    console.error('History API Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: 获取历史列表
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 可选：按类型筛选
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('project_history')
      .select('id, type, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch history:', error)
      return Response.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    return Response.json({ data })
  } catch (error) {
    console.error('History API Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

