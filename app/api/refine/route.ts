import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize client
const client = new OpenAI({
  apiKey: 'sk-qX4Wcc7o1cH15L7KgaRDbBuBgryXzFmVWzYzTjzStdmNxXPj', 
  baseURL: 'https://yinli.one/v1',
});

const TAVILY_API_KEY = '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'

const SEARCH_MODEL = 'claude-sonnet-4-5-20250929';
const REFINER_MODEL = 'gemini-3-pro-preview';

// Standard web_search tool definition
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
];

async function handleWebSearch(query: string) {
  try {
    console.log(`[handleWebSearch] 开始搜索: "${query}"`);
    
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
        const errorText = await response.text();
        console.error(`[handleWebSearch] Tavily API 错误 (${response.status}):`, errorText);
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json()
    console.log(`[handleWebSearch] 搜索成功，返回 ${data.results?.length || 0} 个结果`);

    // 优先使用 Tavily 生成的直接回答
    if (data.answer) {
        return `Answer: ${data.answer}\n\nReference Snippets:\n${data.results.map((r: any) => `- ${r.title}: ${r.content}`).join('\n')}`
    }
    
    // 否则返回搜索结果摘要
    if (data.results && data.results.length > 0) {
        return data.results
          .map((r: any) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
          .join('\n\n')
    }
    
    // 如果没有搜索结果，返回明确的消息
    console.warn(`[handleWebSearch] 未找到搜索结果: "${query}"`);
    return 'No search results found.'

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[handleWebSearch] 搜索失败 "${query}":`, errorMessage);
    return `Search failed: ${errorMessage}`;
  }
}

/**
 * Robust text splitting with multiple fallback strategies:
 * 1. Split by double newlines (paragraphs)
 * 2. If still too large, split by single newlines
 * 3. If still too large, split by sentence boundaries
 * 4. Last resort: hard split by character count
 */
function splitText(content: string, maxChunkSize = 1500): string[] {
  const chunks: string[] = [];
  
  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Strategy 1: Split by double newlines (paragraphs)
  const paragraphs = normalizedContent.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;
    
    // If adding this paragraph exceeds limit
    if (currentChunk.length + trimmedPara.length + 2 > maxChunkSize) {
      // Push current chunk if not empty
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If the paragraph itself is too large, need to split it further
      if (trimmedPara.length > maxChunkSize) {
        const subChunks = splitLargeParagraph(trimmedPara, maxChunkSize);
        chunks.push(...subChunks);
      } else {
        currentChunk = trimmedPara;
      }
    } else {
      // Add paragraph to current chunk
      currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedPara : trimmedPara;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // Filter out empty chunks
  return chunks.filter(c => c.trim().length > 0);
}

/**
 * Split a large paragraph that exceeds maxChunkSize
 */
function splitLargeParagraph(para: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  
  // Strategy 2: Try splitting by single newlines first
  const lines = para.split('\n');
  
  if (lines.length > 1) {
    let currentChunk = '';
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxChunkSize) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        // If single line is still too large, split by sentences
        if (line.length > maxChunkSize) {
          chunks.push(...splitBySentences(line, maxChunkSize));
          currentChunk = '';
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk = currentChunk ? currentChunk + '\n' + line : line;
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }
  
  // Strategy 3: Split by sentences
  return splitBySentences(para, maxChunkSize);
}

/**
 * Split text by sentence boundaries
 */
function splitBySentences(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  
  // Match sentence endings (Chinese and English punctuation)
  // This regex captures the punctuation as part of the sentence
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]?/g) || [text];
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      // If single sentence is still too large, hard split
      if (sentence.length > maxChunkSize) {
        chunks.push(...hardSplit(sentence, maxChunkSize));
        currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Last resort: hard split by character count
 */
function hardSplit(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChunkSize) {
    chunks.push(text.slice(i, i + maxChunkSize));
  }
  return chunks;
}

// Phase 1: Search Context Gathering (Using Claude)
async function gatherSearchContext(text: string, sendData: (type: 'p' | 'c' | 's' | 'search', content: string) => Uint8Array, controller: ReadableStreamDefaultController): Promise<string> {
  try {
    const textSample = text.slice(0, 4000);
    console.log('[gatherSearchContext] 开始搜索上下文收集');
    controller.enqueue(sendData('s', 'Web Searching...'));

    let messages: OpenAI.ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: `你是一个专业的搜索研究员。你的任务是阅读给定的文本，识别其中需要核实的关键信息（如人名、公司名、技术术语、专有名词等），并使用 web_search 工具进行搜索验证。
请收集所有相关信息，以便后续生成准确的背景资料。
如果不需要搜索，请直接回复"无需搜索"。
你的最终回复应该是你找到的所有相关信息的汇总。`
        },
        { role: 'user', content: textSample }
    ];

    let accumulatedContext = '';
    let maxIterations = 3; // Limit search iterations for speed

    while (maxIterations > 0) {
        maxIterations--;
        
        const completion = await client.chat.completions.create({
            model: SEARCH_MODEL,
            messages,
            temperature: 0.3,
            tools: tools,
            tool_choice: 'auto',
        });

        const choice = completion.choices[0];
        
        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
             console.log(`[gatherSearchContext] 工具调用数量: ${choice.message.tool_calls.length}`);
             
             // Append assistant's intent to messages
             messages.push({
                 ...choice.message,
                 content: choice.message.content || 'Searching...'
             }); 
             
             for (const toolCall of choice.message.tool_calls) {
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 const tc = toolCall as any;
                 const toolArgs = JSON.parse(tc.function.arguments || '{}');
                 
                 if (tc.function.name === 'web_search') {
                    console.log(`[gatherSearchContext] 执行网络搜索: ${toolArgs.query}`);
                    
                    // Emit search status to client
                    controller.enqueue(sendData('search', toolArgs.query));

                    const searchResult = await handleWebSearch(toolArgs.query);
                    console.log(`[gatherSearchContext] 搜索结果长度: ${searchResult.length} 字符`);
                    
                    // Add result to messages for the model to see
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: searchResult
                    });

                    // Accumulate results for the pool
                    accumulatedContext += `\n\n[Search Query: ${toolArgs.query}]\n[Result]\n${searchResult}`;
                 }
             }
        } else {
            // Final response from searcher
            const summary = choice.message.content || '';
            accumulatedContext += `\n\n[Search Summary]\n${summary}`;
            console.log(`[gatherSearchContext] 搜索阶段完成`);
            break;
        }
    }
    
    return accumulatedContext;
  } catch (error) {
    console.error('[gatherSearchContext] 搜索失败:', error);
    controller.enqueue(sendData('s', '搜索过程出现异常，将跳过搜索...'));
    return '';
  }
}

// Phase 2: System Prompt Generation (Using Gemini with Context Pool)
async function generateSystemPrompt(text: string, searchContext: string, sendData: (type: 'p' | 'c' | 's' | 'search', content: string) => Uint8Array, controller: ReadableStreamDefaultController): Promise<string> {
  try {
    const textSample = text.slice(0, 4000);
    console.log('[generateSystemPrompt] 开始生成系统提示词');
    controller.enqueue(sendData('s', 'Generating System Prompt...'));
    
    // Construct prompt with context pool
    let messages: OpenAI.ChatCompletionMessageParam[] = [
      { 
        role: 'system', 
        content: `你是一个专业的文本分析专家。你的任务是分析这段“投资人与公司/客户的访谈录音”文本，并生成一个结构化的上下文定义。

以下是前期搜索阶段收集到的参考信息（Context Pool）：
<context_pool>
${searchContext || '无额外搜索信息'}
</context_pool>

请根据原文和参考信息，按照以下严格的格式输出分析结果。
重要：你的输出必须只包含 <thinking> 块（用于思考）和随后的结构化结果。严禁包含任何开场白（如 "Based on...", "Here is..."）或结束语。

<thinking>
在这里进行思考，结合Context Pool的信息验证原文中的术语和人名...
</thinking>

人物
1. [姓名/代号] - [推测身份：投资机构负责人/同事/公司高管/技术负责人等]
2. ...

关键术语、专有名词、公司/产品名称
- [名称]
- ...

技术术语：
- [术语]([中文翻译]): [简要定义]

纠错表：
[原文错误写法]→[正确标准名称]
[原文错误写法]→[正确标准名称]

为了确保信息的准确：
1. **识别身份**：根据对话内容推测说话人的角色（投资方 vs 项目方）。
2. **术语验证**：识别并验证所有的专有名词、技术缩写。利用Context Pool中的信息。
3. **纠错**：对于可能的语音识别错误（谐音），请结合上下文和Context Pool进行验证并列入纠错表。
4. **思考验证**：在输出最终结果前，先使用 <thinking>...</thinking> 标签进行思考。
` 
      },
      { role: 'user', content: textSample }
    ];

    const completion = await client.chat.completions.create({
        model: REFINER_MODEL,
        messages,
        temperature: 0.3,
        // No tools needed here, Gemini uses the pool
    });

    const choice = completion.choices[0];
    let finalContent = choice.message.content || '无特定上下文';
    console.log(`[generateSystemPrompt] 分析完成，结果长度: ${finalContent.length} 字符`);

    // Clean up the content: remove <thinking> tags and any introductory text
    let cleanedContent = finalContent;
    
    // 1. Remove <thinking> blocks
    cleanedContent = cleanedContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

    return cleanedContent.trim();
  } catch (error) {
    console.error('[generateSystemPrompt] 分析失败，错误详情:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[generateSystemPrompt] 错误消息:', errorMessage);
    
    try {
        controller.enqueue(sendData('s', `上下文分析失败: ${errorMessage}`));
    } catch (e) {
        console.error('[generateSystemPrompt] 无法发送错误状态到客户端:', e);
    }
    
    return '上下文分析失败，将使用通用模式。';
  }
}

export async function POST(request: Request) {
  try {
    let { text, basePrompt, startChunkIndex = 0, skipContextAnalysis = false } = await request.json();

    if (!text) {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    // Clean basePrompt to avoid duplication if the client sends back the full prompt from a previous run
    if (basePrompt) {
        // 1. Remove progress indicator (e.g., "这是第 1/3 段内容。")
        basePrompt = basePrompt.replace(/\n+这是第 \d+\/\d+ 段内容[。.]?\s*$/g, '');
        
        // 2. Remove previously auto-generated context marker and everything after it
        const contextMarker = '【自动生成的上下文信息 (Auto-Context)】';
        const markerIndex = basePrompt.indexOf(contextMarker);
        if (markerIndex !== -1) {
            basePrompt = basePrompt.substring(0, markerIndex).trim();
        }
    }

    const encoder = new TextEncoder();
    
    // Helper to send typed data
    // We use a simple JSON Lines format: {"t": "p"|"c"|"s"|"search", "c": "content"}
    // t: "p" = prompt, "c" = content, "s" = status, "search" = search query
    const sendData = (type: 'p' | 'c' | 's' | 'search', content: string) => {
        return encoder.encode(JSON.stringify({ t: type, c: content }) + '\n');
    };

    // Create stream
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
            // 2. Split text (Do this first to know total chunks)
            const chunks = splitText(text);
            
            // Send chunk count as status
            controller.enqueue(sendData('s', `Split into ${chunks.length} chunks`));
            
            // 1. Analyze Context (or skip)
            let fullPromptTemplate = '';
            let displayPrompt = '';
            
            if (skipContextAnalysis && basePrompt) {
                 // If resuming, trust the client provided basePrompt as the full prompt
                 fullPromptTemplate = basePrompt;
                 displayPrompt = basePrompt;
            } else {
                // Phase 1: Search Context with Claude
                const searchContext = await gatherSearchContext(text, sendData, controller);
                
                // Phase 2: Generate System Prompt with Gemini
                const globalContext = await generateSystemPrompt(text, searchContext, sendData, controller);
                
                // Construct the Full System Prompt
                if (basePrompt && basePrompt.trim()) {
                    fullPromptTemplate = `${basePrompt}\n\n【自动生成的上下文信息 (Auto-Context)】\n${globalContext}`;
                    displayPrompt = `${basePrompt}\n\n${globalContext}`;
                } else {
                    fullPromptTemplate = `你是一个专业的文字编辑和润色专家。
这是投资人与公司/客户的音频转文字记录。
注意访谈录音稿可能存在错误，包括语序错误、字词识别错误等等，这些问题你需要修正。
由于录制声音可能不清晰，你需要根据上下文推测不清楚的地方。
对于不清楚的名字你需要思考并给出正确的内容。
保留原格式不变。不要对说的话进行概括，保持和原来录音稿基本一样。

${globalContext}

【修正要求】
1. 修正语病与错词：修复语音识别错误（ASR errors），修正语序倒装。
2. 事实核查与纠错：参考上方的【纠错表】和【关键术语】，确保文中相关名称准确无误。
3. 推测补全：根据上下文，推测语音不清晰或识别模糊的地方。
4. 保持原意与格式：严禁过度改写或摘要。严禁省略任何内容。保留说话人标记（如 "Name :"）和原有段落结构。
5. 去除口语废话：适当删除无意义的语气词（如"呃"、"然后就是"），但要保持对话的自然感。`;

                    // Create filtered display prompt
                    let displayContent = '';
                    if (globalContext && globalContext !== '无特定上下文') {
                         displayContent += `${globalContext}\n\n`;
                    }
                    
                    displayContent += `【修正要求】
1. 修正语病与错词：修复语音识别错误（ASR errors），修正语序倒装。
2. 事实核查与纠错：参考上方的【纠错表】和【关键术语】，确保文中相关名称准确无误。
3. 推测补全：根据上下文，推测语音不清晰或识别模糊的地方。
4. 保持原意与格式：严禁过度改写或摘要。严禁省略任何内容。保留说话人标记（如 "Name :"）和原有段落结构。
5. 去除口语废话：适当删除无意义的语气词（如"呃"、"然后就是"），但要保持对话的自然感。`;

                    displayPrompt = displayContent.replace(/\*/g, '');
                }
                
                // Send the finalized prompt to the client immediately
                controller.enqueue(sendData('p', displayPrompt));
            }

            // 3. Process Chunks (with start index support)
            for (let i = startChunkIndex; i < chunks.length; i++) {
                const chunk = chunks[i];
                
                // Send progress status
                controller.enqueue(sendData('s', `Processing chunk ${i + 1}/${chunks.length}`));
                
                const finalSystemPrompt = `${fullPromptTemplate}\n\n这是第 ${i + 1}/${chunks.length} 段内容。`;
                const finalDisplayPrompt = `${displayPrompt}\n\n这是第 ${i + 1}/${chunks.length} 段内容。`;
                
                // Update client with current FULL prompt being used for this chunk
                controller.enqueue(sendData('p', finalDisplayPrompt));

                // Logic NO LONGER supports tools in this loop
                const messages: OpenAI.ChatCompletionMessageParam[] = [
                    { role: 'system', content: finalSystemPrompt },
                    { role: 'user', content: `请修正以下文本。注意：你必须处理下面给出的每一句话，禁止省略任何内容。直接输出修正后的结果：\n\n---\n${chunk}\n---` }
                ];
                
                // Stream response directly
                const stream = await client.chat.completions.create({
                    model: REFINER_MODEL,
                    messages: messages,
                    temperature: 0.3,
                    stream: true
                });

                for await (const part of stream) {
                    const content = part.choices[0]?.delta?.content || '';
                    if (content) {
                        controller.enqueue(sendData('c', content));
                    }
                }
                
                // Add newline between chunks
                controller.enqueue(sendData('c', '\n\n'));
            }
            
            controller.close();
        } catch (error) {
            console.error('Refine Stream Error:', error);
            controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Refine API Error:', error);
    return Response.json(
      { success: false, error: '请求失败，请稍后重试' },
      { status: 500 }
    );
  }
}
