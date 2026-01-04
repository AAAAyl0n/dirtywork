
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Helper to split text into chunks while preserving speaker context
function splitText(content: string, maxChunkSize = 2000): string[] {
  const lines = content.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if line is a speaker (e.g., "Name :")
    // Python regex was: r'^[A-Za-z\s]+:\s*$'
    // We'll use a similar regex
    const speakerMatch = line.match(/^[A-Za-z\s]+:\s*$/);

    if (speakerMatch) {
      // It's a speaker line
      const speaker = line;
      const contentLines = [speaker];
      i++;

      // Collect content until next speaker or end
      while (i < lines.length && !lines[i].match(/^[A-Za-z\s]+:\s*$/)) {
        contentLines.push(lines[i]);
        i++;
      }

      const dialogue = contentLines.join('\n');
      const dialogueSize = dialogue.length;

      // If adding this dialogue exceeds chunk size and we have content, push current chunk
      if (currentSize + dialogueSize > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentSize = 0;
      }

      currentChunk.push(...contentLines);
      currentSize += dialogueSize;
    } else {
      // Not a speaker line (maybe intro text or messily formatted)
      currentChunk.push(line);
      currentSize += line.length + 1; // +1 for newline
      i++;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

// Helper to clean format
function cleanFormat(text: string): string {
    let cleaned = text;
    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```[\w]*\n/gm, '').replace(/\n```$/gm, '');
    
    // Normalize speaker format: "Name :"
    cleaned = cleaned.replace(/^([A-Za-z\s]+)\s*[：:]\s*$/gm, '$1 :');
    
    // Ensure newline after speaker
    cleaned = cleaned.replace(/^([A-Za-z\s]+ :)(?!\n)/gm, '$1\n');
    
    // Collapse multiple newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    const chunks = splitText(text);
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Process chunks sequentially
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            const systemPrompt = `你是一个专业的商务英语翻译助手。请将以下英文对话翻译成中文。
            
【格式要求 - 必须严格遵守】
1. 说话人格式：
   - 说话人名字单独一行，后跟空格+英文冒号+空格（格式：Name : ）
   - 说话人名字必须保持英文原样，不要翻译
   - 说话人行后必须换行
   
2. 对话内容格式：
   - 对话内容紧跟说话人行之后
   - 保持原文的段落结构和换行
   - 不要添加序号、项目符号或其他装饰
   
3. 空行规则：
   - 不同说话人之间用一个空行分隔
   - 保持与原文相同的空行结构
   
这是第 ${i + 1}/${chunks.length} 段内容。`;

            const completion = await client.chat.completions.create({
              model: 'gpt-4.1-2025-04-14',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `请严格按照以下格式翻译，只输出翻译结果，不要添加任何其他内容：\n\n${chunk}` }
              ],
              temperature: 0.3,
              stream: true, // We stream the response from OpenAI
            });

            for await (const part of completion) {
              const content = part.choices[0]?.delta?.content || '';
              if (content) {
                // We send the raw content chunk to the client
                // The client will append it
                controller.enqueue(encoder.encode(content));
              }
            }
            
            // Add a newline between chunks if needed
            controller.enqueue(encoder.encode('\n\n'));
          }
          
          controller.close();
        } catch (error) {
          console.error('Translation Stream Error:', error);
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
    console.error('Translate API Error:', error);
    return Response.json(
      { success: false, error: '请求失败，请稍后重试' },
      { status: 500 }
    );
  }
}

