import { useEffect, useRef, useState } from 'react'

const OPTIONS = [
  { mode: 'category', label: 'SECTOR', to: '/custom/sector' },
  { mode: 'stock', label: 'STOCK', to: '/custom/stock' },
] as const

export default function ModeDropdown({ mode, onSelect }: {
  mode: 'category' | 'stock'
  onSelect: (path: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = OPTIONS.find(option => option.mode === mode) ?? OPTIONS[0]

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={rootRef} className="relative z-40 flex items-center font-roboto-latin">
      <button
        type="button"
        role="combobox"
        aria-label="커스텀 화면 선택"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen(open => !open)}
        className="inline-flex h-6 w-[7.5rem] shrink-0 items-center justify-between gap-1 rounded-lg border-0 bg-zinc-600 px-2 text-base font-semibold text-white transition-colors hover:bg-zinc-500"
      >
        <span className="min-w-0 flex-1 truncate text-left">{selected.label}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 w-[7.5rem] rounded-md bg-[#202020] p-2 text-sm text-white shadow-md">
          <div role="listbox" aria-label="커스텀 화면 목록">
            {OPTIONS.map(option => (
              <button
                key={option.mode}
                type="button"
                role="option"
                aria-selected={mode === option.mode}
                onClick={() => {
                  onSelect(option.to)
                  setIsOpen(false)
                }}
                className={`block w-full border-0 bg-transparent px-2.5 py-2 text-left ${mode === option.mode ? 'font-semibold text-[var(--accent)]' : 'text-gray-300 hover:text-white'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
