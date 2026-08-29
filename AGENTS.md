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

## Interactive lab rules

21. Use the exact source project when a lesson embeds a functional twin or simulator. Pin it in `vendor/` as a Git submodule; do not paste a visually similar replacement into Anatomy.
22. Physical-device twins belong in `Pom4H/elements`. Anatomy may drive their public attributes, states, ports, and semantic parts, but must not fork their SVG implementation locally.
23. Circuit examples belong in `Pom4H/nodspice`. Build the pinned Rust/WASM application into `public/labs/` during CI rather than depending on an external deployment.
24. State clearly whether a circuit is a conceptual model, first-order equivalent, measured model, or production sign-off artifact. Never promote one evidence class into another through presentation.
25. Separate the exact current interface contract from choices that remain open. A reference display/button/USB contract is not a claim that the final MCU, secure element, PCB, or enclosure has been selected.
26. Every lab needs keyboard access, a meaningful fallback, source links, and a concise explanation of what the reader should change or observe.
27. A device labelled “emulated” must execute firmware in the declared emulator. A JavaScript state machine may be a fallback or fixture, but must never be presented as firmware execution.
28. Firmware-owned text and state must cross an explicit protocol boundary into the visual twin. Anatomy may decode and render frames; it must not invent the transaction-review outcome.
29. Physical controls must enter the emulator as GPIO or another documented hardware input. The visual twin must not call domain transitions directly.
30. When firmware state changes electrical load, drive the pinned NodeSpice circuit input and solve that model. Do not reproduce the voltage calculation in article JavaScript.
31. CI must execute the firmware artifact inside the same emulator engine shipped to the browser and assert at least one complete physical-input → domain-transition → display-frame path.
32. Treat the lesson as a modern-engineering stack: invariants, implementation, execution, physical interaction, simulation, and evidence should refer to the same source revisions.
