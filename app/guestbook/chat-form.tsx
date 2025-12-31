'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

// 解决类型兼容性问题
const SyntaxHighlighterCasted = SyntaxHighlighter as unknown as React.ComponentType<any>

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function SearchStatusBubble({ query }: { query: string }) {
    return (
      <motion.div
        key={query} // key change triggers animation re-run
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        className="flex items-center space-x-2 text-sm text-neutral-400 dark:text-neutral-500 mb-2"
      >
        <div className="flex h-2 w-2 items-center justify-center translate-y-[0.4px]">
          <span className="relative flex h-2 w-2">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-500"></span>
          </span>
        </div>
        <span>Searching: {query}</span>
      </motion.div>
    )
  }

export default function ChatForm() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  // 新增搜索状态
  const [searchStatus, setSearchStatus] = useState<string | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, searchStatus, scrollToBottom])

  // 自动调整文本框高度
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input.trim() 
    }
    const currentMessages = [...messages, userMessage]
    setMessages(currentMessages)
    setInput('')
    setLoading(true)
    setStreamingContent('')
    setSearchStatus(null)
    
    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages.map(({ role, content }) => ({ role, content })), // 发送给 API 时去除 id
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('请求失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应')
      }

      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              continue
            }
            try {
              const parsed = JSON.parse(data)
              
              // 处理搜索状态更新
              if (parsed.type === 'status' && parsed.status === 'searching') {
                setSearchStatus(parsed.query)
                continue
              }

              // 处理内容更新
              if (parsed.content) {
                // 一旦开始接收内容，清除搜索状态（搜索已完成）
                setSearchStatus(null)
                fullContent += parsed.content
                setStreamingContent(fullContent)
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 流结束后，将完整内容添加到消息列表
      if (fullContent) {
        setMessages((prev) => [
          ...prev, 
          { 
            id: Date.now().toString(), 
            role: 'assistant', 
            content: fullContent 
          }
        ])
      }
      setStreamingContent('')
      setSearchStatus(null)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      setMessages((prev) => [
        ...prev,
        { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: '网络错误，请检查连接后重试。' 
        },
      ])
      setStreamingContent('')
      setSearchStatus(null)
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col">
      {/* 输入框 (在顶部) */}
      <form onSubmit={handleSubmit} className="mb-8 relative">
        <div className="relative">
          <textarea
            ref={textareaRef}
            aria-label="消息内容"
            placeholder="Message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="mb-2 mt-2 block w-full resize-none overflow-hidden rounded-lg border-neutral-300 bg-neutral-100 py-4 pl-4 pr-20 text-[14px] text-neutral-900 placeholder-neutral-400 outline-none dark:bg-neutral-800 dark:text-neutral-100"
            style={{ minHeight: '80px' }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute bottom-2 right-2 rounded-lg bg-neutral-200 px-4 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600"
          >
            发送
          </button>
        </div>
      </form>

      {/* 消息列表 (在底部，模仿 GuestbookEntries 样式) */}
      <div className="flex flex-col">
        {/* 历史消息 (倒序显示，新的在上面) */}
        {[...messages].reverse().map((msg, index, arr) => {
          // 只处理 User 消息，AI 消息作为附属渲染
          if (msg.role === 'user') {
            // 查找对应的 AI 回复
            // 在倒序数组中，回复应该是当前元素的前一个元素 (index - 1)
            const replyMsg = arr[index - 1]
            const hasReply = replyMsg && replyMsg.role === 'assistant'
            
            // 检查是否是最新的一条消息（index 0）且正在 loading
            const showLoading = loading && index === 0

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, filter: 'blur(10px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                className="mb-4 flex flex-col"
              >
                {/* User 消息：使用原来 Reply 的样式 (右侧气泡) */}
                <div className="flex justify-end">
                  <div className="max-w-[90%] rounded-lg bg-neutral-100 p-2 text-left text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400">
                    {msg.content}
                  </div>
                </div>

                {/* AI 回复 (Loading 或 已完成) - 渲染在 User 下方 */}
                {(hasReply || showLoading) && (
                  <motion.div
                    initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 w-full text-sm"
                  >
                    <div className="prose prose-neutral min-w-0 max-w-none text-sm leading-normal dark:prose-invert [&>*:first-child]:mt-0 [&>p]:mb-4 [&>p:last-child]:mb-0">
                      {showLoading ? (
                        <>
                            <AnimatePresence mode="wait">
                                {searchStatus && <SearchStatusBubble query={searchStatus} />}
                            </AnimatePresence>
                            
                            {streamingContent ? (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                              >
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath]}
                                  rehypePlugins={[rehypeKatex]}
                                  components={{
                                    code({ node, className, children, ...props }: any) {
                                      const match = /language-(\w+)/.exec(className || '')
                                      if (match) {
                                        return (
                                          <SyntaxHighlighterCasted
                                            style={oneLight}
                                            language={match[1]}
                                            PreTag="div"
                                            customStyle={{ background: 'transparent', margin: 0, padding: 0 }}
                                            {...props}
                                          >
                                            {String(children).replace(/\n$/, '')}
                                          </SyntaxHighlighterCasted>
                                        )
                                      }
                                      return (
                                        <code
                                          className={`${className} text-neutral-800 dark:text-neutral-300`}
                                          {...props}
                                        >
                                          {children}
                                        </code>
                                      )
                                    },
                                  }}
                                >
                                  {streamingContent}
                                </ReactMarkdown>
                              </motion.div>
                            ) : (
                              // 仅当没有正在生成的文本，且没有搜索状态时，才显示传统的 Loading 点
                              !searchStatus && (
                                  <div className="flex h-6 items-center">
                                    <span className="inline-flex items-center space-x-1">
                                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"></span>
                                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: '0.1s' }}></span>
                                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: '0.2s' }}></span>
                                    </span>
                                  </div>
                              )
                            )}
                        </>
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            code({ node, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              if (match) {
                                return (
                                  <SyntaxHighlighterCasted
                                    style={oneLight}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ background: 'transparent', margin: 0, padding: 0 }}
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighterCasted>
                                )
                              }
                              return (
                                <code
                                  className={`${className} !text-neutral-800 dark:!text-neutral-300`}
                                  {...props}
                                >
                                  {children}
                                </code>
                              )
                            },
                          }}
                        >
                          {replyMsg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )
          }
          // Assistant 消息在上面已经作为 User 的附属渲染了，这里跳过
          return null
        })}
      </div>
    </div>
  )
}
