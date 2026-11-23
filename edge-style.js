// Stage settings, in User Settings under the accent colour.
// Stage edge: how the background dissolves into the chat column. A dropdown picks the style;
// style.css ("The halftone") draws each one from the data-seeker-edge attribute set here.
// Character name on stage: a switch for the big name beside the sprite (data-seeker-stage-name).
// Filigree: a switch for the thin-line ornament in the stage's corner (data-seeker-filigree). It is
// saved as the ornament's name ("corner" or "none"), so a dropdown can replace the switch once
// there is more than one ornament.
// Fonts: a dropdown of font loadouts, each a heading, a body and a mono face (variables.css,
// "Type", defines them from data-seeker-fonts).
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

export function mountEdgeStyle() {
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
