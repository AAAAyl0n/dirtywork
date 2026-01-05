import WorkCard from './work-card'
import Link from 'next/link'
// Reusing letter image for translate as requested (random pick from resources)
import translateImg from 'public/work/translate.webp'
import refineImg from 'public/work/refine.webp'

export const metadata = {
  title: 'Work',
  description: 'My works and tools.',
}

export default function Page() {
  return (
    <section>
      <section className="sm:px-14 sm:pt-6">
        <h1 className="mb-2 text-2xl font-medium tracking-tighter">
          Work
        </h1>
        <div className="flex items-center justify-between mb-8">
          <p className="prose prose-neutral text-sm dark:prose-invert">
            A collection of useful tools.
          </p>
          <Link 
            href="/work/history"
            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
           <WorkCard
            title="Translate"
            description="Long text translation tool with speaker detection."
            image={translateImg}
            link="/work/translate"
          />
           <WorkCard
            title="Refine"
            description="Intelligent text refinement and grammar correction."
            image={refineImg}
            link="/work/refine"
          />
        </div>
      </section>
    </section>
  )
}
