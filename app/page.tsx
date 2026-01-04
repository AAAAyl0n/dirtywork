import { TimeWeather } from './components/time-weather'

export const metadata = {
  title: 'Home',
  description: 'Personal Dashboard',
}

export default function Page() {
  return (
    <section>
      <section className="sm:px-14 sm:pt-6">
        <h1 className="mb-2 text-2xl font-medium tracking-tighter">
          🏗️施工中...
        </h1>
        <p className="prose prose-neutral mb-2 text-sm dark:prose-invert">
          暂时还不知道放什么。
        </p>
        <TimeWeather />
      </section>
    </section>
  )
}
