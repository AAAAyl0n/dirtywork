import ArticlesClient from './articles-client'

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
  return (
    <section className="sm:px-14 sm:pt-6">
      <ArticlesClient initialArticles={articles} />
    </section>
  )
}
