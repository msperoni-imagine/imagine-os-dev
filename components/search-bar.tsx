'use client'

import { Search } from 'lucide-react'

interface SearchBarProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ placeholder = 'Buscar...', value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border border-border bg-white py-1.5 pl-8 pr-3 text-xs font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-normal outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
      />
    </div>
  )
}
