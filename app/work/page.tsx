import WorkCard from './work-card'
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
        <p className="prose prose-neutral mb-8 text-sm dark:prose-invert">
          A collection of useful tools.
        </p>
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
