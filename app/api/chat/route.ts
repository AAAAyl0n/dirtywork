import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})

const claudeClient = new OpenAI({
  apiKey: process.env.CLAUDE_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.CLAUDE_BASE_URL || process.env.OPENAI_BASE_URL,
})

const isClaudeModel = (model: string) => model.startsWith('claude-')

const TAVILY_API_KEY = process.env.TAVILY_API_KEY!

// 定义工具
const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the internet for real-time information.',
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

async function handleWebSearch(query: string) {
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
        throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json()

    // 优先使用 Tavily 生成的直接回答
    if (data.answer) {
        return `Answer: ${data.answer}\n\nReference Snippets:\n${data.results.map((r: any) => `- ${r.title}: ${r.content}`).join('\n')}`
    }
    
    // 否则返回搜索结果摘要
    return data.results
      .map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
      .join('\n\n')

  } catch (error) {
    console.error('Search error:', error)
    return 'Search failed.'
  }
}

export async function POST(request: Request) {
  try {
    const { messages: userMessages } = await request.json()

    const systemMessage = {
      role: 'system' as const,
      content:
        'You are a helpful AI assistant. When the user asks for real-time information, use the web_search tool to find answers. You are currently using the Claude-3.5-Sonnet model (via adapter). Math formulas should be wrapped in $$.',
    }

    // 构建消息数组
    let messages: OpenAI.ChatCompletionMessageParam[] = [
      systemMessage,
      ...userMessages,
    ]

    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // 第一次请求：开启流式
          const stream = await client.chat.completions.create({
            model: 'gpt-4o',
            messages,
            temperature: 0.3,
            tools,
            tool_choice: 'auto',
            stream: true, 
          })

          let finalContent = ''
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolCallsMap: Record<number, any> = {}

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta

            if (delta?.content) {
              finalContent += delta.content
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`)
              )
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index
                if (!toolCallsMap[index]) {
                  toolCallsMap[index] = {
                    id: tc.id,
                    type: 'function',
                    function: {
                      name: tc.function?.name || '',
                      arguments: tc.function?.arguments || '',
                    },
                  }
                } else {
                  if (tc.function?.arguments) {
                    toolCallsMap[index].function.arguments += tc.function.arguments
                  }
                }
              }
            }
          }

          const toolCalls = Object.values(toolCallsMap)

          // 如果模型想要调用工具
          if (toolCalls.length > 0) {
            // 1. 把助手的"想调用工具"的想法加入历史
            // Fix: Ensure content is not null (some providers require string content)
            const assistantMsg: OpenAI.ChatCompletionMessageParam = {
                role: 'assistant',
                content: finalContent || 'Thinking...',
                tool_calls: toolCalls as any,
            }
            messages.push(assistantMsg)

            // 2. 执行所有工具调用
            for (const toolCall of toolCalls) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const tc = toolCall as any
              if (tc.function.name === 'web_search') {
                const args = JSON.parse(tc.function.arguments)

                // 通知前端：正在搜索中
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'status', status: 'searching', query: args.query })}\n\n`)
                )

                const searchResult = await handleWebSearch(args.query)

                // 3. 把工具的执行结果加入历史
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: searchResult,
                })
              }
            }

            // 4. 带上工具结果，再次请求模型 (这次开启流式)
            const model = 'claude-sonnet-4-5-20250929'
            const modelClient = isClaudeModel(model) ? claudeClient : client
            const stream2 = await modelClient.chat.completions.create({
              model,
              messages,
              temperature: 0.3,
              stream: true,
            })

            // 5. 转发流
            for await (const chunk of stream2) {
              const content = chunk.choices[0]?.delta?.content || ''
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                )
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API Error:', error)
    return Response.json(
      { success: false, error: '请求失败，请稍后重试' },
      { status: 500 }
    )
  }
}
