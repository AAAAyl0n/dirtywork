'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, UserGroupIcon, XMarkIcon, PencilSquareIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline'

type TranscriptStatus = 'idle' | 'submitting' | 'processing' | 'completed' | 'error'

export default function TranscribePage() {
  const [audioUrl, setAudioUrl] = useState('')
  const [status, setStatus] = useState<TranscriptStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [languageCode, setLanguageCode] = useState('en')
  const [speakerLabels, setSpeakerLabels] = useState(true)
  
  // 说话人命名相关状态
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({})
  const [showSpeakerModal, setShowSpeakerModal] = useState(false)
  const [editingSpeakerNames, setEditingSpeakerNames] = useState<Record<string, string>>({})
  
  // 编辑模式状态
  const [isEditMode, setIsEditMode] = useState(false)
  
  // 复制状态反馈
  const [copied, setCopied] = useState(false)
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 从结果中提取所有 Speaker 标签
  const detectedSpeakers = useMemo(() => {
    if (!result) return []
    const speakerRegex = /\*\*Speaker ([A-Z])\*\*/g
    const speakers = new Set<string>()
    let match
    while ((match = speakerRegex.exec(result)) !== null) {
      speakers.add(match[1])
    }
    return Array.from(speakers).sort()
  }, [result])

  // 当检测到新的 Speaker 时，初始化名称映射
  useEffect(() => {
    if (detectedSpeakers.length > 0) {
      setSpeakerNames(prev => {
        const newNames = { ...prev }
        detectedSpeakers.forEach(speaker => {
          if (!(speaker in newNames)) {
            newNames[speaker] = ''
          }
        })
        return newNames
      })
    }
  }, [detectedSpeakers])

  // 打开说话人编辑弹窗
  const openSpeakerModal = () => {
    setEditingSpeakerNames({ ...speakerNames })
    setShowSpeakerModal(true)
  }

  // 保存说话人名称
  const saveSpeakerNames = () => {
    setSpeakerNames(editingSpeakerNames)
    setShowSpeakerModal(false)
  }

  // 渲染带有 markdown 加粗和说话人替换的结果
  const renderFormattedResult = useMemo(() => {
    if (!result) return null
    
    // 替换 Speaker 标签为自定义名称
    let processedResult = result
    Object.entries(speakerNames).forEach(([speaker, customName]) => {
      if (customName.trim()) {
        const regex = new RegExp(`\\*\\*Speaker ${speaker}\\*\\*`, 'g')
        processedResult = processedResult.replace(regex, `**${customName}**`)
      }
    })
    
    // 按行分割并渲染
    const lines = processedResult.split('\n')
    return lines.map((line, index) => {
      // 处理加粗文本 **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      const renderedLine = parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2)
          return (
            <strong key={partIndex} className="font-semibold text-neutral-900 dark:text-neutral-100">
              {boldText}
            </strong>
          )
        }
        return <span key={partIndex}>{part}</span>
      })
      
      return (
        <div key={index} className="min-h-[1.5em]">
          {renderedLine}
        </div>
      )
    })
  }, [result, speakerNames])

  // 清理轮询
  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // 验证 URL 格式
  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // 转换云存储分享链接为直接下载链接
  const convertToDirectLink = (url: string): string => {
    // Google Drive: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    // 转换为: https://drive.google.com/uc?export=download&id=FILE_ID
    const googleDriveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
    if (googleDriveMatch) {
      const fileId = googleDriveMatch[1]
      return `https://drive.google.com/uc?export=download&id=${fileId}`
    }

    // Google Drive 另一种格式: https://drive.google.com/open?id=FILE_ID
    const googleDriveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/)
    if (googleDriveOpenMatch) {
      const fileId = googleDriveOpenMatch[1]
      return `https://drive.google.com/uc?export=download&id=${fileId}`
    }

    // Dropbox: https://www.dropbox.com/s/xxx/file.m4a?dl=0
    // 转换为: https://www.dropbox.com/s/xxx/file.m4a?dl=1
    if (url.includes('dropbox.com')) {
      return url.replace('dl=0', 'dl=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    }

    // OneDrive: 需要使用 download=1 参数
    if (url.includes('1drv.ms') || url.includes('onedrive.live.com')) {
      if (!url.includes('download=1')) {
        return url + (url.includes('?') ? '&' : '?') + 'download=1'
      }
    }

    // 其他链接保持不变
    return url
  }

  // 开始转写流程
  const handleTranscribe = async () => {
    if (!audioUrl.trim() || !isValidUrl(audioUrl)) {
      setError('请输入有效的音频 URL')
      return
    }

    // 转换分享链接为直接下载链接
    const directUrl = convertToDirectLink(audioUrl.trim())

    setStatus('submitting')
    setError('')
    setResult('')
    setProgress(10)

    try {
      // 提交转写任务
      const submitRes = await fetch('/api/transcribe/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: directUrl,
          language_code: languageCode,
          speaker_labels: speakerLabels,
        }),
      })

      if (!submitRes.ok) {
        const errorData = await submitRes.json()
        throw new Error(errorData.error || '提交转写任务失败')
      }

      const { transcript_id } = await submitRes.json()
      setProgress(30)
      setStatus('processing')

      // 轮询获取结果
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/transcribe/status/${transcript_id}`)
          
          if (!statusRes.ok) {
            throw new Error('查询状态失败')
          }

          const data = await statusRes.json()

          if (data.status === 'completed') {
            clearPolling()
            setStatus('completed')
            setResult(data.formatted || data.text)
            setProgress(100)
          } else if (data.status === 'error') {
            clearPolling()
            setStatus('error')
            setError(data.error || '转写失败')
          } else {
            // 还在处理中，更新进度（30-90之间）
            setProgress(prev => Math.min(prev + 3, 90))
          }
        } catch {
          clearPolling()
          setStatus('error')
          setError('查询状态时出错')
        }
      }, 5000) // 每 5 秒轮询一次

    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : '未知错误')
    }
  }

  // 获取处理后的结果（应用说话人名称替换）
  const getProcessedResult = useCallback(() => {
    if (!result) return ''
    let processedResult = result
    Object.entries(speakerNames).forEach(([speaker, customName]) => {
      if (customName.trim()) {
        const regex = new RegExp(`\\*\\*Speaker ${speaker}\\*\\*`, 'g')
        processedResult = processedResult.replace(regex, `**${customName}**`)
      }
    })
    return processedResult
  }, [result, speakerNames])

  // 导出结果
  const handleExport = () => {
    if (!result) return
    
    const processedResult = getProcessedResult()
    const blob = new Blob([processedResult], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 复制结果
  const handleCopy = async () => {
    if (!result) return
    const processedResult = getProcessedResult()
    try {
      await navigator.clipboard.writeText(processedResult)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 某些浏览器可能不支持 clipboard API，尝试 fallback
      const textarea = document.createElement('textarea')
      textarea.value = processedResult
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // 重置
  const handleReset = () => {
    clearPolling()
    setAudioUrl('')
    setStatus('idle')
    setProgress(0)
    setResult('')
    setError('')
    setSpeakerNames({})
    setIsEditMode(false)
  }

  // 获取状态文字
  const getStatusText = () => {
    switch (status) {
      case 'submitting':
        return '正在提交转写任务...'
      case 'processing':
        return '正在转写中，可能需要 5-30 分钟...'
      case 'completed':
        return '转写完成'
      case 'error':
        return '转写失败'
      default:
        return ''
    }
  }

  return (
    <section className="flex flex-col min-h-[calc(100vh-180px)] md:h-[calc(100vh-180px)] sm:px-14 sm:pt-6 pb-8">
      {/* Header */}
      <div className="mb-4 md:mb-6 shrink-0">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/work"
            className="rounded-full p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-medium tracking-tighter">Transcribe</h1>
        </div>
        <p className="prose prose-neutral text-sm dark:prose-invert">
          Speech to text powered by AssemblyAI. Paste a public audio URL to start.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 min-h-0">
        {/* Left Column */}
        <div className="flex flex-col min-h-0">
          {/* URL Input */}
          <div className="shrink-0">
            <label className="mb-2 block text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Audio URL
            </label>
            <input
              type="url"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://files.catbox.moe/xxxxxx.m4a"
              disabled={status !== 'idle'}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 disabled:opacity-50"
            />
          </div>

          {/* Settings */}
          <div className="mt-4 space-y-3 shrink-0">
            <div className="flex items-center gap-4">
              <label className="text-sm text-neutral-600 dark:text-neutral-400 w-20">
                Language
              </label>
              <select
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                disabled={status !== 'idle'}
              >
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
              </select>
            </div>
            
            <div className="flex items-center gap-4">
              <label className="text-sm text-neutral-600 dark:text-neutral-400 w-20">
                Speakers
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={speakerLabels}
                  onChange={(e) => setSpeakerLabels(e.target.checked)}
                  disabled={status !== 'idle'}
                  className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700"
                />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Speaker Identification 
                </span>
              </label>
            </div>
          </div>

          {/* Instructions - scrollable on desktop, fixed height on mobile */}
          <div className="mt-4 md:flex-1 min-h-0 max-h-96 md:max-h-none overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
              📋 使用说明
            </h3>
            <ol className="text-xs text-neutral-500 dark:text-neutral-400 space-y-2 list-decimal list-inside">
              <li>将音频上传到支持直链的云存储</li>
              <li>获取文件链接（推荐<strong>直接下载链接</strong>）</li>
              <li>粘贴链接到上方输入框</li>
              <li>点击开始转写</li>
            </ol>

            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <h4 className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                💡 可使用以下云存储（支持直链）
              </h4>
              <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
                <li><strong>catbox.moe</strong>: 最大200MB,直接返回直链</li>
                <li><strong>Cloudflare R2</strong>: 免费 10GB,适合大文件</li>
                <li><strong>Google Drive</strong>: 大于 100MB 会警告</li>
                <li><strong>Dropbox</strong>: 分享链接需要手动转换</li>
                <li><strong>OneDrive</strong>: 分享链接是预览页面</li>
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <h4 className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                ⏱️ 预计耗时
              </h4>
              <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
                <li>10 分钟音频 → 约 1-2 分钟</li>
                <li>1 小时音频 → 约 5-10 分钟</li>
                <li>3 小时音频 → 约 15-30 分钟</li>
              </ul>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                中文转写建议使用{' '}
                <a 
                  href="https://tingwu.aliyun.com/home" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline"
                >
                  通义听悟
                </a>
              </p>
            </div>
          </div>

          {/* Action Button & Status */}
          <div className="mt-4 shrink-0">
            {status === 'idle' ? (
              <button
                onClick={handleTranscribe}
                disabled={!audioUrl.trim()}
                className="w-full sm:w-auto rounded-lg bg-neutral-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                Start Transcribe
              </button>
            ) : status === 'completed' || status === 'error' ? (
              <button
                onClick={handleReset}
                className="w-full sm:w-auto rounded-lg border border-neutral-200 bg-white px-6 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                New Transcription
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300" />
                <span className="text-sm text-neutral-500">{getStatusText()}</span>
              </div>
            )}

            {/* Progress Bar */}
            {(status === 'submitting' || status === 'processing') && (
              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-neutral-900 dark:bg-neutral-100 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-400 mt-1">{progress}%</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col min-h-0 mt-2 md:mt-0">
          {/* Result label with edit/preview toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 shrink-0">
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Transcription Result
            </label>
            <div className="flex items-center gap-2">
              {status === 'completed' && (
                <span className="text-xs text-green-500">✓ 完成</span>
              )}
              {result && (
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  {isEditMode ? (
                    <>
                      <EyeIcon className="w-3.5 h-3.5" />
                      <span>预览</span>
                    </>
                  ) : (
                    <>
                      <PencilIcon className="w-3.5 h-3.5" />
                      <span>编辑</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Speaker Management Bar */}
          {detectedSpeakers.length > 0 && !isEditMode && (
            <div className="mb-2 shrink-0">
              <button
                onClick={openSpeakerModal}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors text-sm"
              >
                <UserGroupIcon className="w-4 h-4 text-neutral-500" />
                <span className="text-neutral-600 dark:text-neutral-300">
                  说话人管理
                </span>
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
                  {detectedSpeakers.length}
                </span>
                {Object.values(speakerNames).some(name => name.trim()) && (
                  <PencilSquareIcon className="w-3.5 h-3.5 text-green-500 ml-1" />
                )}
              </button>
            </div>
          )}

          {/* Result Display - Edit or Preview mode */}
          {isEditMode ? (
            <textarea
              ref={textareaRef}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="flex-1 w-full min-h-[400px] md:min-h-0 resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 font-mono"
              placeholder="Transcription will appear here..."
            />
          ) : (
            <div
              ref={outputRef}
              className="flex-1 w-full min-h-[200px] md:min-h-0 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 font-mono"
            >
              {result ? (
                <div className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                  {renderFormattedResult}
                </div>
              ) : (
                <span className="text-neutral-400 dark:text-neutral-500">
                  Transcription will appear here...
                </span>
              )}
            </div>
          )}

          {/* Export Buttons - aligned with left column button */}
          <div className="mt-4 flex gap-2 shrink-0">
            <button
              onClick={handleExport}
              disabled={!result}
              className="flex-1 sm:flex-none rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Export .md
            </button>
            <button
              onClick={handleCopy}
              disabled={!result}
              className={`flex-1 sm:flex-none rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                copied 
                  ? 'border-green-500 bg-green-50 text-green-600 dark:border-green-500 dark:bg-green-950 dark:text-green-400' 
                  : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Speaker Name Edit Modal */}
      {showSpeakerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-neutral-200 dark:border-neutral-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-neutral-500" />
                <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                  说话人命名
                </h3>
              </div>
              <button
                onClick={() => setShowSpeakerModal(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-auto">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                为每个说话人设置自定义名称，留空则使用默认标签。
              </p>
              {detectedSpeakers.map((speaker) => (
                <div key={speaker} className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Speaker {speaker}
                    </span>
                  </div>
                  <span className="text-neutral-400">→</span>
                  <input
                    type="text"
                    value={editingSpeakerNames[speaker] || ''}
                    onChange={(e) => setEditingSpeakerNames(prev => ({
                      ...prev,
                      [speaker]: e.target.value
                    }))}
                    placeholder={`例如：参与者 ${speaker}`}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                  />
                </div>
              ))}
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <button
                onClick={() => setShowSpeakerModal(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveSpeakerNames}
                className="px-4 py-2 rounded-lg bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
