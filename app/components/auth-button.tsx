'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { GitHubIcon } from './Icon'

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
    // 已登录 - 显示用户头像和用户名
    const username = user.user_metadata?.user_name || user.user_metadata?.preferred_username || user.email?.split('@')[0] || 'User'
    const avatarUrl = user.user_metadata?.avatar_url
    return (
      <div
        className="mr-4 flex items-center justify-center rounded-xl border-[0.5px] border-neutral-200 px-3 py-2 text-xs font-medium shadow-[0_2px_2px_rgba(0,0,0,0.04)] dark:border-neutral-700 dark:bg-neutral-700/20"
        title={user.email || ''}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            className="mr-1.5 h-4 w-4 rounded-full"
          />
        ) : (
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
        )}
        <span className="text-neutral-600 dark:text-neutral-400">{username}</span>
      </div>
    )
  }

  // 未登录 - 显示 GitHub 登录按钮
  return (
    <button
      onClick={handleLogin}
      className="mr-4 flex items-center justify-center rounded-xl border-[0.5px] border-neutral-200 p-2 text-xs font-medium shadow-[0_2px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-stone-100 hover:shadow-none dark:border-neutral-700 dark:bg-neutral-700/20 dark:hover:bg-neutral-900/20"
    >
      <GitHubIcon className="mr-1 h-4" />
      <span>Log in</span>
    </button>
  )
}

