'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

interface HistoryDetail {
  id: string
  type: string
  title: string
  original_text: string
  result_text: string
  created_at: string
}

const typeLabels: Record<string, string> = {
  refine: 'Refine',
  translate: 'Translate',
}

const typeColors: Record<string, string> = {
  refine: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  translate: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const mockHistoryDetail: Record<string, HistoryDetail> = {
  'dev-refine-1': {
    id: 'dev-refine-1',
    type: 'refine',
    title: '本地预览：内容精修示例',
    original_text: '这是本地预览用的原始文本示例。',
    result_text: '这是本地预览用的精修后文本示例。',
    created_at: new Date().toISOString(),
  },
  'dev-translate-1': {
    id: 'dev-translate-1',
    type: 'translate',
    title: '本地预览：中英翻译示例',
    original_text: 'Hello world. This is a local preview entry.',
    result_text: '你好，世界。这是一条本地预览记录。',
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
}

export default function HistoryDetailPage({ params }: { params: { id: string } }) {
  const [history, setHistory] = useState<HistoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const isLocalDev =
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

    if (isLocalDev && mockHistoryDetail[params.id]) {
      setHistory(mockHistoryDetail[params.id])
      setLoading(false)
      return
    }

    fetchHistoryDetail()
  }, [params.id])

  const fetchHistoryDetail = async () => {
    try {
      const response = await fetch(`/api/history/${params.id}`)
      const result = await response.json()
      
      if (response.ok) {
        setHistory(result.data)
      } else {
        setError(result.error || 'Failed to fetch history')
      }
    } catch (err) {
      setError('Failed to fetch history')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!history) return
    const blob = new Blob([history.result_text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${history.title}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <section className="flex flex-col h-[calc(100vh-150px)] sm:px-14 sm:pt-6">
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300"></div>
        </div>
      </section>
    )
  }

  if (error || !history) {
    return (
      <section className="flex flex-col h-[calc(100vh-150px)] sm:px-14 sm:pt-6">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Link 
              href="/work/history" 
              className="rounded-full p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-medium tracking-tighter">History</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error || '记录不存在'}</p>
            <Link 
              href="/work/history"
              className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              返回历史列表
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col h-[calc(100vh-150px)] sm:px-14 sm:pt-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link 
            href="/work/history" 
            className="rounded-full p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-medium tracking-tighter truncate max-w-[60%]">
            {history.title}
          </h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[history.type] || 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'}`}>
            {typeLabels[history.type] || history.type}
          </span>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {formatDate(history.created_at)}
        </p>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Two Columns: Original Text & Result Text */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          {/* Left Column: Original Text */}
          <div className="flex flex-col h-full min-h-0">
            <label className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              原始文本
            </label>
            <textarea
              value={history.original_text}
              readOnly
              className="flex-1 w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          {/* Right Column: Result Text */}
          <div className="flex flex-col h-full min-h-0">
            <label className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              处理结果
            </label>
            <textarea
              value={history.result_text}
              readOnly
              className="flex-1 w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        {/* Export Button */}
        <div className="mt-4">
          <button
            onClick={handleExport}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            导出 .md
          </button>
        </div>
      </div>
    </section>
  )
}

