import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  content: string
  className?: string
}

export function MarkdownView({ content, className }: Props) {
  return (
    <div className={`markdown ${className ?? ''}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                if (href && /^https?:\/\//i.test(href)) void window.tea.openExternal(href)
              }}
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
