import Link from 'next/link'

const AssistantPromoCard = () => {
  return (
    <section className='bg-panel border border-line-soft rounded-2xl p-6'>
      <h2 className='text-xl font-medium leading-snug'>Ask QueryFi<br />about your money</h2>
      <p className='text-xs text-ink-muted font-medium mt-3 leading-relaxed'>
        Ask questions about your spending in plain English and get answers grounded in your own transactions.
      </p>
      <Link
        href='/ai-assistant'
        className='inline-block mt-5 bg-brand hover:bg-brand-hover text-white text-sm font-medium rounded-md px-5 py-2 transition-colors'
      >
        Open Assistant
      </Link>
    </section>
  )
}

export default AssistantPromoCard
