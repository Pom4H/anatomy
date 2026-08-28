# Anatomy design direction

## Editorial Technical / Swiss × Visual Explainer

Anatomy is a visual textbook, not a product landing page and not a project changelog.

### Defaults

- light, warm paper canvas;
- near-black typography;
- one semantic accent per lesson;
- oversized headlines as the primary visual object;
- asymmetry built on a strict grid;
- thin rules, direct labels, numbered stages, and figure captions;
- system fonts and no render-blocking font requests;
- explanatory diagrams before decorative illustration;
- motion only when it exposes a mechanism.

### Lesson rhythm

A lesson should visually alternate between:

1. mental model;
2. vocabulary;
3. short causal loop;
4. step-by-step flow;
5. comparison;
6. security boundary;
7. checkpoint;
8. summary.

The reader should always know what is being explained, which data moves, and which component is trusted.

### Avoid

- card soup;
- universal 16px rounded rectangles;
- dark “developer” background by default;
- cyan/purple AI gradients;
- fake terminal output;
- stock crypto coins and padlock imagery;
- decorative motion without causal meaning;
- one long autoplay explainer where several focused loops would teach better;
- opening with the implementation before the concept;
- claims not supported by primary specifications or inspected source code.

### Article layout

The learning column stays narrow. Animated and static figures may break into the wider grid. Learning goals, checkpoints, and summaries are structurally distinct but should not look like SaaS cards. Each section should have one dominant teaching gesture.

### Mobile

Mobile is recomposed, not merely compressed. Side navigation becomes a disclosure, metadata becomes two columns, figures become full-width, and tables remain horizontally understandable.

## Loop grammar

An Anatomy loop is a compact visual sentence. It should be readable in one pass and useful after repeated viewing.

- `Reveal` introduces a concept only when it becomes necessary.
- `Focus` lowers unrelated contrast and directs attention.
- `DrawPath` makes a newly active relationship explicit.
- `Flow` moves data or authority between trust zones.
- `Transform` changes one object while preserving its identity.
- `Compare` holds geometry stable while one boundary or behavior changes.
- `Reject` visibly stops an invalid or unsafe path.

Use 4–8 second silent loops. Start with a stable composition, animate one mechanism, briefly hold the result, then return invisibly to the starting state. A loop should not require transport controls, narration, or a previous scene.

Color is semantic:

- blue — unsigned data or a request;
- amber — human review or pending approval;
- green — verified, signed, or accepted;
- red — secrets, untrusted claims, or rejection.
