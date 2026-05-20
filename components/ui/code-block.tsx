'use client'

import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { codeToHtml } from 'shiki'

type CodeBlockProps = {
  code: string
  lang?: string
  title?: string
  className?: string
}

export default function CodeBlock({
  code,
  lang = 'ts',
  title,
  className,
}: CodeBlockProps) {
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function highlight() {
      const result = await codeToHtml(code, {
        lang,
        theme: 'github-dark',
      })

      setHtml(result)
    }

    highlight()
  }, [code, lang])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)

    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 1500)
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border bg-background',
        className
      )}
    >
      {(title || true) && (
        <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            </div>

            {title && (
              <span className="text-sm text-muted-foreground">
                {title}
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      <div
        className="overflow-x-auto text-sm [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:p-4"
        dangerouslySetInnerHTML={{
          __html: html,
        }}
      />
    </div>
  )
}