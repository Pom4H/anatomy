# Anatomy design and editorial rules

## Purpose

Anatomy explains Pom4H open-source systems through code-backed engineering narratives.

## Visual direction

Use an editorial engineering language: Swiss precision with restrained neo-brutalist tension.

- Light-first, warm paper canvas, almost-black typography.
- Typography and whitespace before containers.
- Do not create a grid of rounded SaaS cards.
- Border radius is exceptional, not the default.
- Use one semantic signal color. Here it marks trust boundaries and active transitions.
- Diagrams use direct labels, figure numbers and thin rules instead of generic Mermaid-style boxes.
- Motion must explain state or causality. The production site should remain useful with motion disabled.
- Mobile is a recomposed layout, not a squeezed desktop.

## Editorial rules

- Pin factual claims to a source commit.
- Keep experimental/security disclaimers visible.
- Never say the project is audited or production-ready unless the source proves it.
- Never claim that keys cannot leave a secure element until the physical implementation proves it.
- Describe narrow chain support as architecture probes, not broad multi-chain compatibility.
- Prefer concrete invariants, code types, protocol boundaries and CI behavior over marketing language.

## Technical rules

- Astro 7 static output.
- No client-side JavaScript unless an interaction genuinely requires it.
- Preserve canonical URLs, structured data, sitemap, robots and social metadata.
- Test `npm run build` before merging.
