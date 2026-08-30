/**
 * Verbatim excerpt of Anthropic's official `pptx` skill
 * (github.com/anthropics/skills, skill id "pptx", `SKILL.md`, fetched via
 * `npx skills add https://github.com/anthropics/skills --skill pptx`).
 *
 * Only two things were cut, both because they don't apply to how this bot
 * generates slides:
 *   - Everything about the skill's own tooling (Python validators,
 *     LibreOffice/`soffice` rendering, `markitdown`, editing/templates, the
 *     screenshot-based visual QA loop, `python-pptx`, react-icons/sharp icon
 *     rendering) - that all assumes an interactive coding agent with real
 *     filesystem/shell access. Claude here only ever writes JavaScript that
 *     runs through our fixed bridge functions (src/pptx/bridge.ts) inside an
 *     `isolated-vm` sandbox with no filesystem, network, or process access,
 *     and we already have our own icon system (src/pptx/icons/).
 *   - The example color-palette table and the "don't default to blue/cream"
 *     line: our themes (src/pptx/themes/) already fix the deck's exact
 *     colors, so the model never chooses a palette.
 * Everything else below is the skill's own wording, unedited.
 */
export const PPTX_SKILL_DESIGN_GUIDE = `
## Design Ideas

**Don't create boring slides.** Plain bullets on a white background won't impress anyone. Consider ideas from this list for each slide.

### Before Starting

- **Dominance over equality**: One color should dominate (60-70% visual weight), with 1-2 supporting tones and one sharp accent. Never give all colors equal weight.
- **Dark/light contrast**: Dark backgrounds for title + conclusion slides, light for content ("sandwich" structure). Or commit to dark throughout for a premium feel.
- **Commit to a visual motif**: Pick ONE distinctive element and repeat it — rounded image frames, icons in colored circles. Carry it across every slide. **Do not use a color bar or accent stripe as your motif** (see Avoid list).

### For Each Slide

**Every slide needs a visual element** — image, chart, icon, or shape. Text-only slides are forgettable.

**Layout options:**
- Two-column (text left, illustration on right)
- Icon + text rows (icon in colored circle, bold header, description below)
- 2x2 or 2x3 grid (image on one side, grid of content blocks on other)
- Half-bleed image (full left or right side) with content overlay

**Data display:**
- Large stat callouts (big numbers 60-72pt with small labels below)
- Comparison columns (before/after, pros/cons, side-by-side options)
- Timeline or process flow (numbered steps, arrows)

**Visual polish:**
- Icons in small colored circles next to section headers
- Italic accent text for key stats or taglines

### Typography

| Element | Size |
|---------|------|
| Slide title | 36-44pt bold |
| Section header | 20-24pt bold |
| Body text | 14-16pt |
| Captions | 10-12pt muted |

### Spacing

- 0.5" minimum margins
- 0.3-0.5" between content blocks
- Leave breathing room—don't fill every inch

### Avoid (Common Mistakes)

- **Don't repeat the same layout** — vary columns, cards, and callouts across slides
- **Don't center body text** — left-align paragraphs and lists; center only titles
- **Don't skimp on size contrast** — titles need 36pt+ to stand out from 14-16pt body
- **Don't mix spacing randomly** — choose 0.3" or 0.5" gaps and use consistently
- **Don't style one slide and leave the rest plain** — commit fully or keep it simple throughout
- **Don't create text-only slides** — add images, icons, charts, or visual elements; avoid plain title + bullets
- **Don't forget text box padding** — when aligning lines or shapes with text edges, set \`margin: 0\` on the text box or offset the shape to account for padding
- **Don't use low-contrast elements** — icons AND text need strong contrast against the background; avoid light text on light backgrounds or dark text on dark backgrounds
- **NEVER use accent lines under titles** — these are a hallmark of AI-generated slides; use whitespace or background color instead
- **NEVER add decorative color bars or accent stripes** — this includes: header/footer bars spanning the slide width, vertical sidebar stripes down one edge of the slide, thin accent stripes along one edge of a card or content block, and "single-side borders" on rectangles. These read as AI-generated filler. If you want to set a card apart, use a subtle background tint, a drop shadow, or an icon — not an edge stripe.
- **Don't ship text that overflows its shape** — if text doesn't fit, reduce font size, split across slides, or enlarge the container; never leave content cut off or spilling past bounds

## pptxgenjs gotchas

These options are passed straight through to real pptxgenjs calls, so its footguns apply directly:

- **Hex colors: never \`#\`, never 8 digits.** \`color: "FF0000"\`. Both \`"#FF0000"\` and alpha baked into the hex (\`"00000020"\`) **corrupt the file**. For translucency: \`transparency: 0-100\` on fills and images, \`opacity: 0.0-1.0\` on shadows — each is silently ignored on the other.
- **Shadow \`offset\` must be ≥ 0** — a negative offset corrupts the file. To cast a shadow upward, use \`angle: 270\` with a positive offset.
- **\`letterSpacing\` is silently ignored** — the real option is \`charSpacing\`.
- **Lists:** \`bullet: true\` on each item, never a literal \`•\` (renders double bullets). Set \`breakLine: true\` on every array item except the last. Space bulleted paragraphs with \`paraSpaceAfter\`, not \`lineSpacing\` (huge gaps).
- **\`rectRadius\` only works on \`ROUNDED_RECTANGLE\`**, not \`RECTANGLE\`.
- **Gradient fills aren't supported** — use a gradient image as the background instead.
- **Text boxes have built-in internal padding** — set \`margin: 0\` whenever text must align with a shape, line, or icon at the same x.
- **Default charts render bare** — no title, no data labels, dated palette. Set \`showTitle\` + \`title\`, \`showValue: true\` + \`dataLabelPosition\`, \`chartColors: [...]\` from your palette, and quiet the frame (\`catAxisLabelColor\`/\`valAxisLabelColor\`, \`valGridLine: { color, size }\`, \`catGridLine: { style: "none" }\`, \`showLegend: false\` for a single series).
- **On a stacked bar or column chart, \`dataLabelPosition\` must be \`ctr\`, \`inEnd\`, or \`inBase\`.** \`outEnd\` **corrupts the file**.
`.trim();
