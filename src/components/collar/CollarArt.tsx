/** The collar as drawn in the approved mockups: a pine strap and the Pi's case with a blinking light. */
export default function CollarArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 104" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="collar-art-case" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2d3833" />
          <stop offset="1" stopColor="#151b18" />
        </linearGradient>
      </defs>
      <rect x="10" y="40" width="280" height="30" rx="15" fill="#1f5c47" />
      <path d="M26 47.5H274M26 62.5H274" stroke="#3b8467" strokeWidth="1.4" strokeDasharray="5 4" />
      <rect x="26" y="35" width="26" height="40" rx="7" fill="none" stroke="#b9c3bd" strokeWidth="4" />
      <circle cx="258" cy="55" r="3.4" fill="#153f2f" />
      <circle cx="240" cy="55" r="3.4" fill="#153f2f" />
      <circle cx="222" cy="55" r="3.4" fill="#153f2f" />
      <rect x="100" y="18" width="104" height="72" rx="18" fill="url(#collar-art-case)" />
      <rect x="100.5" y="18.5" width="103" height="71" rx="17.5" fill="none" stroke="#3a4741" />
      <g transform="translate(137 33) scale(0.25)">
        <rect x="6" y="6" width="108" height="108" rx="26" fill="#131a17" />
        <circle cx="54" cy="44" r="19" fill="#1f5c47" />
        <circle cx="54" cy="77" r="21" fill="#1f5c47" />
        <rect x="32" y="27" width="16" height="66" rx="5" fill="#153f2f" />
        <circle cx="48" cy="60" r="6" fill="#dc9a35" />
      </g>
      <circle cx="186" cy="31" r="3.4" fill="#3fd18a" className="animate-pulse" />
      <text x="152" y="80" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7.5" fontWeight="700" letterSpacing="1.6" fill="#8fa39a">
        GPS · WIFI · BLE
      </text>
    </svg>
  );
}
