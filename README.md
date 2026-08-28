# Anatomy

A visual learning library about how software, hardware, protocols, and security boundaries work.

The first lesson is:

> **How Software and Hardware Wallets Work**

It explains the topic from first principles—keys, addresses, deterministic recovery, transaction construction, signing, trusted review, broadcasting, and the different trust boundaries of software and hardware wallets. The open-source [`Pom4H/hardware-wallet`](https://github.com/Pom4H/hardware-wallet) project appears at the end as a reference implementation, not as the subject of the lesson.

## Stack

- Astro `7.2.9`;
- typed Astro content collections;
- static output for GitHub Pages;
- short Remotion compositions rendered as infinitely looping GIFs;
- static SVG fallbacks for `prefers-reduced-motion`;
- 1200×630 PNG Open Graph images;
- no remote fonts, client framework, or trackers.

## Local development

Astro 7 requires Node `22.12.0` or newer.

```bash
npm install
npm run motion:gifs
npm run dev
```

Production build:

```bash
npm run motion:check
npm run motion:gifs
npm run build
npm run preview
```

The site is configured for:

```text
https://pom4h.github.io/anatomy/
```

## GitHub Pages

The workflow in `.github/workflows/deploy.yml` validates the Remotion compositions, renders the looped GIF assets, builds the static Astro site, uploads a Pages artifact, and deploys it on every push to `main`.

## Lesson format

Each lesson should:

1. state clear learning goals;
2. establish the shortest useful mental model;
3. introduce the minimum vocabulary;
4. trace one complete data flow;
5. locate trust and security boundaries;
6. compare common implementations;
7. include checkpoints and a compact summary;
8. link to real code only after the general concept is understood.

## SEO and accessibility

Each lesson provides:

- canonical URL;
- Open Graph and Twitter metadata;
- 1200×630 social image;
- `TechArticle` + `LearningResource` JSON-LD;
- educational level and explicit learning outcomes;
- published and modified dates;
- semantic heading hierarchy and generated table of contents;
- XML sitemap, `robots.txt`, and RSS;
- descriptive figure alternatives and static reduced-motion sources;
- print stylesheet.

## Content structure

```text
src/content/articles/       Markdown lesson sources
src/content.config.ts       typed learning-resource schema
src/pages/[id].astro        static lesson route
src/layouts/                document and lesson layouts
src/components/             SEO, navigation, and table of contents
src/styles/global.css       editorial learning design system
src/styles/motion.css       looped-infographic layout
src/motion/loops.tsx        short causal Remotion compositions
scripts/render-gifs.mjs     deterministic GIF renderer
public/figures/             static SVG fallbacks
public/generated/wallets/   generated loop assets during build
public/og/                  social images
```

## Motion design system

Anatomy uses **small, silent, self-contained loops**, not one long explainer player. Each GIF explains one mechanism next to the relevant text:

- wallet authority versus ledger state;
- keys, addresses, and signatures;
- deterministic recovery;
- software-wallet signing;
- hardware-wallet signing;
- trusted-display mismatch rejection.

The GIFs are rendered at 960×540. Their source compositions run at 20 FPS and the exporter keeps every second frame, producing compact 10 FPS loops. Omitting `numberOfGifLoops` makes the GIF repeat indefinitely.

Commands:

```bash
npm run motion:studio  # inspect each short loop in Remotion Studio
npm run motion:check   # bundle and list all compositions
npm run motion:gifs    # render all infinitely looping GIF assets
```

## Licenses

Site code and original visual assets: MIT. Lesson text: CC BY 4.0 unless noted otherwise.
