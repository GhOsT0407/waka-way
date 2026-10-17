import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * The public address of the site, used for the canonical link, social previews,
 * robots.txt and sitemap.xml.
 *
 * SITE_URL wins when set. Otherwise Vercel's own production domain is used —
 * VERCEL_PROJECT_PRODUCTION_URL is set automatically on every Vercel build and
 * switches to a custom domain (wakaway.ng, say) as soon as one is attached, so
 * moving domains needs no code change. Local builds fall back to localhost.
 */
function siteUrl(env: Record<string, string>): string {
  const explicit = env.SITE_URL || process.env.SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:5173';
}

/** Pages to list in sitemap.xml. The web shell is one page today. */
const PAGES = ['/'];

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * Everything Google and link previews need, generated at build time from the
 * site URL above: SEO tags in <head>, plus robots.txt and sitemap.xml in dist/.
 */
function seo(site: string, googleVerification: string): Plugin {
  return {
    name: 'wakaway-seo',
    transformIndexHtml(html) {
      const tags = [
        `<link rel="canonical" href="${site}/" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="WakaWay" />`,
        `<meta property="og:locale" content="en_NG" />`,
        `<meta property="og:url" content="${site}/" />`,
        `<meta property="og:title" content="WakaWay — Move Smart. Move Local." />`,
        `<meta property="og:description" content="How to move around Lagos by danfo, BRT, keke and rail — where to board, what to tell the conductor, and what it should cost." />`,
        `<meta property="og:image" content="${site}/icon.png" />`,
        `<meta name="twitter:card" content="summary" />`,
        `<link rel="apple-touch-icon" href="/icon.png" />`,
      ];
      if (googleVerification) {
        tags.push(`<meta name="google-site-verification" content="${escapeAttr(googleVerification)}" />`);
      }
      return html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
    },
    generateBundle() {
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
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          PAGES.map((p) => `  <url><loc>${site}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
          `\n</urlset>\n`,
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
  // convention covers both shells. The empty prefix also exposes SITE_URL and
  // GOOGLE_SITE_VERIFICATION to this config file (never to the bundle).
  const env = loadEnv(mode, here('.'), '');

  return {
    plugins: [react(), seo(siteUrl(env), env.GOOGLE_SITE_VERIFICATION ?? '')],

    // Engine files live under ../client, whose tsconfig extends
    // expo/tsconfig.base. That package only exists when the Expo app's
    // node_modules are installed, which a web-only build (Vercel) never does.
    // Handing esbuild its settings directly stops it looking for that file.
    esbuild: {
      tsconfigRaw: JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          jsx: 'react-jsx',
          useDefineForClassFields: true,
          verbatimModuleSyntax: false,
        },
      }),
    },

    resolve: {
      alias: {
        '@engine': here('../client/src'),

        // The engine's only native dependency. AsyncStorage's surface is
        // async get/set/remove over string keys — localStorage with promises
        // around it is a faithful stand-in.
        '@react-native-async-storage/async-storage': here('./src/shims/async-storage.ts'),

        // Browsers have had a working URL for years; the RN polyfill is a
        // no-op here and would drag in React Native internals if left alone.
        'react-native-url-polyfill/auto': here('./src/shims/empty.ts'),
      },
      // Engine files import packages (supabase-js, react) that must resolve to
      // this project's node_modules, not ../client's — which isn't installed
      // on a web-only build.
      dedupe: ['@supabase/supabase-js', 'react', 'react-dom'],
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
