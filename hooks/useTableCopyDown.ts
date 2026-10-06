'use client'

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

type CopyRange = { row: number; column: number; bottom: number; sourceValue?: unknown }

type Options<T, C> = {
  rows: T[]
  columns: C[]
  disabled: boolean
  isEditable: (column: C, row: T) => boolean
  getValue: (column: C, row: T) => unknown
  onCopy: (column: C, targets: T[], value: unknown) => void | Promise<void>
}

/** Shared fill-handle behavior for tables with data-copy-down-row on their cells. */
export function useTableCopyDown<T, C>(options: Options<T, C>) {
  const latest = useRef(options)
  const drag = useRef<CopyRange | null>(null)
  const origin = useRef<Options<T, C> | null>(null)
  const pending = useRef(false)
  const [range, setRange] = useState<CopyRange | null>(null)

  useEffect(() => { latest.current = options })

  const cancel = () => {
    drag.current = null
    setRange(null)
  }

  useEffect(() => {
    const stop = () => cancel()
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop()
    }
    window.addEventListener('blur', stop)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('blur', stop)
      window.removeEventListener('keydown', escape)
    }
  }, [])

  const finish = async () => {
    const selection = drag.current
    const snapshot = origin.current
    cancel()
    if (!selection || !snapshot || selection.bottom <= selection.row || pending.current) return
    if (latest.current.disabled || latest.current.rows !== snapshot.rows
      || latest.current.columns !== snapshot.columns) return
    const column = snapshot.columns[selection.column]
    const source = snapshot.rows[selection.row]
    if (snapshot.disabled || !column || !source || !snapshot.isEditable(column, source)) return
    const targets = snapshot.rows.slice(selection.row + 1, selection.bottom + 1)
      .filter(row => snapshot.isEditable(column, row))
    if (!targets.length) return
    const value = selection.sourceValue === undefined
      ? snapshot.getValue(column, source)
      : selection.sourceValue
    pending.current = true
    try {
      const current = latest.current
      if (!current.disabled
        && current.rows === snapshot.rows && current.columns === snapshot.columns
        && current.isEditable(column, source)
        && targets.every(row => current.isEditable(column, row))) {
        await current.onCopy(column, targets, value)
      }
    } finally {
      pending.current = false
    }
  }

  const getHandleProps = (row: number, column: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.button !== 0 || options.disabled || pending.current) return
      const source = options.rows[row]
      const field = options.columns[column]
      if (!source || !field || !options.isEditable(field, source)) return
      const next = { row, column, bottom: row }
      origin.current = options
      drag.current = next
      setRange(next)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      if (!drag.current) return
      const cell = document.elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-copy-down-row]')
      const table = event.currentTarget.closest('table')
      if (!cell || cell.closest('table') !== table) return
      const bottom = Number(cell.dataset.copyDownRow)
      if (!Number.isInteger(bottom)) return
      const next = { ...drag.current, bottom: Math.max(drag.current.row, bottom) }
      drag.current = next
      setRange(next)
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      void finish()
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onClick: (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation(),
  })

  return {
    copyToBottom: (row: number, column: number, sourceValue?: unknown) => {
      if (pending.current || options.disabled) return
      origin.current = options
      drag.current = { row, column, bottom: options.rows.length - 1, sourceValue }
      void finish()
    },
    getHandleProps,
    isCopyTarget: (row: number, column: number) => Boolean(range
      && column === range.column && row > range.row && row <= range.bottom),
  }
}
