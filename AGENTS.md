# Instructions for coding agents

1. Read `DESIGN.md` before changing layout or visual assets.
2. Treat article claims as source-backed facts. Preserve `sourceCommit` and update it only after re-checking the linked project.
3. Never remove the experimental warning from security-sensitive projects unless the source repository status changes explicitly.
4. Keep the site static and progressively enhanced. Do not add a client framework for presentation-only behavior.
5. Prefix internal URLs with `import.meta.env.BASE_URL`; GitHub Pages serves the project under `/anatomy/`.
6. Preserve canonical URLs, JSON-LD, Open Graph, sitemap, robots and RSS when adding routes.
7. Add future articles as typed entries in `src/content/articles/`.
8. Use publication figures, not generic card diagrams. SVGs must include `<title>` and `<desc>`.
9. Run `npm run build` before merging.
10. Keep valid HTML: Astro 7 uses the stricter Rust compiler.
