import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})

function stripHtml(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  return withoutScripts.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match?.[1]?.trim() || ''
}

function parseMetaTags(html: string) {
  const tags: Record<string, string> = {}
  const metaTags = html.match(/<meta\s+[^>]*>/gi) || []

  for (const tag of metaTags) {
    const attrs: Record<string, string> = {}
    const attrRegex = /([a-zA-Z:-]+)\s*=\s*["']([^"']+)["']/g
    let match: RegExpExecArray | null
    while ((match = attrRegex.exec(tag))) {
      attrs[match[1].toLowerCase()] = match[2]
    }
    const key = attrs.property || attrs.name
    const content = attrs.content
    if (key && content) {
      tags[key.toLowerCase()] = content
    }
  }

  return tags
}

function parseContextText(rawText: string, hostname: string) {
  const cleaned = rawText
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) {
    return {
      title: '',
      author: '未注明',
      source: hostname,
    }
  }

  const parts = cleaned.split(' - ').map((part) => part.trim()).filter(Boolean)
  const title = parts[0] || cleaned
  const author = (parts[1] || '未注明').replace(/的文章|的帖子|的博文/g, '').trim()
  const source = parts[2] || hostname

  return {
    title,
    author: author || '未注明',
    source,
  }
}

function buildFallback(
  url: string,
  meta: Record<string, string>,
  htmlTitle: string,
  contextText: string
) {
  const hostname = new URL(url).hostname.replace(/^www\./, '')
  const contextFallback = parseContextText(contextText, hostname)
  const title =
    meta['og:title'] || meta['twitter:title'] || htmlTitle || contextFallback.title || url
  const author =
    meta['author'] ||
    meta['article:author'] ||
    meta['parsely-author'] ||
    contextFallback.author ||
    '未注明'
  const publishedAt =
    meta['article:published_time'] ||
    meta['article:published'] ||
    meta['pubdate'] ||
    meta['date'] ||
    meta['parsely-pub-date'] ||
    '未注明'
  const source = meta['og:site_name'] || contextFallback.source || hostname

  return { title, author, publishedAt, source }
}

export async function POST(request: Request) {
  try {
    const { url, contextText = '' } = await request.json()
    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return Response.json({ error: 'Invalid URL' }, { status: 400 })
    }

    let html = ''
    let metaTags: Record<string, string> = {}
    let htmlTitle = ''
    let textSnippet = ''

    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        cache: 'no-store',
      })

      if (response.ok) {
        html = await response.text()
        metaTags = parseMetaTags(html)
        htmlTitle = extractTitle(html)
        textSnippet = stripHtml(html).slice(0, 2400)
      }
    } catch {
      // 网络或反爬失败时，继续使用粘贴文本进行解析
    }

    const fallback = buildFallback(parsedUrl.toString(), metaTags, htmlTitle, contextText)

    const prompt = `请基于提供的URL、元标签、标题、正文片段以及粘贴文本，提取网页信息并输出JSON：\n{\n  "title": "标题",\n  "author": "作者，未知则填未注明",\n  "publishedAt": "发布时间，未知则填未注明",\n  "source": "网站名称或域名"\n}\n\n规则：\n1. 如果网页抓取失败，优先从粘贴文本推断标题/作者/来源。\n2. 标题优先使用网页主标题，不要加引号。\n3. 作者字段保持简短；若只有用户名或机构名也可作为作者。\n4. 时间保留原始格式（如ISO或中文日期）。\n5. 如果信息无法从上下文推断，请输出“未注明”。\n6. 必须输出纯JSON，不要附加解释文字。`

    const input = {
      url: parsedUrl.toString(),
      hostname: parsedUrl.hostname,
      title: htmlTitle,
      meta: metaTags,
      textSnippet,
      contextText,
      fallback,
    }

    let aiResult = fallback

    if (process.env.OPENAI_API_KEY) {
      const completion = await client.chat.completions.create({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: '你是网页元信息抽取助手。' },
          { role: 'user', content: `${prompt}\n\n输入：\n${JSON.stringify(input, null, 2)}` },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 600,
      })

      const content = completion.choices[0]?.message?.content || ''
      try {
        aiResult = {
          ...fallback,
          ...(JSON.parse(content) as typeof fallback),
        }
      } catch {
        aiResult = fallback
      }
    }

    return Response.json({ data: aiResult })
  } catch (error) {
    console.error('Article parse error:', error)
    return Response.json({ error: '解析失败，请稍后重试' }, { status: 500 })
  }
}
