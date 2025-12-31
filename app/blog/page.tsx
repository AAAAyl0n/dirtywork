import { cn } from 'lib/utils'
import Link from 'next/link'
import BlurFade from '../components/blur-fade'

export const metadata = {
  title: '📝 推荐阅读',
  description: '博客文章与推荐阅读',
}

const articles = [
  {
    title: 'Emergence of Human to Robot Transfer in VLAs',
    url: 'https://www.pi.website/research/human_to_robot',
    source: 'Physical Intelligence',
  },
  {
    title: 'Vibe Coder 如何掌握AI编程进度',
    url: 'https://x.com/jesselaunz/status/2005854758041436268?s=20',
    source: 'X (Twitter)',
  },
  {
    title: 'Steam, Steel, and Infinite Minds',
    url: 'https://x.com/ivanhzhao/status/2003192654545539400?s=20',
    source: 'X (Twitter)',
  },
]

export default async function BlogPage() {
  return (
    <section className="sm:px-14 sm:pt-6">
      <h1 className="mb-2 text-2xl font-medium tracking-tighter">📝 推荐阅读</h1>
      <p className="prose prose-neutral mb-8 text-sm dark:prose-invert">
        这里推送一些论文，优质博客，技术文章，等等。
      </p>

      <div className="flex flex-col gap-4">
        {articles.map((article, idx) => (
          <BlurFade key={article.url} delay={idx * 0.25} inView>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 transition-all',
                'hover:bg-neutral-100 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800'
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {article.title}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {article.source}
                </span>
              </div>
              <div className="text-neutral-400 transition-transform group-hover:translate-x-1">
                →
              </div>
            </a>
          </BlurFade>
        ))}
      </div>
    </section>
  )
}
