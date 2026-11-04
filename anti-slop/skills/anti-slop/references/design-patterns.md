# Design & UI Anti-Patterns

Patterns that mark frontend output as AI-generated. These primarily apply to web frontend (HTML/CSS/JS). Adjust for other platforms (native mobile, desktop, terminal UI). The "generic AI website" problem comes from LLMs reproducing the median aesthetic from their training corpus, predominantly Tailwind CSS tutorials and SaaS landing pages.

How to apply this file: almost everything here is a Pattern smell, a correlation with generated output rather than a proof that the page is wrong, and § Presence and concentration says which tells count on one instance and which need repetition. The accessibility and functional sections are the exception: those are defects. The fix for a tell is a decision with a reason (`choosing-with-intent.md`), never a different default, and a choice made on purpose is marked `anti-slop-allow: <reason>` and left alone.

## What the evidence actually ranks highest

A corpus study of 3M+ Reddit posts and 3,033 comments (see `empirical-rankings.md`) found the strongest real complaints are, in order: **generic sameness ("all looks the same"), the un-themed shadcn/Tailwind default kit, AI purple, and gradients.** Two surprises worth internalizing:

- **The memes are near the bottom.** Bento grids (0.1%, people defend them) and mesh/aurora gradients (rejected outright as a keyword artifact) are not real tells. Do not lead with them.
- **The single largest *emerging* tell is not in most anti-AI lists at all**: the cream-and-serif "tasteful default" below. It now reads as AI faster than purple does.

Trust comment share over post share when they disagree (comments are 100% on-topic; post bodies inflate generic words). The deepest cause is upstream of any pattern: an unspecified prompt returns the median of the training data, and everyone's median is identical. The fix is a deliberate choice with a reason; see `choosing-with-intent.md`. The diagnostic that captures it: the **logo-swap test** (below).

## The Tasteful Default (Cream + Serif + a Warm Accent)

The current top emerging tell, and the one most lists miss. A warm cream/beige page background + a serif display font (Instrument Serif, Fraunces, Playfair Display) + a single saturated accent, often with a generated product-screenshot card to the right. This is the look the *previous* wave of anti-AI advice converged on, so it now signals "AI tried to be tasteful." It reacts harder than purple ever did, precisely because it looks like a choice: being told it is a default lands worse than being told purple is.

**The accent leg moved.** Through 2025 the third leg was sage or forest green. By mid-2026 the reporting that named this style names **rusty orange and terracotta** instead, on the same cream ground and with the same serif display. Both are current; the accent is the leg that drifts, and cream and serif are stable. The clay accent is the weaker of the two, because a warm editorial ground with a brick or ochre accent is also a common human choice, and the replacement hues recommended for AI purple sit in the same band. So clay completes the combination only beside the serif display, while sage completes it beside either of the other two.

**Anti-patterns:**
- Cream/beige page background: hexes like `#faf8f5`, `#f5f1e8`, `#f3eee3`, `#fdfbf7`, or Tailwind `bg-stone-50` / `bg-amber-50` / `bg-orange-50` used as the page surface
- Serif display face for headings: Instrument Serif, Fraunces, Playfair Display, Cormorant, Spectral, DM Serif
- Accent, either wave: sage / forest green (`#15573a`, emerald/green 700-900), or rusty orange / terracotta (`#b7410e`, `#c2410c`, `#9a3412`, `#a0522d`, Tailwind orange/amber 600-800)
- The screenshot-card-on-the-right hero that ships with it

**The signal is the combination.** Two distinct legs together are the strong tell: cream with serif, cream with sage, serif with sage, or serif with clay. Cream with clay and no serif display is not the combination, and two hits of one leg (two cream hexes, two serif faces) are still one leg. That is why `cream-serif-default` is a concentration rule at `minCount: 2` that counts legs rather than matches. One leg alone may be a real decision.

**Judgment note: the false-positive risk on this one is rising and the confidence class must stay Pattern smell.** The same reporting that identifies this as the generated look also records human 2026 design converging on the same palette independently. A warm editorial site built by a person now matches on two legs. Red is deliberately excluded from the accent leg, because including it would fire on every error state on the web, and the 200-level tints are excluded because a single `bg-amber-50` warning banner is not a palette. The scanner's sage leg is the one hex the sources name, `#15573a`; the emerald and green 700-900 classes stay out, since `text-green-700` is the web's success colour, so other sage or forest greens on cream are the agent's to catch and not the scanner's.

**Instead:** this is not "pick a different nice palette" (that just resets the clock). Anchor color and type to the real brand or a reference. If none exists, choose a direction that is specific and uncommon rather than the current tasteful average. If warm-editorial cream-and-serif is a genuine, stated decision, keep it and mark the line `anti-slop-allow: <reason>`. See `choosing-with-intent.md`.

## The Generic AI Aesthetic

### The Default Color Problem

AI defaults to purple/indigo gradients on white backgrounds. This traces directly to Tailwind CSS's documentation and starter templates, which use `bg-indigo-500` and `bg-purple-600` as demo defaults. These colors dominated the training data.

**Anti-patterns:**
- Purple-to-blue gradient backgrounds
- Indigo/violet as primary color
- Monochromatic or heavily desaturated palettes
- Timid, evenly-distributed color choices
- No bold accent colors

**Instead:** Anchor the palette on the brand, or on a reference the user named. With neither, choose a direction you can give a reason for and state the reason (`choosing-with-intent.md`). A palette chosen because it is "not purple" is the next default: the cream-and-warm-accent look two sections up is what that move produced last time. A restaurant website doesn't need tech-purple, and it doesn't need this year's tasteful average either.

**The default has broadened, not moved.** Framework indigo/violet remains the loudest palette tell in the corpus, and it is the one with scanner rules (`ai-purple-hex`, `ai-purple-class`, `purple-gradient-default`, `purple-blue-gradient`). But 2026 surveys of generated sites put Tailwind `blue-600` (`#2563EB`) ahead of it by raw volume, with an all-`slate` neutral ramp underneath. There is deliberately **no rule for blue**, and there should not be one: blue is the most common legitimate brand colour in software, a concentration rule on it would fire on a large share of correctly branded interfaces, and its remediation ("pick a different colour") is exactly the reset-the-clock move that `empirical-rankings.md` finding 1 warns against. The point is unchanged and is not about any hex. An unchosen primary plus an unchosen neutral ramp is the tell, and swapping indigo for blue changes nothing. The test stays "can I say why this project uses this colour."

### The Default Typography Problem

AI reaches for Inter, Roboto, or system sans-serif every time. No distinctive pairings. Generic hierarchies.

**Anti-patterns:**
- Inter as the default font
- Roboto for everything
- Arial/Helvetica fallback without thought
- No display or serif fonts
- Identical weight hierarchies (400/600/700)

**Instead:** A pairing chosen for a reason: the brand's face where one exists, otherwise a display face and a body face picked for this product and named in a comment or a token. Use distinctive weight and size hierarchies. A serif chosen because it is the brand's, or because it fits this product and someone can say why, is a choice; the same serif reached for as the move away from Inter is the counterpart trap two paragraphs down.

**The default sans has broadened past Inter.** `generic-font` matches the geometric-and-neutral set that generated pages reach for interchangeably: Inter, Geist, Roboto, Space Grotesk, Manrope, Plus Jakarta Sans, Outfit, DM Sans. They are all competent faces and none of them is banned; the tell is that swapping one for another is the move a page makes when nobody chose a typeface. **Remediation is a decision with a source**, not a different entry from the same list: the brand's face if there is one, a pairing (a display face plus a separate body face) if there is not, and a stated reason either way. The rule reads the face a block actually sets: the first family of `font-family` or of the `font` shorthand that is not a generic keyword. A system stack never matches, a listed face named only as a fallback never matches, and names are matched whole, so `Inter Tight` (the same family) matches and `Inter Display` (a different cut, and a reasonable alternative) does not. A listed face set only on a button or field label is the UI label fallback, and is not a finding when the page sets another face for its content; on content copy it is.

The counterpart trap is on the other side. Steering off Inter and landing on Instrument Serif or Fraunces is the tasteful default above, and the same non-decision wearing better clothes.

### The Default Layout Problem

Three-column grids with icon boxes. Hero section with centered text and CTA. Feature comparison tables. Testimonial carousels. Pricing cards in groups of three. This is the SaaS landing page template AI reproduces on every project.

**Anti-patterns:**
- Three-column icon grids as the default feature display
- Centered hero with H1, subtitle, and CTA button
- Symmetric card layouts (all same size)
- Bento grid as default layout for everything
- Predictable component arrangement without asymmetry
- Cookie-cutter dashboard layouts

