import OpenAI from 'openai'
import { getAuthedUserOpenRouterApiKey } from '@/lib/user-api-keys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const TAVILY_API_KEY = process.env.TAVILY_API_KEY!
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const OPENROUTER_ANALYZE_MODEL =
  process.env.OPENROUTER_ANALYZE_MODEL || 'google/gemini-3-flash-preview'
const OPENROUTER_SUMMARIZE_MODEL =
  process.env.OPENROUTER_SUMMARIZE_MODEL || 'google/gemini-3.1-pro-preview'
const OPENROUTER_REFINE_MODEL =
  process.env.OPENROUTER_REFINE_MODEL || 'anthropic/claude-haiku-4.5'
const SEARCH_RESULT_MAX_CHARS = 1000
const ANALYZE_TIMEOUT_MS = 180_000
const MERGE_TIMEOUT_MS = 360_000
const SEARCH_TIMEOUT_MS = 20_000
const ANALYSIS_CONCURRENCY = 8

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the internet for real-time information. Use this ONLY when you are highly uncertain about specific terms, company names, or technical terminology that cannot be inferred from context.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query string.',
          },
        },
        required: ['query'],
      },
    },
  },
]

function createOpenRouterClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer':
        process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Dirtywork OpenRouter Refine',
    },
  })
}

async function handleWebSearch(query: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return `Search failed: ${response.statusText}`
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return `No search results found for: ${query}`
    }

    if (data.answer) {
      const snippets = data.results
        .map((r: any) => `- ${r.title}: ${r.content}`)
        .join('\n')
      return truncateSearchResult(
        `Answer: ${data.answer}\n\nReference Snippets:\n${snippets}`
      )
    }

    const result = data.results
      .map(
        (r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`
      )
      .join('\n\n')

    return truncateSearchResult(result || `No meaningful results for: ${query}`)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      return `Search timed out for query: ${query}`
    }

    return `Search failed due to error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

function truncateSearchResult(text: string): string {
  if (text.length <= SEARCH_RESULT_MAX_CHARS) return text
  return `${text.slice(0, SEARCH_RESULT_MAX_CHARS)}\n\n[Truncated]`
}

function splitForAnalysis(content: string, maxChunkSize = 4000): string[] {
  const chunks: string[] = []
  let currentChunk = ''
  const paragraphs = content.split(/\n\n+/)

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }

      if (paragraph.length > maxChunkSize) {
        let remaining = paragraph
        while (remaining.length > maxChunkSize) {
          chunks.push(remaining.slice(0, maxChunkSize))
          remaining = remaining.slice(maxChunkSize)
        }
        currentChunk = remaining
      } else {
        currentChunk = paragraph
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter((chunk) => chunk.trim().length > 0)
}

function splitForProcessing(content: string, maxChunkSize = 2000): string[] {
  const lines = content.split('\n')
  const chunks: string[] = []
  let currentChunk: string[] = []
  let currentSize = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const speakerMatch = line.match(
      /^(\*\*)?[A-Za-z\u4e00-\u9fa5]+(\*\*)?(\s+\d{1,2}:\d{2}(:\d{2})?|\s*\(\d{1,2}:\d{2}(:\d{2})?\))?[：:]?\s*$/
    )

    if (speakerMatch) {
      const contentLines = [line]
      i++

      while (
        i < lines.length &&
        !lines[i].match(
          /^(\*\*)?[A-Za-z\u4e00-\u9fa5]+(\*\*)?(\s+\d{1,2}:\d{2}(:\d{2})?|\s*\(\d{1,2}:\d{2}(:\d{2})?\))?[：:]?\s*$/
        )
      ) {
        contentLines.push(lines[i])
        i++
      }

      const dialogue = contentLines.join('\n')
      const dialogueSize = dialogue.length

      if (
        currentSize + dialogueSize > maxChunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.join('\n'))
        currentChunk = []
        currentSize = 0
      }

      currentChunk.push(...contentLines)
      currentSize += dialogueSize
    } else {
      currentChunk.push(line)
      currentSize += line.length + 1
      i++
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'))
  }

  return chunks.filter((chunk) => chunk.trim().length > 0)
}

interface ContextPool {
  characters: Array<{
    identifier: string
    role: string
    description?: string
  }>
  terminology: Array<{
    term: string
    explanation?: string
    category?: string
  }>
  corrections: Array<{
    original: string
    corrected: string
    reason?: string
  }>
  notes?: string[]
}

function parseJsonFromText<T>(text: string): T | null {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) return null

  const rawJson = candidate.slice(start, end + 1)
  const cleaned = rawJson.replace(/,\s*([}\]])/g, '$1').trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

