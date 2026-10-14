/** A cat's paw (four toes and a pad), drawn in the current text colour. */
export default function PawIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <ellipse cx="4.6" cy="11.2" rx="2.1" ry="2.7" transform="rotate(-18 4.6 11.2)" />
      <ellipse cx="9.2" cy="6.2" rx="2.2" ry="3" transform="rotate(-6 9.2 6.2)" />
      <ellipse cx="14.8" cy="6.2" rx="2.2" ry="3" transform="rotate(6 14.8 6.2)" />
      <ellipse cx="19.4" cy="11.2" rx="2.1" ry="2.7" transform="rotate(18 19.4 11.2)" />
      <path d="M12 11.4c-3.3 0-6.6 3.1-6.6 5.9 0 1.9 1.4 3.1 3.1 3.1 1 0 1.9-.5 3.5-.5s2.5.5 3.5.5c1.7 0 3.1-1.2 3.1-3.1 0-2.8-3.3-5.9-6.6-5.9z" />
    </svg>
  )
}
