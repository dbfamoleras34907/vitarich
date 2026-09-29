'use client'

import { type ComponentProps } from 'react'
import { ArrowDownToLine } from 'lucide-react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './context-menu'

type Props = ComponentProps<'td'> & {
  canCopyDown?: boolean
  onCopyDown?: (sourceValue?: unknown) => void
}

export function isCopyDownShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>) {
  return event.key === 'ArrowDown' && (event.ctrlKey || event.metaKey)
}

function getKeyboardSourceValue(target: EventTarget | null) {
  if (target instanceof HTMLInputElement) {
    if (target.readOnly) return undefined
    return target.type === 'checkbox' || target.type === 'radio' ? target.checked : target.value
  }
  if (target instanceof HTMLTextAreaElement) return target.readOnly ? undefined : target.value
  return undefined
}

/** A normal table cell with shared Copy down context-menu and keyboard behavior. */
export function TableCopyDownCell({ canCopyDown = false, onCopyDown, ...props }: Props) {
  const cell = <td
    {...props}
    onKeyDown={event => {
      if (canCopyDown && isCopyDownShortcut(event)) {
        event.preventDefault()
        event.stopPropagation()
        onCopyDown?.(getKeyboardSourceValue(event.target))
        return
      }
      props.onKeyDown?.(event)
    }}
  />
  if (!canCopyDown) return cell
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{cell}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onCopyDown?.()}>
          <ArrowDownToLine aria-hidden="true" />
          Copy down
          <span className="ml-auto pl-4 text-xs tracking-wider text-muted-foreground">Ctrl+Down</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
