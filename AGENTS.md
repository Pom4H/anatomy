# Instructions for coding agents

1. Read `DESIGN.md` before changing layout or visual assets.
2. Write lessons in English unless a different language is explicitly requested.
3. Keep the lesson focused on the general topic. A Pom4H project may be used as a reference implementation near the end, but must not replace the explanation.
4. Every lesson needs learning goals, a minimal mental model, a complete data flow, trust boundaries, checkpoints, and a compact summary.
5. Distinguish stable domain facts from implementation-specific choices. Link primary specifications when exact behavior depends on a protocol.
6. Preserve experimental warnings for linked security-sensitive reference implementations.
7. Keep the site static and progressively enhanced. Do not add a client framework for presentation-only behavior.
8. Prefix internal URLs with `import.meta.env.BASE_URL` in Astro components; Markdown assets may use the established `/anatomy/` base.
9. Preserve canonical URLs, learning-resource JSON-LD, Open Graph, sitemap, robots, and RSS when adding routes.
10. Add future lessons as typed entries in `src/content/articles/`.
11. Use explanatory publication figures, not generic card diagrams. SVG fallbacks must include `<title>` and `<desc>`.
12. Run `npm run motion:check`, `npm run motion:gifs`, and `npm run build` before merging motion changes.

## Motion rules

13. Default to **one short loop per concept**, placed beside the paragraph it explains. Do not replace a lesson with one long player unless explicitly requested.
14. A loop should normally last 4–8 seconds, work without audio, and repeat indefinitely without an obvious discontinuity.
15. Motion must explain causality. Use reveal, focus, draw-path, flow, transform, compare, and reject. Decorative movement is not a teaching primitive.
16. Keep geometry stable. Move the payload or highlight the active relationship instead of moving the camera.
17. At most two objects should move at once. Leave a comprehension hold after every semantic change.
18. Every animated figure needs a static SVG source selected through `prefers-reduced-motion`.
19. Render GIFs from Remotion source at 960×540 and a practical frame rate. Keep page weight low enough for several loops in one lesson.
20. The first and last visible states must match, or moving elements must fade before the loop boundary so the reset is invisible.
