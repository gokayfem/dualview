import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-accent text-white hover:bg-accent-hover active:scale-[0.98]': variant === 'default',
            'bg-surface text-text-primary hover:bg-surface-hover active:scale-[0.98]': variant === 'secondary',
            'hover:bg-surface hover:text-text-primary active:bg-surface-alt': variant === 'ghost',
            'border border-border bg-transparent hover:bg-surface hover:border-border-hover active:scale-[0.98]': variant === 'outline',
            'bg-error text-white hover:bg-error/90 active:scale-[0.98]': variant === 'destructive',
          },
          {
            'h-9 px-4 py-2': size === 'default',
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-8': size === 'lg',
            'h-9 w-9': size === 'icon',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
