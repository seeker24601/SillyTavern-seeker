// Middle ground: a second picture over the background and under the sprite (a table, a railing,
// a window frame; usually a PNG with transparency). The Backgrounds panel gets a third tab, a
// gallery of the user's middle grounds: pick one, pick None, add more, delete. The pictures are
// kept with the user's files; the gallery and the one in use are in the theme's settings.
// backgrounds.css draws the gallery and the layer, style.css moves the layer with the pointer.
export function mountMiddleGround() {
    const { eventSource, eventTypes, extensionSettings, saveSettingsDebounced, getRequestHeaders } = SillyTavern.getContext();
    const stage = document.getElementById('bg1');
    const tabs = document.getElementById('bg_tabs');
    const tabList = tabs?.querySelector('.bg_tabs_list');
    const addBackground = document.getElementById('add_background_button_top');
    if (!stage || !tabs || !tabList || !addBackground) return;

    const layer = document.createElement('div');
    layer.id = 'seeker-middle-ground';
    layer.setAttribute('aria-hidden', 'true');
    layer.hidden = true;
    stage.append(layer);

    // The tab and its panel, beside Global and Chat.
    const tab = document.createElement('li');
    tab.className = 'bg_tab_button';
    tab.innerHTML = '<a href="#seeker-middle-ground-tab">Middle ground</a>';
    tabList.querySelector('.bg_tab_button:last-of-type').after(tab);
    tabList.classList.add('seeker-three-tabs');
    const panel = document.createElement('div');
    panel.id = 'seeker-middle-ground-tab';
    panel.className = 'bg_tab_panel';
    const grid = document.createElement('div');
    grid.id = 'seeker-middle-ground-list';
    grid.className = 'bg_list';
    grid.setAttribute('role', 'list');
    panel.append(grid);
    tabs.append(panel);
    try { $(tabs).tabs('refresh'); } catch { /* the tabs are set up later; they pick the new one up then */ }

    const button = document.createElement('div');
    button.id = 'seeker-middle-ground-button';
    button.className = 'menu_button menu_button_icon';
    button.tabIndex = 0;
    button.setAttribute('role', 'button');
    button.title = 'Add pictures that sit over the background, behind the character';
    button.innerHTML = '<i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>Add Middle Ground</span>';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/webp,image/avif,image/gif,image/jpeg';
    input.multiple = true;
    input.hidden = true;
    addBackground.after(button, input);

    let ready = false;
    const settings = () => extensionSettings.seeker ??= {};
    const gallery = () => settings().middleGroundGallery ??= [];
    const post = (url, body) => fetch(url, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(body) });
    const save = () => { saveSettingsDebounced(); show(); };

    const tile = (picture, label) => {
        const el = document.createElement('div');
        el.className = 'seeker-mg-tile';
        el.tabIndex = 0;
        el.setAttribute('role', 'listitem');
        el.title = label;
        el.dataset.picture = picture;
        const image = document.createElement('div');
        image.className = 'seeker-mg-image';
        if (picture) image.style.backgroundImage = `url("${encodeURI(picture)}")`;
        const name = document.createElement('div');
        name.className = 'seeker-mg-name';
        name.textContent = label;
        el.append(image, name);
        if (picture) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'seeker-mg-delete';
            remove.title = 'Delete this middle ground';
            remove.setAttribute('aria-label', remove.title);
            remove.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
            el.append(remove);
        }
        return el;
    };
    function show() {
        const list = ready ? gallery() : [];
        const picture = ready && list.includes(settings().middleGround) ? settings().middleGround : '';
        layer.hidden = !picture;
        layer.style.backgroundImage = picture ? `url("${encodeURI(picture)}")` : '';
        const tiles = [tile('', 'None'), ...list.map((path, i) => tile(path, `Middle ground ${i + 1}`))];
        for (const el of tiles) el.classList.toggle('seeker-mg-selected', el.dataset.picture === picture);
        const add = document.createElement('div');
        add.className = 'seeker-mg-tile seeker-mg-add';
        add.tabIndex = 0;
        add.setAttribute('role', 'button');
        add.title = button.title;
        add.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i><span>Add</span>';
        grid.replaceChildren(...tiles, add);
    }

    const upload = async file => {
        const extension = (/\.(png|webp|avif|gif|jpe?g)$/i.exec(file.name)?.[1] || 'png').toLowerCase();
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
        const name = `seeker-middle-ground-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
        const response = await post('/api/files/upload', { name, data });
        if (!response.ok) throw new Error(await response.text());
        const { path } = await response.json();
        return path.startsWith('/') ? path : `/${path}`;
    };
    input.addEventListener('change', async () => {
        const files = [...input.files];
        input.value = '';
        let last = '';
        for (const file of files) {
            try { last = await upload(file); gallery().push(last); } catch (error) {
                console.error('seeker: middle ground upload failed', error);
                globalThis.toastr?.error(`Could not add ${file.name}.`);
            }
        }
        if (last) { settings().middleGround = last; save(); }
    });
    const pressed = (el, handler) => {
        el.addEventListener('click', handler);
        el.addEventListener('keydown', event => {
            if (event.target === event.currentTarget || event.target.closest('.seeker-mg-tile') === event.target) {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handler(event); }
            }
        });
    };
    pressed(button, () => input.click());
    pressed(grid, async event => {
        const el = event.target.closest('.seeker-mg-tile');
        if (!el) return;
        if (el.classList.contains('seeker-mg-add')) return input.click();
        const picture = el.dataset.picture;
        if (event.target.closest('.seeker-mg-delete')) {
            const list = gallery();
            list.splice(list.indexOf(picture), 1);
            if (settings().middleGround === picture) settings().middleGround = '';
            save();
            await post('/api/files/delete', { path: picture }).catch(() => { });
            return;
        }
        settings().middleGround = picture;
        save();
    });

    // Only once SillyTavern has loaded the user's settings. APP_READY also fires for listeners
    // added after it.
    eventSource.on(eventTypes.APP_READY, () => {
        // Before the gallery, a middle ground belonged to one background: keep those pictures.
        const pairs = settings().middleGrounds;
        if (pairs) {
            for (const path of Object.values(pairs)) if (!gallery().includes(path)) gallery().push(path);
            settings().middleGround ??= Object.values(pairs)[0] ?? '';
            delete settings().middleGrounds;
            saveSettingsDebounced();
        }
        ready = true;
        show();
    });
    show();
}