**Instead:** Let the content determine the layout. An article page has different needs than a product page. Use asymmetry. Let important content take more space. Break the grid when it serves the design.

### No Real Images

One of the most-cited specific complaints: every section is icon-cards and abstract shapes, with no actual images. "Most good websites are like 50% images if not more." AI defaults to icon-in-a-box because an icon needs no asset pipeline, so a generated page often has zero screenshots, photos, or product shots.

**Instead:** Show the real product. A true screenshot, real data, a short demo clip, or real photography carries more than a grid of Lucide icons. If the product is visual, the page should be too.

**Stock illustration is the same defect with an asset attached.** The flat-vector illustration libraries (unDraw, Storyset, DrawKit, Humaaans) are what a generated page reaches for when it is told to add imagery, and they carry the same monochrome-accent, no-faces, floating-limbs house style everywhere they appear. The scanner matches the source URLs and package names as `stock-illustration`, presence-flagged, Pattern smell.

**Remediation:** replace the illustration with the thing it stands in for. A screenshot of the actual screen being described, a photograph of the actual object, a diagram drawn for this specific system. Where an abstract image genuinely belongs, commission or draw one that does not ship with a recognisable house style. Deleting the image and leaving an empty band is not the fix: the section still needs something, and the tell was the stock asset, not the presence of a picture.

## Visual Design Anti-Patterns

### Glassmorphism Without Purpose

Frosted glass effects applied everywhere because they look "modern." Background blur is expensive to render and often obscures content.

**Anti-patterns:**
- Backdrop-filter blur on every card
- Semi-transparent backgrounds for all containers
- Frosted glass navigation bars
- Glass effect on text containers (hurts readability)

**Instead:** Use glassmorphism sparingly and only when the layered transparency serves the information hierarchy -- for example, an overlay that should feel temporary.

**Weight this lightly.** In the corpus data glassmorphism is a low-signal, contested complaint (0.2% of comments). Flag it only when frosted glass is applied *everywhere without purpose* or hurts readability; its mere presence is not a strong tell, and a single intentional glass overlay is fine.

### Shadow and Depth Excess

Subtle shadows at exactly 0.1 opacity on every element. Box shadows on cards, buttons, inputs, and containers, all at the same depth.

**Anti-patterns:**
- Identical box-shadow on every component
- `box-shadow: 0 1px 3px rgba(0,0,0,0.1)` everywhere
- Multiple shadow layers for fake depth
- Shadows on flat elements that don't need elevation

**Instead:** Use shadow to communicate interactive hierarchy (elevated = interactive). Keep most elements flat. Vary shadow values when used.

### Border Radius Excess

Rounding every corner to the same generous radius. Everything looks like a lozenge.

**Anti-patterns:**
- `border-radius: 12px` or larger on everything
- Buttons, cards, inputs, images all rounded identically
- Pill-shaped elements that would work better with sharp corners

**Instead:** Match border radius to the design's personality. Sharp corners feel precise and technical. Gentle rounding (4-6px) works for most UI. Reserve larger radii for specific interactive elements.

**Weight this lightly, on the same grounds as glassmorphism.** In the corpus data "rounded corners / pill buttons everywhere" is 0.8% of comments at **medium** false-positive risk. Rounding is not a defect and most interfaces are rounded. Two rules exist and both are concentration rules for that reason: `rounded-everything` fires at three Tailwind `rounded-2xl` / `rounded-3xl` / `rounded-full` / 999px pills, and `uniform-literal-radius` fires at three literal `border-radius` values in a file that declares no radius token to vary from. A `0` or `0px` reset is not a radius choice and does not count; `0.5rem` does. A single pill button is a choice, and a file that defines `--radius` and uses it is silenced outright.

**Remediation:** state the radius as a token (`--radius: 8px`) and reference it, or vary it deliberately by control class. The remediation is *stating the decision*, never removing the rounding. A review that ends with square corners nobody asked for was a wrong review.

### Icon-in-Colored-Circle Pattern

One of the strongest AI design tells. Every feature card gets a generic icon (Zap, Shield, Globe, Sparkles) placed inside a colored oval or circle background (`bg-indigo-100 rounded-full p-3`). The pattern repeats identically across every card in a grid, creating a uniform, template-driven look.

**Anti-patterns:**
- Every icon wrapped in a colored circle/oval background (`rounded-full` with a tinted `bg-*-100`)
- Identical circle treatment across all feature cards (same size, same padding, same background tint)
- Icons serving as decoration rather than aiding comprehension (a Rocket icon for a slow process, a Sparkles icon for anything AI-related)
- Icon circles as the sole visual differentiator between cards that otherwise look identical

**Instead:** Use icons without decorative backgrounds when the icon itself is clear. If backgrounds are needed, vary the treatment (different shapes, sizes, or styles per card based on content). Consider illustrations, screenshots, or no visual at all when icons add nothing. The icon should explain the feature, not decorate the card. If the user specifically requests icon circles, use them.

### Gratuitous Animations

Hover effects, entrance animations, and transitions on everything. Looks like a demo, not a product.

**Anti-patterns:**
- Fade-in animations on every section scroll
- Scale transforms on every hover
- Transition durations over 300ms for micro-interactions (hover, focus, toggle)
- Loading animations that delay content display
- Parallax effects without purpose

**Instead:** Animate to communicate state changes. Micro-interactions: under 200ms. Medium transitions (panels, dropdowns): 200-300ms. Full-screen: up to 400ms. Over 500ms feels sluggish. Respect `prefers-reduced-motion`. For animation performance details (compositor vs layout properties), see `frontend-patterns.md`.

**Weight this lightly. It is the noisiest entry in the whole UI table.** "Too many animations / Framer fade-ins" is 1.1% of comments at **high** false-positive risk, the only `high` in the corpus ranking, because the complaint is usually a taste disagreement rather than a defect. Flag it when the motion has no state change to communicate, when a duration is plainly out of band, or when there is no `prefers-reduced-motion` handling; the last of those is an accessibility finding and stands on its own. Do not write it up as a count of animations.

### Bounce and Elastic Easing

Keyword bounce and elastic animations, `animate-bounce` on a scroll cue, and the `cubic-bezier(0.68, -0.55, 0.265, 1.55)` curve that winds up and then overshoots. The motion reads as playful on a toast confirming a payment, and that mismatch is the tell: the energy belongs to the action, and generated motion uses one preset for all of them.

**Remediation:** ease out with an exponential curve, or use a spring token that settles once. Springs are the tool, not the tell: a `linear()` spring, a single-overshoot curve like `cubic-bezier(0.34, 1.56, 0.64, 1)`, and a rise that settles once all stay clean.

