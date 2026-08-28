# Instructions for coding agents

1. Read `DESIGN.md` before changing layout or visual assets.
2. Write lessons in English unless a different language is explicitly requested.
3. Keep the lesson focused on the general topic. A Pom4H project may be used as a reference implementation near the end, but must not replace the explanation.
4. Every lesson needs learning goals, a minimal mental model, a complete data flow, trust boundaries, checkpoints, and a compact summary.
5. Distinguish stable domain facts from implementation-specific choices. Link primary specifications when exact behavior depends on a protocol.
6. Preserve experimental warnings for linked security-sensitive reference implementations.
7. Keep the site static and progressively enhanced. Do not add a client framework for presentation-only behavior.
8. Prefix internal URLs with `import.meta.env.BASE_URL` in Astro components; GitHub Pages serves the project under `/anatomy/`.
9. Preserve canonical URLs, learning-resource JSON-LD, Open Graph, sitemap, robots, and RSS when adding routes.
10. Add future lessons as typed entries in `src/content/articles/`.
11. Use explanatory publication figures, not generic card diagrams. SVGs must include `<title>` and `<desc>`.
12. Run `npm run build` before merging. Keep valid HTML: Astro 7 uses the stricter Rust compiler.
