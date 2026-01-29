import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5分钟超时，处理长文本

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})

const claudeClient = new OpenAI({
  apiKey: process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.CLAUDE_BASE_URL || process.env.OPENAI_BASE_URL,
})

const isClaudeModel = (model: string) => model.startsWith('claude-')

// Gemini 专用客户端
const geminiClient = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})

const TAVILY_API_KEY = process.env.TAVILY_API_KEY!

// 定义工具
const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the internet for real-time information. Use this ONLY when you are highly uncertain about specific terms, company names, or technical terminology that cannot be inferred from context.',
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

// 联网搜索
async function handleWebSearch(query: string): Promise<string> {
  console.log('[Search] Starting search for:', query)
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5,
      }),
    })

    if (!response.ok) {
      console.error('[Search] Tavily API error:', response.status, response.statusText)
      return `Search failed: ${response.statusText}`
    }

    const data = await response.json()
    console.log('[Search] Tavily response:', JSON.stringify(data).slice(0, 500))

    // 检查是否有结果
    if (!data.results || data.results.length === 0) {
      console.log('[Search] No results found')
      return `No search results found for: ${query}`
    }

    if (data.answer) {
      const snippets = data.results.map((r: any) => `- ${r.title}: ${r.content}`).join('\n')
      return `Answer: ${data.answer}\n\nReference Snippets:\n${snippets}`
    }

    const result = data.results
      .map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
      .join('\n\n')
    
    return result || `No meaningful results for: ${query}`
  } catch (error) {
    console.error('[Search] Error:', error)
    return `Search failed due to error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

// 按4000字分割文本（用于上下文分析）
function splitForAnalysis(content: string, maxChunkSize = 4000): string[] {
  const chunks: string[] = []
  let currentChunk = ''

  // 按段落分割，尽量保持语义完整
  const paragraphs = content.split(/\n\n+/)

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      // 如果单个段落超长，强制分割
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

  // 过滤掉空的 chunks
  return chunks.filter(chunk => chunk.trim().length > 0)
}

// 按2000字分割文本（用于处理输出），保持对话完整性
function splitForProcessing(content: string, maxChunkSize = 2000): string[] {
  const lines = content.split('\n')
  const chunks: string[] = []
  let currentChunk: string[] = []
  let currentSize = 0

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // 检查是否是说话人行
    // 支持三种格式：
    // 1. "说话人：" 或 "说话人:" （中文/英文冒号结尾）
    // 2. "说话人   29:10" （名字 + 空格 + 时间戳，如 MM:SS 或 HH:MM:SS）
    // 3. "**Kathy** (00:56)" （Markdown加粗 + 括号时间戳）
    const speakerMatch = line.match(/^(\*\*)?[A-Za-z\u4e00-\u9fa5]+(\*\*)?(\s+\d{1,2}:\d{2}(:\d{2})?|\s*\(\d{1,2}:\d{2}(:\d{2})?\))?[：:]?\s*$/)

    if (speakerMatch) {
      const speaker = line
      const contentLines = [speaker]
      i++

      // 收集直到下一个说话人
      while (i < lines.length && !lines[i].match(/^(\*\*)?[A-Za-z\u4e00-\u9fa5]+(\*\*)?(\s+\d{1,2}:\d{2}(:\d{2})?|\s*\(\d{1,2}:\d{2}(:\d{2})?\))?[：:]?\s*$/)) {
        contentLines.push(lines[i])
        i++
      }

      const dialogue = contentLines.join('\n')
      const dialogueSize = dialogue.length

      if (currentSize + dialogueSize > maxChunkSize && currentChunk.length > 0) {
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

  // 过滤掉空的 chunks
  return chunks.filter(chunk => chunk.trim().length > 0)
}

// Context Pool 接口定义
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

// 辅助函数：限制并发数的批量执行
async function promiseAllWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
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

// 分析单个chunk，生成context pool
async function analyzeChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  basePrompt: string,
  onSearch: (query: string) => void,
  onSearchDone: () => void,
  onThinking: () => void
): Promise<ContextPool> {
  // 检查 chunk 是否为空
  if (!chunk || chunk.trim().length === 0) {
    console.warn(`Chunk ${chunkIndex + 1} is empty, skipping analysis`)
    return { characters: [], terminology: [], corrections: [] }
  }

  const systemPrompt = `你是一个专业的语音转文字内容分析专家。你的任务是分析对话文本，提取关键上下文信息。不要过度思考。

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
  "notes": ["其他重要观察（可选）"]
}

