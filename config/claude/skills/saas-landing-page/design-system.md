# Warm Editorial Minimalism — Design System

This is the spec. Tokens are the single source of truth; archetypes are
compositions of tokens; a page is composition of archetypes. Nothing below
hardcodes a value an archetype could read from a token.

---

## 1. Aesthetic identity — what makes it read as "this"

Five tells. Lose two and it stops looking like the genre:

1. **Serif display + grotesque sans pairing.** Big headlines, prices, and hero
   words are set in a transitional/old-style **serif** (Instrument Serif,
   Tiempos, Editorial New, or Georgia as a free fallback). Everything else —
   body, labels, buttons — is a clean **grotesque sans** (Inter, Geist,
   system-ui). The contrast between the two is the signature.
2. **Warm off-white background, never `#fff`.** A "bone" / paper tone. Pure
   white reads as cheap admin panel; warm white reads as considered.
3. **Subtle texture.** A faint dotted grid (or fine noise) over the background.
   Barely visible — you notice it's *not flat*, not that there are dots.
4. **Dark rounded cards that float.** Near-black, generously rounded
   (~20-24px), with a soft *large-radius low-opacity* shadow so they sit above
   the light field. The light/dark inversion (dark cards on light page) is core.
5. **Near-monochrome palette.** Almost no accent color. Hierarchy comes from
   ink vs muted-ink and from type, not from color. At most one restrained
   accent, used once.

Supporting tells: outlined **uppercase letter-spaced pill tags**; thin
checkmark feature lists; generous whitespace; a **floating pill nav** at top;
**segmented-control toggles** (e.g. Monthly/Yearly).

---

## 2. Tokens — the single source of truth

Paste this into `:root`. Every component reads from it. To re-brand, change
values *here only*.

```css
:root {
  /* ---- Color: light field ---- */
  --bg:            #f1efe9;   /* warm bone — never #fff */
  --bg-2:          #e9e7df;   /* slightly deeper, for banding */
  --ink:           #1a1814;   /* near-black, warm */
  --ink-muted:     #6b665d;   /* secondary text on light */
  --hairline:      rgba(26,24,20,0.10);

  /* ---- Color: dark surfaces (cards, nav, CTA band) ---- */
  --surface:       #161412;   /* near-black, warm */
  --surface-top:   #211e1a;   /* lighter, for top-lit gradient */
  --on-surface:    #f5f3ee;   /* headings on dark */
  --on-surface-muted: #9b958a;/* body on dark */
  --ring:          rgba(245,243,238,0.14); /* outline on dark */

  /* ---- One restrained accent (use sparingly, or not at all) ---- */
  --accent:        #c8643c;   /* warm terracotta; swap per brand */

  /* ---- Texture ---- */
  --dot:           rgba(26,24,20,0.06);
  --dot-size:      22px;

  /* ---- Type ---- */
  --font-display:  "Instrument Serif", "Tiempos Headline", Georgia, serif;
  --font-sans:     "Inter", system-ui, -apple-system, sans-serif;
  --tracking-tag:  0.14em;   /* uppercase pill letter-spacing */

  /* ---- Type scale (fluid) ---- */
  --t-hero:   clamp(3rem, 7vw, 5.5rem);   /* serif display */
  --t-h2:     clamp(2rem, 4vw, 3rem);     /* serif */
  --t-price:  clamp(2.5rem, 4vw, 3.25rem);/* serif numerals */
  --t-lead:   clamp(1.05rem, 1.6vw, 1.25rem);
  --t-body:   1rem;
  --t-small:  0.8125rem;

  /* ---- Space scale ---- */
  --s-1: 0.5rem;  --s-2: 0.75rem; --s-3: 1rem;   --s-4: 1.5rem;
  --s-5: 2rem;    --s-6: 3rem;    --s-7: 4.5rem; --s-8: 7rem;

  /* ---- Radii ---- */
  --r-card: 22px;  --r-btn: 12px;  --r-pill: 999px;

  /* ---- Shadow: soft, large-radius, low-opacity (cards float) ---- */
  --shadow-card: 0 24px 48px -24px rgba(26,24,20,0.45),
                 0 2px 6px rgba(26,24,20,0.08);
}
```

**Cool/Linear dialect** (same archetypes, different brand) — change only:
`--bg:#0c0c0d; --ink:#ededef; --surface:#161618; --on-surface:#fafafa;
--bg-2:#0a0a0b;` and you have the dark-mode cool variant. The point: archetypes
don't change, tokens do.

---

## 3. Foundations

```css
* { box-sizing: border-box; margin: 0; }
body {
  font-family: var(--font-sans);
  color: var(--ink);
  background-color: var(--bg);
  /* dotted texture — the "not flat" tell */
  background-image: radial-gradient(var(--dot) 1px, transparent 1px);
  background-size: var(--dot-size) var(--dot-size);
  -webkit-font-smoothing: antialiased;
  line-height: 1.5;
}
.wrap { max-width: 1140px; margin-inline: auto; padding-inline: var(--s-4); }
.serif { font-family: var(--font-display); font-weight: 400; line-height: 1.05; }
.muted { color: var(--ink-muted); }
```

---

## 4. Component archetypes

Each is a composition of tokens. Build pages by assembling these.

