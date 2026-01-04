import { cn } from 'lib/utils'
import BlurFade from '../../components/blur-fade'
import ArxivSwitch from '../arxiv-switch'

export const metadata = {
  title: '🧑‍💼 Key Person',
  description: '关键人物追踪',
}

const keyPersons = [
  {
    name: 'Andrej Karpathy',
    title: 'Former OpenAI / Tesla AI Director',
    twitter: 'https://x.com/karpathy',
    description: 'AI教育家，深度学习专家',
  },
  {
    name: 'Jim Fan',
    title: 'NVIDIA Senior Research Scientist',
    twitter: 'https://x.com/DrJimFan',
    description: '具身智能、基础代理研究',
  },
  {
    name: 'Yann LeCun',
    title: 'Meta Chief AI Scientist',
    twitter: 'https://x.com/ylecun',
    description: 'CNN之父，图灵奖得主',
  },
]

export default async function KeyPersonPage() {
  return (
    <section className="sm:px-14 sm:pt-6">
      <h1 className="mb-2 text-2xl font-medium tracking-tighter">Key Person</h1>
      <p className="prose prose-neutral mb-2 text-sm dark:prose-invert">
        追踪行业关键人物的动态与观点。
      </p>
      <ArxivSwitch />

      <div className="mt-6 flex flex-col gap-4">
        {keyPersons.map((person) => (
          <BlurFade key={person.name} yOffset={0} inView>
            <a
              href={person.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-4 transition-all',
                'hover:bg-neutral-100 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800'
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {person.name}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {person.title}
                </span>
                <span className="text-xs text-neutral-400 dark:text-neutral-500">
                  {person.description}
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

