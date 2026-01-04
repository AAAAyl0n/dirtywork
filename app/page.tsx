import Image from 'next/image'
import avatar from 'app/avatar.webp'
import Link from 'next/link'
import { GitHubIcon } from './components/Icon'
import { TimeWeather } from './components/time-weather'

export default async function Page() {
  return (
    <section>
      <section className="sm:px-28 sm:pt-8">
        <Image
          alt={'Bowen'}
          src={avatar}
          height={64}
          width={64}
          sizes="33vw"
          placeholder="blur"
          className="mb-6 h-14 w-14 rounded-full border border-neutral-200 dark:border-neutral-700"
          priority
        />
        <h1 className="mb-1 text-xl font-medium tracking-tighter">
          DirtyWork
        </h1>
        <p className="prose prose-neutral text-sm dark:prose-invert">
          The toolbox of venture capitalists.
        </p>
        <p className={'mb-6 pt-10 text-lg font-medium tracking-tight'}>
          Welcome to dirtywork.top
          <br />
          I dream that one day AI can secretly take over my job alone, and then I can just lie flat.
          <br />

        </p>
        <TimeWeather />
        <div className={'mt-6 flex items-center'}>
          <Link href="https://github.com/AAAAyl0n" target="_blank">
            <button
              className={
                'mr-4 flex items-center justify-center rounded-xl border-[0.5px] border-neutral-200 p-2 text-xs font-medium shadow-[0_2px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-stone-100 hover:shadow-none dark:border-neutral-700 dark:bg-neutral-700/20 dark:hover:bg-neutral-900/20'
              }
            >
              <GitHubIcon className="mr-1 h-4" />
              <p>GitHub</p>
            </button>
          </Link>
          <span className="mr-2 h-2 w-2 rounded-full bg-blue-500"></span>
          <Link
            href={'/work/translate'}
            className="text-xs font-medium"
          >
            Translate
          </Link>
          <p className="mx-1 text-xs font-medium">/</p>
          <Link
            href={'/work/refine'}
            className="text-xs font-medium"
          >
            Refine
          </Link>
        </div>
      </section>
    </section>
  )
}
