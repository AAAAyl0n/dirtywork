'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

function SearchStatusBubble({ query }: { query: string }) {
  return (
    <motion.div
      key={query}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="absolute bottom-4 left-4 right-4 flex items-center space-x-2 rounded-lg border border-neutral-100 bg-white/90 px-3 py-2 text-sm text-neutral-500 shadow-sm backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-400 z-10"
    >
      <div className="flex h-2 w-2 items-center justify-center translate-y-[0.4px]">
        <span className="relative flex h-2 w-2">
           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75"></span>
           <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-500"></span>
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
      className="absolute bottom-4 left-4 right-4 flex items-center space-x-2 rounded-lg border border-neutral-100 bg-white/90 px-3 py-2 text-sm text-neutral-500 shadow-sm backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-400 z-10"
    >
      <div className="flex h-4 w-4 items-center justify-center">
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
      className="absolute bottom-4 left-4 right-4 flex items-center space-x-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-600 shadow-sm backdrop-blur-sm dark:border-emerald-800/50 dark:bg-emerald-950/90 dark:text-emerald-400 z-10"
    >
      <div className="flex h-4 w-4 items-center justify-center">
        <svg className="animate-pulse h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
        </svg>
      </div>
      <span>Summarizing...</span>
    </motion.div>
  )
}

