'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_OPENROUTER_ANALYZE_MODEL,
  DEFAULT_OPENROUTER_REFINE_MODEL,
  DEFAULT_OPENROUTER_SUMMARIZE_MODEL,
} from '@/lib/openrouter-models'

type ModelTestResult = {
  ok: boolean
  message: string
  configured: string
  default: string
}

type ModelTestState = {
  analyze: ModelTestResult | null
  summarize: ModelTestResult | null
  refine: ModelTestResult | null
}

function SearchStatusBubble({ query }: { query: string }) {
  return (
    <motion.div
      key={query}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="absolute bottom-4 left-4 right-4 z-10 flex items-center space-x-2 rounded-lg border border-neutral-100 bg-white/90 px-3 py-2 text-sm text-neutral-500 shadow-sm backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-400"
    >
      <div className="flex h-2 w-2 translate-y-[0.4px] items-center justify-center">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-500"></span>
        </span>
      </div>
      <span className="truncate">Searching: {query}</span>
    </motion.div>
  )
}

function ThinkingStatusBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="absolute bottom-4 left-4 right-4 z-10 flex items-center space-x-2 rounded-lg border border-neutral-100 bg-white/90 px-3 py-2 text-sm text-neutral-500 shadow-sm backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-400"
    >
      <div className="flex h-4 w-4 items-center justify-center">
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
      <span>Thinking... This may take several minutes.</span>
    </motion.div>
  )
}

function SumUpStatusBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="absolute bottom-4 left-4 right-4 z-10 flex items-center space-x-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-600 shadow-sm backdrop-blur-sm dark:border-emerald-800/50 dark:bg-emerald-950/90 dark:text-emerald-400"
    >
      <div className="flex h-4 w-4 items-center justify-center">
        <svg
          className="h-4 w-4 animate-pulse"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
          />
        </svg>
      </div>
      <span>Summarizing...</span>
    </motion.div>
  )
}

