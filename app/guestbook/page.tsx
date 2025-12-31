import ChatForm from './chat-form'

export const metadata = {
  title: 'Chat',
  description: '与 Kimi AI 对话',
}

export default function ChatPage() {
  return (
    <section className="sm:px-14 sm:pt-6">
      <h1 className="mb-2 text-2xl font-medium tracking-tighter">Chat</h1>
      <p className="prose prose-neutral mb-4 text-sm dark:prose-invert">
        Chat with AI.
      </p>
      <ChatForm />
    </section>
  )
}