export default function RefinePage() {
  const [inputText, setInputText] = useState('')
  const [basePrompt, setBasePrompt] = useState('')
  const [displayedPrompt, setDisplayedPrompt] = useState('')
  const [promptDraft, setPromptDraft] = useState('')
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [refinedText, setRefinedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0) // Start from 0
  const [analysisDone, setAnalysisDone] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [isSumUp, setIsSumUp] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const analysisPercent = analysisProgress.total > 0
    ? Math.round((analysisProgress.done / analysisProgress.total) * 100)
    : 0
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const outputTextareaRef = useRef<HTMLTextAreaElement>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // Check login status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
    }
    checkAuth()
  }, [])

  // Auto-scroll to bottom when refined text changes
  useEffect(() => {
    if (outputTextareaRef.current) {
      outputTextareaRef.current.scrollTop = outputTextareaRef.current.scrollHeight
    }
  }, [refinedText])

  // Auto-scroll to bottom when prompt changes
  useEffect(() => {
      if (promptTextareaRef.current) {
          promptTextareaRef.current.scrollTop = promptTextareaRef.current.scrollHeight
      }
  }, [displayedPrompt])

  // Auto-save to history when completed
  useEffect(() => {
    if (isCompleted && isLoggedIn && refinedText && inputText) {
      saveToHistory(inputText, refinedText)
    }
  }, [isCompleted])

  const runRefinement = async (startIndex: number, skipAnalysis: boolean) => {
    if (!inputText.trim() || loading) return

    setLoading(true)
    setIsCompleted(false)
    setIsEditingPrompt(false)
    setStatus(startIndex > 0 ? `Resuming from chunk ${startIndex + 1}...` : 'Analyzing Context...')
    
    // Only clear if starting fresh
    if (startIndex === 0) {
        setRefinedText('')
        if (!skipAnalysis) {
            // Restart/fresh start: clear previous Live System Prompt immediately.
            // (We still send `basePrompt` to the API; the new live prompt will stream back.)
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
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            text: inputText,
            basePrompt: skipAnalysis ? displayedPrompt : basePrompt, // Pass full prompt if skipping analysis
            startChunkIndex: startIndex,
            skipContextAnalysis: skipAnalysis
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Refinement failed')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader')

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        // Process buffer line by line
        let newlineIndex
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex)
            buffer = buffer.slice(newlineIndex + 1)
            
            if (!line.trim()) continue
            
            try {
                const data = JSON.parse(line)
                if (data.t === 'p') {
                    // Update Prompt
                    setDisplayedPrompt(data.c)
                    if (!isEditingPrompt) {
                        setPromptDraft(data.c)
                    }
                    setAnalysisDone(true)
                    setSearchQuery(null)
                    setIsThinking(false)
                    setIsSumUp(false)
                } else if (data.t === 'c') {
                    // Append Content
                    setRefinedText((prev) => prev + data.c)
                    setSearchQuery(null)
                    setIsThinking(false)
                    setIsSumUp(false)
                } else if (data.t === 'search') {
                    // Update Search Status
                    console.log('Search triggered:', data.c)
                    setSearchQuery(data.c)
                    setIsThinking(false)
                    setIsSumUp(false)
                } else if (data.t === 'searchdone') {
                    // Search completed, clear search bubble
                    setSearchQuery(null)
                } else if (data.t === 'thinking') {
                    // Show Thinking bubble
                    setSearchQuery(null)
                    setIsThinking(true)
                    setIsSumUp(false)
                } else if (data.t === 'sumup') {
                    // Show Sum up! bubble
                    setSearchQuery(null)
                    setIsThinking(false)
                    setIsSumUp(true)
                } else if (data.t === 'sumupc') {
                    // Streamed summary content
                    setDisplayedPrompt((prev) => prev + data.c)
                    if (!isEditingPrompt) {
                        setPromptDraft((prev) => prev + data.c)
                    }
                    setSearchQuery(null)
                    setIsThinking(false)
                    setIsSumUp(true)
                } else if (data.t === 'ap') {
                    // Analysis progress
                    try {
                        const { done, total } = JSON.parse(data.c)
                        setAnalysisProgress({ done, total })
                    } catch (e) {
                        console.warn('Failed to parse analysis progress:', data.c, e)
                    }
                } else if (data.t === 's') {
                    // Update Status (e.g. "Processing chunk 1/5")
                    setStatus(data.c)
                    setSearchQuery(null)
                    setIsThinking(false)
                    setIsSumUp(false)
                    // Parse chunk index
                    const match = data.c.match(/Processing chunk (\d+)\/(\d+)/);
                    if (match) {
                        // Current chunk is being processed, so next start index should be this one (if fails) 
                        // or next one (if succeeds).
                        // We update currentChunkIndex to match the one being processed.
                        // If we stop now, we want to resume from THIS chunk (because it's not finished).
                        // Chunk index is 1-based in status string, so subtract 1.
                        setCurrentChunkIndex(parseInt(match[1]) - 1);
                    }
                }
            } catch (e) {
                console.warn('Failed to parse line (partial JSON?):', line, e)
                if (!line.startsWith('{')) {
                     setRefinedText((prev) => prev + line + '\n')
                }
            }
        }
      }
      setIsCompleted(true)
      setStatus('Completed')
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            setStatus('Stopped')
            setLoading(false)
            return
        }
        console.error('Refine error:', error)
        setRefinedText((prev) => prev + '\n[Refinement Error]')
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
      // Resume from currentChunkIndex
      // We assume context analysis is done, so we skip it and pass current displayedPrompt
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
    a.download = 'refined_text.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Save to history when completed
  const saveToHistory = async (original: string, result: string) => {
    if (!isLoggedIn) return
    
    setSaveStatus('saving')
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'refine',
          originalText: original,
          resultText: result,
        }),
      })
      
      if (response.ok) {
        setSaveStatus('saved')
      } else {
        setSaveStatus('error')
      }
    } catch (error) {
      console.error('Failed to save history:', error)
      setSaveStatus('error')
    }
  }

  // Determine button state
  // Resume is available if not loading, not completed, and analysis is done (so we have a prompt to resume with)
  const canResume = !loading && !isCompleted && analysisDone;
  const promptValue = isEditingPrompt
      ? promptDraft
      : (analysisDone || loading || canResume || isCompleted ? displayedPrompt : basePrompt)
  const promptReadOnly = !isEditingPrompt && (loading || analysisDone || canResume || isCompleted)

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
            <h1 className="text-2xl font-medium tracking-tighter">Refine</h1>
        </div>
        <p className="prose prose-neutral text-sm dark:prose-invert">
          Advanced text refinement tool. Analyzes context, fixes grammar/formatting, and improves clarity for long transcripts.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        {/* Left Column: Input + Prompt + Button */}
        <div className="flex flex-col h-full gap-4">
            {/* Input Transcript */}
            <div className="flex-1 flex flex-col min-h-0">
                <label className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Original Transcript
                </label>
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your long conversation text here..."
                    className="flex-1 w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                />
            </div>
            
            {/* Prompt Area */}
            <div className="h-1/3 flex flex-col min-h-0 relative">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                        {loading ? 'Live System Prompt' : (analysisDone ? 'Live System Prompt' : 'Base System Prompt (Optional)')}
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
                {loading && analysisProgress.total > 0 && !analysisDone && !isSumUp && (
                    <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                            <span>Analyzing chunks</span>
                            <span>{analysisProgress.done}/{analysisProgress.total} ({analysisPercent}%)</span>
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800">
                            <div
                                className="h-2 rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${analysisPercent}%` }}
                            />
                        </div>
                    </div>
                )}
                <div className="relative flex-1 min-h-0">
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
                        placeholder={loading ? "Waiting for context analysis..." : "在此添加背景信息，例如一些人名、公司名、可能识别错误的名称等"}
                        className={
                            `w-full h-full resize-none rounded-lg border border-neutral-200 p-4 text-xs font-mono focus:outline-none dark:border-neutral-800 dark:text-neutral-100
                            ${loading ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500' : 'bg-neutral-50 dark:bg-neutral-900 focus:border-neutral-400'}`
                        }
                    />
                    <AnimatePresence mode="wait">
                        {searchQuery && <SearchStatusBubble query={searchQuery} />}
                        {!searchQuery && isThinking && <ThinkingStatusBubble />}
                        {!searchQuery && !isThinking && isSumUp && <SumUpStatusBubble />}
                    </AnimatePresence>
                </div>
            </div>

            {/* Start/Stop/Resume Buttons */}
            <div className="flex gap-2">
                 {!loading ? (
                    <>
                        {canResume ? (
                             <button
                                onClick={handleResume}
                                disabled={isEditingPrompt}
                                className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                             >
                                Resume
                             </button>
                        ) : (
                             <button
                                onClick={handleStart}
                                disabled={!inputText.trim() || isEditingPrompt}
                                className="w-full sm:w-24 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                             >
                                Refine
                             </button>
                        )}

                        {(canResume || isCompleted) && (
                             <button
                                onClick={handleStart}
                                disabled={isEditingPrompt}
                                title="Restart from beginning"
                                className="w-auto px-4 rounded-lg bg-neutral-200 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                             </button>
                        )}
                    </>
                ) : (
                    <button
                    onClick={handleStop}
                    className="w-full sm:w-24 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                    >
                    Stop
                    </button>
                )}
            </div>
        </div>

        {/* Right Column: Output + Export Button + Status */}
        <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                        Refined Output
                    </label>
                    {/* Save Status - 右上角 */}
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
                    readOnly
                    placeholder="Refined text will stream here..."
                    className="flex-1 w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 mb-4"
                />
            </div>

            {/* Export Button & Status */}
            <div className="flex items-center gap-6">
                <button
                onClick={handleExport}
                disabled={!isCompleted}
                className="flex-shrink-0 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                Export .md
                </button>

                {/* Progress Status */}
                <div className="flex items-center gap-2 text-sm ml-2">
                    {loading && (
                        <div className="flex items-center gap-2 text-neutral-500">
                            <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300"></div>
                            <span className="hidden sm:inline">{status || 'Working...'}</span>
                        </div>
                    )}
                    {isCompleted && (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden sm:inline">Refinement Complete</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </section>
  )
}