The scanner rule is `bounce-easing`, low severity, Pattern smell. It fires on an animation named for a bounce, elastic, wobble, jiggle or rubber motion (unless its keyframes only fade and shrink, the way SpinKit's loaders do), on `animate-bounce`, on a curve that both anticipates (y1 below -0.1) and overshoots (y2 above 1.1), used directly or through a custom property something reads, and on keyframes that reverse direction twice or more. Declarations inside `prefers-reduced-motion: reduce` are skipped. The severity is low on purpose: the harm data behind impeccable's `bounce-easing` rule, whose shapes this one re-expresses, is thin, and the judgment that matters is the action's gravity.

### Pulsing Dot

A small round dot that pulses forever beside "Live", "Online" or a count: an 8px circle running an infinite opacity and scale pulse, or `h-2 w-2 rounded-full animate-ping`. It says something is happening without saying what, and it never stops moving.

**Remediation:** let liveness show in the content, as rows arriving or a timestamp updating. Where the brief asks for a live badge, keep it and mark the line `anti-slop-allow: <reason>`.

The scanner rule is `pulsing-dot`, medium severity, Pattern smell: a 2px to 16px round box, close to square, running an infinite animation whose keyframes pulse in place (opacity, a shadow or a scale, with no movement of 4px or more), or the Tailwind `animate-ping` / `animate-pulse` dot. An equaliser bar, a dot that pulses once, a dot that moves and a spinner over 16px stay clean. It re-expresses impeccable's `pulsing-dot` rule.

### Marquee

A row of logos or headlines that scrolls sideways forever: a `<marquee>`, or a flex track running `translateX(0)` to `translateX(-50%)` on an infinite linear loop. It fills a strip the page had nothing to say in, and the motion never stops asking for attention.

**Remediation:** show the items as a static row, or let the reader scroll the row on demand with a visible pause control.

The scanner rule is `marquee`, low severity, Pattern smell: a `<marquee>` tag, or keyframes that carry the row a fifth of its width or more along the x axis, run forever. A one-shot slide, a scroll-snap rail moved by hand, and a one-step keyframes body that also scales or fades stay clean, and declarations inside `prefers-reduced-motion: reduce` are skipped. It re-expresses impeccable's `marquee` rule.

### `transition-all`

The one motion default that is a defect on its own technical merits rather than as a taste call. `transition-all` animates every animatable property, layout properties included, so a hover that was meant to fade a shadow also interpolates width, height, and position on any state change that touches them. `frontend-patterns.md` § Animation Performance already says not to animate layout properties; this is the shorthand that does it by accident.

**Remediation:** name the properties. `transition-[background-color,box-shadow] duration-150` costs nothing, animates the same visible thing, and removes no motion. The scanner matches it as `transition-all` at low severity, concentration, from two occurrences, because one on a single button is a shortcut rather than a policy. Nothing about the fix touches `prefers-reduced-motion` handling, so the remediation floor is clear.

### Unprompted Neon Glow

Dark background plus a saturated glow bleeding off cards, buttons, and headings: `box-shadow: 0 0 40px rgba(139,92,246,0.5)`, `drop-shadow-[0_0_25px_#a855f7]`, a `text-shadow` halo on a heading. In the corpus this sits at 0.7% of comments with **low** false-positive risk, and the complaint is specific: **the glow, not dark mode.** Dark mode itself is cleared by the data. The glow is what nobody asked for.

It arrives with the purple palette because a saturated hue on near-black is where a glow reads at all, which is why the two so often ship together. The scanner matches it as `neon-glow` when a viewer could see it: a layer with zero offsets, a blur over 4px, a chromatic colour, and blur times alpha of 3 or more, so a soft neutral shadow, a 1px hairline ring and a `--card-box-shadow` token definition do not count. A focus halo is a state indicator and is exempt. On a bar or track whose declared sides differ by four times or more, a halo that lights more than twice the element's own area reads as a lit track rather than a glow; a halo around a dot or a card keeps the verdict.

**Remediation:** carry elevation with a real shadow scale and a lighter surface, the way the platform does. `background: var(--surface-2)` plus `box-shadow: 0 1px 2px rgb(0 0 0 / 0.6)` separates a card from its ground without the halo. Where a glow is genuinely the brand (a synthwave product, a monitoring wall meant to be read across a room), keep it and mark the line, because the rule is about the unchosen default rather than the technique.

### Side Stripe on a Card

A coloured bar down one side of a card, callout or panel: `border-left: 4px solid` in a brand teal, an absolute `::before` strip, an inset side shadow, or `border-l-4 border-teal-600`. It is the generated way to say "this one matters" without deciding what makes it matter, and it lands on every callout of the page at once. The coloured left border is banned on any box here, rounded or square.

**Remediation:** carry the emphasis with something that says why: a surface tint, a heading, or real selection state. The severity edge of a live region (`role="alert"`, `aria-live`), the error edge of an invalid field, and the edge of the selected tab or the current row are substance rather than decoration, and stay.

The scanner rule is `side-stripe-accent`, medium severity, Pattern smell, on one instance: a stripe of 2px or more (3px on a square box) that dominates the other sides, in a colour that is not neutral, drawn by any of the syntaxes above, including a JSX style object. Controls, list items, table cells and inline text are exempt subjects, and an unreadable radius counts as rounded rather than as evidence of a square box. The thresholds and exemptions re-express impeccable's `side-tab` rule; the square-box ban is this catalogue's own, and is where the two part ways.

### Text Below the Legibility Floor

Running text at 11px, footer links at 10px, a price note at `0.625rem`. Small type is how a generated layout fits everything into the mockup; it reads on the designer's display and not on a phone.

**Remediation:** set running text at 12px or more (16px for body copy) and functional text (links, labels, table cells, meta rows) at 11px or more, and subordinate it with weight, colour or caps tracking rather than size. Small print inside a legal or footnote block may go to 10px.

The scanner rule is `text-size-floor`, medium severity, Quality defect. It judges px, rem and the `font` shorthand's size, and guesses nothing else, so em, percent, viewport and `clamp()` sizes are not judged. Footnote markers (`sup`, `sub`), code, `option` and hidden text are exempt; a selector that names a label-like word (`meta`, `badge`, `caption`, `tag`) is functional even when it also names a reading word, and caps text takes the functional floor. It reads one block at a time, so a size inherited from a parent rule is not seen. The floors re-express impeccable's `tiny-text` and `undersized-ui-text`.

### Reading Mechanics

Settings that make running text harder to read, each common in stylesheets that tune the display type and copy the values down to the body:

| Tell | Rule | Fires when |
|---|---|---|
| Tight leading | `tight-leading` | Body text under 24px with a line-height under 1.3 |
| Wide tracking | `wide-tracking` | Mixed-case running text tracked wider than 0.05em |
| Justified narrow column | `justified-narrow-column` | `text-align: justify` on a measure of about 45 characters or less, with no `hyphens: auto` |
| Crushed tracking | `crushed-tracking` | Letter-spacing tighter than -0.07em (-0.09em at 40px and up) |

**Remediation:** body leading at 1.4 to 1.6; running-text tracking between -0.01em and 0.02em; a ragged-right narrow column, or justify with hyphens on a measure of 45 characters or more; display tracking between -0.02em and -0.05em. Display tracking of -0.05em is normal, and the rules leave it alone.

All of them are low severity, Quality defect, and keep the settings that belong to other text: headings and display sizes, lead text at 20px or more, bold titles, caps and small-caps labels, code, controls, and CJK text, where open tracking is conventional (Arabic, Hebrew and Thai do not justify on word spaces either). A wordmark or logo selector keeps its tight tracking, and a readout (tabular figures, or text set to copy whole such as a device code) is never running text. A furniture word in the selector (`code`, `badge`, `label`) marks a label whatever element it styles. Where the file carries its own markup, a class, id or attribute selector is read as the element it styles, and a block whose every element holds a short label is read as a label rather than as running text. The thresholds re-express impeccable's `tight-leading`, `wide-tracking`, `justified-text` and `extreme-negative-tracking`.

### Emoji as Interface

Distinct from emoji in copy, which `writing-patterns.md` § Emoji Abuse covers. This is the interface using a glyph as a control or an indicator: a sparkle on the AI button, a rocket on the "Get started" CTA, a green circle standing in for a status dot, a check mark doing the work of a success icon, emoji as the bullet in a feature list. The corpus rates it 0.5% of comments at medium false-positive risk, and the verdict is explicit: confirmed as a tell **when emoji act as UI**, not when they appear in text a user wrote.

Three reasons it is a defect and not only a tell:

- **Screen readers announce them.** A green circle emoji next to a row reads as "large green circle" and the row's actual state is never stated.
- **They render differently on every platform.** The same glyph is a different shape, weight, and colour on iOS, Android, Windows, and each browser's fallback font, so the interface has no controlled appearance.
- **They cannot be styled.** No size token, no colour token, no state variants, no alignment with the icon set beside them.

**Remediation:** an icon component from the project's set, with an accessible name; or a word, which is often better than either. `PASS` / `FAIL` / `WARNING` beats a colour glyph in a log line, and a labelled status pill beats a coloured dot in a table. Where the glyph is the content rather than the control (a user's message, an emoji picker, a reaction), it stays. The scanner sees one leg of this: `media-control-glyph` matches a bare media-control glyph (U+23CF, U+23ED-U+23EF, U+23F8-U+23FA, U+25B6, U+25C0) carrying no U+FE0F presentation selector, at low severity, Pattern smell, on a single occurrence, and it is the one rule object that also runs on the Apple surfaces (`native-ui-patterns.md`). Anything Unicode renders as an emoji is counted by the emoji rule in prose and code alike (`writing-patterns.md` § Emoji Abuse), which cannot tell a control from content; that judgment is this section's.

### Fixed Geometry: Shells, Tracks, and Viewport Units

The web mirror of the native fixed-frame family in `native-ui-patterns.md`. Each of these answers a question about available space with a number, so the layout survives exactly the window it was authored against.

| Tell | What it looks like | Remediation |
|---|---|---|
| **Fixed page shell** (`fixed-page-shell`) | `width: 1200px` or `min-width: 960px` on a content container | `width: min(100%, 75rem); margin-inline: auto;`. The container keeps a maximum and stops having a floor. `max-width` alone is the correct idiom and is deliberately not matched |
| **Fixed grid tracks** (`fixed-grid-tracks`) | `grid-template-columns: repeat(4, 280px)` | `repeat(auto-fit, minmax(20rem, 1fr))`. Same content, gaining and losing columns with the window, no breakpoint |
| **`100vh` app shell** (`vh-viewport-shell`) | `height: 100vh` on the shell, with a fixed bottom bar | `100dvh` (or `100svh` where the bar must never be covered), plus `padding-bottom: max(0.75rem, env(safe-area-inset-bottom))` on the bar. On mobile, `100vh` excludes the URL bar and clips the last row |
| **Token drift** (`token-drift-spacing`) | `padding: 13px` in a file that declares `--space-1` through `--space-8` | Use the nearest existing token, or add one if the value is genuinely new. Never "delete the padding" |