async function promiseAllWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
) {
  const results: T[] = new Array(tasks.length)
  let currentIndex = 0

  async function worker() {
    while (currentIndex < tasks.length) {
      const index = currentIndex++
      results[index] = await tasks[index]()
    }
  }

  const workers = Array(Math.min(concurrency, tasks.length))
    .fill(null)
    .map(() => worker())

  await Promise.all(workers)
  return results
}

async function analyzeChunk(
  client: OpenAI,
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  basePrompt: string,
  onSearch: (query: string) => void,
  onSearchDone: () => void,
  onThinking: () => void
): Promise<ContextPool> {
  if (!chunk || chunk.trim().length === 0) {
    return { characters: [], terminology: [], corrections: [] }
  }

  const systemPrompt = `你是一个专业的语音转文字内容分析专家。你的任务是分析对话文本，提取关键上下文信息。不要过度思考，尽可能精简输出。

${basePrompt ? `用户提供的背景信息：\n${basePrompt}\n` : ''}

请分析以下文本（第${chunkIndex + 1}/${totalChunks}段），提取以下信息并以JSON格式返回：

{
  "characters": [
    {"identifier": "标识符/代号", "role": "角色描述", "description": "更多信息（可选）"}
  ],
  "terminology": [
    {"term": "术语/专有名词", "explanation": "解释（可选）", "category": "分类：company/product/technical/other"}
  ],
  "corrections": [
    {"original": "原错误表达", "corrected": "正确表达", "reason": "原因（可选）"}
  ],
  "notes": ["其他重要观察（可选，尽量不写）"]
}

注意：
1. 用户提供的是一个音频转文本的内容，可能包含较多听写错误，包含人名错误、公司名错误、语病，请注意纠正。
2. 遇到不确定的专有名词、公司名称或技术术语，必须使用搜索工具验证，并推测、确认名词是否正确。
3. 几个说话人提到的人名和公司名，务必！！必须！！使用搜索工具验证和深度思考判断，不允许自己猜测。
4. 纠错表中尽量只包含名词（人名、公司名、数据）的纠错，语言纠错会在后续步骤中修正。尽可能多的寻找和给出纠错。
5. 返回纯JSON格式，不要有其他文字
6. 严格规则：如果你对某个事实或名称的置信度低于90%，你必须先搜索再回答。`

  let messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: chunk },
  ]

  const firstController = new AbortController()
  const firstTimeoutId = setTimeout(
    () => firstController.abort(),
    ANALYZE_TIMEOUT_MS
  )

  let response

  try {
    response = await client.chat.completions.create(
      {
        model: OPENROUTER_ANALYZE_MODEL,
        messages,
        temperature: 0.2,
        tools,
        tool_choice: 'auto',
        max_tokens: 16384,
        reasoning: {
          effort: 'high',
          exclude: true,
        },
      } as any,
      {
        signal: firstController.signal,
      }
    )
    clearTimeout(firstTimeoutId)
  } catch (error) {
    clearTimeout(firstTimeoutId)
    throw error
  }

  let assistantMessage = response.choices[0].message

  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    let followupMessages: OpenAI.ChatCompletionMessageParam[] = [...messages]
    let loopCount = 0
    const maxLoops = 5

    while (
      assistantMessage.tool_calls &&
      assistantMessage.tool_calls.length > 0
    ) {
      if (loopCount >= maxLoops) {
        break
      }
      loopCount += 1

      const toolMessages: OpenAI.ChatCompletionMessageParam[] = []

      for (const toolCall of assistantMessage.tool_calls) {
        const tc = toolCall as any
        if (tc.function?.name !== 'web_search') continue

        let args: { query?: string } = {}
        try {
          args = JSON.parse(tc.function.arguments || '{}')
        } catch {}

        const query = (args.query || '').trim()
        if (!query) continue

        onSearch(query)
        const searchResult = await handleWebSearch(query)
        onSearchDone()
        toolMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: searchResult,
        })
      }

      onThinking()
      followupMessages = [
        ...followupMessages,
        assistantMessage,
        ...toolMessages,
      ]

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS)

      try {
        const response2 = await client.chat.completions.create(
          {
            model: OPENROUTER_ANALYZE_MODEL,
            messages: followupMessages,
            temperature: 0.2,
            tools,
            tool_choice: 'auto',
            max_tokens: 16384,
            reasoning: {
              effort: 'high',
              exclude: true,
            },
          } as any,
          {
            signal: controller.signal,
          }
        )
        clearTimeout(timeoutId)
        assistantMessage = response2.choices[0].message
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }
    }
  }

  try {
    const content = assistantMessage.content || '{}'
    const parsed = parseJsonFromText<ContextPool>(content)
    if (parsed) return parsed
  } catch (error) {
    console.error('Failed to parse context JSON:', error)
  }

  return { characters: [], terminology: [], corrections: [] }
}