注意：
1. 用户提供的是一个音频转文本的内容，可能包含较多听写错误，请注意纠正。
2. 如果遇到不确定的专有名词、公司名称或技术术语，必须使用搜索工具验证，并推测、确认名词是否正确。可能遇到公司名听写错误，但错误识别为另一个公司（例如星猿辙->新原则），搜索前请先思考确认，避免出现此类搜索错误。
3. 纠错表中尽量只包含名词（人名、公司名、数据）的纠错，语言纠错会在后续步骤中修正。
4. 返回纯JSON格式，不要有其他文字`

  let messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: chunk },
  ]

  // 第一次请求，可能会调用工具
  // 添加超时控制
  const firstController = new AbortController()
  const firstTimeoutId = setTimeout(() => firstController.abort(), 3600000) // 90秒超时
  
  let response
  try {
    const model = 'claude-sonnet-4-5-20250929'
    const modelClient = isClaudeModel(model) ? claudeClient : client
    response = await modelClient.chat.completions.create({
      model,
      messages,
      temperature: 0.2,
      tools,
      tool_choice: 'auto',
      max_tokens: 4096, // 限制输出长度
    }, {
      signal: firstController.signal,
    })
    clearTimeout(firstTimeoutId)
  } catch (error) {
    clearTimeout(firstTimeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Claude] Request timed out after 90s')
    }
    throw error
  }

  let assistantMessage = response.choices[0].message

  // 处理工具调用
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    // 收集所有搜索结果
    const searchResults: string[] = []
    
    for (const toolCall of assistantMessage.tool_calls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tc = toolCall as any
      if (tc.function?.name === 'web_search') {
        const args = JSON.parse(tc.function.arguments)
        onSearch(args.query)
        const searchResult = await handleWebSearch(args.query)
        onSearchDone() // 搜索完成，清除搜索框
        searchResults.push(`【搜索: ${args.query}】\n${searchResult}`)
      }
    }

    // 构建 Gemini 友好的消息格式（不使用 tool_calls）
    const geminiMessages: OpenAI.ChatCompletionMessageParam[] = [
      messages[0], // system prompt
      messages[1], // user content (chunk)
      {
        role: 'user',
        content: `以下是搜索结果，请参考这些信息完成分析：\n\n${searchResults.join('\n\n')}\n\n请基于以上搜索结果和原文，输出JSON格式的分析结果。不要过度思考.`,
      },
    ]

    // 再次请求获取最终结果
    onThinking() // 开始分析，显示 Thinking 框
    console.log('[Analysis] Sending request with messages:', JSON.stringify(geminiMessages, null, 2))
    
    // 添加超时控制，避免 Cloudflare 524 错误
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3600000) // 90秒超时
    
    try {
      const response2 = await geminiClient.chat.completions.create({
        model: 'gemini-3-flash-preview-thinking',
        messages: geminiMessages,
        temperature: 0.2,
        max_tokens: 32768, // 增加限制，给 reasoning + output 都留够空间
      }, {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      console.log('[Gemini] Raw response:', JSON.stringify(response2, null, 2))
      assistantMessage = response2.choices[0].message
      console.log('[Gemini] Parsed message:', assistantMessage)
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[Gemini] Request timed out after 360s')
      }
      throw error
    }
  }

  // 解析JSON
  try {
    const content = assistantMessage.content || '{}'
    // 提取JSON部分
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return { characters: [], terminology: [], corrections: [] }
  } catch (e) {
    console.error('Failed to parse context JSON:', e)
    return { characters: [], terminology: [], corrections: [] }
  }
}

// 合并多个context pools
async function mergeContextPools(pools: ContextPool[]): Promise<ContextPool> {
  if (pools.length === 0) {
    return { characters: [], terminology: [], corrections: [] }
  }

  if (pools.length === 1) {
    return pools[0]
  }

  const mergePrompt = `你是一个数据合并专家。请将以下多个JSON上下文信息合并为一个统一的JSON。

要求：
1. 合并相同的人物，保留最完整的描述
2. 去重术语，合并相同术语的不同描述
3. 合并纠错表，去除重复项
4. 输出纯JSON格式