Every remediation above **adds** adaptive behaviour and removes none, which is the test any new geometry rule has to pass. Two of the four carry a file-level guard: `vh-viewport-shell` stays silent where the file also declares `100dvh` or `100svh` (the progressive-enhancement pair), and `token-drift-spacing` says nothing until the file declares two or more `--space` tokens to drift from, because there is no drift without a scale. `fixed-page-shell` guards per line instead, skipping any line that carries `@media` or `@container` so a breakpoint is not read as a fixed shell, and `fixed-grid-tracks` carries no guard at all.

### Dead Controls

A button, link, or toggle that renders and does nothing: `onclick=""`, `onClick={() => {}}`, `onClick={() => null}`, or a handler whose body is a comment. Demo-ware, and `frontend-patterns.md` § Demo-ware carries the wider case. It is a **Hard defect** rather than a smell, because a visible affordance that does not act is wrong on any reading, and it is the single easiest thing to leave behind when a page was generated to be looked at rather than used.

**Remediation:** wire the handler, or remove the control until it works. A handler with a real body and a comment explaining why it is intentionally inert (`onClick={() => {/* see #221 */ log()}}`) is a decision and does not match. The scanner rule is `dead-control`.

## CSS Anti-Patterns

For z-index stacking, sticky/fixed positioning, Tailwind issues, font loading, dark mode implementation, and fluid typography, see `frontend-patterns.md`.

### Magic Numbers

Hardcoded pixel values scattered through styles without explanation or system.

```css
/* BAD */
.card {
  padding: 17px;
  margin-top: 23px;
  width: 347px;
  font-size: 13.5px;
}

/* GOOD */
.card {
  padding: var(--space-4);
  margin-top: var(--space-6);
  max-width: var(--card-width);
  font-size: var(--text-sm);
}
```

A number with a comment naming its source (`padding: 17px; /* matches the logo inset */`) is a decision, and one of them is not a finding. The finding is a file full of unrelated values with no scale behind them.

### !important Overrides

Using `!important` to force styles instead of fixing specificity.

```css
/* BAD */
.button {
  color: blue !important;
  background: white !important;
}

/* GOOD -- fix the specificity chain */
.button {
  color: blue;
  background: white;
}
```

One `!important` against a third-party widget's inline styles is pragmatism, which is why the scanner's `important-overuse` counts from two. The finding is the file that reaches for it instead of reading the cascade.

### Excessive Nesting

```css
/* BAD */
.page .content .section .card .header .title span {
  color: red;
}

/* GOOD */
.card-title {
  color: red;
}
```

Three levels is a selector; seven is a specificity war that every later rule has to win.

### Duplicate Styles

The same styles defined in multiple places because the AI generates each component in isolation without checking what already exists.

**Rule:** Before adding styles, check if a utility class, component class, or design token already handles it. Two components that share three declarations are not a duplicate worth a token; the finding is the same block copied because nobody looked.

### Over-Engineering Simple Layouts

Using CSS Grid with named template areas and a breakpoint for a layout that is one row of two items. Flexbox with multiple wrappers for centering. Complex media queries for simple responsive behavior.

```css
/* BAD -- named areas and a breakpoint to put two things side by side */
.container {
  display: grid;
  grid-template-areas: "main aside";
  grid-template-columns: 2fr 1fr;
}
@media (max-width: 640px) {
  .container { grid-template-areas: "main" "aside"; grid-template-columns: 1fr; }
}

/* GOOD -- the same behaviour, no breakpoint */
.container {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.container > main { flex: 2 1 20rem; }
.container > aside { flex: 1 1 12rem; }
```

The test is whether the layout has a structure the simpler tool cannot express. A page with a header spanning two columns and a sidebar under it is what template areas are for; a card grid is what `repeat(auto-fit, minmax(20rem, 1fr))` is for (§ Fixed Geometry recommends exactly that form); two boxes in a row are flex. Reaching for the most general tool first is the tell.

## Functional Anti-Patterns

### Forms Without Validation States

Generating form markup without error states, required field indicators, success messages, or loading states. The "happy path only" problem.

**Must include:**
- Required field indicators
- Inline validation messages with `aria-describedby` linking errors to inputs
- Error state styling
- Submit button loading state
- Success/failure feedback announced via `aria-live` region
- `autocomplete` attributes on personal data fields (name, email, address, card)
- `fieldset`/`legend` for grouped controls (radio groups, checkbox groups, multi-part fields)

### Accessibility Failures

AI-generated UI frequently fails accessibility. These are functional defects, not cosmetic preferences.

**Contrast:**
- Insufficient text contrast (WCAG AA: 4.5:1 for normal text, 3:1 for large text 18pt+/14pt bold+)
- Non-text UI elements (form borders, icons, focus indicators) failing 3:1 contrast against adjacent colors (WCAG 1.4.11)
- Color used as the only indicator of meaning (WCAG 1.4.1). Error states need icons or text, not just red borders. Status dots need labels, not just colors.

**Semantic HTML:**
- `<div>` and `<span>` for everything instead of semantic elements (`<nav>`, `<main>`, `<article>`, `<button>`, `<dialog>`, `<table>`)
- `<div onclick>` instead of `<button>` (breaks keyboard nav and screen readers)
- Heading levels skipped (h1 to h3) or chosen for size instead of hierarchy. The scanner rule is `skipped-heading` (medium, Quality defect), on full HTML documents only: a heading more than one level below the one before it. Going back up, the first heading, and the first heading of a `<footer>` or `role="contentinfo"` region are not findings, and markup quoted in `<code>` or `<pre>` is not read. It re-expresses impeccable's `skipped-heading` rule
- No landmark elements for screen reader navigation

**Focus and Keyboard:**
- Focus outlines removed with `outline: none` for aesthetics (WCAG 2.4.7 failure). Never remove outlines without providing a visible replacement.
- No focus trapping in modals and dialogs (focus escapes to background content)
- Focus not returned to trigger element when modal closes
- Route changes in SPAs that leave focus stranded on invisible elements
- Tab order broken by CSS `order` or grid placement

**Dynamic Content:**
- Toast notifications, form errors, loading indicators not announced to screen readers. Use `aria-live="polite"` for non-urgent updates, `aria-live="assertive"` for urgent ones (WCAG 4.1.3).
- Content inserted dynamically that keyboard users cannot reach

**Other:**
- Missing alt text, or meaningless alt text (`alt="image"`). Decorative images need `alt=""`
- No `lang` attribute on `<html>` element
- No skip navigation link (a visually-hidden link before nav that jumps to `#main-content`, visible on focus, WCAG 2.4.1)
- Icon-only buttons without accessible names (`aria-label` or visually-hidden text)
- Placeholder text used as the only label (disappears on input, not reliably read by screen readers)
- Animations without `@media (prefers-reduced-motion: reduce)` wrapping
- No `@media (forced-colors: active)` consideration for high-contrast mode
- A viewport meta with `user-scalable=no` or `maximum-scale=1`, which blocks pinch zoom (WCAG 1.4.4)
- Inputs for email, phone, or numbers without the matching `type` or `inputmode`, so the mobile keyboard is the wrong one and autofill has nothing to match

**Rule:** Check contrast for text AND UI components. Use semantic HTML. Trap focus in modals. Announce dynamic changes. Test with keyboard only.

**Four of these have scanner rules, and every remediation adds behaviour rather than removing it.**

