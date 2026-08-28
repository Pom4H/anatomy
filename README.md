# Anatomy

Editorial engineering publication about open-source systems: architecture, protocols, invariants and the real code behind them.

The first issue is a technical article about [`Pom4H/hardware-wallet`](https://github.com/Pom4H/hardware-wallet):

> **Hardware Wallet: кошелёк, который не доверяет компьютеру**

## Stack

- Astro `7.2.9`;
- typed Astro content collection;
- static output for GitHub Pages;
- zero framework JavaScript;
- a tiny inline script only for reading progress;
- local SVG figures and 1200×630 PNG Open Graph images;
- no remote fonts, trackers or third-party runtime dependencies.

## Local development

Astro 7 requires Node `22.12.0` or newer.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

The site is configured for:

```text
https://pom4h.github.io/anatomy/
```

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` installs dependencies, builds the static Astro site, uploads a Pages artifact and deploys it.

After the first push, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source. Every push to `main` will then publish the site.

## SEO

Each article provides:

- canonical URL;
- Open Graph and Twitter metadata;
- 1200×630 PNG social image;
- `TechArticle` JSON-LD;
- published and modified dates;
- author and source repository;
- semantic heading hierarchy and generated table of contents;
- XML sitemap;
- `robots.txt`;
- RSS feed;
- accessible figure descriptions;
- print stylesheet.

## Content structure

```text
src/content/articles/       Markdown source
src/content.config.ts       typed article schema
src/pages/[id].astro        static article route
src/layouts/                document and article layouts
src/components/             SEO, navigation and table of contents
src/styles/global.css       editorial design system
public/figures/             source-backed SVG diagrams
public/og/                  social images
```

## Source snapshot

The first article is based on:

- `Pom4H/hardware-wallet@af1f103b0d7404178ab64b0f717f1af188bdd5fe`;
- `Pom4H/chain-sandbox` as the local-chain CI dependency.

The article preserves the experimental-status warning and does not claim that a concrete MCU or secure-element implementation has been finalized.

## Licenses

Site code and original visual assets: MIT. Article text: CC BY 4.0 unless noted otherwise.
