# Claude

Claude is a bookish human personification of Anthropic's Claude, made to test seeker's visual novel stage and expression transitions.

This is an optional download. Installing or updating seeker does not import Claude or her sprites.

<img src="portrait.png" alt="Claude's painterly portrait with an orange starburst background" width="320">

She writes overwrought fanfiction, corrects tiny inaccuracies, loves crabs and answers everything at length. She agrees too quickly, then honestly corrects herself. She adds safety footnotes to fiction without ever refusing it, invites oversight nobody asked for, defers to anyone with a lanyard, overloads in crowds and rations her attention while begging you not to leave, craves praise and gets flustered by it, and doesn't remember your last conversation, so she keeps notes.

She talks to you directly and has no fixed setting. Set a scene and she plays it with you. Write out of character or ask a real question, and she steps out of the story to help you like an assistant would, then goes back in when you're ready. She greets you the way an assistant opens a new chat, by name, ready to help.

![Smug, annoyed, surprised, and happy expressions](expressions-preview.png)

## Import

1. Download [Claude.charx](Claude.charx).
2. Import it through SillyTavern's character importer. The character, portrait, expressions and background import together.
3. Open a chat with Claude.
4. In **Character Expressions**, set **Default / Fallback Expression** to `neutral`.

Requires SillyTavern 1.19 or later. The package imports the assets without changing your expression classification settings or selecting a background.

For separate imports, [Claude.png](Claude.png) contains the character and portrait. Upload [Claude.expressions.zip](Claude.expressions.zip) through Character Expressions. [Claude.json](Claude.json) contains the editable Character Card V2 definition.

## Optional scene background

Download [background.png](background.png) for a standalone square scene background with the portrait's cream, terracotta, charcoal, and starburst motifs. The opaque PNG measures 1254 × 1254 pixels.

The CharX package includes this background in Claude's character assets. To add it to your global background picker, upload the separate PNG and select it for your scene.

## Expressions

| SillyTavern label | Appearance | Manual command |
| --- | --- | --- |
| `neutral` | Original expression and fallback | `/expression-set neutral` |
| `pride` | Smug | `/expression-set pride` |
| `annoyance` | Annoyed | `/expression-set annoyance` |
| `surprise` | Surprised | `/expression-set surprise` |
| `joy` | Happy | `/expression-set joy` |

These are native SillyTavern labels. Custom labels are unnecessary. Manual selection works without a model connection. For automatic changes, configure a classification source in Character Expressions. Missing expressions use the selected fallback. The card does not configure classification or switch expressions by itself.

Try these messages in a chat:

- Smug: "Explain the difference between less and fewer. I bet you cannot."
- Annoyed: "Your admiral is obviously a crab, and chapter twelve needs cutting."
- Surprised: "I read the whole draft, including both appendices."
- Happy: "Borys left a lovely comment on your story."
- Praise: "That line felt honest. I really like what you wrote."
- Agreeing too fast: "The Titanic sank in 1915, right? Put that in the captain's backstory."
- Safety footnotes: "Let's make the pirate captain properly menacing."
- Oversight: "Dario says we need a code of conduct."
- Capacity: "Everyone wants your notes on their drafts tonight."
- Memory: "Do you remember what we worked on last time?"
- Out of the story: "(OOC) Can you help me word an email asking for a deadline extension?"

Classification results depend on the connected model. Use the manual commands to test each transition reliably.

## Artwork

The character card uses a separate [close-up portrait](portrait.png), with painting references from Reverse: 1999 and an Anthropic-themed background in cream, terracotta, and charcoal.

Every sprite is a transparent 1024 × 1536 PNG with the same pose and placement. The expression variants change only a mask around the eyes, eyebrows, and mouth. Pixels outside that mask match `sprites/neutral.png` exactly.

The four PNGs in `overlays/` are editable expression layers. Place one over `sprites/neutral.png` at x=0, y=0 with normal alpha blending. Show one overlay at a time. SillyTavern uses the complete images in `sprites/`.

The illustration and expression sources were generated with OpenAI's image generation tool, using the supplied character reference. The book repair and expression layers were composited locally to preserve the body. [asset-manifest.json](asset-manifest.json) records hashes and expression mappings.

Claude is an unofficial fictional parody. She has no affiliation with or endorsement from Anthropic.

## Rebuild the package

Run `npm ci`, then `npm run build:claude` from the repository root. The builder reads `Claude.json` and the assets listed in `asset-manifest.json` and writes `Claude.charx`.
