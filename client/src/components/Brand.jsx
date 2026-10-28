import { Link } from 'react-router-dom';

export default function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Droply home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none">
          <path d="M18 3.5C14.3 9 7 15.4 7 22.1a11 11 0 0 0 22 0C29 15.4 21.7 9 18 3.5Z" fill="currentColor" />
          <path d="M13.2 23.2c.4 2.4 2.2 4 4.7 4.4" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="25.5" cy="12.5" r="3" fill="#9F8BFF" />
        </svg>
      </span>
      <span>droply</span>
    </Link>
  );
}