- `outline-none` matches `outline: none` / `outline: 0`, and the Tailwind `outline-none` / `outline-hidden` utilities in a class set that carries no `focus:` or `focus-visible:` replacement (a ring width, an outline width or style, or a focus border colour), in a file that defines no `:focus-visible` rule. `focus:outline-none focus:ring-2` replaces the indicator and is not a finding. **Remediation: replace the ring, never remove it.** `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px }` satisfies WCAG 2.4.7 and looks better than the browser default, which is usually why the outline was killed in the first place. A file that already defines `:focus-visible` is silenced, because suppressing the default in favour of a designed ring is the correct pattern.
- `missing-alt` matches an `<img>` with no `alt` attribute at all, and separately an `alt` whose value is `image`, `photo`, `picture`, `icon`, `graphic`, or `img`, which is the placeholder a generated page writes when it has nothing to say. **Remediation: write what the image conveys**, in the context where it sits ("Q3 revenue by region, with EMEA flat"). For a decorative image, `alt=""` is the correct answer and is deliberately not matched. Deleting the `<img>` is never the fix.
- `viewport-zoom-lock` matches a viewport meta carrying `user-scalable=no`, `user-scalable=0`, or `maximum-scale=1`, which blocks pinch zoom and fails WCAG 1.4.4 Resize Text. **Hard defect**, medium severity, presence-flagged: there is no reading on which locking zoom helps the person holding the phone. **Remediation: delete both attributes.** `width=device-width, initial-scale=1` is the whole viewport meta, and the layout bug that prompted the lock (usually a fixed-width element) is the thing to fix.
- `positive-tabindex` matches `tabindex` (or JSX `tabIndex`) set to a positive integer, which pulls the element ahead of everything else in the focus order and fails WCAG 2.4.3 Focus Order as soon as a second element does the same. **Quality defect**, medium severity. `tabindex="0"` (in the natural order) and `tabindex="-1"` (focusable by script only) are correct and are not matched. **Remediation: `tabindex="0"` or none, and fix the DOM order** so the natural sequence is the intended one.

### Contrast on the Declared Surface

Text that fails WCAG 1.4.3 on the surface its stylesheet gives it: `#8a8a8a` captions on white, white labels on a mid-amber button, slate meta text on a navy card. Generated palettes take the text colour and the surface from different scales and never measure the pair, and the tertiary "muted" token is where the failure lands most often.

**Remediation:** move the lightness, keeping the hue and the surface, until the pair clears 4.5:1 (3:1 for text at 24px, or 18.66px bold). Measure the pair that shipped rather than trusting the scale's name.

The scanner rules are `low-contrast` (high severity, Quality defect) and `low-contrast-near-bar` (low severity, for a ratio within 0.3 of its bar, so a hairline miss never reads like a 2:1 one). A pair is measured only when both colours are known: the block's own background, the background of the exact block its plain descendant chain names, or the page ground when nothing else in the file paints a surface. A `:hover` block borrows its missing half from the rule it repaints, and placeholder text is measured too, at near-bar when the file labels its fields. Not measured: gradient and image surfaces, values left behind an unresolved `var()`, Tailwind colour utilities, dark-mode overrides, and any surface set in another file. A pair that cannot be measured reports nothing, and a failing ratio never prints as its bar (4.4983 reads as 4.49, not 4.5). The tiers re-express impeccable's `low-contrast` rule.

A pair can pass the ratio and still read badly: neutral mid-grey text on a saturated surface (`text-gray-300` on `bg-blue-800`, `#d1d5db` on `#1e40af`) has no hue of its own to sit on the colour with, and reads muddy. Tint the secondary text from the surface hue at lower chroma, or use the surface's own ink. The scanner rule is `gray-on-color`, low severity, Pattern smell: a resting `text-gray`/`slate`/`zinc`/`neutral`/`stone` 300 to 600 beside a resting chromatic `bg-*` above 100 in one class set, or a CSS pair on its own block or its ancestor whose ink is grey (HSL saturation under 0.2, lightness 0.3 to 0.85) on a surface that reads as colour. Pale tints, hover surfaces, near-white and near-black ink stay clean. It re-expresses impeccable's `gray-on-color` rule.

### Mobile-Unfriendly Designs

Designs that look good at desktop width but break on mobile:
- Fixed widths instead of responsive
- Pinch zoom locked with `user-scalable=no` or `maximum-scale=1` in the viewport meta (the `viewport-zoom-lock` rule)
- Hover-only interactions (no touch equivalent)
- Small tap targets (24x24 CSS px minimum with spacing per WCAG 2.5.8 AA; 44x44 CSS px per WCAG 2.5.5 AAA and platform guidelines)
- Horizontal scrolling from overflow
- Text too small on mobile (minimum 16px base)

## Content Design Anti-Patterns

### Generic Microcopy

AI generates the same microcopy for every project:
- "Welcome back!" (on every dashboard)
- "Get started today!" (on every CTA)
- "Unlock the power of..." (on every feature section)
- "Join thousands of satisfied users" (social proof)
- "We're here to help" (support sections)
- "Stay in the loop" (newsletter signup)
- "Transform the way you..." (hero sections)

**Instead:** Write microcopy specific to the product and the user's actual context. "Your last report ran 3 hours ago" is better than "Welcome back!"

The scanner matches the recurring literals as `generic-microcopy`, a **Quality defect** rather than a smell: these strings say nothing about the product, so replacing them costs the interface nothing and gains it a sentence. **Remediation: answer the question the user arrived with.** A dashboard greeting becomes the freshness of the data. A CTA becomes the action ("Import your first realm"). A support block becomes the actual channel and its response time. Copy written for one specific product does not match, however warm it is.

### Marketing Speak in UI

Using promotional language in functional interfaces:
- "Supercharge your workflow" (settings page)
- "Unleash the full potential" (upgrade prompt)
- "Experience seamless integration" (connection settings)

**Instead:** Be functional and clear. "Connect your GitHub account" not "Seamlessly integrate with GitHub."

### Placeholder Content Left In

Lorem ipsum text, "John Doe" names, "example@email.com" addresses, stock photo placeholder images. AI sometimes generates these as final content.

**Rule:** All content in the final output should be real or clearly marked as placeholder that needs replacement.

## The Missing States Problem

AI generates only the "happy path" view. Production interfaces need all of these:

- **Empty states:** What does the dashboard show with zero data? Design this first.
- **Error states:** What happens when the API fails? Show degraded or offline experiences.
- **Loading states:** Beyond a spinner, what does progressive loading look like?
- **Edge cases:** Very long names, very short content, extreme values, unusual data formats.
- **Onboarding:** How does a new user understand the interface? Not just the populated veteran view.
- **Responsive intermediates:** Not just desktop and phone; also tablet, split-screen, unusual viewports.

**Rule:** Design the empty state and error state before the populated state. If they don't exist, the design is incomplete.

## The Component Library Fingerprint

Unmodified shadcn/ui, Material UI, or Ant Design components produce instantly recognizable interfaces. The exact same dialog, popover, dropdown, toast, and data table styling appears across thousands of AI-generated projects.

**Rule:** Customize component library defaults to match the project's identity. Change the default border colors, radii, shadows, and transitions. An interface should not look like the library's documentation site.

## A Documented Design System (DESIGN.md)

A project that writes its system down has made the choice the tells in this file look for, so a value it documents is not a default. Where a `DESIGN.md` sits beside the code (the nearest one walking up from the file, inside the project), the scanner reads its frontmatter: `colors.<name>` for the palette and `typography.<role>.fontFamily` for the faces.

- **A declared purple is the brand, at its own hue.** The exemption is per match, never per rule. When the file declares a colour on the purple arc (OKLCH hue 250 to 320, chroma 0.08 or more), a purple hex or utility within 15 degrees of that hue is the documented palette and does not count toward the four purple rules (`ai-purple-hex`, `ai-purple-class`, `purple-gradient-default`, `purple-blue-gradient`); every other match still fires, so a declared blue-600 (hue about 263) leaves a violet `#7c3aed` (about 293) a tell. A gradient is exempt only when each of its purple stops is. A literal within 6 per channel of any declared colour never counts either, and the CLI's coverage notes name the declared colours.
- **A face outside the declared typography is drift.** `design-system-font` (medium, Quality defect) fires on a block whose primary face is not one `DESIGN.md` declares. A system stack never counts, and test, fixture and story files are skipped, since the file describes the product rather than its fixtures. Use a declared family, or add the face to `DESIGN.md` with the reason it was chosen.

Colour, radius and type-size drift against the file are not scanner rules: a short declared ramp would flag nearly every file, and the judgment belongs to a reviewer. The file is read, never written. The reader and the font rule re-express impeccable's `DESIGN.md` support and its `design-system-font` rule.

## Dark Mode Bias

AI disproportionately generates dark mode because dark screenshots look more "modern" and the purple-blue gradient aesthetic works better against dark backgrounds. The result: dark mode delivered without light mode, or light mode as a broken afterthought.

**Rule:** If the project needs theming, design both modes intentionally. Neither is a derivative of the other.

The 2026 sources split on which direction the default runs: one names permanent dark mode as the single most common tell, another names light-mode-only with no `dark:` variants anywhere. The disagreement is the evidence. What both describe is the absence of a decision about theming, which is why the rule above is about intent rather than about which mode shipped, and why there is no scanner rule here. Whether a light theme exists is an absence claim about the whole project, and a single file cannot see it.

## AI Component Fingerprints

