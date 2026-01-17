import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'
import { ChevronDown } from 'lucide-react'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-xs text-text-secondary">{label}</label>
        )}
        <div className="relative">
          <select
            className={cn(
              'w-full h-9 px-3 pr-8 bg-surface border border-border rounded-md text-sm text-text-primary appearance-none cursor-pointer hover:border-border-hover focus:outline-none focus:border-accent',
              className
            )}
            ref={ref}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
        </div>
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
