// Stage settings, in User Settings under the accent colour.
// Stage edge: how the background dissolves into the chat column. A dropdown picks the style;
// style.css ("The halftone") draws each one from the data-seeker-edge attribute set here.
// Character name on stage: a switch for the big name beside the sprite (data-seeker-stage-name).
// Filigree: a switch for the thin-line ornament in the stage's corner (data-seeker-filigree). It is
// saved as the ornament's name ("corner" or "none"), so a dropdown can replace the switch once
// there is more than one ornament.
// Fonts: a dropdown of font loadouts, each a heading, a body and a mono face (variables.css,
// "Type", defines them from data-seeker-fonts).
import { DITHER_MAP, HALFTONE_MAP } from './shadow-maps.js';

const LOADOUTS = [
    ['didoni', 'Didoni'], // Bodoni Moda, Jost, DM Mono: the default, so it sets no attribute
    ['garalde', 'Garalde'], // Cormorant, Source Serif 4, IBM Plex Mono
    ['grotesk', 'Grotesk'], // Boldonse in capitals, Inter, JetBrains Mono
    ['handwritten', 'Handwritten'], // Amatic SC, Kalam, Courier Prime
];
const STYLES = [
    ['dither', 'Dither'],
    ['gradient', 'Smooth gradient'],
    ['halftone', 'Halftone'],
    ['torn', 'Torn paper'],
];


// Filters for the sprites and for small things of any shape (shadows.css names them).
//
// Sprites get a light rim, not a shadow: white soft-lit onto the figure just inside its outline
// (so it lifts the sprite's own colours rather than painting over them), hardest right at the
// edge and fading inward, brightest along the left and top, as if lit from the
// upper left. The rim is the sprite's outline minus a blurred copy moved down and right, so it is
// faint along the right and bottom edges, where a sprite cut off by the screen would otherwise
// get a line. For dither and halftone its strength is inked against the pattern, so the texture
// itself carries the fade; torn paper adds a hard line along the edge to the smooth fade.
//
// Round buttons and other small things of any shape get a small shadow cast below them, inked
// the same way.
//
// Each pattern is one repeat, an SVG image of black squares, tiled over the filter region. The
// image is given no x or y, so it sits at the region's top left: WebKit puts an explicit x and y
// in page space, which left every element away from the page's top left (the second sprite in a
// duo) without its filter. (A field of the pattern the size of the screen worked too, but
// redrawing it on every repaint made the stage lag.)
const tile = map => 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${map.size}" height="${map.size}" shape-rendering="crispEdges">${map.squares}</svg>`);
const TILES = { dither: DITHER_MAP, halftone: HALFTONE_MAP };

function mountShadowFilters() {
    const ink = (map, steps, table, k1, k2) => `
            <feComponentTransfer result="soft"><feFuncA type="${steps}" tableValues="${table}" /></feComponentTransfer>
            <feImage href="${tile(TILES[map])}" width="${TILES[map].size}" height="${TILES[map].size}" preserveAspectRatio="none" result="cell" />
            <feTile in="cell" result="pattern" />
            <feComposite in="soft" in2="pattern" operator="arithmetic" k2="60" k3="-60" result="inked" />
            <feComposite in="inked" in2="soft" operator="arithmetic" k1="${k1}" k2="${k2}" result="mark" />`;
    const smooth = (table, strength) => `
            <feComponentTransfer result="mark"><feFuncA type="table" tableValues="${table.split(' ').map(v => +(v * strength).toFixed(3)).join(' ')}" /></feComponentTransfer>`;
    const rimTable = '0 0.15 0.55 0.85 1 1';
    // The torn rim adds a hard 2px line along the lit edges to the smooth fade.
    const hardLine = `
            <feOffset in="SourceAlpha" dx="2" dy="2" result="moved" />
            <feComposite in="SourceAlpha" in2="moved" operator="out" />
            <feComponentTransfer><feFuncA type="discrete" tableValues="0 0.8" /></feComponentTransfer>
            <feComposite in2="mark" operator="arithmetic" k2="1" k3="1" result="mark" />`;
    const rim = (id, marking, blur) => `
        <filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" />
            <feOffset dx="${blur}" dy="${blur * 0.75}" result="blurred" />
            <feComposite in="SourceAlpha" in2="blurred" operator="arithmetic" k2="1" k3="-1" />${marking}
            <feFlood flood-color="#fff" />
            <feComposite in2="mark" operator="in" />
            <feComposite in2="SourceAlpha" operator="in" result="rim" />
            <feBlend in="rim" in2="SourceGraphic" mode="soft-light" />
        </filter>`;
    const shadow = (id, marking, blur, dy) => `
        <filter id="${id}" x="-50%" y="-50%" width="200%" height="220%" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" />
            <feOffset dy="${dy}" />${marking}
            <feMerge><feMergeNode in="mark" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>`;
    const ditherSteps = '0 0.03 0.125 0.25 0.41 0.6 0.75';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'seeker-shadow-filters';
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svg.innerHTML = rim('seeker-sprite-rim-dither', ink('dither', 'discrete', ditherSteps, 0.7, 0.25), 7)
        + rim('seeker-sprite-rim-halftone', ink('halftone', 'table', '0 0.1 0.35 0.6 0.75 0.8', 0.6, 0.28), 7)
        + rim('seeker-sprite-rim-soft', smooth(rimTable, 0.9), 6)
        + rim('seeker-sprite-rim-torn', smooth(rimTable, 0.5) + hardLine, 6)
        + shadow('seeker-small-shadow-dither', ink('dither', 'discrete', ditherSteps, 0.5, 0.12), 5, 5)
        + shadow('seeker-small-shadow-halftone', ink('halftone', 'table', '0 0.05 0.2 0.4 0.6 0.72', 0.4, 0.14), 5, 5);
    document.body.append(svg);
}

