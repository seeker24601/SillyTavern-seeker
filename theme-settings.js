export function mountThemeSettings() {
    const { eventSource, eventTypes, extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
    const placeAccent = () => {
        const picker = document.getElementById('underline-color-picker');
        const presetsBlock = document.getElementById('UI-presets-block');
        if (!picker || !presetsBlock) return;
        const row = picker.parentElement;
        row.id = 'seeker-accent-setting';
        const label = row.querySelector('span');
        label.textContent = 'Accent color';
        // Retarget the translation key rather than removing it: SillyTavern translates every
        // data-i18n change, and a removed key makes it throw.
        label.dataset.i18n = 'Accent color';
        label.id = 'seeker-accent-label';
        picker.setAttribute('aria-label', 'Accent color');
        picker.setAttribute('aria-labelledby', label.id);
        picker.setAttribute('button-width', '48px');
        picker.setAttribute('button-height', '32px');
        picker.setAttribute('button-padding', '2px');
        picker.setAttribute('popup-position', 'right');
        presetsBlock.after(row);
    };
    const presets = [['seeker', 'seeker.json'], ['seeker gilt', 'seeker-gilt.json']];
    let running = false;
    const install = async () => {
        const select = document.getElementById('themes');
        const input = document.getElementById('ui_preset_import_file');
        if (running || !select || !input || !select.options.length) return;
        running = true;
        const has = name => [...select.options].some(option => option.value === name);
        for (const [name, file] of presets) {
            if (has(name)) continue;
            const response = await fetch(new URL(`theme/${file}`, import.meta.url));
            if (!response.ok) continue;
            const transfer = new DataTransfer();
            transfer.items.add(new File([await response.text()], file, { type: 'application/json' }));
            input.files = transfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            for (let i = 0; i < 50 && !has(name); i++) await new Promise(resolve => setTimeout(resolve, 100));
        }
        const settings = extensionSettings.seeker ??= {};
        if (!settings.themeApplied && has('seeker')) {
            settings.themeApplied = true;
            saveSettingsDebounced();
            if (select.value !== 'seeker') $(select).val('seeker').trigger('change');
        }
        running = false;
    };
    // Only once SillyTavern has loaded the user's settings, or the first run would repeat.
    // APP_READY also fires for listeners added after it.
    eventSource.on(eventTypes.APP_READY, () => {
        placeAccent();
        install();
    });
}
