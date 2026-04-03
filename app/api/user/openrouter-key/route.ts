import { createClient } from '@/lib/supabase/server'
import { maskApiKey } from '@/lib/user-api-keys'
import { resolveOpenRouterModelConfig } from '@/lib/openrouter-models'

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
      .select(
        'openrouter_api_key, openrouter_analyze_model, openrouter_summarize_model, openrouter_refine_model, updated_at'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch OpenRouter key:', error)
      return Response.json(
        { error: 'Failed to fetch OpenRouter key' },
        { status: 500 }
      )
    }

    const modelConfig = resolveOpenRouterModelConfig({
      analyzeModel: data?.openrouter_analyze_model,
      summarizeModel: data?.openrouter_summarize_model,
      refineModel: data?.openrouter_refine_model,
    })

    return Response.json({
      hasKey: !!data?.openrouter_api_key,
      maskedKey: data?.openrouter_api_key
        ? maskApiKey(data.openrouter_api_key)
        : null,
      ...modelConfig,
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

    const { apiKey, analyzeModel, summarizeModel, refineModel } =
      await request.json()
    const rawApiKey = typeof apiKey === 'string' ? apiKey : ''
    let trimmedKey = rawApiKey.trim()
    const modelConfig = resolveOpenRouterModelConfig({
      analyzeModel,
      summarizeModel,
      refineModel,
    })

    if (!trimmedKey) {
      const { data: existingRow, error: existingRowError } = await supabase
        .from('user_api_keys')
        .select('openrouter_api_key')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingRowError) {
        console.error(
          'Failed to fetch existing OpenRouter key:',
          existingRowError
        )
        return Response.json(
          { error: 'Failed to fetch existing OpenRouter key' },
          { status: 500 }
        )
      }

      trimmedKey = existingRow?.openrouter_api_key?.trim() || ''
    }

    if (!trimmedKey) {
      return Response.json({ error: 'API key is required' }, { status: 400 })
    }

    const { error } = await supabase.from('user_api_keys').upsert(
      {
        user_id: user.id,
        openrouter_api_key: trimmedKey,
        openrouter_analyze_model: modelConfig.analyzeModel,
        openrouter_summarize_model: modelConfig.summarizeModel,
        openrouter_refine_model: modelConfig.refineModel,
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
      ...modelConfig,
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
