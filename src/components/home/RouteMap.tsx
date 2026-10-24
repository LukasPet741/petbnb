/**
 * A walk drawn as a little map: streets, two parks, and the route with the dog at its end.
 * The landing page's picture of the GPS collar (hero card and the "why" bento). An
 * illustration, never a real place or a real walk, and coloured by the --map-* tokens so it
 * reads as a map in both themes. Sliced to fill whatever box it is given.
 */
export default function RouteMap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="420" height="220" className="fill-[var(--map-bg)]" />
      <g fill="none" strokeLinecap="round" className="stroke-[var(--map-road)]">
        <path d="M-20 58C90 38 150 108 260 88S400 38 450 58" strokeWidth="12" />
        <path d="M70 -20L120 260" strokeWidth="10" />
        <path d="M260 -20C240 70 320 130 300 260" strokeWidth="8" />
        <path d="M-20 186C80 166 200 196 450 156" strokeWidth="7" />
      </g>
      <ellipse cx="350" cy="148" rx="70" ry="42" className="fill-[var(--map-park)]" />
      <ellipse cx="150" cy="148" rx="46" ry="26" className="fill-[var(--map-park)]" />
      <path
        d="M48 166C90 138 104 102 156 98S222 128 258 110S300 74 332 118S360 148 372 138"
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-[var(--map-route)]"
      />
      <circle cx="48" cy="166" r="6" className="fill-[var(--map-route)]" />
      <circle cx="372" cy="138" r="11" strokeWidth="4" className="fill-amber stroke-surface" />
    </svg>
  );
}
