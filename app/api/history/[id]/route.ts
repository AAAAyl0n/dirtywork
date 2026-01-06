import { createClient } from '@/lib/supabase/server'

// GET: 获取单个历史记录详情
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('project_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // 确保只能访问自己的记录
      .single()

    if (error) {
      console.error('Failed to fetch history detail:', error)
      return Response.json({ error: 'History not found' }, { status: 404 })
    }

    return Response.json({ data })
  } catch (error) {
    console.error('History Detail API Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: 更新历史记录标题
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title } = await request.json()

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return Response.json({ error: 'Invalid title' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_history')
      .update({ title: title.trim() })
      .eq('id', id)
      .eq('user_id', user.id) // 确保只能更新自己的记录
      .select()
      .single()

    if (error) {
      console.error('Failed to update history:', error)
      return Response.json({ error: 'Failed to update history' }, { status: 500 })
    }

    return Response.json({ success: true, data })
  } catch (error) {
    console.error('History Update API Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 删除历史记录
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('project_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // 确保只能删除自己的记录

    if (error) {
      console.error('Failed to delete history:', error)
      return Response.json({ error: 'Failed to delete history' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('History Delete API Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

