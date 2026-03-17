import * as React from "react"

export function BracketCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="font-mono text-lg select-none flex"
    >
      {checked ? <>[<div className="w-2.5">✓</div>]</> :<>[<div className="w-2.5"> </div>]</> }
    </button>
  )
}