import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

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
    <App />
  </StrictMode>,
);
