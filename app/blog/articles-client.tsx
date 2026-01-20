'use client'

import { useMemo, useState } from 'react'
 import { cn } from 'lib/utils'
import BlurFade from '../components/blur-fade'
 import { SkeletonBase } from '../components/skeleton-base'
import ArxivSwitch from './arxiv-switch'
 
 type ArticleItem = {
   id: string
   title: string
   url: string
   source: string
   author: string
   publishedAt: string
   isLoading?: boolean
   createdAt?: number
 }
 
 type ArticlesClientProps = {
   initialArticles: Array<Omit<ArticleItem, 'id'>>
 }
 
 function getSortTime(article: ArticleItem) {
  if (article.createdAt) {
    return article.createdAt
  }
   if (!article.publishedAt || article.publishedAt === '未注明') {
     return 0
   }
   const time = Date.parse(article.publishedAt)
   return Number.isNaN(time) ? 0 : time
 }
 
function getDisplayTime(article: ArticleItem) {
  if (article.publishedAt && article.publishedAt !== '未注明') {
    return article.publishedAt
  }
  if (article.createdAt) {
    return new Date(article.createdAt).toLocaleDateString('zh-CN')
  }
  return '未注明'
}

function isSupportedUrl(url: string) {
  try {
    const normalized = normalizeUrl(url)
    if (!normalized) return false
    new URL(normalized)
    return true
  } catch {
    return false
  }
}

function normalizeUrl(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    return parsed.toString()
  } catch {
    return ''
  }
}

function extractUrlFromText(input: string) {
  const match = input.match(/https?:\/\/\S+|www\.\S+/i)
  if (!match) return ''
  return normalizeUrl(match[0])
}
 
 export default function ArticlesClient({ initialArticles }: ArticlesClientProps) {
   const [isOpen, setIsOpen] = useState(false)
  const [inputText, setInputText] = useState('')
   const [error, setError] = useState('')
   const [articles, setArticles] = useState<ArticleItem[]>(
     initialArticles.map((article) => ({
       ...article,
       id: article.url,
     }))
   )
 
   const sortedArticles = useMemo(() => {
     return [...articles].sort((a, b) => getSortTime(b) - getSortTime(a))
   }, [articles])
 
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
     event.preventDefault()
    const trimmed = inputText.trim()
     if (!trimmed) {
       setError('请输入文章链接。')
       return
     }
    const normalizedUrl = extractUrlFromText(trimmed)
    if (!normalizedUrl) {
      setError('请在文本中包含有效链接。')
      return
    }
    if (!isSupportedUrl(normalizedUrl)) {
      setError('请输入有效的文章链接。')
      return
    }

    setError('')
    setInputText('')

    const now = Date.now()
    const loadingItem: ArticleItem = {
      id: normalizedUrl,
      title: '',
      url: normalizedUrl,
      source: '',
      author: '',
      publishedAt: '',
      isLoading: true,
      createdAt: now,
    }

    setArticles((prev) => [
      loadingItem,
      ...prev.filter((article) => article.url !== normalizedUrl),
    ])

    try {
      const response = await fetch('/api/articles/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: normalizedUrl,
          contextText: trimmed,
        }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error || '解析失败，请稍后重试。')
      }

      const result = await response.json()
      const data = result?.data
      if (!data?.title) {
        throw new Error('解析结果为空，请稍后重试。')
      }

      setArticles((prev) =>
        prev.map((article) =>
          article.id === normalizedUrl
            ? {
                ...article,
                ...data,
                id: normalizedUrl,
                url: normalizedUrl,
                isLoading: false,
              }
            : article
        )
      )
      setIsOpen(false)
    } catch (err) {
      setArticles((prev) => prev.filter((article) => article.id !== normalizedUrl))
      setError(err instanceof Error ? err.message : '解析失败，请稍后重试。')
    }
   }

   return (
     <>
       <div className="flex items-start justify-between gap-4">
         <div>
           <h1 className="mb-2 text-2xl font-medium tracking-tighter">Articles</h1>
           <p className="prose prose-neutral mb-2 text-sm dark:prose-invert">
             这里推送一些论文，优质博客，技术文章，等等。
           </p>
         </div>
         <button
           type="button"
           aria-label={isOpen ? '收起添加文章表单' : '添加文章链接'}
           onClick={() => setIsOpen((prev) => !prev)}
           className={cn(
             'flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-lg text-neutral-600 transition-all',
             'hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900'
           )}
         >
           {isOpen ? '×' : '+'}
         </button>
       </div>
       <ArxivSwitch />
 
       <div
         className={cn(
           'grid transition-all duration-300',
           isOpen ? 'mb-4 mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
         )}
       >
         <div className="overflow-hidden">
          <form
            onSubmit={handleSubmit}
             className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900"
           >
             <label className="text-xs text-neutral-500 dark:text-neutral-400">
              输入文章链接或描述文本
             </label>
             <div className="flex flex-col gap-2 sm:flex-row">
               <input
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                placeholder="https://... 可以补充标题、作者、发表日期等信息"
                 className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition-all focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
               />
               <button
                 type="submit"
                 className={cn(
                   'rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity',
                   'disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900'
                 )}
               >
                解析
               </button>
             </div>
             {error ? (
               <span className="text-xs text-red-500">{error}</span>
             ) : null}
           </form>
         </div>
       </div>
 
       <div className="mt-6 flex flex-col gap-4">
         {sortedArticles.map((article) => (
           <BlurFade key={article.id} yOffset={0} inView>
             <a
               href={article.url}
               target="_blank"
               rel="noopener noreferrer"
               aria-busy={article.isLoading}
               className={cn(
                 'group flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 transition-all',
                 'hover:bg-neutral-100 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800'
               )}
             >
               <div className="flex flex-col gap-2">
                 {article.isLoading ? (
                   <>
                     <SkeletonBase className="h-4 w-60 sm:w-80" />
                     <SkeletonBase className="h-3 w-40" />
                   </>
                 ) : (
                   <>
                     <span className="font-medium text-neutral-900 dark:text-neutral-100">
                       {article.title}
                     </span>
                     <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {article.author} · {getDisplayTime(article)} · {article.source}
                     </span>
                   </>
                 )}
               </div>
               <div className="text-neutral-400 transition-transform group-hover:translate-x-1">
                 →
               </div>
             </a>
           </BlurFade>
         ))}
       </div>
     </>
   )
 }