These are the specific, repeatable component-level patterns AI produces identically every time. Each can be used when appropriate, but using ALL of them together on one page is what creates the "AI-generated" look. Unless the user requests these specific patterns, vary the approach.

### Badge Pill Above Hero Headings

A small colored pill (`rounded-full px-3 py-1 text-sm bg-primary/10`) above the main headline with "Introducing...", "New", "AI-Powered", or a sparkle icon. Present on nearly every AI hero section.

**Instead:** Skip the badge unless there is a real announcement. If announcing something, use a less formulaic treatment (a colored underline, a sidebar callout, an inline label).

### The Tracked-Out Uppercase Overline

`text-xs uppercase tracking-wider` above a section heading or on a table header. Entry 4 in the Strongest-10 below, and the most-repeated three-class run in generated markup after the hero triplet. The scanner matches it as `uppercase-overline`.

**Instead:** set the overline in the project's own type scale. A distinct size, weight, or colour does the same job of marking a label as subordinate, and does it in the project's voice rather than the framework's. A tuned tracking value (`tracking-tight` on a logotype, a specific `letter-spacing` chosen for the face) is a decision and is deliberately not matched, on the same principle as `tailwind-hero-triplet`: the tell is the untouched default run, not the technique.

### Gradient Text on Hero Headings

`bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent` applied to one or two words in the headline ("Build **Better** Faster"). The gradient-text span is a v0/Claude signature.

**Instead:** Use size contrast, weight contrast, a single flat accent color on one word, or serif/sans-serif mixing within the headline. The typography itself should be the design, not a CSS gradient trick.

### Decorative Blur Blobs

`absolute -z-10 w-72 h-72 bg-purple-300 rounded-full blur-3xl opacity-20` scattered behind sections. Purely decorative, adds no information.

**Instead:** Solid color blocks between sections, subtle texture/grain at 2-5% opacity, real photography, or white space. If the background needs visual interest, use something related to the content. The scanner matches the composition as `blur-blob`: a `blur-2xl` or `blur-3xl` on the same element as a `rounded-full`, which is the shape nothing else produces. A `blur-3xl` over a real photographic backdrop has no `rounded-full` sibling and does not match.

### The Frosted Glass Navigation Bar

`bg-white/80 backdrop-blur-md border-b sticky top-0 z-50` with `h-16`, 4-6 nav links, and a CTA button in the top-right. This exact combination is the strongest single-component AI fingerprint.

**Instead:** Vary the nav height, skip the blur effect when it doesn't serve the design, use dropdowns or mega-menus for complex sites, or try a sidebar navigation. Not every site needs a frosted sticky nav.

### Two-Button CTA Group

Always one filled primary button ("Get Started") + one ghost/outline secondary ("Learn More"), side by side, centered below the subtitle. AI never generates a single CTA, never three CTAs.

**Instead:** One call to action per distinct thing the page wants the visitor to do, which is usually one. A second button exists only when a second action genuinely exists (a demo booking beside a signup, a download beside a purchase), and it is named after that action rather than "Learn More". A page whose content leads to the action can have none.

### Stats Row

3-4 cards with a big number, a label, and a green/red percentage change ("$45,231.89", "+20.1% from last month"). The exact value "$45,231.89" originates from shadcn/ui's dashboard example.

**Instead:** Use stats relevant to the actual product. Vary the visual treatment (sparklines, gauges, contextual benchmarks). Skip the percentage change if the number alone tells the story.

`shadcn-stats-magic` matches the two literals themselves (`$45,231.89` and `+20.1% from last month`) rather than the layout, which makes it one of the highest-precision rules in the set: those exact strings come from one documentation example and appear in shipped product UI only by copy-paste. It is a **Quality defect**, not a smell, because a docs placeholder rendering as a user-facing figure is wrong regardless of how it looks. **Remediation:** wire the real number, or show the empty state until there is one. Any real currency figure is clean.

### The "Alternating Left-Right Feature Showcase"

Feature sections that alternate: text on left + image on right, then image on left + text on right, repeating down the page. Every section is the same structure, just flipped.

**Instead:** Vary section layouts. Some features deserve a full-width demo. Some need only text. Some work as a grid. Let the content determine the layout, not a mechanical alternation pattern.

### Wave/Curved Section Dividers

SVG wave or curved shape between page sections, usually in a light gray or the primary color at low opacity.

**Instead:** Use background color changes, horizontal rules, generous white space, or no divider at all. If sections are well-designed, they don't need decorative separators.

### Identical Footer Structure

4 columns: Brand + description + social icons, then "Product", "Company", "Legal" link groups. Dark background (`bg-gray-900`). Always "All rights reserved." Always the same 4 social icons (Twitter, GitHub, LinkedIn, Discord).

**Instead:** Match footer tone to the overall design (light footers exist). Column count and grouping follow the site's actual structure: a four-page site does not need four link columns. Include newsletter signup, office addresses, or trust badges when they are real. Skip "All rights reserved" (legally redundant). The tell is the template with nothing behind it; vary where the site gives a reason and keep the convention where it does not.

### Dashboard Layout Trinity

`w-64` dark sidebar + `h-16` header with search + bell + avatar + 4 stats cards + Recharts chart + "Recent Orders" table. This exact layout appears across every AI dashboard generation.

**Instead:** Ask what the operator comes to this screen for and put that above the fold; four stat cards and a recent-orders table are the answer for a shop, not for a monitoring console or a ledger. The sidebar is as wide as its longest real label, the chart shows the figure the operator acts on, and the empty state is designed before the populated one. The shadcn dashboard this layout copies is a documentation example, not a product.

### Uniform Spacing Scale

AI uses the same spacing values everywhere: `p-6` for card bodies, `gap-8` between cards, `py-20` for section padding, `mt-2`/`mt-4`/`mt-6`/`mt-8` between elements. The mechanical regularity is a tell.

**Instead:** Base spacing on a deliberate scale (4px grid), but vary it by context. Dense data sections use tighter spacing. Spacious hero sections use more generous spacing. The spacing should serve the content, not follow a template.

The section-padding leg of this has a rule: `uniform-section-padding` fires at three `py-20` or `py-24` in one file, which is the point at which the page has stopped deciding and started repeating. **Remediation: vary the vertical rhythm by what the section holds.** A dense table does not want the same air as a hero, and a closing CTA usually wants more than either. One `py-20` beside a `py-12` and a `py-32` is a rhythm and does not match. A deliberate uniform 5rem rhythm is a real design decision, which is why the rule is low severity and needs three hits.

### Identical Testimonial Cards

Always 3 cards. Always 5 yellow stars. Always 2-3 sentence hyperbolic quotes. Always circular `w-10 h-10` avatar. Names from a small pool ("Sarah Johnson", "Michael Chen"). Always "CEO at TechCorp."

**Instead:** Real quotes from real people, with their names, and permission on file. With none, no testimonial section: an invented quote is a falsehood on the page rather than a design choice, and invented ratings mixed to look plausible are the same falsehood with decimals. Where real quotes exist, one large testimonial with supporting smaller ones, or embedded third-party reviews, reads as considered, and a specific figure ("saved 40 hours a month") carries more than adjectives.

### Pricing Table Convention

Always 3 tiers. Middle one always highlighted with "Most Popular" floating badge (`absolute -top-3 rounded-full`). Always monthly/annual toggle saving "20%". Always checkmark feature lists.

**Instead:** Tier count, emphasis, and the billing toggle follow the product's real plans: two plans get two columns, and a plan is highlighted only when the product can say why it is the right one for most buyers. Where the differences between plans are detailed, a comparison table reads better than three columns of check marks. "Most Popular" appears only when it is true.

### Skeleton/Loading Defaults

CSS border spinner (`animate-spin border-4 border-t-primary`) or `animate-pulse bg-gray-200` skeletons with fractional widths (`w-3/4`, `w-1/2`). The stepped-fraction pattern is a strong AI tell.

**Instead:** Skeleton shapes that match the layout they stand in for, so the page does not jump when content arrives, and progressive loading where content appears as it lands. A shimmer or a branded animation is a choice, not a requirement: the tell is the stepped-fraction template with nothing behind it, and a plain pulse on a skeleton that mirrors the real layout is fine.

### 404/Error Page Formula

Giant gray "404" text (`text-8xl text-gray-200`), "Page not found", "Sorry, we couldn't find..." description, "Go home" + "Go back" buttons. No illustration, no personality.

**Instead:** Say what happened in the product's voice, and give the visitor a way forward that fits this site: a search box, the pages people actually came for, a link back to where they were. An illustration or an animation is welcome when the brand has one and unnecessary when it does not; the tell is the formula with nothing behind it, and a plain page that helps beats a decorated page that does not.

