import Link from 'next/link'

type DashboardCardProps = {
  title: string
  subtitle?: React.ReactNode
  action?: { label: string; href: string }
  className?: string
  children: React.ReactNode
}

const DashboardCard = ({ title, subtitle, action, className = '', children }: DashboardCardProps) => {
  return (
    <section className={`bg-panel border border-line-soft rounded-2xl p-6 flex flex-col ${className}`}>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h2 className='text-xl font-medium'>{title}</h2>
          {subtitle && <p className='text-xs text-ink-muted font-medium mt-1'>{subtitle}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className='shrink-0 bg-control hover:bg-control-hover text-xs text-ink-2 rounded-md px-3 py-1.5 transition-colors'
          >
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export default DashboardCard
