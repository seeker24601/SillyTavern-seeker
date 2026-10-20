# seeker

A visual novel theme for SillyTavern: the character's sprite on a stage beside a full-height chat, set in Bodoni and Jost, with DM Mono for code.

## Install

Needs SillyTavern 1.19 or later.

1. Open Extensions (the cubes icon in the top bar) and click **Install extension**.
2. Paste this link and install:

   ```
   https://github.com/seeker24601/SillyTavern-seeker
   ```

The theme switches itself on. A gold variant, seeker gilt, is in User settings > UI Theme.

The stage shows a character's expression sprites. Characters without sprites get a single centred column.

SillyTavern tells you when an update is out. To remove the theme, delete it in Extensions > Manage extensions, then pick another UI Theme in User settings.

## What it does

- The sprite fills a stage with the character's name set vertically in Bodoni, and the background dissolves into the chat through a halftone.
- Expressions dissolve into each other, and new messages fade in.
- Every menu opens as a centred panel. User settings, Formatting and AI response show one section at a time.
- Dialogs, notifications, tooltips and icons ([Lucide](https://lucide.dev)) match the theme.
- On phones the top bar folds into a menu button and the chat fades up over the sprite.

## Customize

Every colour, font, size, spacing step, corner radius and layer is a variable in [`variables.css`](variables.css), with a note on what it changes. Copy the ones you want into User settings > Custom CSS and change them there, where updates won't overwrite them:

```css
:root {
  --seeker-chat-width: 600px;
  --seeker-radius-md: 8px;
}
```

The accent is the Underlined Text colour in User settings > Theme Colors, and the chat's narration, actions and dialogue follow Main Text, Italics Text and Quote Text.

## Develop

`scripts/link.sh [path-to-SillyTavern]` links this folder into a local SillyTavern. Edit the CSS and reload the tab. `style.css` holds the layout and imports the rest, one file per area. `npm run build:icons` rebuilds `icons.css`, and `node scripts/ornament.cjs ornament.svg` redraws the stage ornament.

## License

Lucide icons are ISC licensed (`LICENSE-lucide`). Bodoni Moda, Jost and DM Mono are under the SIL Open Font License (`fonts/`).