## The 10 Strongest AI Design Fingerprints (Ranked)

For reference, the patterns most reliably marking output as AI-generated:

1. `rounded-xl shadow-sm border` on every card
2. `bg-white/80 backdrop-blur-md border-b` frosted navigation
3. `w-64` sidebar + `h-16` header in dashboards
4. `text-xs uppercase tracking-wider` on table headers and overlines
5. "Most Popular" badge floating above middle pricing tier
6. `bg-primary/10` icon containers (`w-12 h-12 rounded-lg`) in feature grids
7. `animate-pulse bg-gray-200` skeletons with fractional widths
8. `bg-black/50` modal overlay with `max-w-md p-6 rounded-xl`
9. The **verbatim** run `text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight` on a hero heading -- the unmodified string, not a responsive type scale
10. 4-column footer with "Product / Company / Legal" headers

None of these are wrong individually. The tell is when they all appear together on the same project with no variation or customization. Each has its remediation in its own section above (the AI Component Fingerprints and Visual Design entries), and the one that needs the most care is entry 9, below.

### What entry 9 is, and what it is not

Entry 9 is a **genericness signal**: the presence of the untouched copy-paste string that
ships with every Tailwind hero example. It is graded as a pattern smell, not a defect, and
the scanner matches only that exact class run in that exact order.

**It is not a rule against responsive typography.** A scale on different steps, a tuned
tracking value, or a fluid `clamp()` ramp is a different string and is not this
fingerprint. This distinction is load-bearing, because the cheapest way to make the
original over-broad rule stop matching was to delete the responsive sizes, which makes the
page worse and fails WCAG 1.4.4 Resize Text. A review of a hero heading that ends with
less responsive behaviour than it started with was a wrong review.

**Remediation:** replace the stepped ramp with a fluid one and tune the tracking, so every
viewport width in the range gets a size chosen for it rather than the size of the nearest
breakpoint down:

```css
h1 {
  font-size: clamp(2rem, 1.2rem + 3.2vw, 4.5rem);
  letter-spacing: -0.025em;
}
```

Keep the `min` at or above 16px on body text. Never replace it with a single fixed size.

## Presence and concentration

Not every tell fires the same way, and treating a concentration tell as if one hit were
damning is the largest single source of false positives. Before writing a finding,
classify what you matched.

**Presence-flaggable -- one instance is the finding.** Specific, high-signal compositions
that read as generated on sight: the AI Component Fingerprints above, the Strongest-10,
gradient text on a hero word, the frosted sticky nav, the unmodified shadcn card.

**Concentration -- the finding is the density, not the instance.** Most property-level
rows: colors, fonts, radii, spacing. Weight by repetition, and count before flagging.

### Which of these the scanner can actually see

Presence-flaggable and scanner-implemented are different claims, and this section previously
ran them together under a heading about thresholds. Most of the compositions in this file have
**no rule**, so a clean scan of a `.tsx` file says nothing whatsoever about them. They are the
agent's to find, and `empirical-rankings.md` § Coverage matrix states the same boundary
across every family.

