# seeker

A visual novel theme for SillyTavern, by seeker. Modelled on MyPhone's Live view.

- The character sprite fills a stage on the left at full height and zooms in slightly on hover, with the character's name set large and vertical in Bodoni, outlined in white with a soft silver gradient along its length, on the stage's right edge. It starts centred and rises as the chat scrolls, slower than the chat (a parallax), until it reaches the top. Beside it runs a hairline spine carrying the card's creator and version in italic small caps.
- On desktop, the stage has a fine, still grain and darkens softly towards its corners and foot, and a thin-line geometric ornament (quarter arcs, ticks and a seal of two squares in a circle) sits in its bottom-left corner, over the background and under the sprite.
- When the character's expression changes, the old sprite dissolves into the new one over about half a second instead of cutting.
- Your messages are the quieter voice: your name in Bodoni italic, a little dimmer, and your text set off by a hairline.
- A new message fades in and rises a few pixels. While a reply is on its way, three small four-pointed stars with a passing glint replace SillyTavern's dots.
- Portraits in the chat and the enlarged portrait are matted: a fine light line inset from the edge, like a print in a mount.
- Colour stays out of the way: chosen tabs, sections, switches, the New button and a dialog's main button are solid white with black text, and selections are white tints. The accent colour appears only in the composer's focus sheen, success notices and underlined chat text.
- Tooltips are small dark cards with the panels' glass edge instead of the browser's own.
- Notifications are small dark cards with the panels' glass edge, a tinted icon for their kind and a Bodoni title. Editing a message keeps the chat's type size and line spacing.
- A reply's thinking folds into one faint line in Bodoni italic. Opened, it reads as an aside: smaller, fainter text set off by a hairline, with the model's notes in the same font.
- The chat is a full-height, solid column on the right. The background fills only the stage, dissolves into the column through a halftone at its edge, and drifts towards the pointer while it is over the stage (not with the system's reduce-motion setting).
- On the welcome screen, the stage shows the SillyTavern logo, name and version with the Docs, GitHub, Discord and Temporary Chat links, and the chat column shows the recent chats.
- With no sprite to show (a character without sprites), the chat is one centred column without the stage.
- Dialogue is bright and narration is dimmer, with no message cards.
- The top bar is folded into a menu button in the top right corner.
- User settings, Formatting and AI response (Chat Completion) show one section at a time, chosen from a list beside them (a scrolling row on phones). Searching User settings shows the matching settings from every section.
- Every menu item opens a large panel centred on the screen over a dimmed backdrop, with a header showing its name and a close button. Controls that apply to the whole panel, such as presets, the connection profile, the backgrounds toolbar and the character being edited, sit in that header and stay in view while the rest scrolls. Escape or a click on the backdrop also closes it. Author's Note, CFG, token probabilities and Advanced Definitions open the same way. Dialogs are centred too, compact for prompts and confirmations, and the same large size as the panels for anything SillyTavern marks wide or large.
- One type scale. Headings are Bodoni Moda at three sizes (22px panel titles, 18px sections, 16px subsections and names), and the SillyTavern name on the welcome stage is Bodoni Moda SC at 56px. Dates, message numbers, timers and counts are Bodoni Moda SC at 13px, letter-spaced; everything else is Jost at 16px for chat, 14px for panel text and controls and 12.5px for hints. A greeting opens on a three-line Bodoni drop cap, and every panel title sits over a Scotch rule (a thick and a thin line). Line heights follow the role: 1.2 for titles and sections, 1.25 for subsections and names, 1.3 for single-line UI (labels, buttons, inputs, menus, counters), 1.4 for hints, 1.5 for running text and text areas, and 1.55 for chat prose. Sizes and line heights are tokens at the top of `typography.css`.
- One spacing scale (4, 8, 12, 16, 24, 32px). Panels and dialogs have 24px padding; headings, fields, checkbox rows, sliders and sections are spaced from the scale.
- Colours are neutral greys with one accent. The accent is the Underlined Text colour in User settings > Theme Colors (emerald by default, gold in seeker gilt): change it there and the composer's sheen and success notices follow. Chat colours come from the same Theme Colors: grey narration, dimmer grey for actions in italics and near-white for spoken dialogue.
- Controls have no borders: inputs and buttons are soft fills with a light focus ring, and panels, menus and dialogs are rounded solid surfaces with a glass edge and a shadow. Open dropdown lists are drawn the same way in browsers that support customizable selects (Chrome 135 and later). Icon-only buttons are circles, and they and the composer have a glass edge that brightens with a sheen running round it when focused.
- Clicking a chat portrait shows the character's full image, large and centred over a dimmed screen; a click outside it or Escape closes it.
- The composer is a single slim bar with rounded ends, small icons and a white glass send button.
- At 1000 px wide and below, the sprite sits above the chat, which fades up over it, and panels fill the screen.
- Font Awesome icons are replaced with [Lucide](https://lucide.dev) icons. Brand logos (GitHub, Discord) stay on Font Awesome because Lucide has none.

## Install

1. In SillyTavern, open Extensions, choose Install extension and paste `https://github.com/seeker24601/SillyTavern-seeker`.
2. In User settings > UI Theme, import `theme/seeker.json` (or `theme/seeker-gilt.json`) from this repository and select it.

## Parts

| File | What it is |
| --- | --- |
| `style.css` | All of the styling. SillyTavern loads it as an extension stylesheet. |
| `halftone.webp` | The halftone where the stage meets the chat column on desktop: dot coverage as white on black, used as a luminance mask. |
| `ornament.svg` | The ornament in the stage's bottom-left corner on desktop (drawn for a top-left corner and flipped): thin white lines on transparency. |
| `fonts/` | Bodoni Moda, Bodoni Moda SC and Jost, self-hosted, so the theme works offline. |
| `typography.css` | The type scale: heading levels, text sizes and which font goes where. Imported by `style.css`. |
| `spacing.css` | The spacing scale: modal padding and the rhythm inside panels and dialogs. Imported by `style.css`. |
| `settings.css` | User settings, Formatting and AI response: a list of sections beside one section at a time, each setting a row with its label on the left and its control on the right, switches for checkboxes. index.js adds the list and filters to matching rows while searching. |
| `backgrounds.css` | The Backgrounds panel: a gallery of large rounded tiles with their names, four a row on desktop and two on phones, a lift on hover and a white ring on the background in use. |
| `panels.css` | API connections, Persona, Characters, Extensions and World info: field labels instead of headings for single fields, wrapping toolbars, characters as large portrait cards (four a row) under a toolbar of search, a Filters menu, the sort order and a New menu, a character editor with a Characters back button and the portrait beside its controls, rounded persona rows with a hover fill, quiet extension headers and a dimmed Extras API. |
| `primitives.css` | Inputs, dropdowns, buttons, checkboxes, sliders, panels, menus and dialogs. Borders are switched off (SillyTavern draws them all in `--SmartThemeBorderColor`) and controls are shaped by fills instead. Imported by `style.css`. |
| `icons.css` | Generated. Paints a Lucide icon over each Font Awesome icon class; imported by `style.css`. |
| `scripts/build-icons.mjs` | Builds `icons.css`. Holds the table of Font Awesome names that Lucide names differently. |
| `scripts/ornament.cjs` | Draws `ornament.svg`; its sizes and angles are at the top. |
| `manifest.json` | Extension metadata. |
| `index.js` | Adds the menu button and its open/close behaviour. SillyTavern's own drawer icons become the menu items. |
| `theme/seeker.json` | SillyTavern UI theme with the matching colours. It turns on Visual Novel mode and the Flat chat style. |
| `theme/seeker-gilt.json` | The same theme with a muted gold accent in place of the green. |
| `scripts/link.sh` | Links the project into a local SillyTavern and installs the theme. |

## Develop

```bash
scripts/link.sh
```

The script links this folder into `~/SillyTavern/data/default-user/extensions` and copies the theme into its themes folder. Pass another SillyTavern path as the first argument if needed.

Edit `style.css` and reload the SillyTavern tab to see changes. The values at the top of `style.css`, under `:root`, set the colours, chat width, fade length and corner radius.

### Icons

```bash
npm install
npm run build:icons
```

The build reads SillyTavern's Font Awesome stylesheet to find every icon class and the classes that share a glyph, then picks a Lucide icon for each glyph: from the alias table in `scripts/build-icons.mjs` first, otherwise by matching name. Each icon is painted as a mask in the current text colour, so colours, sizes and spinners carry over. Run it again after updating SillyTavern or `lucide-static`, or after editing the alias table. Set `SILLYTAVERN=/path` for another install, or `STROKE=1.5` for thinner lines.

Visual Novel mode only shows a character who has expression sprites. Put them in `data/default-user/characters/<Name>/`, one image per emotion, for example `joy.png`.

## Requirements

SillyTavern 1.19 or later. Tested in Chrome on macOS and Windows.

## License

Lucide icons are ISC licensed; see `LICENSE-lucide`. Bodoni Moda and Bodoni Moda SC are under the SIL Open Font License; see `fonts/OFL.txt`. Jost is under the same licence; see `fonts/OFL-Jost.txt`.
