# Anatomy

Engineering stories about how Pom4H open-source systems actually work.

The first issue dissects [`Pom4H/hardware-wallet`](https://github.com/Pom4H/hardware-wallet): trust boundaries, deterministic domain logic, chain adapters and real local protocol verification.

## Stack

- Astro 7;
- static HTML/CSS/SVG;
- GitHub Pages;
- no client-side JavaScript;
- canonical metadata, Open Graph, JSON-LD, sitemap and robots.

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

The Astro project uses `base: /anatomy` for the project Pages URL:

`https://pom4h.github.io/anatomy/`

## Content sources

The Hardware Wallet article is pinned to:

- `Pom4H/hardware-wallet@af1f103b0d7404178ab64b0f717f1af188bdd5fe`
- `Pom4H/chain-sandbox@fd34c73ddfb1509bd5c09020c6140918733cde0f`

## License

MIT.