export function mountEdgeStyle() {
    mountShadowFilters();
    const { eventSource, eventTypes, extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
    const root = document.documentElement;
    // The pictures, by their full address: a relative url() in a custom property is
    // resolved against whichever stylesheet uses it, and other extensions use this one.
    root.style.setProperty('--seeker-halftone-asset', `url("${new URL('halftone.avif', import.meta.url).href}")`);

    root.style.setProperty('--seeker-torn-asset', `url("${new URL('torn-paper.webp', import.meta.url).href}")`);

    const apply = style => {
        const known = STYLES.some(([value]) => value === style) ? style : 'dither';
        if (known === 'dither') root.removeAttribute('data-seeker-edge');
        else root.dataset.seekerEdge = known;
        return known;
    };

    const row = document.createElement('div');
    row.id = 'seeker-edge-setting';
    row.className = 'flex-container alignItemsCenter';
    const label = document.createElement('label');
    label.htmlFor = 'seeker-edge-style';
    label.textContent = 'Stage edge';
    const select = document.createElement('select');
    select.id = 'seeker-edge-style';
    select.className = 'text_pole';
    select.title = 'How the background fades into the chat column';
    for (const [value, name] of STYLES) select.add(new Option(name, value));
    row.append(label, select);
    select.addEventListener('change', () => {
        (extensionSettings.seeker ??= {}).edgeStyle = apply(select.value);
        saveSettingsDebounced();
    });

    const applyFonts = loadout => {
        const known = LOADOUTS.some(([value]) => value === loadout) ? loadout : LOADOUTS[0][0];
        if (known === LOADOUTS[0][0]) root.removeAttribute('data-seeker-fonts');
        else root.dataset.seekerFonts = known;
        return known;
    };
    const fontRow = document.createElement('div');
    fontRow.id = 'seeker-fonts-setting';
    fontRow.className = 'flex-container alignItemsCenter';
    const fontLabel = document.createElement('label');
    fontLabel.htmlFor = 'seeker-fonts';
    fontLabel.textContent = 'Fonts';
    const fontSelect = document.createElement('select');
    fontSelect.id = 'seeker-fonts';
    fontSelect.className = 'text_pole';
    fontSelect.title = 'The theme\'s set of heading, body and mono fonts';
    for (const [value, name] of LOADOUTS) fontSelect.add(new Option(name, value));
    fontRow.append(fontLabel, fontSelect);
    fontSelect.addEventListener('change', () => {
        (extensionSettings.seeker ??= {}).fonts = applyFonts(fontSelect.value);
        saveSettingsDebounced();
    });

    const nameRow = document.createElement('label');
    nameRow.id = 'seeker-stage-name-setting';
    nameRow.className = 'checkbox_label';
    nameRow.htmlFor = 'seeker-stage-name-toggle';
    nameRow.title = 'Show the character\'s name in large letters beside the sprite';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = 'seeker-stage-name-toggle';
    const toggleText = document.createElement('span');
    toggleText.textContent = 'Character name on stage';
    nameRow.append(toggle, toggleText);
    const applyName = shown => {
        if (shown) root.removeAttribute('data-seeker-stage-name');
        else root.dataset.seekerStageName = 'off';
    };
    toggle.addEventListener('change', () => {
        (extensionSettings.seeker ??= {}).stageName = toggle.checked;
        applyName(toggle.checked);
        saveSettingsDebounced();
    });

    const filigreeRow = document.createElement('label');
    filigreeRow.id = 'seeker-filigree-setting';
    filigreeRow.className = 'checkbox_label';
    filigreeRow.htmlFor = 'seeker-filigree-toggle';
    filigreeRow.title = 'Show the thin-line ornament in the corner of the stage';
    const filigree = document.createElement('input');
    filigree.type = 'checkbox';
    filigree.id = 'seeker-filigree-toggle';
    const filigreeText = document.createElement('span');
    filigreeText.textContent = 'Filigree';
    filigreeRow.append(filigree, filigreeText);
    const applyFiligree = name => {
        if (name === 'none') root.dataset.seekerFiligree = 'none';
        else root.removeAttribute('data-seeker-filigree');
    };
    filigree.addEventListener('change', () => {
        const name = filigree.checked ? 'corner' : 'none';
        (extensionSettings.seeker ??= {}).filigree = name;
        applyFiligree(name);
        saveSettingsDebounced();
    });

    // Only once SillyTavern has loaded the user's settings. APP_READY also fires for listeners
    // added after it. The accent row is moved under the theme presets at the same moment.
    eventSource.on(eventTypes.APP_READY, () => {
        select.value = apply(extensionSettings.seeker?.edgeStyle);
        const anchor = document.getElementById('seeker-accent-setting') ?? document.getElementById('UI-presets-block');
        anchor?.after(fontRow, row, nameRow, filigreeRow);
        filigree.checked = extensionSettings.seeker?.filigree !== 'none';
        applyFiligree(filigree.checked ? 'corner' : 'none');
        fontSelect.value = applyFonts(extensionSettings.seeker?.fonts);
        toggle.checked = extensionSettings.seeker?.stageName !== false;
        applyName(toggle.checked);
    });
}
