'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    checkUser()

    // 监听登录状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`
      }
    })
  }

  if (loading) {
    return (
      <button
        disabled
        className="mr-4 flex items-center justify-center rounded-xl border-[0.5px] border-neutral-200 px-3 py-2 text-xs font-medium shadow-[0_2px_2px_rgba(0,0,0,0.04)] dark:border-neutral-700 dark:bg-neutral-700/20"
      >
        <span className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"></span>
      </button>
    )
  }

  if (user) {
    // 已登录 - 显示用户 ID（取前8位）
    const displayId = user.id.substring(0, 8)
    return (
      <div
        className="mr-4 flex items-center justify-center rounded-xl border-[0.5px] border-neutral-200 px-3 py-2 text-xs font-medium shadow-[0_2px_2px_rgba(0,0,0,0.04)] dark:border-neutral-700 dark:bg-neutral-700/20"
        title={`用户 ID: ${user.id}`}
      >
        <svg
          className="mr-1.5 h-4 w-4 text-green-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-neutral-600 dark:text-neutral-400">{displayId}</span>
      </div>
    )
  }

  // 未登录 - 显示登录按钮
  return (
    <button
      onClick={handleLogin}
      className="mr-4 flex items-center justify-center rounded-xl border-[0.5px] border-neutral-200 px-3 py-2 text-xs font-medium shadow-[0_2px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-stone-100 hover:shadow-none dark:border-neutral-700 dark:bg-neutral-700/20 dark:hover:bg-neutral-900/20"
    >
      <svg
        className="mr-1.5 h-4 w-4"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span>登录</span>
    </button>
  )
}

