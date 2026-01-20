import { cn } from 'lib/utils'
import BlurFade from '../components/blur-fade'
import ArxivSwitch from './arxiv-switch'

export const metadata = {
  title: 'Articles',
  description: '博客文章与推荐阅读',
}

const articles = [
  {
    title: 'Emergence of Human to Robot Transfer in VLAs',
    url: 'https://www.pi.website/research/human_to_robot',
    source: 'Physical Intelligence',
    author: 'Physical Intelligence',
    publishedAt: '未注明',
  },
  {
    title: 'How to fix your entire life in 1 day',
    url: 'https://x.com/thedankoe/status/2010751592346030461',
    source: 'X (Twitter)',
    author: 'Dan Koe',
    publishedAt: '2026-01-12',
  },
  {
    title: 'Vibe Coder 如何掌握AI编程进度',
    url: 'https://x.com/jesselaunz/status/2005854758041436268?s=20',
    source: 'X (Twitter)',
    author: 'Jesse Launz',
    publishedAt: '2025-12-30',
  },
  {
    title: 'Steam, Steel, and Infinite Minds',
    url: 'https://x.com/ivanhzhao/status/2003192654545539400?s=20',
    source: 'X (Twitter)',
    author: 'Ivan Zhao',
    publishedAt: '2025-12-22',
  },
  {
    title: '为什么人可以直观地看出函数局部最小值的大致位置，而计算机不能？',
    url: 'https://www.zhihu.com/question/657302311/answer/1992562376210393062',
    source: '知乎',
    author: 'V777',
    publishedAt: '2026-01-08',
  },
  {
    title: '人形机器人运动控制Know-How',
    url: 'https://zhuanlan.zhihu.com/p/1993986785630499920',
    source: '知乎',
    author: 'Jagger',
    publishedAt: '2026-01-15',
  },
]

export default async function BlogPage() {
  const sortedArticles = [...articles].sort((a, b) => {
    const aTime = a.publishedAt === '未注明' ? 0 : Date.parse(a.publishedAt)
    const bTime = b.publishedAt === '未注明' ? 0 : Date.parse(b.publishedAt)
    return bTime - aTime
  })

  return (
    <section className="sm:px-14 sm:pt-6">
      <h1 className="mb-2 text-2xl font-medium tracking-tighter">Articles</h1>
      <p className="prose prose-neutral mb-2 text-sm dark:prose-invert">
        这里推送一些论文，优质博客，技术文章，等等。
      </p>
      <ArxivSwitch />

      <div className="mt-6 flex flex-col gap-4">
        {sortedArticles.map((article) => (
          <BlurFade key={article.url} yOffset={0} inView>
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
                  {article.author} · {article.publishedAt} · {article.source}
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