| Tell | Scanner rule? |
|---|---|
| Gradient text on a hero word | Yes (`gradient-text`) |
| Frosted sticky nav | Yes (`frosted-glass-nav`) |
| Unmodified shadcn card | Yes (`shadcn-default-card`, `shadow-border-rounded-combo`) |
| Side stripe on a card | Yes (`side-stripe-accent`) |
| Bounce easing, the pulsing live dot, the marquee | Yes (`bounce-easing`, `pulsing-dot`, `marquee`) |
| Dot, grid and stripe background patterns, the radial halo on a dark page | Yes (`background-pattern`, `radial-halo`) |
| Text contrast on its surface | Partly (`low-contrast`, `low-contrast-near-bar`: declared surfaces only, no Tailwind colour utilities) |
| Grey text on a coloured surface | Yes (`gray-on-color`) |
| Heading levels skipped | Yes (`skipped-heading`, full HTML documents) |
| A face outside the typography DESIGN.md declares | Yes (`design-system-font`, only where a DESIGN.md is found) |
| Type below the legibility floor, the reading-mechanics settings | Partly (`text-size-floor`, `tight-leading`, `wide-tracking`, `justified-narrow-column`, `crushed-tracking`: one block at a time) |
| Icon in a colored circle | Yes (`icon-in-colored-circle`) |
| Decorative blur blobs | Yes (`blur-blob`) |
| Tracked-out uppercase overline (Strongest-10 #4) | Yes (`uppercase-overline`) |
| The verbatim hero type run (Strongest-10 #9) | Yes (`tailwind-hero-triplet`) |
| The shadcn stats literals | Yes (`shadcn-stats-magic`) |
| Generic microcopy literals | Yes (`generic-microcopy`) |
| Hero scroll-indicator microcopy ("Scroll to explore") | Yes (`hero-scroll-hint`) |
| Unthemed Bootstrap palette hexes (`#0d6efd` / `#0b5ed7` / `#dee2e6`) | Yes (`bootstrap-default-blue`, and only where the file also carries the primary blue) |
| Bootstrap's 4px-radius-everywhere | Partly (`uniform-literal-radius`, 3+, and only where the file states no radius identity) |
| Bootstrap's default shadow, zebra-striped tables | **No** |
| Keyword easings / scale(0) entrances, cards-in-cards, logo tells | **No** |
| `w-64` sidebar + `h-16` header (Strongest-10 #3) | **No** |
| "Most Popular" floating badge (#5) | **No** |
| `bg-primary/10` icon containers (#6) | **No** |
| `animate-pulse` skeletons with fractional widths (#7) | **No** |
| `bg-black/50` modal overlay with `max-w-md` (#8) | **No** |
| 4-column footer (#10) | **No** |
| Badge pill above the hero, two-button CTA group, alternating L-R sections, wave dividers, testimonial trio, pricing convention, 404 formula, the SaaS page sequence | **No** |

Every design rule that counts before it reports, and the threshold it counts to. All of them
are listed; a rule absent from this table is presence-flaggable, where one hit is the finding.

| Tell | Fires at | Because |
|---|--:|---|
| `rounded-everything` | 3 | "The same radius on every interactive control" is a pattern; one pill is a choice |
| `uniform-literal-radius` | 3 | Same claim in raw CSS, and silenced entirely on any file that states a radius identity (a `--radius` token, or a `border-radius: var(...)`) |
| `uniform-section-padding` | 3 | One `py-20` beside a `py-12` and a `py-32` is a rhythm, not a default |
| `cream-serif-default` | 2 | The combination is the signal: two distinct legs, where clay counts only beside the serif display |
| `ai-purple-hex` / `ai-purple-class` | 2 | The tell is "indigo IS the palette", which one declaration does not establish. A tokens file that declares the whole Tailwind ramp (`--violet-500`) is not the palette in use until something reads the token; a semantic role (`--primary`, `--brand`) counts where it is declared |
| `bootstrap-default-blue` | 2 | Same logic, Bootstrap's compiled literals. Counting alone was not enough here: the count sums matches, not distinct hexes, so the rule additionally requires the primary blue to be in the file before the border gray counts toward anything |
| `important-overuse` | 2 | The rule is named *overuse*; one override against a third-party widget is pragmatism |
| `transition-all` | 2 | One `transition: all` on a single control is laziness; two is the file's default |
| `token-drift-spacing` | 2 | Needs two off-scale values, and only in a file that declared two `--space` tokens to drift from |
| `shadow-border-rounded-combo` | 3 cards, or 2 | The trio is the surface's card treatment when three cards carry it, or every card of a surface that has two; one framed card among unframed sections is a choice |

**The floor rule: a lone utility-class hit is not a finding.** One `text-slate-600`, one
`shadow-sm`, one `rounded-full` on a decorative avatar, on an otherwise coherent surface,
is clean. Do not write it up. The signal is an unspecified default reached for repeatedly
and without a point of view, never the presence of any single class.

`important-overuse` carries a suppression guard, and it is wider than the reduced-motion
case it was written for. The guard is a per-line test, so it clears **any** line where the
`!important` sits on a `transition`, `animation`, or `scroll-behavior` declaration, and any
line mentioning `prefers-reduced-motion`, wherever in the file that line appears. That
covers the canonical `* { transition: none !important }` inside a
`prefers-reduced-motion` block, which is the correct implementation of WCAG 2.3.3 and whose
only "fix" would be an accessibility regression. It also covers a motion `!important`
outside such a block, which is deliberate: those overrides are almost always the same
intent, and firing on them would push a reviewer toward removing motion handling. Know the
real breadth before reporting a suppressed line as a miss.

Confidence classes, the evidence rules, and the full remediation floor are in
`confidence-and-evidence.md`.

## Additional AI Design Tells

### Social Proof Notification Toasts
"John from NYC just signed up 2 minutes ago" popups in the bottom-left corner. Auto-dismissing after 3-5 seconds. Small card with avatar, name, action, timestamp. A dark pattern borrowed from Fomo/UseProof SaaS tools and reproduced by AI as a default "engagement" element.

**Instead:** Skip these entirely unless the product genuinely benefits from real-time activity signals. If used, show real data, not fabricated names.

### Chat Widget Bubble
A circular button (`fixed bottom-4 right-4 rounded-full w-14 h-14 bg-indigo-600 shadow-lg`) with a chat icon, always in the bottom-right corner, always with a subtle bounce animation on load. AI adds this by default even when no chat system exists.

**Instead:** Only add a chat widget if there is an actual chat system behind it. A non-functional chat bubble is demo-ware.

### Dot/Grid Background Patterns
CSS `radial-gradient(circle, #e5e7eb 1px, transparent 1px)` with `background-size: 20px 20px` behind hero sections. A decorative pattern that adds no information.

**Instead:** Use a solid background, a photograph, a subtle texture, or white space. If a grid pattern serves a specific purpose (graph paper aesthetic for a data tool), use it intentionally.

The scanner rule is `background-pattern`, low severity, Pattern smell: two or more hairline stops on a px tile (a grid), a radial stop of 2px or less on a px tile (a dot field), or a repeating gradient whose last stop falls short of its full length (stripes). One hairline is a ruled line or a rail, and a repeating gradient that runs its whole length paints once; both stay clean. Where the grid is the stated surface, mark the line `anti-slop-allow: background-pattern -- <reason>`. It re-expresses impeccable's `codex-grid-background` and `repeating-stripes-gradient` rules.

A related texture is the radial halo: a saturated glow fading to nothing behind a section of a dark page, `radial-gradient(circle at 50% 0%, rgba(34, 211, 238, 0.8), transparent 70%)`. The scanner rule is `radial-halo`, low severity, Pattern smell: on a page ground darker than 0.05 relative luminance, a radial gradient whose first stop is opaque (alpha 0.7 or more) and chromatic and whose last stop is transparent, with no stop pinned within 24px. A light page, a translucent wash and a small spot stay clean. Ground the section with a solid or slightly shifted surface instead, or put the light on the content. It re-expresses impeccable's `radial-halo` rule.

### The SaaS Landing Page Sequence
AI produces pages in this exact order regardless of project type: nav, hero, logo bar, stats row, feature grid, alternating L-R features, testimonials, pricing, FAQ accordion, CTA repeat, footer. A restaurant, portfolio, e-commerce store, and SaaS product all get this same structure.

**Instead:** Let the content determine the page structure. A portfolio leads with work samples. A restaurant leads with the menu or a reservation CTA. An e-commerce site leads with products. The page structure should match what the user came to do.

The logo bar deserves its own sentence: a "Trusted by" strip of invented or borrowed company logos is a falsehood, not a tell. Delete it until there are real customers who agreed to appear, and then show those.

### The Bootstrap Fingerprint

The Tailwind sections above have a Bootstrap twin. Unthemed Bootstrap ships a recognizable set of compiled literals: primary blue `#0d6efd` (hover `#0b5ed7`), `#dee2e6` borders, the `0 2px 4px rgba(0,0,0,.1)` default shadow, 4px radius on everything, and zebra-striped tables. Any one is unremarkable; two or more together is the framework's palette wearing the product's clothes, the same non-decision as an un-themed shadcn kit. The scanner matches the three hex literals as `bootstrap-default-blue` (concentration, from two occurrences), because those exact values reach shipped CSS only by leaving the theme untouched. The count sums matches rather than distinct hexes, so the rule additionally requires the primary blue to be present in the file: one chosen neutral gray reused across a sheet is a token decision, not an unthemed framework, and the rule has to be able to tell those apart. The trade is stated recall -- a sheet that themed the blue and kept `#dee2e6` is invisible to the scanner and is the agent's to catch.

**Remediation:** theme the framework -- set `$primary`, the border and radius variables, and the shadow scale to project values -- or adopt the project's own tokens. For tables, replace the striping with row rules (a 1px bottom border in the border token) and a row highlight on both `:hover` and `:focus-visible`, so the row boundary survives touch and keyboard rather than becoming pointer-only; striping earns its place on dense reference tables read row-by-row. Swapping `#0d6efd` for another framework's default is the reset-the-clock move, not a fix. Mid-migration is the one file where these literals legitimately sit together in bulk -- a legacy token sheet naming the old values so they can be replaced -- and the escape hatch (`anti-slop-allow:` / `unslop-ignore` on the line) is the designed answer there.

*(This entry and the three below are adapted from [VibeCurb](https://github.com/Yu-369/VibeCurb), MIT, Copyright (c) 2026 Yu-369 -- heuristic provenance, not corpus-ranked; graded accordingly.)*

### Scroll Indicators in the Hero

"Scroll to explore" with a bouncing chevron at the bottom of a full-viewport hero. A generated page adds it because the hero was built as a poster rather than as the top of a page. The scanner matches the literal as `hero-scroll-hint`, its own rule rather than a sixth string inside `generic-microcopy`: the hint asserts something true about the page, so it is a Pattern smell rather than that rule's Quality defect, and its remediation is structural rather than a copy rewrite. The rule skips any line carrying an `aria-label` or an `alt`, where the remediation below would delete screen-reader output instead of fixing a layout.

**Remediation:** let the layout invite scrolling. Content visibly cut at the fold says "there is more" better than a label does. If the hero genuinely fills the viewport with nothing peeking, that is the thing to fix.

### Cards Inside Cards Inside Cards

A bordered, rounded, shadowed container holding another bordered, rounded, shadowed container holding a third. Each wrapper was generated in isolation, so each brought its own elevation. The nesting reads as bureaucracy: three frames, one piece of content.

**Remediation:** one container level carries the elevation; inner groupings use spacing, rules, or background shifts. Judgment call, no scanner rule -- Pattern smell, and grade by depth (two levels can be a real hierarchy; three almost never are).

### The Unchosen Easing and the scale(0) Entrance

Two motion defaults that mark generated CSS the way keyword colors mark a palette. First: every `transition` and `animation` in the file runs on CSS keyword easings (`ease`, `ease-in-out`, `linear`) -- the browser's "nobody decided" curves. A keyword easing is fine when chosen; a file where no curve was ever named is a file where no motion was ever designed. Second: entrance animations from `scale(0)`, growing elements out of nothingness. Nothing physical appears from zero; the generated look is a rendering glitch played on purpose.

**Remediation:** name the curves -- a `cubic-bezier()` or spring chosen for the interaction, declared once as a token and reused -- and start entrances at `scale(0.9)`-`scale(0.97)` paired with opacity. Both remediations add intent and remove no motion, so the remediation floor is clear. No scanner rule on either: keyword easings are ubiquitous in human CSS and the corpus has no ranking for them, so this stays an agent judgment weighted the same way as the rest of the animation family (lightly, per `empirical-rankings.md`).

### The "Logo Swap Test"
The fastest diagnostic for AI-generated design: if you can swap any SaaS logo onto the page and it still makes sense, the design lacks identity. Good design is inseparable from its content and brand.

## Logo and Brand Mark Tells

Generated logos and brand boards have their own default set, distinct from page-level tells. These apply when reviewing brand output -- logo concepts, identity boards, hero mockups with generated marks. *(Adapted from [VibeCurb](https://github.com/Yu-369/VibeCurb), MIT, Copyright (c) 2026 Yu-369; heuristic provenance.)*

The recurring defaults, in rough order of frequency:

- **Brain/neuron network marks** for anything AI-adjacent -- the single most common generated-logo cliche
- **Globe with a swoosh** (1990s corporate identity), **shield with wings** (the lazy security mark), **interlocking rings**, **infinity symbols**, **sparkle bursts**
- **Metallic/chrome 3D rendering** -- logos are flat; bevels and reflections mark a mark as generated
- **Gradient-dependent marks** -- if the shape is unrecognizable in one flat color, the form is weak
- **Hairline-thin strokes** that vanish at favicon scale, and **crests with 4+ elements** (an illustration, not a logo)

**Remediation is reduction, not swapping cliches.** A sound mark passes four tests: constructible from at most 3 geometric primitives; recognizable at 16x16 (the favicon test); describable in one sentence ("two overlapping rounded squares with the intersection removed"); and identical in black-on-white and white-on-black (the inversion test). A mark that fails these is not fixed by picking a different cliche from the list above. No scanner rules here -- image output is outside the scanner's reach; these are the agent's to catch.
