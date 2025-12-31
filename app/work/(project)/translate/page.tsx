'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from 'lib/utils'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function TranslatePage() {
  const [inputText, setInputText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const outputTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when translated text changes
  useEffect(() => {
    if (outputTextareaRef.current) {
      outputTextareaRef.current.scrollTop = outputTextareaRef.current.scrollHeight
    }
  }, [translatedText])

  const handleTranslate = async () => {
    if (!inputText.trim() || loading) return

    setLoading(true)
    setIsCompleted(false)
    setTranslatedText('')
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error('Translation failed')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        setTranslatedText((prev) => prev + chunk)
      }
      setIsCompleted(true)
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return
        }
        console.error('Translation error:', error)
        setTranslatedText((prev) => prev + '\n[Translation Error]')
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort()
      }
  }

  const handleExport = () => {
    const blob = new Blob([translatedText], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'translated.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
            <h1 className="text-2xl font-medium tracking-tighter">Translate</h1>
        </div>
        <p className="prose prose-neutral text-sm dark:prose-invert">
          Long text translation tool. Splits text by speaker/paragraphs and translates sequentially.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        {/* Left Column: Input + Start Button */}
        <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col min-h-0">
                <label className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Original Text
                </label>
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your long text here..."
                    className="flex-1 w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 mb-4"
                />
            </div>
            
            {/* Start/Stop Button */}
            <div>
                 {!loading ? (
                    <button
                    onClick={handleTranslate}
                    disabled={!inputText.trim()}
                    className="w-full sm:w-24 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                    >
                    Start
                    </button>
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
                <label className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Translated Text
                </label>
                <textarea
                    ref={outputTextareaRef}
                    value={translatedText}
                    readOnly
                    placeholder="Translation will appear here..."
                    className="flex-1 w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 mb-4"
                />
            </div>

            {/* Export Button & Status */}
            <div className="flex items-center gap-4">
                <button
                onClick={handleExport}
                disabled={!isCompleted}
                className="w-full sm:w-auto rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                >
                Export .md
                </button>

                {/* Progress Status */}
                <div className="flex items-center gap-2 text-sm">
                    {loading && (
                        <div className="flex items-center gap-2 text-neutral-500">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300"></div>
                            <span className="hidden sm:inline">Translating...</span>
                        </div>
                    )}
                    {isCompleted && (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden sm:inline">Completed</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </section>
  )
}
