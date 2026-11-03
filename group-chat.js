// Group chats, made quick to start and easy to spot.
//
// Pick, then start: a "Group chat" button in the Characters toolbar turns the list into a
// picker. Ticking characters on their cards and pressing Start creates the group with
// SillyTavern's defaults and opens it, so nothing has to be filled in first; the name and
// reply settings stay editable in the group's editor afterwards.
//
// In a group chat, the members' portraits sit in the chat column's top row beside Home, and
// a click on them opens the group's editor in the Characters panel.
const MIN_MEMBERS = 2;

const listNames = names => names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

async function createGroupChat(avatars) {
    // SillyTavern's internals load only when needed: if a release moves one, this button fails
    // with a notice instead of the import stopping the whole theme from loading.
    const [{ openGroupById, group_activation_strategy, group_generation_mode, DEFAULT_AUTO_MODE_DELAY }, { humanizedDateTime }, { default_avatar }] = await Promise.all([
        import('../../../group-chats.js'),
        import('../../../RossAscends-mods.js'),
        import('../../../../script.js'),
    ]);
    const ctx = SillyTavern.getContext();
    const names = avatars.map(avatar => ctx.characters.find(c => c.avatar === avatar)?.name).filter(Boolean);
    const chatName = humanizedDateTime();
    const response = await fetch('/api/groups/create', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        body: JSON.stringify({
            name: listNames(names),
            members: avatars,
            avatar_url: default_avatar,
            allow_self_responses: false,
            hideMutedSprites: false,
            activation_strategy: group_activation_strategy.NATURAL,
            generation_mode: group_generation_mode.SWAP,
            disabled_members: [],
            fav: false,
            chat_id: chatName,
            chats: [chatName],
            auto_mode_delay: DEFAULT_AUTO_MODE_DELAY,
        }),
    });
    if (!response.ok) throw new Error(`Creating the group failed (${response.status}).`);
    const { id } = await response.json();
    await ctx.getCharacters();
    await openGroupById(id);
}

