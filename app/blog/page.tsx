import ArticlesClient from './articles-client'

export const metadata = {
  title: 'Articles',
  description: '博客文章与推荐阅读',
}

const articles = [
  {
    title: 'Building a C compiler with a team of parallel Claudes',
    url: 'https://www.anthropic.com/engineering/building-c-compiler',
    source: 'anthropic.com',
    author: 'Nicholas Carlini',
    publishedAt: '2026-02-05',
  },
  {
    title: "Don't fall into the anti-AI hype",
    url: 'https://antirez.com/news/158',
    source: 'antirez.com',
    author: 'antirez',
    publishedAt: '2026-02-03',
  },
  {
    title: '为什么音乐的音调是离散频率，不能有连续频率变化的音乐吗？',
    url: 'https://www.zhihu.com/question/1998934565625041679/answer/1999790856752891418',
    source: '知乎',
    author: 'DBinary',
    publishedAt: '2026-01-28',
  },
  {
    title: '对话拓竹陶冶：我们一群工程师，一起造个朴素的硬核公司',
    url: 'https://mp.weixin.qq.com/s/KczhjI3IEbJe10rnbe5G2w',
    source: '微信公众号',
    author: '晚点团队',
    publishedAt: '2026-01-26',
  },
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
