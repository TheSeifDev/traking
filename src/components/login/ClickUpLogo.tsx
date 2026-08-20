type ClickUpLogoProps = {
  className?: string;
  /** Must be unique when more than one mark is rendered on the page. */
  gradientId: string;
};

/**
 * Lightweight inline ClickUp mark.
 * Keeping it inline avoids another public asset and lets the logo scale cleanly.
 */
const ClickUpLogo = ({ className = "size-8", gradientId }: ClickUpLogoProps) => (
  <svg
    aria-hidden="true"
    className={className}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7.3 34.2 13 29.85c3.02 3.97 6.25 5.77 10.02 5.77 3.75 0 6.9-1.77 9.93-5.69l5.7 4.38C34.58 39.6 29.32 42.6 23.02 42.6c-6.33 0-11.62-3.02-15.72-8.4Z"
      fill={`url(#${gradientId}-base)`}
    />
    <path
      d="m23 11.35-10.12 8.72-4.7-5.45L23.04 1.8l14.78 12.84-4.73 5.43L23 11.35Z"
      fill={`url(#${gradientId}-chevron)`}
    />
    <defs>
      <linearGradient id={`${gradientId}-base`} x1="7.3" y1="36.2" x2="38.65" y2="36.2" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6F42F5" />
        <stop offset="1" stopColor="#00C4FF" />
      </linearGradient>
      <linearGradient id={`${gradientId}-chevron`} x1="8.18" y1="10.94" x2="37.82" y2="10.94" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F32AC6" />
        <stop offset="1" stopColor="#FFB52D" />
      </linearGradient>
    </defs>
  </svg>
);

export default ClickUpLogo;