function fallbackMergeContextPools(pools: ContextPool[]): ContextPool {
  if (pools.length === 0) {
    return { characters: [], terminology: [], corrections: [] }
  }

  if (pools.length === 1) {
    return pools[0]
  }

  return {
    characters: pools.flatMap((p) => p.characters || []),
    terminology: pools.flatMap((p) => p.terminology || []),
    corrections: pools.flatMap((p) => p.corrections || []),
    notes: pools.flatMap((p) => p.notes || []),
  }
}

async function summarizeContextText(
  client: OpenAI,
  contextText: string,
  onStream?: (delta: string) => void
) {
  if (!contextText.trim()) return contextText

  const summarizePrompt = `你是一个“上下文信息整理”专家。请整理下面的上下文文本，输出去重后的版本。

要求：
1. 合并相同人物（同名、别名、明显指代同一人），保留最完整的一条
2. 去重术语，若解释重复则保留更清晰版本；冲突时保留更可信/更完整版本
3. 去重纠错表，保留最准确表达
4. 保留原有大结构（如：人物、公司/组织、产品/服务、技术术语、其他术语、纠错表、备注）
5. 输出纯文本，不要 JSON，不要 Markdown 代码块，不要额外说明

待整理文本：
${contextText}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MERGE_TIMEOUT_MS)
  let summarizedContent = ''

  try {
    const stream = (await client.chat.completions.create(
      {
        model: OPENROUTER_SUMMARIZE_MODEL,
        messages: [{ role: 'user', content: summarizePrompt }],
        temperature: 0.1,
        stream: true,
        reasoning: {
          effort: 'medium',
          exclude: true,
        },
      } as any,
      {
        signal: controller.signal,
      }
    )) as any

    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content || ''
      if (delta) {
        summarizedContent += delta
        onStream?.(delta)
      }
    }

    const cleaned = summarizedContent.trim()
    if (!cleaned) {
      return contextText
    }

    return cleaned
  } catch (error) {
    console.error('[OpenRouter summarize] fallback to original context:', error)
    return contextText
  } finally {
    clearTimeout(timeoutId)
  }
}

function formatContextPool(pool: ContextPool, userBasePrompt: string): string {
  let result = ''

  if (userBasePrompt) {
    result += `【用户提供的背景信息】\n${userBasePrompt}\n\n`
  }

  result += '【上下文信息库】\n\n'

  if (pool.characters && pool.characters.length > 0) {
    result += '人物：\n'
    for (const char of pool.characters) {
      result += `- ${char.identifier} - ${char.role}${char.description ? ` (${char.description})` : ''}\n`
    }
    result += '\n'
  }

  if (pool.terminology && pool.terminology.length > 0) {
    const byCategory: Record<string, typeof pool.terminology> = {}
    for (const term of pool.terminology) {
      const cat = term.category || 'other'
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(term)
    }

    const categoryNames: Record<string, string> = {
      company: '公司/组织',
      product: '产品/服务',
      technical: '技术术语',
      other: '其他术语',
    }

    for (const [cat, terms] of Object.entries(byCategory)) {
      result += `${categoryNames[cat] || cat}：\n`
      for (const term of terms) {
        result += `- ${term.term}${term.explanation ? `: ${term.explanation}` : ''}\n`
      }
      result += '\n'
    }
  }

  if (pool.corrections && pool.corrections.length > 0) {
    result += '纠错表：\n'
    for (const correction of pool.corrections) {
      result += `- [${correction.original}] → [${correction.corrected}]${correction.reason ? ` (${correction.reason})` : ''}\n`
    }
    result += '\n'
  }

  if (pool.notes && pool.notes.length > 0) {
    result += '备注：\n'
    for (const note of pool.notes) {
      result += `- ${note}\n`
    }
  }

  return result.trim()
}

const REFINE_INSTRUCTION = `这是投资人与公司/客户的音频转文字记录。注意访谈录音稿可能存在错误，包括语序错误、字词识别错误等等，这些问题你需要修正，同时由于录制声音可能不清晰，你需要根据上下文推测不清楚的地方。

请修正以下文本：
1. 修正语序错误
2. 修正字词识别错误（利用上下文信息库中的纠错表）
3. 修正专有名词拼写（利用上下文信息库中的术语表）
4. 根据上下文推测并修正不清晰的部分
5. 务必保持原文格式和说话人标记
6. 不要添加额外的解释或注释，只输出修正后的文本
7. 去除或润色语气词较多或有口癖、重复的内容
8. 开头不要输出其他内容，直接输出修正后的文本`

export async function POST(request: Request) {
  try {
    const keyResult = await getAuthedUserOpenRouterApiKey()
    if ('error' in keyResult) {
      return Response.json(
        { error: keyResult.error },
        { status: keyResult.status }
      )
    }

    const client = createOpenRouterClient(keyResult.apiKey)
    const {
      text,
      basePrompt,
      startChunkIndex = 0,
      skipContextAnalysis = false,
    } = await request.json()

    if (!text) {
      return Response.json({ error: 'Text is required' }, { status: 400 })
    }

    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        const send = (type: string, content: string) => {
          controller.enqueue(
            encoder.encode(JSON.stringify({ t: type, c: content }) + '\n')
          )
        }

        try {
          let finalPrompt = basePrompt || ''

          if (!skipContextAnalysis) {
            send('s', 'Analyzing context...')

            const analysisChunks = splitForAnalysis(text, 2000)
            let completedChunks = 0
            const totalChunks = analysisChunks.length
            send(
              'ap',
              JSON.stringify({ done: completedChunks, total: totalChunks })
            )

            const contextPoolTasks = analysisChunks.map(
              (chunk, index) => () =>
                analyzeChunk(
                  client,
                  chunk,
                  index,
                  analysisChunks.length,
                  basePrompt,
                  (query) => send('search', query),
                  () => send('searchdone', ''),
                  () => send('thinking', '')
                )
                  .catch((error) => {
                    console.error(
                      `[OpenRouter analyze] Chunk ${index + 1} failed:`,
                      error
                    )
                    return {
                      characters: [],
                      terminology: [],
                      corrections: [],
                    } satisfies ContextPool
                  })
                  .then((result) => {
                    completedChunks += 1
                    send(
                      'ap',
                      JSON.stringify({
                        done: completedChunks,
                        total: totalChunks,
                      })
                    )
                    return result
                  })
            )

            const contextPools = await promiseAllWithConcurrency(
              contextPoolTasks,
              ANALYSIS_CONCURRENCY
            )

            send('s', 'Summarizing context...')
            send('sumup', '')
            const mergedPool = fallbackMergeContextPools(contextPools)
            const rawContextText = formatContextPool(mergedPool, basePrompt)
            const summarizedContextText = await summarizeContextText(
              client,
              rawContextText,
              (delta) => send('sumupc', delta)
            )

            finalPrompt = summarizedContextText
            send('p', finalPrompt)
          } else {
            finalPrompt = basePrompt
            send('ap', JSON.stringify({ done: 0, total: 0 }))
          }

          const processChunks = splitForProcessing(text, 2000)
          const totalChunks = processChunks.length

          for (let i = startChunkIndex; i < processChunks.length; i++) {
            const chunk = processChunks[i]
            send('s', `Processing chunk ${i + 1}/${totalChunks}`)

            const stream = await client.chat.completions.create({
              model: OPENROUTER_REFINE_MODEL,
              messages: [
                {
                  role: 'system',
                  content: `${finalPrompt}\n\n${REFINE_INSTRUCTION}`,
                },
                { role: 'user', content: chunk },
              ],
              temperature: 0.3,
              stream: true,
            })

            for await (const part of stream) {
              const content = part.choices[0]?.delta?.content || ''
              if (content) {
                send('c', content)
              }
            }

            if (i < processChunks.length - 1) {
              send('c', '\n\n')
            }

            send('chunkdone', JSON.stringify({ chunkIndex: i, totalChunks }))
          }

          send('done', JSON.stringify({ totalChunks }))
          send('s', 'Completed')
          controller.close()
        } catch (error) {
          console.error('OpenRouter Refine Stream Error:', error)
          send('s', 'Error occurred')
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('OpenRouter Refine API Error:', error)
    return Response.json(
      { success: false, error: '请求失败，请稍后重试' },
      { status: 500 }
    )
  }
}
