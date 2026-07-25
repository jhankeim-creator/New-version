import { Link } from 'react-router-dom';

/**
 * Kayee01 brand logo.
 * - `variant`: "dark" (for light backgrounds) or "light" (for dark backgrounds)
 * - `showText`: render the wordmark next to the emblem
 * - `withTagline`: render the small tagline under the wordmark
 */
const Logo = ({ variant = 'dark', showText = true, withTagline = false, className = '', size = 40, to = '/' }) => {
  const wordInk = variant === 'light' ? '#ffffff' : '#14110f';
  const tagInk = variant === 'light' ? 'rgba(255,255,255,0.65)' : '#a9832f';

  const emblem = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="kayeeGold" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e6cf8b" />
          <stop offset="0.5" stopColor="#c9a24b" />
          <stop offset="1" stopColor="#a9832f" />
        </linearGradient>
      </defs>
      {/* Diamond crest */}
      <rect
        x="32" y="2"
        width="42.4" height="42.4"
        rx="9"
        transform="rotate(45 32 2)"
        fill="url(#kayeeGold)"
      />
      <rect
        x="32" y="8.5"
        width="33.2" height="33.2"
        rx="7"
        transform="rotate(45 32 8.5)"
        fill="none"
        stroke="rgba(20,17,15,0.28)"
        strokeWidth="1.2"
      />
      {/* Monogram K */}
      <text
        x="32" y="40"
        textAnchor="middle"
        fontFamily="'Playfair Display', Georgia, serif"
        fontSize="30"
        fontWeight="700"
        fill="#14110f"
      >
        K
      </text>
    </svg>
  );

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {emblem}
      {showText && (
        <span className="flex flex-col leading-none">
          <span
            className="font-serif font-bold tracking-tight"
            style={{ fontSize: size * 0.55, color: wordInk, fontFamily: "'Playfair Display', serif" }}
          >
            Kayee<span style={{ color: '#c9a24b' }}>01</span>
          </span>
          {withTagline && (
            <span
              className="uppercase font-semibold mt-1"
              style={{ fontSize: size * 0.19, letterSpacing: '0.34em', color: tagInk }}
            >
              Luxury · Fashion
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (to === null) return content;
  return (
    <Link to={to} className="inline-flex items-center" aria-label="Kayee01 home">
      {content}
    </Link>
  );
};

export default Logo;