export default function OpenRouterRefinePage() {
  const [inputText, setInputText] = useState('')
  const [basePrompt, setBasePrompt] = useState('')
  const [displayedPrompt, setDisplayedPrompt] = useState('')
  const [promptDraft, setPromptDraft] = useState('')
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [refinedText, setRefinedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0)
  const [analysisDone, setAnalysisDone] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [isSumUp, setIsSumUp] = useState(false)
  const [isOutputScrollLocked, setIsOutputScrollLocked] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState<{
    done: number
    total: number
  }>({ done: 0, total: 0 })
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false)
  const [openRouterKeyInput, setOpenRouterKeyInput] = useState('')
  const [analyzeModelInput, setAnalyzeModelInput] = useState('')
  const [summarizeModelInput, setSummarizeModelInput] = useState('')
  const [refineModelInput, setRefineModelInput] = useState('')
  const [openRouterKeyStatus, setOpenRouterKeyStatus] = useState<
    'idle' | 'saving' | 'saved' | 'deleting' | 'error'
  >('idle')
  const [modelTestStatus, setModelTestStatus] = useState<
    'idle' | 'testing' | 'passed' | 'failed'
  >('idle')
  const [modelTestMessage, setModelTestMessage] = useState('')
  const [modelTestResults, setModelTestResults] = useState<ModelTestState>({
    analyze: null,
    summarize: null,
    refine: null,
  })
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(false)
  const [maskedOpenRouterKey, setMaskedOpenRouterKey] = useState<string | null>(
    null
  )
  const [openRouterKeyMessage, setOpenRouterKeyMessage] = useState('')
  const analysisPercent =
    analysisProgress.total > 0
      ? Math.round((analysisProgress.done / analysisProgress.total) * 100)
      : 0

  const abortControllerRef = useRef<AbortController | null>(null)
  const outputTextareaRef = useRef<HTMLTextAreaElement>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setIsLoggedIn(!!user)

      if (user) {
        await fetchOpenRouterKey()
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    if (!isOutputScrollLocked && outputTextareaRef.current) {
      outputTextareaRef.current.scrollTop =
        outputTextareaRef.current.scrollHeight
    }
  }, [refinedText, isOutputScrollLocked])

  useEffect(() => {
    if (!isOutputScrollLocked) return

    const handlePointerUp = () => {
      setIsOutputScrollLocked(false)
      if (outputTextareaRef.current) {
        outputTextareaRef.current.scrollTop =
          outputTextareaRef.current.scrollHeight
      }
    }

    window.addEventListener('pointerup', handlePointerUp)
    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [isOutputScrollLocked])

  useEffect(() => {
    if (promptTextareaRef.current) {
      promptTextareaRef.current.scrollTop =
        promptTextareaRef.current.scrollHeight
    }
  }, [displayedPrompt])

  useEffect(() => {
    if (isCompleted && isLoggedIn && refinedText && inputText) {
      saveToHistory(inputText, refinedText)
    }
  }, [isCompleted])

  const fetchOpenRouterKey = async () => {
    try {
      const response = await fetch('/api/user/openrouter-key')
      const result = await response.json()

      if (response.ok) {
        setHasOpenRouterKey(!!result.hasKey)
        setMaskedOpenRouterKey(result.maskedKey)
        setAnalyzeModelInput(result.analyzeModel || '')
        setSummarizeModelInput(result.summarizeModel || '')
        setRefineModelInput(result.refineModel || '')
        setOpenRouterKeyMessage(result.hasKey ? '已保存 OpenRouter key' : '')
        setModelTestStatus('idle')
        setModelTestMessage('')
        setModelTestResults({
          analyze: null,
          summarize: null,
          refine: null,
        })
        if (!result.hasKey) {
          setOpenRouterKeyInput('')
        }
      } else {
        setOpenRouterKeyMessage(result.error || '读取 OpenRouter key 失败')
      }
    } catch (error) {
      console.error('Failed to fetch OpenRouter key:', error)
      setOpenRouterKeyMessage('读取 OpenRouter key 失败')
    }
  }

  const persistOpenRouterKey = async () => {
    if (!isLoggedIn) {
      setOpenRouterKeyStatus('error')
      setOpenRouterKeyMessage('请先登录再保存 OpenRouter key')
      return false
    }

    if (!openRouterKeyInput.trim() && !hasOpenRouterKey) {
      setOpenRouterKeyStatus('error')
      setOpenRouterKeyMessage('请输入 OpenRouter key')
      return false
    }

    setOpenRouterKeyStatus('saving')
    setOpenRouterKeyMessage('')

    try {
      const response = await fetch('/api/user/openrouter-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: openRouterKeyInput.trim(),
          analyzeModel: analyzeModelInput.trim(),
          summarizeModel: summarizeModelInput.trim(),
          refineModel: refineModelInput.trim(),
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        setOpenRouterKeyStatus('error')
        setOpenRouterKeyMessage(result.error || '保存 OpenRouter key 失败')
        return false
      }

      setOpenRouterKeyStatus('saved')
      setHasOpenRouterKey(true)
      setMaskedOpenRouterKey(result.maskedKey)
      setAnalyzeModelInput(result.analyzeModel || '')
      setSummarizeModelInput(result.summarizeModel || '')
      setRefineModelInput(result.refineModel || '')
      setOpenRouterKeyInput('')
      setOpenRouterKeyMessage('OpenRouter key 已保存')
      setModelTestStatus('idle')
      setModelTestMessage('')
      setIsKeyModalOpen(false)
      return true
    } catch (error) {
      console.error('Failed to save OpenRouter key:', error)
      setOpenRouterKeyStatus('error')
      setOpenRouterKeyMessage('保存 OpenRouter key 失败')
      return false
    }
  }

  const deleteOpenRouterKey = async () => {
    if (!isLoggedIn) return

    setOpenRouterKeyStatus('deleting')
    setOpenRouterKeyMessage('')

    try {
      const response = await fetch('/api/user/openrouter-key', {
        method: 'DELETE',
      })
      const result = await response.json()

      if (!response.ok) {
        setOpenRouterKeyStatus('error')
        setOpenRouterKeyMessage(result.error || '删除 OpenRouter key 失败')
        return
      }

      setOpenRouterKeyStatus('idle')
      setHasOpenRouterKey(false)
      setMaskedOpenRouterKey(null)
      setOpenRouterKeyInput('')
      setAnalyzeModelInput('')
      setSummarizeModelInput('')
      setRefineModelInput('')
      setOpenRouterKeyMessage('已删除 OpenRouter key')
      setModelTestStatus('idle')
      setModelTestMessage('')
      setModelTestResults({
        analyze: null,
        summarize: null,
        refine: null,
      })
    } catch (error) {
      console.error('Failed to delete OpenRouter key:', error)
      setOpenRouterKeyStatus('error')
      setOpenRouterKeyMessage('删除 OpenRouter key 失败')
    }
  }

  const testOpenRouterModels = async () => {
    if (!isLoggedIn) {
      setModelTestStatus('failed')
      setModelTestMessage('请先登录')
      return
    }

    if (!hasOpenRouterKey && !openRouterKeyInput.trim()) {
      setModelTestStatus('failed')
      setModelTestMessage('请先输入或保存 OpenRouter key')
      return
    }

    setModelTestStatus('testing')
    setModelTestMessage('')
    setModelTestResults({
      analyze: null,
      summarize: null,
      refine: null,
    })

    try {
      const response = await fetch('/api/user/openrouter-key/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: openRouterKeyInput.trim(),
          analyzeModel: analyzeModelInput.trim(),
          summarizeModel: summarizeModelInput.trim(),
          refineModel: refineModelInput.trim(),
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || '模型测试失败')
      }

      setModelTestResults(result.models)
      if (result.success) {
        setModelTestStatus('passed')
        setModelTestMessage('三个模型都已成功响应')
      } else {
        setModelTestStatus('failed')
        setModelTestMessage('部分模型未通过，请检查返回信息')
      }
    } catch (error) {
      console.error('Failed to test OpenRouter models:', error)
      setModelTestStatus('failed')
      setModelTestMessage(
        error instanceof Error ? error.message : '模型测试失败'
      )
    }
  }

  const runRefinement = async (startIndex: number, skipAnalysis: boolean) => {
    if (!inputText.trim() || loading) return

    if (!isLoggedIn) {
      setStatus('Login required')
      return
    }

    if (!hasOpenRouterKey) {
      setOpenRouterKeyStatus('error')
      setOpenRouterKeyMessage('请先保存 OpenRouter key')
      setIsKeyModalOpen(true)
      return
    }

    setLoading(true)
    setIsCompleted(false)
    setIsEditingPrompt(false)
    setStatus(
      startIndex > 0
        ? `Resuming from chunk ${startIndex + 1}...`
        : 'Analyzing Context...'
    )

    if (startIndex === 0) {
      setRefinedText('')
      if (!skipAnalysis) {
        setDisplayedPrompt('')
      }
      setCurrentChunkIndex(0)
      setAnalysisDone(skipAnalysis)
      setSaveStatus('idle')
    }
    setAnalysisProgress({ done: 0, total: 0 })
    setSearchQuery(null)
    setIsThinking(false)
    setIsSumUp(false)

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/openrouter-refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          basePrompt: skipAnalysis ? displayedPrompt : basePrompt,
          startChunkIndex: startIndex,
          skipContextAnalysis: skipAnalysis,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error || 'Refinement failed')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader')

      let buffer = ''
      let gotDoneSignal = false

      const handleStreamLine = (line: string) => {
        if (!line.trim()) return

        try {
          const data = JSON.parse(line)
          if (data.t === 'p') {
            setDisplayedPrompt(data.c)
            if (!isEditingPrompt) {
              setPromptDraft(data.c)
            }
            setAnalysisDone(true)
            setSearchQuery(null)
            setIsThinking(false)
            setIsSumUp(false)
          } else if (data.t === 'c') {
            setRefinedText((prev) => prev + data.c)
            setSearchQuery(null)
            setIsThinking(false)
            setIsSumUp(false)
          } else if (data.t === 'search') {
            setSearchQuery(data.c)
            setIsThinking(false)
            setIsSumUp(false)
          } else if (data.t === 'searchdone') {
            setSearchQuery(null)
          } else if (data.t === 'thinking') {
            setSearchQuery(null)
            setIsThinking(true)
            setIsSumUp(false)
          } else if (data.t === 'sumup') {
            setSearchQuery(null)
            setIsThinking(false)
            setIsSumUp(true)
          } else if (data.t === 'sumupc') {
            setDisplayedPrompt((prev) => prev + data.c)
            if (!isEditingPrompt) {
              setPromptDraft((prev) => prev + data.c)
            }
            setSearchQuery(null)
            setIsThinking(false)
            setIsSumUp(true)
          } else if (data.t === 'ap') {
            try {
              const { done, total } = JSON.parse(data.c)
              setAnalysisProgress({ done, total })
            } catch (error) {
              console.warn('Failed to parse analysis progress:', error)
            }
          } else if (data.t === 's') {
            setStatus(data.c)
            setSearchQuery(null)
            setIsThinking(false)
            setIsSumUp(false)
            const match = data.c.match(/Processing chunk (\d+)\/(\d+)/)
            if (match) {
              setCurrentChunkIndex(parseInt(match[1]) - 1)
            }
          } else if (data.t === 'chunkdone') {
            try {
              const { chunkIndex } = JSON.parse(data.c)
              if (typeof chunkIndex === 'number') {
                setCurrentChunkIndex(chunkIndex + 1)
              }
            } catch (error) {
              console.warn('Failed to parse chunkdone:', error)
            }
          } else if (data.t === 'done') {
            gotDoneSignal = true
          }
        } catch (error) {
          console.warn('Failed to parse stream line:', error)
          if (!line.startsWith('{')) {
            setRefinedText((prev) => prev + line + '\n')
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          buffer += decoder.decode()
          break
        }

        buffer += decoder.decode(value, { stream: true })

        let newlineIndex
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex)
          buffer = buffer.slice(newlineIndex + 1)
          handleStreamLine(line)
        }
      }

      if (buffer.trim()) {
        handleStreamLine(buffer)
      }

      if (gotDoneSignal) {
        setIsCompleted(true)
        setStatus('Completed')
      } else {
        setIsCompleted(false)
        setStatus((prev) =>
          prev && prev !== 'Stopped'
            ? `${prev} (Interrupted)`
            : 'Interrupted before completion'
        )
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setStatus('Stopped')
        setLoading(false)
        return
      }

      console.error('OpenRouter refine error:', error)
      setRefinedText(
        (prev) =>
          prev +
          `\n[Refinement Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
      )
      setStatus('Error occurred')
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStart = () => {
    runRefinement(0, false)
  }

  const handleResume = () => {
    runRefinement(currentChunkIndex, true)
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setLoading(false)
    setStatus('Stopped')
  }

  const handleEditPrompt = () => {
    if (loading) {
      handleStop()
    }
    setPromptDraft(displayedPrompt || '')
    setIsEditingPrompt(true)
  }

  const handleCancelEditPrompt = () => {
    setPromptDraft(displayedPrompt || '')
    setIsEditingPrompt(false)
  }

  const handleConfirmEditPrompt = () => {
    const nextPrompt = promptDraft.trim()
    setDisplayedPrompt(nextPrompt)
    setIsEditingPrompt(false)
    runRefinement(0, true)
  }

  const handleExport = () => {
    const blob = new Blob([refinedText], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openrouter_refined_text.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const saveToHistory = async (original: string, result: string) => {
    if (!isLoggedIn) return

    setSaveStatus('saving')
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'openrouter_refine',
          originalText: original,
          resultText: result,
        }),
      })

      setSaveStatus(response.ok ? 'saved' : 'error')
    } catch (error) {
      console.error('Failed to save history:', error)
      setSaveStatus('error')
    }
  }

  const canResume = !loading && !isCompleted && analysisDone
  const modelResultItems: Array<{
    label: string
    result: ModelTestResult | null
  }> = [
    { label: 'Analyze', result: modelTestResults.analyze },
    { label: 'Summarize', result: modelTestResults.summarize },
    { label: 'Refine', result: modelTestResults.refine },
  ]
  const promptValue = isEditingPrompt
    ? promptDraft
    : analysisDone || loading || canResume || isCompleted
      ? displayedPrompt
      : basePrompt
  const promptReadOnly =
    !isEditingPrompt && (loading || analysisDone || canResume || isCompleted)
  const canRun =
    !!inputText.trim() && !!isLoggedIn && hasOpenRouterKey && !isEditingPrompt

  return (
    <section className="flex h-[calc(100vh-150px)] flex-col sm:px-14 sm:pt-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/work"
              className="-ml-2 rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-medium tracking-tighter">
              Refine
            </h1>
          </div>
          <button
            onClick={() => {
              setOpenRouterKeyStatus('idle')
              setOpenRouterKeyMessage('')
              setModelTestStatus('idle')
              setModelTestMessage('')
              setModelTestResults({
                analyze: null,
                summarize: null,
                refine: null,
              })
              setIsKeyModalOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <span>API Key</span>
            {hasOpenRouterKey && maskedOpenRouterKey && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {maskedOpenRouterKey}
              </span>
            )}
          </button>
        </div>
        <p className="prose prose-neutral text-sm dark:prose-invert">
          Same Refine workflow, but all model calls go through your own
          OpenRouter API key stored in your Supabase row.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex h-full flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col">
            <label className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Original Transcript
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your long conversation text here..."
              className="w-full flex-1 resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="relative flex h-1/3 min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                {loading
                  ? 'Live System Prompt'
                  : analysisDone
                    ? 'Live System Prompt'
                    : 'Base System Prompt (Optional)'}
              </label>
              {analysisDone && !isEditingPrompt && (
                <button
                  onClick={handleEditPrompt}
                  className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  编辑 Context
                </button>
              )}
              {analysisDone && isEditingPrompt && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleConfirmEditPrompt}
                    className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                  >
                    编辑完成
                  </button>
                  <button
                    onClick={handleCancelEditPrompt}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
            {loading &&
              analysisProgress.total > 0 &&
              !analysisDone &&
              !isSumUp && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                    <span>Analyzing chunks</span>
                    <span>
                      {analysisProgress.done}/{analysisProgress.total} (
                      {analysisPercent}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${analysisPercent}%` }}
                    />
                  </div>
                </div>
              )}
            <div className="relative min-h-0 flex-1">
              <textarea
                ref={promptTextareaRef}
                value={promptValue}
                onChange={(e) => {
                  if (isEditingPrompt) {
                    setPromptDraft(e.target.value)
                    return
                  }
                  if (!loading && !analysisDone) {
                    setBasePrompt(e.target.value)
                  }
                }}
                readOnly={promptReadOnly}
                placeholder={
                  loading
                    ? 'Waiting for context analysis...'
                    : '在此添加背景信息（如人名、公司名、可能识别错误的名称等）\nAdd background info here, e.g., names, company names, or likely misrecognized entities'
                }
                className={`h-full w-full resize-none rounded-lg border border-neutral-200 p-4 font-mono text-xs focus:outline-none dark:border-neutral-800 dark:text-neutral-100 ${
                  loading
                    ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'
                    : 'bg-neutral-50 focus:border-neutral-400 dark:bg-neutral-900'
                }`}
              />
              <AnimatePresence mode="wait">
                {searchQuery && <SearchStatusBubble query={searchQuery} />}
                {!searchQuery && isThinking && <ThinkingStatusBubble />}
                {!searchQuery && !isThinking && isSumUp && (
                  <SumUpStatusBubble />
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex gap-2">
            {!loading ? (
              <>
                {canResume ? (
                  <button
                    onClick={handleResume}
                    disabled={isEditingPrompt}
                    className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    disabled={!canRun}
                    className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 sm:w-36 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                  >
                    Refine
                  </button>
                )}

                {(canResume || isCompleted) && (
                  <button
                    onClick={handleStart}
                    disabled={isEditingPrompt}
                    title="Restart from beginning"
                    className="w-auto rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                      />
                    </svg>
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={handleStop}
                className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 sm:w-24"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        <div className="flex h-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Refined Output
              </label>
              {isLoggedIn && saveStatus === 'saving' && (
                <span className="text-xs text-neutral-400">保存中...</span>
              )}
              {isLoggedIn && saveStatus === 'saved' && (
                <span className="text-xs text-green-500">已保存到历史</span>
              )}
              {isLoggedIn && saveStatus === 'error' && (
                <span className="text-xs text-red-500">保存失败</span>
              )}
            </div>
            <textarea
              ref={outputTextareaRef}
              value={refinedText}
              onPointerDown={() => {
                if (loading) {
                  setIsOutputScrollLocked(true)
                }
              }}
              readOnly
              placeholder="Refined text will stream here..."
              className="mb-4 w-full flex-1 resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={handleExport}
              disabled={!isCompleted}
              className="flex-shrink-0 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Export .md
            </button>

            <div className="ml-2 flex items-center gap-2 text-sm">
              {loading && (
                <div className="flex items-center gap-2 text-neutral-500">
                  <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300"></div>
                  <span className="hidden sm:inline">
                    {status || 'Working...'}
                  </span>
                </div>
              )}
              {isCompleted && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="hidden sm:inline">Refinement Complete</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isKeyModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 p-4 sm:p-8"
            onClick={() => {
              if (openRouterKeyStatus !== 'saving') {
                setIsKeyModalOpen(false)
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    OpenRouter API Key
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Key 会保存在你自己的 Supabase 数据里，仅服务端调用
                    OpenRouter 时使用。
                  </p>
                  <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <a
                      href="https://openrouter.ai/settings/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      获取 API key
                    </a>
                    <span className="px-2 text-neutral-300 dark:text-neutral-600">
                      /
                    </span>
                    <a
                      href="https://openrouter.ai/models"
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      模型广场
                    </a>
                  </p>
                </div>
                {hasOpenRouterKey && maskedOpenRouterKey && (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {maskedOpenRouterKey}
                  </span>
                )}
              </div>

              <input
                type="password"
                value={openRouterKeyInput}
                onChange={(e) => {
                  setOpenRouterKeyInput(e.target.value)
                  if (openRouterKeyStatus !== 'idle') {
                    setOpenRouterKeyStatus('idle')
                  }
                  if (modelTestStatus !== 'idle') {
                    setModelTestStatus('idle')
                    setModelTestMessage('')
                    setModelTestResults({
                      analyze: null,
                      summarize: null,
                      refine: null,
                    })
                  }
                }}
                placeholder={
                  hasOpenRouterKey
                    ? '输入新 key 以覆盖现有配置'
                    : 'sk-or-v1-...'
                }
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />

              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Analyze Model
                  </label>
                  <input
                    type="text"
                    value={analyzeModelInput}
                    onChange={(e) => {
                      setAnalyzeModelInput(e.target.value)
                      setModelTestStatus('idle')
                      setModelTestMessage('')
                      setModelTestResults({
                        analyze: null,
                        summarize: null,
                        refine: null,
                      })
                    }}
                    placeholder={DEFAULT_OPENROUTER_ANALYZE_MODEL}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Summarize Model
                  </label>
                  <input
                    type="text"
                    value={summarizeModelInput}
                    onChange={(e) => {
                      setSummarizeModelInput(e.target.value)
                      setModelTestStatus('idle')
                      setModelTestMessage('')
                      setModelTestResults({
                        analyze: null,
                        summarize: null,
                        refine: null,
                      })
                    }}
                    placeholder={DEFAULT_OPENROUTER_SUMMARIZE_MODEL}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Refine Model
                  </label>
                  <input
                    type="text"
                    value={refineModelInput}
                    onChange={(e) => {
                      setRefineModelInput(e.target.value)
                      setModelTestStatus('idle')
                      setModelTestMessage('')
                      setModelTestResults({
                        analyze: null,
                        summarize: null,
                        refine: null,
                      })
                    }}
                    placeholder={DEFAULT_OPENROUTER_REFINE_MODEL}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>
              </div>

              {(openRouterKeyMessage || modelTestMessage) && (
                <div className="mt-2 space-y-1">
                  {openRouterKeyMessage && (
                    <p
                      className={`text-xs ${
                        openRouterKeyStatus === 'error'
                          ? 'text-red-500'
                          : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {openRouterKeyMessage}
                    </p>
                  )}
                  {modelTestMessage && (
                    <p
                      className={`text-xs ${
                        modelTestStatus === 'failed'
                          ? 'text-red-500'
                          : modelTestStatus === 'passed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {modelTestMessage}
                    </p>
                  )}
                </div>
              )}

              {(modelTestResults.analyze ||
                modelTestResults.summarize ||
                modelTestResults.refine) && (
                <div className="mt-3 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                  {modelResultItems.map(({ label, result }) =>
                    result ? (
                      <div
                        key={label}
                        className="rounded-lg bg-white px-3 py-2 dark:bg-neutral-950"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                            {label}
                          </span>
                          <span
                            className={`text-[11px] font-medium ${
                              result.ok
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-500'
                            }`}
                          >
                            {result.ok ? 'OK' : 'Failed'}
                          </span>
                        </div>
                        <p className="mt-1 break-all font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                          {result.configured}
                        </p>
                        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          {result.message}
                        </p>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                {hasOpenRouterKey && (
                  <button
                    onClick={deleteOpenRouterKey}
                    disabled={openRouterKeyStatus === 'deleting'}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {openRouterKeyStatus === 'deleting'
                      ? 'Deleting...'
                      : 'Delete'}
                  </button>
                )}
                <button
                  onClick={() => setIsKeyModalOpen(false)}
                  disabled={
                    openRouterKeyStatus === 'saving' ||
                    modelTestStatus === 'testing'
                  }
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={testOpenRouterModels}
                  disabled={
                    !isLoggedIn ||
                    modelTestStatus === 'testing' ||
                    openRouterKeyStatus === 'saving'
                  }
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  {modelTestStatus === 'testing' ? 'Testing...' : 'Test'}
                </button>
                <button
                  onClick={persistOpenRouterKey}
                  disabled={
                    !isLoggedIn ||
                    (!openRouterKeyInput.trim() && !hasOpenRouterKey) ||
                    openRouterKeyStatus === 'saving' ||
                    modelTestStatus === 'testing'
                  }
                  className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                >
                  {openRouterKeyStatus === 'saving' ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
