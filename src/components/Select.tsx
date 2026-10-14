import * as RS from '@radix-ui/react-select'

export type SelectOption = { value: string; label: string }

/** Radix Select forbids an empty item value, so "" (e.g. "— not used —") travels as this placeholder. */
const NONE = '__none__'
const enc = (v: string) => (v === '' ? NONE : v)

type Props = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  label?: string
  className?: string
}

/** Replacement for the native <select>: same look as the other inputs, keyboard and screen-reader support from Radix. */
export default function Select({ value, onChange, options, label, className = '' }: Props) {
  return (
    <RS.Root value={enc(value)} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
      <RS.Trigger aria-label={label} className={`flex items-center justify-between gap-2 !px-2 !py-[5px] text-left font-normal ${className}`}>
        <RS.Value />
        <RS.Icon className="text-[11px] text-muted" aria-hidden>
          ▾
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content position="popper" sideOffset={4} collisionPadding={8} className="z-[80] min-w-(--radix-select-trigger-width) overflow-hidden rounded-lg border border-line bg-card text-ink shadow-xl">
          <RS.Viewport className="max-h-(--radix-select-content-available-height) p-1">
            {options.map((o) => (
              <RS.Item key={o.value} value={enc(o.value)} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none select-none data-[highlighted]:bg-accent/20 data-[state=checked]:font-semibold">
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator className="ml-auto text-accent">✓</RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  )
}
