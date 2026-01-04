'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudRain, Sun, CloudFog, CloudLightning, Snowflake, Moon, CloudDrizzle, CloudSun } from 'lucide-react'

// Shanghai Pudong Kerry Parkside coordinates
const LAT = 31.2155
const LON = 121.5627

interface WeatherData {
  temperature: number
  weatherCode: number
  isDay: boolean
}

const WEATHER_CODES: Record<number, { label: string; icon: any }> = {
  0: { label: '晴朗', icon: Sun },
  1: { label: '晴间多云', icon: CloudSun },
  2: { label: '多云', icon: Cloud },
  3: { label: '阴', icon: Cloud },
  45: { label: '雾', icon: CloudFog },
  48: { label: '雾凇', icon: CloudFog },
  51: { label: '毛毛雨', icon: CloudDrizzle },
  53: { label: '中度毛毛雨', icon: CloudDrizzle },
  55: { label: '大毛毛雨', icon: CloudDrizzle },
  61: { label: '小雨', icon: CloudRain },
  63: { label: '中雨', icon: CloudRain },
  65: { label: '大雨', icon: CloudRain },
  71: { label: '小雪', icon: Snowflake },
  73: { label: '中雪', icon: Snowflake },
  75: { label: '大雪', icon: Snowflake },
  95: { label: '雷雨', icon: CloudLightning },
}

export function TimeWeather() {
  const [time, setTime] = useState<Date | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setTime(new Date())
    
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    async function fetchWeather() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,is_day,weather_code&timezone=Asia%2FShanghai`
        )
        const data = await res.json()
        setWeather({
          temperature: data.current.temperature_2m,
          weatherCode: data.current.weather_code,
          isDay: data.current.is_day === 1
        })
      } catch (e) {
        console.error('Failed to fetch weather', e)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
    // Refresh weather every 30 minutes
    const weatherTimer = setInterval(fetchWeather, 1000 * 60 * 30)

    return () => {
      clearInterval(timer)
      clearInterval(weatherTimer)
    }
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const getWeatherInfo = (code: number, isDay: boolean) => {
    const info = WEATHER_CODES[code] || { label: '未知', icon: Cloud }
    let Icon = info.icon
    
    if (!isDay && (code === 0 || code === 1)) {
      Icon = Moon
    }
    
    return { ...info, Icon }
  }

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode, weather.isDay) : null

  // Loading state
  if (!time) {
    return <TimeWeatherLoading />
  }

  return (
    <div className="flex flex-col gap-y-1 rounded-[10px] bg-neutral-200/40 p-1 dark:bg-neutral-700/50">
      <div className="relative flex w-full rounded-md border-[0.5px] border-neutral-200 bg-white/80 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-none dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-none">
        <div className="flex gap-x-2">
          {/* Weather Icon - 类似专辑封面 */}
          <div className="flex h-12 w-12 items-center justify-center rounded-[3px] bg-gradient-to-br from-neutral-800 to-neutral-600 dark:from-neutral-900 dark:to-neutral-700">
            {weatherInfo ? (
              <weatherInfo.Icon className="h-7 w-7 text-white" />
            ) : (
              <Cloud className="h-7 w-7 text-white animate-pulse" />
            )}
          </div>
          {/* Time & Date - 类似歌曲名和艺术家 */}
          <div className="flex flex-col justify-between py-1">
            <div className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
              {formatTime(time)}
            </div>
            <div className="text-xs opacity-30">
              {formatDate(time)}
            </div>
          </div>
        </div>
        {/* Location - 右下角标识 */}
        <div className="absolute bottom-2 right-2 flex flex-col justify-end">
          <div className="flex flex-row items-center gap-x-1.5">
            <p className="text-[10px] opacity-30">上海浦东</p>
          </div>
        </div>
      </div>
      {/* Weather Status Bar - 类似播放状态栏 */}
      <div className="flex h-6 items-center justify-between px-1">
        <div className="flex flex-row items-center gap-x-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
          </span>
          <p className="text-xs opacity-50">
            {weather && weatherInfo ? (
              <>{weatherInfo.label}</>
            ) : (
              <>获取天气中...</>
            )}
          </p>
        </div>
        <div className="text-xs font-medium opacity-50 tabular-nums">
          {weather ? `${weather.temperature}°C` : '--°C'}
        </div>
      </div>
    </div>
  )
}

function TimeWeatherLoading() {
  return (
    <div className="flex flex-col gap-y-1 rounded-[10px] bg-neutral-200/40 p-1 dark:bg-neutral-700/50">
      <div className="flex w-full justify-between rounded-md border-[0.5px] border-neutral-200 bg-white/80 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-none dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-none">
        <div className="flex gap-x-2">
          <div className="h-12 w-12 rounded-[3px] bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
          <div className="flex flex-col justify-between py-1.5">
            <div className="h-4 w-16 rounded-[3px] bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
            <div className="h-3 w-20 rounded-[3px] bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col justify-end"></div>
      </div>
      <div className="flex h-6 items-center justify-between px-1">
        <div className="flex flex-row items-center gap-x-1.5">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-200 dark:bg-neutral-700"></span>
          </span>
          <div className="h-2 w-24 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
        </div>
        <div className="h-2 w-9 rounded-md bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      </div>
    </div>
  )
}
