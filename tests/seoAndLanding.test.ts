// tests/seoAndLanding.test.ts
//
// Guards the landing-page lavender revamp + SEO asset alignment.
// These are file-content assertions (no DOM needed) so they lock in the
// marketing copy, structured data, theme colours and crawler rules that the
// new features depend on — and fail loudly if a later edit drops one.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relFromRoot: string): string =>
  readFileSync(fileURLToPath(new URL(relFromRoot, import.meta.url)), 'utf8');

const indexHtml = read('../index.html');
const authPage = read('../src/Auth/AuthPage.tsx');
const loginPage = read('../src/Auth/LoginPage.tsx');
const registerPage = read('../src/Auth/RegisterPage.tsx');
const viteConfig = read('../vite.config.ts');
const sitemap = read('../public/sitemap.xml');
const robots = read('../public/robots.txt');
const manifest = JSON.parse(read('../public/manifest.json'));

describe('landing page is a light lavender theme', () => {
  it('uses the lavender primary colour across the auth surfaces', () => {
    for (const page of [authPage, loginPage, registerPage]) {
      expect(page).toContain('#7c3aed'); // VIOLET
      expect(page).toContain('#6d28d9'); // VIOLET_DEEP
    }
  });

  it('no longer hardcodes the old dark emerald canvas', () => {
    for (const page of [authPage, loginPage, registerPage]) {
      expect(page).not.toContain('#020b18'); // old dark background
      expect(page).not.toContain('#10b981'); // old emerald accent
    }
  });

  it('advertises the newer linked/auto-sync features, not just the old set', () => {
    const labels = [
      'Bond Interest Auto-Sync',
      'Upcoming Bills',
      'Receivables',
      'AI Financial Coach',
      'Goal-Linked',
    ];
    for (const label of labels) {
      expect(authPage).toContain(label);
    }
  });

  it('exposes crawler-facing nav + legal links in the footer', () => {
    expect(authPage).toContain("href='/privacy'");
    expect(authPage).toContain("href='/terms'");
    expect(authPage).toContain("href='/contact'");
  });
});

describe('index.html SEO reflects the updated feature set', () => {
  it('pins the browser chrome to the lavender theme colour', () => {
    expect(indexHtml).toMatch(
      /<meta name="theme-color" content="#f6f1fe" \/,?/i,
    );
  });

  it('keeps a single canonical + Open Graph URL on the deployed domain', () => {
    expect(indexHtml).toContain(
      '<link rel="canonical" href="https://fintrackly.web.app/" />',
    );
    expect(indexHtml).toContain(
      '<meta property="og:url" content="https://fintrackly.web.app/" />',
    );
  });

  it('mentions the new capabilities in the meta description', () => {
    const desc = /<meta name="description"\s+content="([^"]+)"/i.exec(indexHtml);
    expect(desc).not.toBeNull();
    const text = desc![1].toLowerCase();
    for (const needle of ['bond', 'receivable', 'ai financial coach']) {
      expect(text).toContain(needle);
    }
  });

  it('lists the new modules in the SoftwareApplication featureList JSON-LD', () => {
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    const blocks = [...indexHtml.matchAll(ld)].map((m) => m[1]);
    const app = blocks.find((b) => b.includes('SoftwareApplication'));
    expect(app).toBeDefined();
    const parsed = JSON.parse(app!);
    const joined = (parsed.featureList as string[]).join(' ').toLowerCase();
    for (const needle of [
      'auto-synced interest',
      'receivables',
      'payment reminders',
      'ai-powered financial coach',
    ]) {
      expect(joined).toContain(needle);
    }
  });

  it('keeps the SPA-fallback crawlable body aligned with the feature list', () => {
    const crawl = indexHtml.toLowerCase();
    expect(crawl).toContain('bond &amp; fixed deposit tracker');
    expect(crawl).toContain('receivables / lending tracker');
    expect(crawl).toContain('ai-powered financial coach');
  });
});

describe('PWA manifest stays lavender in both sources', () => {
  it('public/manifest.json uses lavender brand colours', () => {
    expect(manifest.theme_color).toBe('#7c3aed');
    expect(manifest.background_color).toBe('#f6f1fe');
  });

  it('vite-plugin-pwa manifest matches (build output wins over public)', () => {
    expect(viteConfig).toContain("theme_color: '#7c3aed'");
    expect(viteConfig).toContain("background_color: '#f6f1fe'");
  });
});

describe('sitemap + robots cover the real public/crawl surface', () => {
  const publicUrls = [
    'https://fintrackly.web.app/',
    'https://fintrackly.web.app/privacy',
    'https://fintrackly.web.app/terms',
    'https://fintrackly.web.app/contact',
  ];

  it('lists every public page and nothing behind auth', () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const url of publicUrls) expect(locs).toContain(url);
    // Auth-gated routes render the landing page for crawlers → must stay out.
    for (const bad of ['/dashboard', '/wealth', '/cashflow']) {
      expect(locs).not.toContain(`https://fintrackly.web.app${bad}`);
    }
  });

  it('every entry has a valid ISO lastmod date', () => {
    const dates = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(
      (m) => m[1],
    );
    expect(dates.length).toBeGreaterThanOrEqual(publicUrls.length);
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('robots allows the public pages and blocks the app routes', () => {
    expect(robots).toContain('Allow: /contact');
    expect(robots).toContain('Disallow: /wealth');
    expect(robots).toContain('Disallow: /essentials');
    expect(robots).toContain(
      'Sitemap: https://fintrackly.web.app/sitemap.xml',
    );
    // Legal/contact pages must never be disallowed.
    expect(robots).not.toMatch(/^Disallow: \/privacy/m);
    expect(robots).not.toMatch(/^Disallow: \/terms/m);
    expect(robots).not.toMatch(/^Disallow: \/contact/m);
  });
});
