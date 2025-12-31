'use client'

import { StaticImport } from 'next/dist/shared/lib/get-img-props'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { cn } from 'lib/utils'

type WorkCardProps = {
  title: string
  description: string
  image: StaticImport
  link: string
}

export default function WorkCard({
  title,
  description,
  image,
  link,
}: WorkCardProps) {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <div className="mb-4 flex flex-col">
      <Link className={'w-full'} href={link}>
        <Image
          placeholder="blur"
          alt={title}
          src={image}
          onLoad={() => setIsLoading(false)}
          className={cn(
            'rounded-xl transition-all duration-500 ease-in-out hover:scale-95 dark:brightness-75 dark:hover:brightness-100',
            isLoading ? 'blur-xl grayscale' : 'blur-0 grayscale-0'
          )}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Link>
      <Link
        href={link}
        className="text-md mt-2 font-medium tracking-tighter transition-all hover:text-stone-500"
      >
        {title}
      </Link>
      <p className="text-xs text-stone-500">{description}</p>
    </div>
  )
}
