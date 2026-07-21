import { useState } from 'react'
import { addDays, todayLocal } from '../lib/dates'
import { Sheet } from './Sheet'
import { primaryBtn, secondaryBtn } from './ui'

export function BackdateSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (doneOn: string) => void
}) {
  const today = todayLocal()
  const [custom, setCustom] = useState('')

  const options = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: addDays(today, -1) },
    { label: '2 days ago', value: addDays(today, -2) },
    { label: '3 days ago', value: addDays(today, -3) },
  ]

  function pick(v: string) {
    onPick(v)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="When did you do it?">
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <button key={o.value} className={secondaryBtn} onClick={() => pick(o.value)}>
            {o.label}
          </button>
        ))}
        <div className="mt-1 flex gap-2">
          <input
            type="date"
            max={today}
            className="h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 dark:border-stone-700 dark:bg-stone-900"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            className={primaryBtn}
            disabled={!custom || custom > today}
            onClick={() => pick(custom)}
          >
            Log
          </button>
        </div>
      </div>
    </Sheet>
  )
}