### Floating pill nav
Dark rounded bar, not a full-width stripe. Logo left, links + CTA right.
```css
.nav { position: sticky; top: var(--s-4); z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--s-4); padding: var(--s-2) var(--s-2) var(--s-2) var(--s-4);
  background: var(--surface); color: var(--on-surface);
  border-radius: var(--r-pill); box-shadow: var(--shadow-card); }
.nav a { color: var(--on-surface-muted); text-decoration: none; font-size: var(--t-small); }
.nav a:hover { color: var(--on-surface); }
```

### Hero
Centered. Serif display headline (one or two words can carry the brand), a
muted lead line, one primary CTA. Whitespace is the design — don't crowd it.
```html
<header class="hero">
  <h1 class="serif" style="font-size:var(--t-hero)">Pricing</h1>
  <p class="lead muted">Simple, transparent pricing. Choose the plan that fits.</p>
  <a class="btn btn-dark">Get started</a>
</header>
```

### Tier tag (pill)
```css
.tag { display: inline-block; padding: 0.3em 0.9em; font-size: var(--t-small);
  text-transform: uppercase; letter-spacing: var(--tracking-tag);
  color: var(--on-surface-muted); border: 1px solid var(--ring);
  border-radius: var(--r-pill); }
```

### Pricing card (dark, floating)
The price uses the **serif numerals** — the `$10` should be serif, the `/month`
sans and muted. Mixing the two faces *inside the price* is a key detail.
```css
.card { background: linear-gradient(180deg, var(--surface-top), var(--surface));
  color: var(--on-surface); border-radius: var(--r-card);
  box-shadow: var(--shadow-card); padding: var(--s-5);
  display: flex; flex-direction: column; gap: var(--s-4); }
.price { font-family: var(--font-display); font-size: var(--t-price); }
.price small { font-family: var(--font-sans); font-size: var(--t-body); color: var(--on-surface-muted); }
.features { list-style: none; display: grid; gap: var(--s-2); }
.features li { display: flex; gap: var(--s-2); color: var(--on-surface-muted); font-size: var(--t-body); }
.features li::before { content: "✓"; color: var(--on-surface); } /* thin check */
```
Lay three cards in a `grid-template-columns: repeat(3, 1fr); gap: var(--s-3)`.
On mobile collapse to one column. Do **not** scale up the "popular" card with a
loud colored border — at most a thin `--ring` highlight or a small tag.

### Segmented control / billing toggle
```css
.toggle { display: inline-flex; padding: 4px; gap: 2px;
  background: var(--surface); border-radius: var(--r-pill); }
.toggle button { border: 0; padding: 0.5em 1.25em; border-radius: var(--r-pill);
  background: transparent; color: var(--on-surface-muted); cursor: pointer; }
.toggle button[aria-pressed="true"] { background: var(--on-surface); color: var(--surface); }
```

### Buttons
```css
.btn { display: inline-flex; align-items: center; justify-content: center;
  gap: var(--s-2); padding: 0.75em 1.25em; border-radius: var(--r-btn);
  font-size: var(--t-body); text-decoration: none; cursor: pointer; border: 0; }
.btn-dark  { background: var(--ink); color: var(--bg); }
.btn-light { background: var(--on-surface); color: var(--surface); } /* on dark cards */
.btn-ghost { background: transparent; color: var(--on-surface);
  border: 1px solid var(--ring); }
```

### CTA band & footer
A centered closing block (serif headline + one CTA), then a quiet footer with
copyright left, links right, set in `--t-small` and `--ink-muted`. Optionally
invert the CTA band to a dark surface for a strong full-width finish.

---

## 5. Page composition

A typical page is just archetypes stacked with section padding `var(--s-8) 0`:

`pill nav` → `hero` → (`billing toggle` →) `pricing grid` / `feature grid` →
`CTA band` → `footer`.

Landing-page variant: `nav` → `hero` (with product shot) → `logo strip` →
`feature sections` (alternating text/visual) → `social proof` → `CTA band` →
`footer`. Same tokens, same archetypes.

---

## 6. Anti-patterns — what makes it look "generic AI"

Audit every output against these. Each is a direct inversion of a genre tell.

- **Purple→blue (or any) gradient hero.** The genre is near-monochrome on warm
  white. Gradients are the #1 generic-AI tell. Remove it.
- **Pure `#ffffff` background.** Use warm bone (`--bg`). Pure white = unstyled.
- **All-sans typography.** No serif display face = no genre. The pairing is the
  signature; if you set the hero in bold Inter, you've built a different look.
- **Emoji as feature bullets.** Use thin checkmarks or hairline icons.
- **Three identical feature cards with a colored icon circle on top.** The
  default LLM section. Prefer asymmetric layouts, real content, varied rhythm.
- **Loud "MOST POPULAR" card** scaled 1.1× with a saturated border + ribbon.
  Keep promotion quiet: a small tag or thin ring.
- **Hard flat fills with no shadow/texture.** Cards must float (soft shadow);
  background must have faint texture. Flatness reads as a wireframe.
- **Cramped spacing.** This genre is generous. When unsure, add whitespace.
- **Many accent colors.** One restrained accent, used once, or none.

If the page survives this audit and shows the five tells from §1, it's in the
genre.
