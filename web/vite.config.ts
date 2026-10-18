import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * The site's public address, for the sitemap, robots.txt and the canonical
 * link. SITE_URL wins (set it once there is a custom domain); on Vercel the
 * production address is provided automatically; a local build gets the
 * preview address. No placeholder for anyone to forget to edit.
 */
function siteUrl(): string {
  const explicit = process.env.SITE_URL?.replace(/\/+$/, '');
  if (explicit) return explicit;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:4173';
}

/**
 * robots.txt, sitemap.xml and the canonical/Open Graph address, written at
 * build time with the real site address. The admin page is kept out of
 * search separately: an X-Robots-Tag header (vercel.json) and a noindex tag
 * (main.tsx), so it is never crawled into results.
 */
function seoFiles(): Plugin {
  return {
    name: 'wakaway-seo-files',
    apply: 'build',
    transformIndexHtml(html) {
      const site = siteUrl();
      return html
        .replace('</head>', `    <link rel="canonical" href="${site}/" />\n    <meta property="og:url" content="${site}/" />\n  </head>`);
    },
    generateBundle() {
      const site = siteUrl();
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n'
          + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + `  <url>\n    <loc>${site}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`
          + '</urlset>\n',
      });
    },
  };
}

/**
 * The web shell reads the engine out of ../client/src — it never writes there.
 * Everything the Expo app owns stays the Expo app's: same files, same build,
 * same tests. Three aliases are all it takes to make those files run in a
 * browser, because the engine itself is plain TypeScript.
 */
export default defineConfig(({ mode }) => {
  // Deliberately the same variable names the Expo app uses, so one .env
  // convention covers both shells.
  const env = loadEnv(mode, here('.'), 'EXPO_PUBLIC_');

  return {
    plugins: [react(), seoFiles()],

    // MapLibre starts its worker as an ES module; build it as one.
    worker: { format: 'es' },

    resolve: {
      // Order matters: the specific supabase entries must win over '@engine'.
      alias: [
        // The app's Supabase client is built for a phone and cannot accept a
        // sign-in link that returns as a URL. Every import of it — ours and
        // the engine's relative "../lib/supabase" — gets the browser client.
        { find: '@engine/lib/supabase', replacement: here('./src/supabase.ts') },
        { find: /^(\.\.\/)+lib\/supabase$/, replacement: here('./src/supabase.ts') },

        { find: '@engine', replacement: here('../client/src') },

        // The engine's only native dependency. AsyncStorage's surface is
        // async get/set/remove over string keys — localStorage with promises
        // around it is a faithful stand-in.
        { find: '@react-native-async-storage/async-storage', replacement: here('./src/shims/async-storage.ts') },

        // Browsers have had a working URL for years; the RN polyfill is a
        // no-op here and would drag in React Native internals if left alone.
        { find: 'react-native-url-polyfill/auto', replacement: here('./src/shims/empty.ts') },
      ],
    },

    // The engine lives outside this project's root, so Vite needs permission
    // to serve it during dev.
    server: {
      fs: { allow: [here('.'), here('../client')] },
    },

    // The shared files read process.env directly, the way Expo exposes config.
    define: {
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(env.EXPO_PUBLIC_SUPABASE_URL ?? ''),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''),
      'process.env.EXPO_PUBLIC_MAPTILER_KEY': JSON.stringify(env.EXPO_PUBLIC_MAPTILER_KEY ?? ''),
    },
  };
});
