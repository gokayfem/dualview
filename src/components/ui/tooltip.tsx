import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface TooltipProps {
  children: ReactNode
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-2 py-1 text-xs bg-surface-alt border border-border text-text-primary shadow-lg whitespace-nowrap animate-in fade-in-0 zoom-in-95 duration-100',
            {
              'bottom-full left-1/2 -translate-x-1/2 mb-2': side === 'top',
              'top-full left-1/2 -translate-x-1/2 mt-2': side === 'bottom',
              'right-full top-1/2 -translate-y-1/2 mr-2': side === 'left',
              'left-full top-1/2 -translate-y-1/2 ml-2': side === 'right',
            }
          )}
        >
          {content}
          {/* Tooltip arrow */}
          <div className={cn(
            'absolute w-2 h-2 bg-surface-alt border-border rotate-45',
            {
              'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-r border-b': side === 'top',
              'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l border-t': side === 'bottom',
              'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 border-t border-r': side === 'left',
              'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 border-b border-l': side === 'right',
            }
          )} />
        </div>
      )}
    </div>
  )
}
