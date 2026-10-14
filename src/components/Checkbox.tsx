import * as RC from '@radix-ui/react-checkbox'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  className?: string
}

/**
 * Replacement for <input type="checkbox"> (Radix renders a button with role=checkbox). The global `button`
 * rules are unlayered, so the box overrides them with important utilities.
 */
export default function Checkbox({ checked, onChange, disabled, label, className = '' }: Props) {
  return (
    <RC.Root
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={(c) => onChange(c === true)}
      className={`inline-flex !h-4 !w-4 shrink-0 items-center justify-center !rounded-[4px] !p-0 align-middle data-[state=checked]:!border-accent-fill data-[state=checked]:!bg-accent-fill ${className}`}
    >
      <RC.Indicator className="text-[11px] leading-none font-bold text-white">✓</RC.Indicator>
    </RC.Root>
  )
}
