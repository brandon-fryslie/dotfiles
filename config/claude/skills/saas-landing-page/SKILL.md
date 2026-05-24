---
name: saas-landing-page
description: Design startup/SaaS marketing pages in the "warm editorial minimalism" genre — bone-white backgrounds with dotted texture, dark rounded floating cards, serif-display + grotesque-sans type pairing, near-monochrome palette, pill nav, segmented billing toggles, and pricing tier grids (the spoke.so / Linear-adjacent look). Use when the user wants to build a landing page, pricing page, hero section, feature section, or marketing site that should look like a polished modern startup — i.e. "make it look startup-y", "design a SaaS landing page", "build a pricing page like X", "give it that clean minimal startup aesthetic", or wants to avoid generic AI-gradient design.
---

# Startup Site Design

Build marketing pages in **warm editorial minimalism** — the modern startup
aesthetic where a serif display face does the talking, the palette is nearly
monochrome, and dark cards float on a warm off-white field.

## The one rule that makes or breaks it

**The design tokens are the source of truth. Everything else is composition.**
Define the palette, type scale, spacing, radii, shadow, and texture *once* (as
CSS custom properties), then build every component out of those tokens. A page
is then assembled from component archetypes — you never re-decide a hex code or
a font size per-section. This is what separates the genre from generic-AI
output: the look is a *system*, not a vibe re-derived each time. When two
sections disagree on a radius or a gray, the token layer was bypassed — fix the
token, don't patch the section.

## Workflow

1. **Read `design-system.md`** — it holds the full token set, the component
   archetypes (nav, hero, pricing grid, billing toggle, feature card, CTA band,
   footer), and the anti-patterns that make a page look "generic AI". This is
   the spec; treat it as the single source of truth.
2. **Copy `template.html`** as the starting skeleton. It's a self-contained,
   working page wired entirely off the token variables — change tokens at the
   top, every component updates coherently.
3. **Compose, don't restyle.** Pick archetypes, fill in real copy, adjust *token
   values* (not per-component CSS) to shift the brand. Want cool/Linear instead
   of warm/spoke? Change ~6 tokens; the whole page follows.
4. **Verify against the genre tells**, listed in `design-system.md` — serif/sans
   pairing present, background warm not white, cards float with soft shadow,
   palette near-monochrome, generous whitespace. If you used a built-in tool to
   render it, screenshot and check; don't ship on assumption.

## What this genre is NOT

Not the rainbow-gradient, glassmorphism, emoji-bullet, three-equal-feature-cards
look that LLMs default to. The default is loud; this genre is quiet. If your
output has a purple-to-blue gradient hero, you've left the genre — see the
anti-patterns section.
