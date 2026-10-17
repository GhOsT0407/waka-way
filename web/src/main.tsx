import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Admin from './Admin';
import './styles.css';

// "<site>/?admin" is the admin page. A query string rather than a path, so
// it works on any static host without rewrite rules, and stays clear of the
// sign-in code Supabase adds when the emailed link brings the admin back.
const isAdmin = new URLSearchParams(window.location.search).has('admin');

// The admin page has no business in search results. vercel.json also sends
// an X-Robots-Tag header for it; this covers any host that does not.
if (isAdmin) {
  const robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex, nofollow';
  document.head.appendChild(robots);
  document.title = 'WakaWay — Admin';
}

/**
 * No token publishing here.
 *
 * This shell deliberately uses the landing page's palette, not the Expo app's
 * WW_DARK — see the note at the top of styles.css. Importing WW_DARK and
 * writing it over the CSS variables would quietly undo that choice, so the
 * palette lives in one place: the stylesheet.
 */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </StrictMode>,
);
