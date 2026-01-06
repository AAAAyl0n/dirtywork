'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

interface HistoryItem {
  id: string
  type: string
  title: string
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

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setIsLoggedIn(!!user)
    
    if (user) {
      fetchHistory()
    } else {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/history')
      const result = await response.json()
      
      if (response.ok) {
        setHistory(result.data || [])
      } else {
        setError(result.error || 'Failed to fetch history')
      }
    } catch (err) {
      setError('Failed to fetch history')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('确定要删除这条记录吗？')) return
    
    setDeletingId(id)
    try {
      const response = await fetch(`/api/history/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setHistory(prev => prev.filter(item => item.id !== id))
      }
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleStartEdit = (item: HistoryItem, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(item.id)
    setEditingTitle(item.title)
    // 聚焦输入框
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(null)
    setEditingTitle('')
  }

  const handleSaveEdit = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!editingTitle.trim()) return
    
    setSavingId(id)
    try {
      const response = await fetch(`/api/history/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle.trim() })
      })
      
      if (response.ok) {
        setHistory(prev => prev.map(item => 
          item.id === id ? { ...item, title: editingTitle.trim() } : item
        ))
        setEditingId(null)
        setEditingTitle('')
      }
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSavingId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit(id, e as unknown as React.MouseEvent)
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditingTitle('')
    }
  }

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/work/history`
      }
    })
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

  // 未登录状态
  if (isLoggedIn === false) {
    return (
      <section className="flex flex-col h-[calc(100vh-150px)] sm:px-14 sm:pt-6">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Link 
              href="/work" 
              className="rounded-full p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-medium tracking-tighter">History</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium mb-2">登录以查看历史记录</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
              登录后可以保存和查看你的处理历史
            </p>
            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              使用 GitHub 登录
            </button>
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
            href="/work" 
            className="rounded-full p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-medium tracking-tighter">History</h1>
        </div>
        <p className="prose prose-neutral text-sm dark:prose-invert">
          查看你之前处理过的项目记录
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">{error}</div>
        ) : history.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-neutral-500 dark:text-neutral-400">暂无历史记录</p>
            <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">完成 Refine 或 Translate 任务后会自动保存</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {history.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={`/work/history/${item.id}`}
                    className="group block rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 text-sm font-medium rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                              placeholder="输入标题..."
                            />
                            <button
                              onClick={(e) => handleSaveEdit(item.id, e)}
                              disabled={savingId === item.id || !editingTitle.trim()}
                              className="p-1.5 rounded-md text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                            >
                              {savingId === item.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-300 border-t-green-600"></div>
                              ) : (
                                <CheckIcon className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 truncate group-hover:text-neutral-700 dark:group-hover:text-neutral-300">
                            {item.title}
                          </h3>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[item.type] || 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                            {typeLabels[item.type] || item.type}
                          </span>
                          <span className="text-xs text-neutral-400 dark:text-neutral-500">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        {editingId !== item.id && (
                          <button
                            onClick={(e) => handleStartEdit(item, e)}
                            className="p-2 rounded-lg text-neutral-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          disabled={deletingId === item.id}
                          className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          {deletingId === item.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
                          ) : (
                            <TrashIcon className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  )
}

