import { createClient } from '@/lib/supabase/server'
import { resolveOpenRouterModelConfig } from '@/lib/openrouter-models'

export function maskApiKey(apiKey: string) {
  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`
  }

  return `${apiKey.slice(0, 6)}***${apiKey.slice(-4)}`
}

export async function getAuthedUserOpenRouterApiKey() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      error: 'Unauthorized',
      status: 401 as const,
    }
  }

  const { data, error } = await supabase
    .from('user_api_keys')
    .select(
      'openrouter_api_key, openrouter_analyze_model, openrouter_summarize_model, openrouter_refine_model'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch user api key:', error)
    return {
      error: 'Failed to fetch OpenRouter API key',
      status: 500 as const,
    }
  }

  if (!data?.openrouter_api_key) {
    return {
      error: 'OpenRouter API key not configured',
      status: 400 as const,
    }
  }

  return {
    apiKey: data.openrouter_api_key,
    userId: user.id,
    ...resolveOpenRouterModelConfig({
      analyzeModel: data.openrouter_analyze_model,
      summarizeModel: data.openrouter_summarize_model,
      refineModel: data.openrouter_refine_model,
    }),
  }
}
