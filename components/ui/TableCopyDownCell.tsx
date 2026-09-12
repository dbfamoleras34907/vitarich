'use client'

import { useRef, type ComponentProps } from 'react'
import { ArrowDownToLine } from 'lucide-react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './context-menu'

type Props = ComponentProps<'td'> & {
  canCopyDown?: boolean
  onCopyDown?: () => void
}

/** A normal table cell with a shadcn Copy down context menu when editable. */
export function TableCopyDownCell({ canCopyDown = false, onCopyDown, ...props }: Props) {
  const selected = useRef(false)
  const cell = <td {...props} />
  if (!canCopyDown) return cell
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{cell}</ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={event => {
        // Open confirmation after the menu closes so its focus scope cannot
        // steal focus from the alert dialog.
        if (selected.current) {
          event.preventDefault()
          selected.current = false
          onCopyDown?.()
        }
      }}>
        <ContextMenuItem onSelect={() => { selected.current = true }}>
          <ArrowDownToLine aria-hidden="true" />
          Copy down
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
