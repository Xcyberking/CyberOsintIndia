export default function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="cxg" x1="8" y1="4" x2="56" y2="60">
          <stop stopColor="#27c8ff" />
          <stop offset="1" stopColor="#0b4fe0" />
        </linearGradient>
      </defs>
      <path d="M32 3 56 14v18c0 14-10 25-24 29C18 57 8 46 8 32V14L32 3Z" fill="#071a3d" stroke="url(#cxg)" strokeWidth="3" />
      <path d="M32 14c-9 0-15 7-15 16 0 6 3 11 8 14l7 4 7-4c5-3 8-8 8-14 0-9-6-16-15-16Z" fill="#0b2a63" />
      <path d="M32 20c-6 0-10 4-10 10 0 4 2 7 5 9h10c3-2 5-5 5-9 0-6-4-10-10-10Z" fill="#050d22" />
      <ellipse cx="27" cy="30" rx="3" ry="1.8" fill="#27c8ff" />
      <ellipse cx="37" cy="30" rx="3" ry="1.8" fill="#27c8ff" />
    </svg>
  );
}