待合并的JSON数组：
${JSON.stringify(pools, null, 2)}

请输出合并后的单个JSON对象：`

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-2025-04-14', // 使用较小模型
    messages: [{ role: 'user', content: mergePrompt }],
    temperature: 0.1,
  })

  try {
    const content = response.choices[0].message.content || '{}'
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    return pools[0] // fallback
  } catch (e) {
    console.error('Failed to merge context pools:', e)
    // fallback: 简单合并
    return {
      characters: pools.flatMap((p) => p.characters || []),
      terminology: pools.flatMap((p) => p.terminology || []),
      corrections: pools.flatMap((p) => p.corrections || []),
      notes: pools.flatMap((p) => p.notes || []),
    }
  }
}

// 格式化context pool为可读文本
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
    // 按类别分组
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
      for (const t of terms) {
        result += `- ${t.term}${t.explanation ? `: ${t.explanation}` : ''}\n`
      }
      result += '\n'
    }
  }

  if (pool.corrections && pool.corrections.length > 0) {
    result += '纠错表：\n'
    for (const c of pool.corrections) {
      result += `- [${c.original}] → [${c.corrected}]${c.reason ? ` (${c.reason})` : ''}\n`
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

// 精修命令
const REFINE_INSTRUCTION = `这是投资人与公司/客户的音频转文字记录。注意访谈录音稿可能存在错误，包括语序错误、字词识别错误等等，这些问题你需要修正，同时由于录制声音可能不清晰，你需要根据上下文推测不清楚的地方。

请修正以下文本：
1. 修正语序错误
2. 修正字词识别错误（利用上下文信息库中的纠错表）
3. 修正专有名词拼写（利用上下文信息库中的术语表）
4. 根据上下文推测并修正不清晰的部分
5. 保持原文格式和说话人标记
6. 不要添加额外的解释或注释，只输出修正后的文本
7. 去除或润色语气词较多或有口癖、重复的内容`

export async function POST(request: Request) {
  try {
    const { text, basePrompt, startChunkIndex = 0, skipContextAnalysis = false } = await request.json()

    if (!text) {
      return Response.json({ error: 'Text is required' }, { status: 400 })
    }

    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        const send = (type: string, content: string) => {
          controller.enqueue(encoder.encode(JSON.stringify({ t: type, c: content }) + '\n'))
        }

        try {
          let finalPrompt = basePrompt || ''

          // 第一阶段：上下文分析
          if (!skipContextAnalysis) {
            send('s', 'Analyzing context...')

            const analysisChunks = splitForAnalysis(text, 4000)

            // 分批并发分析chunks（限制并发数为2，避免触发代理限制）
            const contextPoolTasks = analysisChunks.map((chunk, index) => () =>
              analyzeChunk(
                chunk,
                index,
                analysisChunks.length,
                basePrompt,
                (query) => send('search', query),
                () => send('searchdone', ''),
                () => send('thinking', '')
              )
            )

            const contextPools = await promiseAllWithConcurrency(contextPoolTasks, 15)

            // 合并context pools
            send('sumup', '') // 显示 Sum up! 框
            const mergedPool = await mergeContextPools(contextPools)

            // 格式化并发送最终prompt
            finalPrompt = formatContextPool(mergedPool, basePrompt)
            send('p', finalPrompt)
          } else {
            // 跳过分析，使用传入的basePrompt
            finalPrompt = basePrompt
          }

          // 第二阶段：逐chunk精修
          const processChunks = splitForProcessing(text, 2000)
          const totalChunks = processChunks.length

          for (let i = startChunkIndex; i < processChunks.length; i++) {
            const chunk = processChunks[i]
            send('s', `Processing chunk ${i + 1}/${totalChunks}`)

            const systemPrompt = `${finalPrompt}\n\n${REFINE_INSTRUCTION}`

            const stream = await client.chat.completions.create({
              model: 'gpt-4.1-2025-04-14',
              messages: [
                { role: 'system', content: systemPrompt },
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

            // 在chunks之间添加换行
            if (i < processChunks.length - 1) {
              send('c', '\n\n')
            }
          }

          send('s', 'Completed')
          controller.close()
        } catch (error) {
          console.error('Refine Stream Error:', error)
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
    console.error('Refine API Error:', error)
    return Response.json({ success: false, error: '请求失败，请稍后重试' }, { status: 500 })
  }
}

