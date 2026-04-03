import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getAuthedUserOpenRouterApiKey } from '@/lib/user-api-keys'
import {
  resolveOpenRouterModelConfig,
  DEFAULT_OPENROUTER_ANALYZE_MODEL,
  DEFAULT_OPENROUTER_SUMMARIZE_MODEL,
  DEFAULT_OPENROUTER_REFINE_MODEL,
} from '@/lib/openrouter-models'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const REQUEST_TIMEOUT_MS = 45_000

function createOpenRouterClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer':
        process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Dirtywork OpenRouter Model Test',
    },
  })
}

async function testModel(client: OpenAI, model: string, label: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          {
            role: 'user',
            content: `Return exactly this text and nothing else: ${label} OK`,
          },
        ],
        temperature: 0,
        max_tokens: 32,
      },
      {
        signal: controller.signal,
      }
    )

    const content = response.choices[0]?.message?.content?.trim() || ''

    return {
      ok: !!content,
      message: content || 'No content returned',
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.name === 'AbortError'
          ? 'Request timed out'
          : error instanceof Error
            ? error.message
            : 'Unknown error',
    }
  } finally {
    clearTimeout(timeoutId)
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

    const payload = await request.json().catch(() => ({}))
    const inputApiKey =
      typeof payload.apiKey === 'string' ? payload.apiKey.trim() : ''
    const modelConfig = resolveOpenRouterModelConfig({
      analyzeModel: payload.analyzeModel,
      summarizeModel: payload.summarizeModel,
      refineModel: payload.refineModel,
    })

    let apiKey = inputApiKey

    if (!apiKey) {
      const keyResult = await getAuthedUserOpenRouterApiKey()
      if ('error' in keyResult) {
        return Response.json({ error: keyResult.error }, { status: keyResult.status })
      }
      apiKey = keyResult.apiKey
    }

    const client = createOpenRouterClient(apiKey)

    const [analyze, summarize, refine] = await Promise.all([
      testModel(client, modelConfig.analyzeModel, 'ANALYZE'),
      testModel(client, modelConfig.summarizeModel, 'SUMMARIZE'),
      testModel(client, modelConfig.refineModel, 'REFINE'),
    ])

    const allPassed = analyze.ok && summarize.ok && refine.ok

    return Response.json({
      success: allPassed,
      models: {
        analyze: {
          configured: modelConfig.analyzeModel,
          default: DEFAULT_OPENROUTER_ANALYZE_MODEL,
          ...analyze,
        },
        summarize: {
          configured: modelConfig.summarizeModel,
          default: DEFAULT_OPENROUTER_SUMMARIZE_MODEL,
          ...summarize,
        },
        refine: {
          configured: modelConfig.refineModel,
          default: DEFAULT_OPENROUTER_REFINE_MODEL,
          ...refine,
        },
      },
    })
  } catch (error) {
    console.error('OpenRouter model test error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