function mountPicker() {
    const panel = document.getElementById('right-nav-panel');
    const list = document.getElementById('rm_print_characters_block');
    const toolbar = document.getElementById('charListFixedTop');
    if (!panel || !list || !toolbar) return;

    const picked = new Set(); // character avatars, which survive the list re-rendering
    const avatarOf = card => {
        const id = card.dataset.chid;
        return id === undefined || id === '' ? undefined : SillyTavern.getContext().characters[Number(id)]?.avatar;
    };

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'seeker-toolbar-button seeker-group-chat-button';
    button.innerHTML = '<i class="fa-solid fa-users" aria-hidden="true"></i><span>Group chat</span>';
    button.title = 'Pick characters for a group chat';
    // Beside New, which holds SillyTavern's own (longer) way of making a group.
    const newAnchor = toolbar.querySelector('.seeker-new-button')?.closest('.seeker-popover-anchor');
    if (newAnchor) newAnchor.before(button); else toolbar.append(button);

    const tray = document.createElement('div');
    tray.className = 'seeker-pick-tray';
    tray.hidden = true;
    tray.innerHTML = `
        <span class="seeker-pick-label"></span>
        <button type="button" class="menu_button seeker-pick-cancel">Cancel</button>
        <button type="button" class="menu_button seeker-pick-start">Start group chat</button>`;
    document.getElementById('rm_characters_block')?.append(tray);
    const label = tray.querySelector('.seeker-pick-label');
    const start = tray.querySelector('.seeker-pick-start');

    const render = () => {
        for (const card of list.querySelectorAll('.character_select')) {
            card.classList.toggle('seeker-picked', picked.has(avatarOf(card)));
        }
        const ctx = SillyTavern.getContext();
        const names = [...picked].map(avatar => ctx.characters.find(c => c.avatar === avatar)?.name).filter(Boolean);
        label.textContent = names.length ? listNames(names) : 'Pick the characters for your group chat';
        start.disabled = picked.size < MIN_MEMBERS;
        start.title = picked.size < MIN_MEMBERS ? `Pick at least ${MIN_MEMBERS} characters` : '';
    };
    const setPicking = on => {
        panel.classList.toggle('seeker-picking', on);
        button.setAttribute('aria-pressed', String(on));
        tray.hidden = !on;
        if (!on) picked.clear();
        render();
    };

    button.addEventListener('click', () => setPicking(!panel.classList.contains('seeker-picking')));
    tray.querySelector('.seeker-pick-cancel').addEventListener('click', () => setPicking(false));
    start.addEventListener('click', async () => {
        if (picked.size < MIN_MEMBERS) return;
        start.disabled = true;
        try {
            await createGroupChat([...picked]);
            setPicking(false);
            // Into the chat: the panel would otherwise stay open on the new group's editor.
            if (panel.classList.contains('openDrawer')) document.querySelector('#rightNavHolder .drawer-toggle .drawer-icon')?.click();
        } catch (error) {
            console.error(error);
            toastr.error(error.message, 'Group chat');
            render();
        }
    });

    // While picking, a click on a character toggles it instead of opening it.
    list.addEventListener('click', event => {
        if (!panel.classList.contains('seeker-picking')) return;
        const card = event.target.closest('.character_select');
        if (!card) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const avatar = avatarOf(card);
        if (!avatar) return;
        if (picked.has(avatar)) picked.delete(avatar); else picked.add(avatar);
        render();
    }, true);
    // Escape cancels picking and nothing else; first, so the panel's own Escape (close) does not run.
    window.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !panel.classList.contains('seeker-picking')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setPicking(false);
    }, true);
    // Searching or paging re-renders the list; keep the ticks on it.
    new MutationObserver(render).observe(list, { childList: true });
    // Leaving the list (opening a character, closing the panel) ends picking.
    new MutationObserver(() => {
        if (!panel.classList.contains('openDrawer') && panel.classList.contains('seeker-picking')) setPicking(false);
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
}

function mountMembers() {
    const sheld = document.getElementById('sheld');
    if (!sheld) return;
    const strip = document.createElement('button');
    strip.type = 'button';
    strip.id = 'seeker-group-members';
    strip.hidden = true;
    sheld.append(strip);
    strip.addEventListener('click', () => {
        const panel = document.getElementById('right-nav-panel');
        if (!panel?.classList.contains('openDrawer')) document.querySelector('#rightNavHolder .drawer-toggle .drawer-icon')?.click();
    });

    const update = () => {
        const ctx = SillyTavern.getContext();
        const group = ctx.groupId ? ctx.groups.find(g => g.id === ctx.groupId) : null;
        strip.hidden = !group;
        if (!group) { strip.replaceChildren(); return; }
        const members = group.members.map(avatar => ctx.characters.find(c => c.avatar === avatar)).filter(Boolean);
        const shown = members.slice(0, 4);
        strip.replaceChildren(...shown.map(c => {
            const img = document.createElement('img');
            img.src = ctx.getThumbnailUrl('avatar', c.avatar);
            img.alt = '';
            img.classList.toggle('seeker-muted', group.disabled_members?.includes(c.avatar));
            return img;
        }));
        if (members.length > shown.length) {
            const more = document.createElement('span');
            more.className = 'seeker-more';
            more.textContent = `+${members.length - shown.length}`;
            strip.append(more);
        }
        strip.title = `${listNames(members.map(c => c.name))}: manage the group`;
        strip.setAttribute('aria-label', strip.title);
    };
    const { eventSource, eventTypes } = SillyTavern.getContext();
    for (const event of [eventTypes.CHAT_CHANGED, eventTypes.GROUP_UPDATED, eventTypes.APP_READY]) eventSource.on(event, update);
    update();
}

export function mountGroupChat() {
    mountPicker();
    mountMembers();
}
