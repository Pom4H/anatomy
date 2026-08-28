# Anatomy design direction

## Editorial Technical / Swiss × Neo-Brutalist

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
- motion only when it explains causality.

### Lesson rhythm

A lesson should visually alternate between:

1. mental model;
2. vocabulary;
3. step-by-step flow;
4. comparison;
5. security boundary;
6. checkpoint;
7. summary.

The reader should always know what is being explained, which data moves, and which component is trusted.

### Avoid

- card soup;
- universal 16px rounded rectangles;
- dark “developer” background by default;
- cyan/purple AI gradients;
- fake terminal output;
- stock crypto coins and padlock imagery;
- decorative motion without causal meaning;
- opening with the implementation before the concept;
- claims not supported by primary specifications or inspected source code.

### Article layout

The learning column stays narrow. Diagrams may break into the wider grid. Learning goals, checkpoints, and summaries are structurally distinct but should not look like SaaS cards. A page should have one strong visual gesture at a time.

### Mobile

Mobile is recomposed, not merely compressed. Side navigation becomes a disclosure, metadata becomes two columns, figures become full-width, and tables remain horizontally understandable.
