'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
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

  if (!time) return null

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getWeatherInfo = (code: number, isDay: boolean) => {
    const info = WEATHER_CODES[code] || { label: '未知', icon: Cloud }
    let Icon = info.icon
    
    // Simple logic to switch to Moon for clear nights if desired
    // (though open-meteo weather codes are generic, 0 is clear sky)
    if (!isDay && (code === 0 || code === 1)) {
        Icon = Moon
    }
    
    return { ...info, Icon }
  }

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode, weather.isDay) : null

  return (
    <div className="flex flex-col gap-2 py-8 select-none">
      <div className="flex flex-col">
        <h2 className="text-6xl font-bold tracking-tighter text-neutral-900 dark:text-neutral-100">
          {formatTime(time)}
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg font-medium mt-2">
          {formatDate(time)}
        </p>
      </div>

      <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-400 mt-2 text-sm font-medium">
        {weather && weatherInfo ? (
            <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full">
              <weatherInfo.Icon className="h-4 w-4" />
              <span>{weather.temperature}°C {weatherInfo.label}</span>
              <span className="text-neutral-300 dark:text-neutral-600">|</span>
              <span>上海浦东嘉里城</span>
            </div>
        ) : (
           <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full animate-pulse">
             <span className="h-4 w-4 bg-neutral-200 dark:bg-neutral-700 rounded-full"></span>
             <span className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded"></span>
           </div>
        )}
      </div>
    </div>
  )
}

