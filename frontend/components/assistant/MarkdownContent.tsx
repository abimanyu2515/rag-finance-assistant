import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Element styles for assistant replies, matching the dark dashboard theme
const components: Components = {
  p: ({ children }) => <p className='my-2 first:mt-0 last:mb-0'>{children}</p>,
  h1: ({ children }) => <h3 className='text-base font-semibold text-ink mt-4 mb-2 first:mt-0'>{children}</h3>,
  h2: ({ children }) => <h3 className='text-base font-semibold text-ink mt-4 mb-2 first:mt-0'>{children}</h3>,
  h3: ({ children }) => <h4 className='text-sm font-semibold text-ink mt-3 mb-1.5 first:mt-0'>{children}</h4>,
  h4: ({ children }) => <h5 className='text-sm font-medium text-ink mt-3 mb-1 first:mt-0'>{children}</h5>,
  strong: ({ children }) => <strong className='font-semibold text-ink'>{children}</strong>,
  em: ({ children }) => <em className='italic'>{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target='_blank' rel='noopener noreferrer' className='text-brand-ink underline underline-offset-2 hover:opacity-80'>
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className='my-2 pl-5 list-disc space-y-1 marker:text-brand'>{children}</ul>,
  ol: ({ children }) => <ol className='my-2 pl-5 list-decimal space-y-1 marker:text-ink-subtle'>{children}</ol>,
  li: ({ children }) => <li className='pl-1'>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className='my-3 border-l-2 border-peach pl-3 text-ink-muted'>{children}</blockquote>
  ),
  hr: () => <hr className='my-4 border-dashed border-line' />,
  pre: ({ children }) => (
    <pre className='my-3 overflow-x-auto rounded-lg bg-control border border-line p-3 text-xs'>{children}</pre>
  ),
  code: ({ className, children }) =>
    // Fenced blocks carry a language-* class and are already wrapped by <pre>
    className?.startsWith('language-')
      ? <code className={className}>{children}</code>
      : <code className='rounded bg-control px-1.5 py-0.5 text-[0.85em] text-peach-ink'>{children}</code>,
  table: ({ children }) => (
    <div className='my-3 overflow-x-auto rounded-lg border border-line'>
      <table className='w-full text-xs'>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className='bg-control text-left text-ink-2'>{children}</thead>,
  th: ({ children, style }) => <th style={style} className='px-3 py-2 font-medium whitespace-nowrap'>{children}</th>,
  td: ({ children, style }) => (
    <td style={style} className='px-3 py-2 border-t border-dashed border-line text-ink-muted'>{children}</td>
  ),
}

const MarkdownContent = ({ content }: { content: string }) => (
  <div className='text-sm leading-relaxed wrap-break-word'>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
)

export default MarkdownContent
