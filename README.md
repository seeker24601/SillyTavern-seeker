# seeker | A visual novel theme for SillyTavern

A SillyTavern theme that puts character expression sprites beside a full-height chat. Turn roleplay conversations into a visual novel layout, with a mobile layout and an optional gold variant.

![seeker SillyTavern theme showing a character expression sprite beside the full-height roleplay chat](docs/screenshot.webp)

## Install the SillyTavern theme

Requires **SillyTavern 1.19 or later**. Install seeker through the Extensions menu; it includes the UI theme presets.

1. Open Extensions (the cubes icon in the top bar) and click **Install extension**.
2. Paste this link and install:

   ```
   https://github.com/seeker24601/SillyTavern-seeker
   ```

The theme switches itself on. A gold variant, seeker gilt, is in User settings > UI Theme.

The stage uses your character's expression sprites. To see the visual novel layout, use a character with sprites configured in SillyTavern. Characters without sprites get a single centred chat column.

SillyTavern tells you when an update is out. To remove the theme, delete it in Extensions > Manage extensions, then pick another UI Theme in User settings.

## What it does

- **Character sprite stage:** a large expression sprite beside the chat, with the character's name set vertically and a halftone transition into the background.
- Expressions dissolve into each other, and new messages fade in.
- Every menu opens as a centred panel. User settings, Formatting and AI response show one section at a time.
- Dialogs, notifications, tooltips and icons ([Lucide](https://lucide.dev)) match the theme.
- **Mobile layout:** the top bar folds into a menu button and the chat fades up over the sprite.
- **Two UI theme presets:** seeker and the gold-accented seeker gilt.

## Customize

Every colour, font, size, spacing step, corner radius and layer is a variable in [`variables.css`](variables.css), with a note on what it changes. Copy the ones you want into User settings > Custom CSS and change them there, where updates won't overwrite them:

```css
:root {
  --seeker-chat-width: 600px;
  --seeker-radius-md: 8px;
}
```

The accent is the Underlined Text colour in User settings > Theme Colors, and the chat's narration, actions and dialogue follow Main Text, Italics Text and Quote Text.

## Feedback

[Report a bug or request a change](https://github.com/seeker24601/SillyTavern-seeker/issues). For layout problems, include your SillyTavern version, browser, screen size and a screenshot with private chats or API keys hidden.

## Develop

`scripts/link.sh [path-to-SillyTavern]` links this folder into a local SillyTavern. Edit the CSS and reload the tab. `style.css` holds the layout and imports the rest, one file per area. `npm run build:icons` rebuilds `icons.css`, and `node scripts/ornament.cjs ornament.svg` redraws the stage ornament.

## License

Lucide icons are ISC licensed (`LICENSE-lucide`). Playfair Display, Bodoni Moda, Jost and DM Mono are under the SIL Open Font License (`fonts/`).
