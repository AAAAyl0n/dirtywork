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

type TestCategory =
  | 'ok'
  | 'timeout'
  | 'model_not_found'
  | 'auth_failed'
  | 'empty_response'
  | 'other_error'

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

function classifyError(error: unknown): {
  category: TestCategory
  message: string
} {
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      category: 'timeout',
      message: '超时',
    }
  }

  const maybeError = error as any
  const status = maybeError?.status
  const code = maybeError?.code
  const message =
    typeof maybeError?.message === 'string'
      ? maybeError.message
      : 'Unknown error'
  const normalizedMessage = message.toLowerCase()

  if (
    status === 401 ||
    status === 403 ||
    code === 'invalid_api_key' ||
    normalizedMessage.includes('invalid api key') ||
    normalizedMessage.includes('unauthorized') ||
    normalizedMessage.includes('authentication') ||
    normalizedMessage.includes('auth')
  ) {
    return {
      category: 'auth_failed',
      message: '认证失败',
    }
  }

  if (
    status === 404 ||
    code === 'model_not_found' ||
    normalizedMessage.includes('model not found') ||
    normalizedMessage.includes('no such model') ||
    normalizedMessage.includes('unknown model')
  ) {
    return {
      category: 'model_not_found',
      message: '模型不存在',
    }
  }

  return {
    category: 'other_error',
    message,
  }
}

function extractText(value: unknown): string {
  if (!value) return ''

  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(extractText).join('')
  }

  if (typeof value !== 'object') {
    return ''
  }

  const record = value as Record<string, unknown>

  if (typeof record.text === 'string') {
    return record.text
  }

  if (typeof record.content === 'string') {
    return record.content
  }

  if (Array.isArray(record.content)) {
    return record.content.map(extractText).join('')
  }

  if (typeof record.output_text === 'string') {
    return record.output_text
  }

  if (Array.isArray(record.output_text)) {
    return record.output_text.map(extractText).join('')
  }

  if (typeof record.reasoning === 'string') {
    return record.reasoning
  }

  if (Array.isArray(record.reasoning)) {
    return record.reasoning.map(extractText).join('')
  }

  if (typeof record.delta === 'object' && record.delta) {
    return extractText(record.delta)
  }

  return ''
}

async function testModel(
  client: OpenAI,
  model: string,
  stream = false
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    let content = ''

    if (stream) {
      const response = (await client.chat.completions.create(
        {
          model,
          messages: [
            {
              role: 'user',
              content: '8+9=?',
            },
          ],
          temperature: 0,
          max_tokens: 32,
          stream: true,
        },
        {
          signal: controller.signal,
        }
      )) as any

      for await (const part of response) {
        content += extractText(part.choices[0]?.delta)
      }
    } else {
      const response = await client.chat.completions.create(
        {
          model,
          messages: [
            {
              role: 'user',
              content: '8+9=?',
            },
          ],
          temperature: 0,
          max_tokens: 32,
        },
        {
          signal: controller.signal,
        }
      )

      content = extractText(response.choices[0]?.message).trim()
    }

    return {
      ok: !!content,
      category: content ? 'ok' : 'empty_response',
      message: content || '响应为空但请求成功',
    }
  } catch (error) {
    const classified = classifyError(error)
    return {
      ok: false,
      category: classified.category,
      message: classified.message,
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
      testModel(client, modelConfig.analyzeModel),
      testModel(client, modelConfig.summarizeModel),
      testModel(client, modelConfig.refineModel),
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
