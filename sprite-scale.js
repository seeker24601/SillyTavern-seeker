// Sprite size: a slider in the character editor makes that character's sprites on the stage
// larger or smaller, by at most SPRITE_SCALE_LIMIT percent either way. It is mostly for short
// characters, whose sprites otherwise stand as tall as everyone else's. The size is kept on the
// card (data.extensions.seeker.spriteScale), so it travels with the character. The Persona panel
// has the same slider for persona sprites (persona-sprites.js).
//
// SillyTavern marks each sprite with its folder (data-sprite-folder-name), so the sizes are a
// stylesheet of one rule per folder; style.css sizes the sprite by --seeker-sprite-scale.
export const SPRITE_SCALE_LIMIT = 25;
export const clampSpriteScale = value => {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number) || number === 0) return 100;
    return Math.min(100 + SPRITE_SCALE_LIMIT, Math.max(100 - SPRITE_SCALE_LIMIT, number));
};

export function mountSpriteScale() {
    const context = () => SillyTavern.getContext();
    const { eventSource, eventTypes } = context();
    const scaleOf = character => clampSpriteScale(character?.data?.extensions?.seeker?.spriteScale ?? 100);
    const quote = text => `"${String(text).replace(/["\\]/g, '\\$&')}"`;

    const sheet = document.createElement('style');
    sheet.id = 'seeker-sprite-scales';
    document.head.append(sheet);
    // A character's sprites are in the folder named after it, or the one the user picked for it
    // in Character Expressions (an override, keyed by the card's file name).
    function writeRules() {
        const { characters, extensionSettings } = context();
        const overrides = extensionSettings.expressionOverrides ?? [];
        const rules = [];
        for (const character of characters ?? []) {
            const scale = scaleOf(character);
            if (scale === 100 || !character.avatar) continue;
            const folders = new Set([character.name]);
            const override = overrides.find(entry => entry.name === character.avatar.replace(/\.[^/.]+$/, ''));
            if (override?.path) folders.add(override.path);
            const selector = [...folders].map(folder => `img[data-sprite-folder-name=${quote(folder)}]`).join(', ');
            rules.push(`${selector} { --seeker-sprite-scale: ${scale / 100}; }`);
        }
        sheet.textContent = rules.join('\n');
    }

    // The slider, under the character's name and tags in the editor.
    const row = document.createElement('div');
    row.className = 'seeker-sprite-scale';
    row.title = 'How large this character\'s sprites stand on the stage';
    const label = document.createElement('label');
    label.htmlFor = 'seeker-sprite-scale-input';
    label.textContent = 'Sprite size';
    const input = document.createElement('input');
    input.type = 'range';
    input.id = 'seeker-sprite-scale-input';
    input.min = String(100 - SPRITE_SCALE_LIMIT);
    input.max = String(100 + SPRITE_SCALE_LIMIT);
    input.step = '1';
    const readout = document.createElement('output');
    readout.htmlFor = input.id;
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'seeker-sprite-scale-reset';
    reset.title = 'Back to 100%';
    reset.setAttribute('aria-label', reset.title);
    reset.innerHTML = '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>';
    row.append(label, input, readout, reset);

    const editing = () => {
        const { characterId, characters, groupId } = context();
        return groupId || characterId === undefined ? null : characters[characterId] ?? null;
    };
    const show = value => {
        input.value = String(value);
        readout.value = `${value}%`;
        reset.hidden = value === 100;
    };
    function sync() {
        const identity = document.querySelector('#avatar-and-name-block .seeker-char-identity');
        const character = editing();
        if (identity && row.parentElement !== identity) identity.append(row);
        row.hidden = !character;
        if (character) show(scaleOf(character));
    }

    // While dragging, only this page's copy changes, so the stage follows the slider; letting go
    // writes it to the card.
    const preview = value => {
        const character = editing();
        if (!character) return;
        ((character.data ??= {}).extensions ??= {}).seeker = { ...character.data.extensions.seeker, spriteScale: value };
        show(value);
        writeRules();
    };
    const commit = async value => {
        const { characterId, writeExtensionField } = context();
        const character = editing();
        if (!character) return;
        preview(value);
        await writeExtensionField(characterId, 'seeker', { ...character.data.extensions.seeker, spriteScale: value });
    };
    input.addEventListener('input', () => preview(clampSpriteScale(input.value)));
    input.addEventListener('change', () => commit(clampSpriteScale(input.value)));
    reset.addEventListener('click', () => commit(100));

    eventSource.on(eventTypes.APP_READY, () => { writeRules(); sync(); });
    for (const event of [eventTypes.CHAT_CHANGED, eventTypes.CHARACTER_PAGE_LOADED, eventTypes.CHARACTER_EDITED, eventTypes.CHARACTER_EDITOR_OPENED]) {
        if (event) eventSource.on(event, () => { writeRules(); sync(); });
    }
}
