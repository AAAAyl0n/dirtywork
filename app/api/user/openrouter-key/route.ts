import { createClient } from '@/lib/supabase/server'
import { maskApiKey } from '@/lib/user-api-keys'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_api_keys')
      .select('openrouter_api_key, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch OpenRouter key:', error)
      return Response.json(
        { error: 'Failed to fetch OpenRouter key' },
        { status: 500 }
      )
    }

    return Response.json({
      hasKey: !!data?.openrouter_api_key,
      maskedKey: data?.openrouter_api_key
        ? maskApiKey(data.openrouter_api_key)
        : null,
      updatedAt: data?.updated_at ?? null,
    })
  } catch (error) {
    console.error('OpenRouter key GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { apiKey } = await request.json()

    if (!apiKey || typeof apiKey !== 'string') {
      return Response.json({ error: 'API key is required' }, { status: 400 })
    }

    const trimmedKey = apiKey.trim()

    if (!trimmedKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 })
    }

    const { error } = await supabase.from('user_api_keys').upsert(
      {
        user_id: user.id,
        openrouter_api_key: trimmedKey,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )

    if (error) {
      console.error('Failed to save OpenRouter key:', error)
      return Response.json(
        { error: 'Failed to save OpenRouter key' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      maskedKey: maskApiKey(trimmedKey),
    })
  } catch (error) {
    console.error('OpenRouter key POST error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete OpenRouter key:', error)
      return Response.json(
        { error: 'Failed to delete OpenRouter key' },
        { status: 500 }
      )
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('OpenRouter key DELETE error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
