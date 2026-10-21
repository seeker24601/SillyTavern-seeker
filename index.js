/*
 * seeker, a SillyTavern theme by seeker.
 *
 * Styling lives in style.css. This script adds the menu button that replaces
 * the top bar: SillyTavern's own drawer icons stay where they are
 * in the page (its click handler finds each panel through the icon's parent)
 * and style.css lays them out as a dropdown under the button. It also lets
 * Escape close the panel that is open.
 */
document.body.classList.add('seeker');

// The locks on AI response, Characters and World info keep a panel open over everything,
// but panels here are dialogs over the chat, so style.css hides the locks. Release saved
// locks too; extensions load before SillyTavern reads them, so no panel comes back pinned
// or reopens on load.
const { accountStorage } = SillyTavern.getContext();
for (const key of ['LNavLockOn', 'NavLockOn', 'WINavLockOn']) {
    if (accountStorage?.getItem(key) === 'true') accountStorage.setItem(key, 'false');
}

const OPEN = 'seeker-nav-open';

// Short menu labels; anything not listed falls back to SillyTavern's own tooltip.
const LABELS = {
    'ai-config-button': 'AI response',
    'sys-settings-button': 'API connections',
    'advanced-formatting-button': 'Formatting',
    'WI-SP-button': 'World info',
    'user-settings-button': 'User settings',
    'backgrounds-button': 'Backgrounds',
    'extensions-settings-button': 'Extensions',
    'persona-management-button': 'Persona',
    rightNavHolder: 'Characters',
};

// Panel headings that repeat the menu item under another name.
const DUPLICATE_TITLES = {
    'advanced-formatting-button': 'Advanced Formatting',
};

const normalize = text => text.replace(/\s+/g, ' ').trim().toLowerCase();

const holder = document.getElementById('top-settings-holder');

const button = document.createElement('div');
button.id = 'seeker-menu-button';
button.className = 'fa-solid fa-bars interactable';
button.setAttribute('role', 'button');
button.setAttribute('tabindex', '0');
button.setAttribute('title', 'Menu');
button.setAttribute('aria-expanded', 'false');
document.body.append(button);

for (const toggle of holder.querySelectorAll(':scope > .drawer > .drawer-toggle')) {
    const icon = toggle.querySelector('.drawer-icon');
    if (!icon) continue;
    const id = toggle.parentElement.id;
    icon.dataset.seekerLabel = LABELS[id] || icon.title || toggle.title || id;
}

// Each menu panel gets a header with its name and a close button. Closing goes
// through the panel's own icon so SillyTavern's state stays in step.
for (const drawer of holder.querySelectorAll(':scope > .drawer')) {
    const content = drawer.querySelector(':scope > .drawer-content');
    const icon = drawer.querySelector(':scope > .drawer-toggle .drawer-icon');
    if (!content || !icon || content.querySelector(':scope > .seeker-panel-header')) continue;
    const header = document.createElement('div');
    header.className = 'seeker-panel-header';
    const title = document.createElement('span');
    title.className = 'seeker-panel-title';
    title.textContent = icon.dataset.seekerLabel;
    const close = document.createElement('div');
    close.className = 'seeker-panel-close fa-solid fa-xmark interactable';
    close.setAttribute('role', 'button');
    close.setAttribute('tabindex', '0');
    close.setAttribute('title', 'Close');
    close.addEventListener('click', () => icon.click());
    close.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            icon.click();
        }
    });
    header.append(title, close);
    content.prepend(header);

    // Hide the panel's own heading when it only repeats the header's title.
    const names = [icon.dataset.seekerLabel, icon.title, drawer.querySelector(':scope > .drawer-toggle').title, DUPLICATE_TITLES[drawer.id]]
        .filter(Boolean).map(normalize);
    for (const heading of content.querySelectorAll('h2, h3, h4')) {
        if (names.includes(normalize(heading.textContent))) {
            heading.classList.add('seeker-duplicate-title');
            break;
        }
    }
}

const setOpen = open => {
    document.body.classList.toggle(OPEN, open);
    button.classList.toggle('fa-bars', !open);
    button.classList.toggle('fa-xmark', open);
    button.setAttribute('aria-expanded', String(open));
};

button.addEventListener('click', () => setOpen(!document.body.classList.contains(OPEN)));
button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        button.click();
    }
});

// Picking an item opens its panel (SillyTavern handles that) and folds the menu away.
holder.addEventListener('click', event => {
    if (event.target.closest('#top-settings-holder > .drawer > .drawer-toggle')) setOpen(false);
});

document.addEventListener('click', event => {
    if (!document.body.classList.contains(OPEN)) return;
    if (event.target.closest('#seeker-menu-button, #top-settings-holder > .drawer > .drawer-toggle')) return;
    setOpen(false);
});

// Escape folds the menu away, or else closes the panel that is open. Dialogs handle
// Escape themselves, so nothing happens here while one is showing.
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (document.body.classList.contains(OPEN)) {
        setOpen(false);
        return;
    }
    if (document.querySelector('dialog.popup[open]')) return;
    // Topmost first: the prompt editor opens over AI response, and Advanced definitions
    // over the Characters panel.
    const promptEditor = document.getElementById('completion_prompt_manager_popup');
    if (promptEditor && getComputedStyle(promptEditor).display !== 'none') {
        document.getElementById('completion_prompt_manager_popup_entry_form_close')?.click();
        return;
    }
    const characterPopup = document.getElementById('character_popup');
    if (characterPopup && characterPopup.style.display === 'flex') {
        document.getElementById('character_cross')?.click();
        return;
    }
    holder.querySelector('.drawer-content.openDrawer')?.parentElement.querySelector('.drawer-toggle .drawer-icon')?.click();
});

// Welcome screen, desktop: the logo, name, version and links move to a stage on the left,
// where a sprite would be, and the chat column keeps the recent chats. On phones they stay
// in the welcome panel. SillyTavern binds their handlers on the elements, so moving keeps them.
const chat = document.getElementById('chat');
const desktop = window.matchMedia('(min-width: 1001px)');
const welcomeStage = document.createElement('div');
welcomeStage.id = 'seeker-welcome-stage';
document.body.append(welcomeStage);
const welcomeParts = new WeakMap();

const placeWelcome = () => {
    const panel = chat?.querySelector(':scope > .welcomePanel');
    if (!panel) {
        welcomeStage.replaceChildren();
        return;
    }
    let parts = welcomeParts.get(panel);
    if (!parts) {
        parts = {
            title: panel.querySelector('.welcomeHeaderTitle'),
            header: panel.querySelector('.welcomeHeader'),
            logo: panel.querySelector('.welcomeHeaderLogo'),
            version: panel.querySelector('.welcomeHeaderVersionDisplay'),
            links: panel.querySelector('.welcomeShortcuts'),
        };
        if (!parts.title || !parts.header || !parts.logo || !parts.version || !parts.links) return;
        // "SillyTavern 1.19.0 'release' (abc123)": the name is the title, the rest a subtitle.
        const match = parts.version.textContent.trim().match(/^(SillyTavern)\s+(.+)$/);
        if (match) {
            const name = document.createElement('span');
            name.className = 'seeker-welcome-name';
            name.textContent = match[1];
            const number = document.createElement('span');
            number.className = 'seeker-welcome-version';
            number.textContent = match[2];
            parts.version.replaceChildren(name, ' ', number);
        }
        welcomeParts.set(panel, parts);
    }
    if (desktop.matches) {
        welcomeStage.replaceChildren(parts.logo, parts.version, parts.links);
    } else {
        parts.title.prepend(parts.logo, parts.version);
        parts.header.append(parts.links);
        welcomeStage.replaceChildren();
    }
};
if (chat) new MutationObserver(placeWelcome).observe(chat, { childList: true });
desktop.addEventListener('change', placeWelcome);
placeWelcome();

// Desktop stage: the background drifts towards the pointer while it is over the stage
// (style.css draws it oversized there) and settles back when the pointer leaves.
const background = document.getElementById('bg1');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const setDrift = (x, y) => {
    document.documentElement.style.setProperty('--seeker-bg-x', x.toFixed(3));
    document.documentElement.style.setProperty('--seeker-bg-y', y.toFixed(3));
};
let driftFrame = 0;
document.addEventListener('pointermove', event => {
    if (driftFrame || event.pointerType !== 'mouse' || !background) return;
    driftFrame = requestAnimationFrame(() => {
        driftFrame = 0;
        const box = background.getBoundingClientRect();
        const inside = !reducedMotion.matches
            && event.clientX >= box.left && event.clientX < box.right
            && event.clientY >= box.top && event.clientY < box.bottom;
        if (inside) {
            setDrift((event.clientX - box.left) / box.width * 2 - 1, (event.clientY - box.top) / box.height * 2 - 1);
        } else {
            setDrift(0, 0);
        }
    });
});
document.documentElement.addEventListener('mouseleave', () => setDrift(0, 0));

// Icon-only buttons (an icon and no text) are drawn as circles. CSS cannot tell a label
// written as a bare text node from no label, so they are marked here, and again whenever
// SillyTavern adds buttons or changes their content.
const ICON = '[class*="fa-"]';
const markIconButton = button => {
    const iconOnly = button.textContent.trim() === '' && (button.matches(ICON) || button.querySelector(ICON) !== null);
    button.classList.toggle('seeker-icon-button', iconOnly);
};
const pending = new Set();
let markFrame = 0;
const markLater = button => {
    pending.add(button);
    markFrame ||= requestAnimationFrame(() => {
        markFrame = 0;
        for (const b of pending) markIconButton(b);
        pending.clear();
    });
};
document.querySelectorAll('.menu_button').forEach(markIconButton);
new MutationObserver(mutations => {
    for (const mutation of mutations) {
        const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
        const owner = target?.closest('.menu_button');
        if (owner) markLater(owner);
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.matches('.menu_button')) markLater(node);
            node.querySelectorAll('.menu_button').forEach(markLater);
        }
    }
}).observe(document.body, { childList: true, subtree: true, characterData: true });

// Panels with many settings (User settings, Formatting) show a list of their sections
// beside them, and one section at a time. SillyTavern's markup stays where it is: each
// section's elements are tagged, and settings.css hides the sections that are not chosen.
// The labels are SillyTavern's own headings, so a translated interface gets translated
// labels. Each section: { key, heading: () => element, els: () => elements }, or a fixed
// label instead of a heading for a section SillyTavern has no heading for.
// Moves elements into a panel's header, under its title, so they stay in view while the
// panel scrolls: controls that apply to all of the panel. They are SillyTavern's own
// elements, so their handlers come with them.
function pinToHeader(inside, elements) {
    elements = elements.filter(Boolean);
    const header = inside?.closest('.drawer-content')?.querySelector(':scope > .seeker-panel-header');
    if (!header || !elements.length) return;
    let holder = header.querySelector(':scope > .seeker-panel-shared');
    if (!holder) {
        holder = document.createElement('div');
        holder.className = 'seeker-panel-shared';
        header.append(holder);
    }
    holder.append(...elements);
}

// Every panel knows its header's height, so things that stick below it (section lists,
// editor toolbars) sit just under it however tall it grows.
document.querySelectorAll('.drawer-content > .seeker-panel-header').forEach(header => {
    new ResizeObserver(() => header.parentElement.style.setProperty('--seeker-header-height', header.offsetHeight + 'px')).observe(header);
});

function sectionPanel(panel, content, sections, storageKey, shared = []) {
    sections = sections.filter(s => (s.label || s.heading()) && s.els().length && s.els().every(Boolean));
    if (!sections.length) return [];
    panel.classList.add('seeker-sectioned');
    // Controls that apply to every section (presets, import and export, search) join the
    // panel's header, so they stay in view while a section scrolls.
    pinToHeader(panel, shared);
    content.classList.add('seeker-sectioned-content');
    for (const section of sections) {
        for (const el of section.els()) el.dataset.seekerSection = section.key;
    }

    const nav = document.createElement('nav');
    nav.className = 'seeker-settings-nav';
    nav.setAttribute('aria-label', 'Sections');
    content.before(nav);

    let active = sections[0].key;
    try { const saved = localStorage.getItem(storageKey); if (sections.some(s => s.key === saved)) active = saved; } catch { }

    const show = key => {
        active = key;
        try { localStorage.setItem(storageKey, key); } catch { }
        for (const section of sections) {
            for (const el of section.els()) el.classList.toggle('seeker-section-active', section.key === key);
        }
        for (const item of nav.children) {
            const current = item.dataset.section === key;
            item.setAttribute('aria-current', String(current));
            // On phones the list is a scrolling row; keep the chosen section in view.
            if (current && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = item.offsetLeft - (nav.clientWidth - item.offsetWidth) / 2;
        }
    };
    const label = heading => (heading.querySelector('[data-i18n]') ?? heading).textContent.trim().replace(/\s+/g, ' ');
    const renderNav = () => {
        nav.replaceChildren(...sections.map(section => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'seeker-settings-nav-item';
            item.dataset.section = section.key;
            item.textContent = section.label ?? label(section.heading());
            item.addEventListener('click', () => {
                show(section.key);
                panel.scrollTop = 0;
            });
            return item;
        }));
        show(active);
    };
    renderNav();
    // Headings are translated after load; refresh the labels whenever the panel opens.
    new MutationObserver(() => {
        if (panel.classList.contains('openDrawer')) renderNav();
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
    return sections;
}

// User settings. While its search has text, every section with a match is shown instead,
// and within a section only the matching rows.
const settingsBlock = document.getElementById('user-settings-block');
const settingsContent = document.getElementById('user-settings-block-content');
if (settingsBlock && settingsContent) {
    const headingOf = text => [...settingsContent.querySelectorAll('h4')].find(h => h.textContent.includes(text));
    const blockOf = text => headingOf(text)?.parentElement;
    const miscBlock = blockOf('Miscellaneous');
    const sections = sectionPanel(settingsBlock, settingsContent, [
        { key: 'theme', heading: () => headingOf('UI Theme'), els: () => [document.getElementById('UI-Theme-Block')] },
        { key: 'characters', heading: () => headingOf('Character Handling'), els: () => [blockOf('Character Handling')] },
        { key: 'chat', heading: () => headingOf('Chat/Message Handling'), els: () => [blockOf('Chat/Message Handling')] },
        // Miscellaneous holds Custom CSS; it lays its children out directly (display: contents).
        { key: 'misc', heading: () => headingOf('Miscellaneous'), els: () => [...(miscBlock?.children ?? [])].filter(c => c.id !== 'CustomCSS-block') },
        { key: 'css', heading: () => headingOf('Custom CSS'), els: () => [document.getElementById('CustomCSS-block')] },
        // The autocomplete drawer sits between Chat and STscript and belongs with STscript.
        { key: 'stscript', heading: () => headingOf('STscript'), els: () => {
            const block = blockOf('STscript');
            const drawer = block?.previousElementSibling?.classList.contains('inline-drawer') ? block.previousElementSibling : null;
            return [drawer, block];
        } },
    ], 'seeker-user-settings-section', [settingsBlock.querySelector(':scope > .flex-container.flexFlowColumn')]);

    // One setting each: a switch, a dropdown or slider with its label, a group that opens.
    const ROW = [
        'label.checkbox_label',
        ':is(.flex-container, div):has(> select)',
        ':is(.flex-container, .range-block):has(> .neo-range-slider)',
        '.flex-container:has(> label.checkbox_label + .menu_button)',
        '#MovingUI-presets-block',
        '.inline-drawer',
        '.flex-container:has(> .menu_button):not(:has(select))',
    ].join(', ');

    // Search: SillyTavern marks matches with .highlighted on the same input event, after this
    // listener, so the sections are checked on the next frame.
    const search = document.getElementById('settingsSearch');
    // One line: Enter does nothing, and pasted line breaks become spaces.
    search?.setAttribute('wrap', 'off');
    search?.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
    search?.addEventListener('input', () => {
        if (search.value.includes('\n')) search.value = search.value.replace(/\s*\n\s*/g, ' ');
    }, true);
    search?.addEventListener('input', () => requestAnimationFrame(() => {
        const searching = search.value.trim() !== '';
        settingsBlock.toggleAttribute('data-seeker-searching', searching);
        for (const section of sections) {
            const match = searching && section.els().some(el => el.matches('.highlighted') || el.querySelector('.highlighted'));
            for (const el of section.els()) el.classList.toggle('seeker-section-match', match);
        }
        // Within a section only the matching rows show.
        for (const row of settingsContent.querySelectorAll(ROW)) {
            row.classList.toggle('seeker-row-match', searching && (row.matches('.highlighted') || row.querySelector('.highlighted') !== null));
        }
    }));
}

// Formatting: its three columns and the sections under System Prompt become one list.
{
    const panel = document.getElementById('AdvancedFormatting');
    const content = document.getElementById('ContextSettings')?.parentElement;
    const systemColumn = document.getElementById('SystemPromptColumn');
    if (panel && content && systemColumn) {
        // System Prompt's column holds its own block and then the smaller sections, each a div
        // starting with its heading.
        const systemHeading = systemColumn.querySelector(':scope > h4');
        const sub = text => [...systemColumn.children].find(c => c !== systemHeading && c.querySelector('h4')?.textContent.includes(text));
        const subHeading = text => sub(text)?.querySelector('h4');
        sectionPanel(panel, content, [
            { key: 'context', heading: () => document.querySelector('#ContextSettings h4'), els: () => [document.getElementById('ContextSettings')] },
            { key: 'instruct', heading: () => document.querySelector('#InstructSettingsColumn > h4'), els: () => [document.getElementById('InstructSettingsColumn')] },
            { key: 'system', heading: () => systemHeading, els: () => [systemHeading, document.getElementById('SystemPromptBlock')] },
            { key: 'stopping', heading: () => subHeading('Custom Stopping Strings'), els: () => [sub('Custom Stopping Strings')] },
            { key: 'tokenizer', heading: () => subHeading('Tokenizer'), els: () => [sub('Tokenizer')] },
            { key: 'reasoning', heading: () => subHeading('Reasoning'), els: () => [sub('Reasoning')] },
            { key: 'misc', heading: () => subHeading('Miscellaneous'), els: () => [sub('Miscellaneous')] },
        ], 'seeker-formatting-section', [panel.querySelector(':scope > .flex-container.alignItemsBaseline'), document.getElementById('advanced-formatting-cc-notice')]);
    }
}

// AI response (Chat Completion): the preset stays on top; the rest becomes Sampling,
// Prompts, Advanced and Logit Bias. Other APIs fill this panel differently, so for them it
// stays as SillyTavern lays it out (data-seeker-sections-off).
{
    const panel = document.getElementById('left-nav-panel');
    const scroller = panel?.querySelector(':scope > .scrollableInner');
    const content = document.getElementById('ai_response_configuration');
    const ranges = document.getElementById('range_block_openai');
    const advanced = document.querySelector('#openai_settings > div:first-child');
    const manager = document.getElementById('completion_prompt_manager')?.closest('.range-block');
    const logit = document.getElementById('logit_bias_openai')?.closest('.range-block');
    if (panel && scroller && content && ranges && advanced && manager && logit) {
        const drawerOf = text => [...ranges.querySelectorAll(':scope > .inline-drawer')].find(d => d.querySelector('.inline-drawer-toggle')?.textContent.includes(text));
        const promptDrawers = [drawerOf('Quick Prompts Edit'), drawerOf('Utility Prompts')].filter(Boolean);
        // Sections SillyTavern has no heading for get one at their top.
        const heading = (text, before) => {
            const h = document.createElement('h4');
            h.className = 'seeker-section-heading';
            h.textContent = text;
            before.before(h);
            return h;
        };
        const samplingHeading = heading('Sampling', ranges.firstElementChild);
        const promptsHeading = heading('Prompts', manager);
        const advancedHeading = heading('Advanced', advanced.firstElementChild);
        sectionPanel(scroller, content, [
            { key: 'sampling', label: 'Sampling', els: () => [samplingHeading, ...[...ranges.children].filter(c => c !== samplingHeading && !promptDrawers.includes(c))] },
            { key: 'prompts', label: 'Prompts', els: () => [promptsHeading, manager, ...promptDrawers] },
            { key: 'advanced', label: 'Advanced', els: () => [...advanced.children] },
            { key: 'logit', heading: () => document.getElementById('logit_bias_openai'), els: () => [logit] },
        ], 'seeker-ai-response-section', [document.getElementById('respective-presets-block')]);
        const sync = () => scroller.toggleAttribute('data-seeker-sections-off', document.getElementById('main_api')?.value !== 'openai');
        document.getElementById('main_api')?.addEventListener('change', () => setTimeout(sync));
        SillyTavern.getContext().eventSource?.on(SillyTavern.getContext().eventTypes.APP_READY, sync);
        sync();
    }
}

// Backgrounds: start the gallery at four tiles a row instead of SillyTavern's five. Done
// once, through its own + button, so the choice is saved and the - and + buttons still
// change it afterwards.
{
    const { eventSource, eventTypes } = SillyTavern.getContext();
    const FLAG = 'seeker-bg-columns-set';
    eventSource?.once(eventTypes.APP_READY, () => {
        try {
            if (localStorage.getItem(FLAG)) return;
            localStorage.setItem(FLAG, '1');
        } catch { return; }
        const columns = Number(getComputedStyle(document.documentElement).getPropertyValue('--bg-thumb-columns'));
        if (columns === 5 && window.matchMedia('(min-width: 1001px)').matches) document.getElementById('bg_thumb_zoom_in')?.click();
    });
}

// Expression changes: SillyTavern fades the new sprite in under the old one (the old is
// positioned, so it stays on top), then removes the old one, which shows as a cut. When it
// does, a copy of the old sprite goes back on top and fades out, revealing the new one.
{
    const { eventSource, eventTypes } = SillyTavern.getContext();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new MutationObserver(records => {
        if (reduceMotion.matches) return;
        for (const record of records) {
            for (const node of record.removedNodes) {
                if (!(node instanceof HTMLImageElement) || !node.classList.contains('expression')) continue;
                // A swap leaves the new sprite in the same holder.
                const successor = record.target.querySelector(':scope > img.expression');
                if (!successor || !node.getAttribute('src')) continue;
                const ghost = node.cloneNode(false);
                ghost.removeAttribute('id');
                ghost.className = 'seeker-sprite-ghost';
                ghost.style.opacity = '1';
                record.target.append(ghost);
                ghost.getBoundingClientRect(); // start the fade from fully visible
                ghost.style.opacity = '0';
                const remove = () => ghost.remove();
                ghost.addEventListener('transitionend', remove, { once: true });
                setTimeout(remove, 1500);
            }
        }
    });
    const watch = () => {
        for (const id of ['expression-holder', 'visual-novel-wrapper']) {
            const holder = document.getElementById(id);
            if (holder) observer.observe(holder, { childList: true, subtree: true });
        }
    };
    watch();
    eventSource.on(eventTypes.CHAT_CHANGED, watch);
}

// Sprite hover: with a mouse on the sprite, another of the character's expressions, picked
// at random, fades in over it and fades out again on leave. Only the picture changes:
// SillyTavern's expression, and what its classifier chose, stay as they are.
{
    const { eventSource, eventTypes } = SillyTavern.getContext();
    const SPRITE = ':is(#expression-holder > img.expression, #visual-novel-wrapper .expression-holder img)';
    const lists = new Map(); // sprite folder -> promise of [{ label, path }]
    const spritesOf = folder => {
        if (!lists.has(folder)) {
            const { getRequestHeaders } = SillyTavern.getContext();
            lists.set(folder, fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`, { headers: getRequestHeaders() })
                .then(response => response.ok ? response.json() : [])
                .catch(() => []));
        }
        return lists.get(folder);
    };
    // Sprites added or removed in the editor show up on the next hover.
    eventSource.on(eventTypes.CHAT_CHANGED, () => lists.clear());
    eventSource.on(eventTypes.CHARACTER_EDITED, () => lists.clear());

    let current = null; // { base, peek }
    const leave = () => {
        if (!current) return;
        const { peek } = current;
        current = null;
        if (!peek) return;
        peek.classList.remove('seeker-shown');
        const remove = () => peek.remove();
        peek.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 1000);
    };

    document.addEventListener('pointerover', async event => {
        const base = event.target;
        if (event.pointerType !== 'mouse' || !(base instanceof HTMLImageElement) || !base.matches(SPRITE)) return;
        if (current?.base === base) return;
        leave();
        const folder = base.dataset.spriteFolderName;
        if (!folder) return;
        const entry = { base, peek: null };
        current = entry;
        const showing = base.dataset.spriteFilename;
        const others = (await spritesOf(folder)).filter(sprite => !sprite.path.split('?')[0].endsWith(`/${showing}`));
        if (current !== entry || !others.length) return;
        const peek = new Image();
        peek.className = 'seeker-sprite-peek';
        peek.alt = '';
        peek.src = others[Math.floor(Math.random() * others.length)].path;
        try { await peek.decode(); } catch { return; }
        // Laid exactly over the sprite, in the same box.
        const parent = base.offsetParent;
        if (current !== entry || !base.isConnected || !parent) return;
        Object.assign(peek.style, {
            left: `${base.offsetLeft}px`,
            top: `${base.offsetTop}px`,
            width: `${base.offsetWidth}px`,
            height: `${base.offsetHeight}px`,
        });
        parent.append(peek);
        entry.peek = peek;
        peek.getBoundingClientRect(); // start the fade from clear
        peek.classList.add('seeker-shown');
    });
    document.addEventListener('pointerout', event => {
        if (current && event.target === current.base && event.relatedTarget !== current.base) leave();
    });
    // SillyTavern swapping the expression replaces the sprite under the pointer.
    const observer = new MutationObserver(() => {
        if (current && !current.base.isConnected) leave();
    });
    const watch = () => {
        for (const id of ['expression-holder', 'visual-novel-wrapper']) {
            const holder = document.getElementById(id);
            if (holder) observer.observe(holder, { childList: true, subtree: true });
        }
    };
    watch();
    eventSource.on(eventTypes.CHAT_CHANGED, () => { leave(); watch(); });
}

// Tooltips: SillyTavern uses the browser's title tooltips, which CSS cannot reach. With a
// mouse, the title moves to data-seeker-title while the pointer is over the element (so the
// browser shows nothing) and style.css draws it as a small card; it goes back on leave.
{
    const tip = document.createElement('div');
    tip.id = 'seeker-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.append(tip);
    let owner = null;
    let timer = 0;
    const place = () => {
        if (!owner) return;
        const r = owner.getBoundingClientRect();
        const t = tip.getBoundingClientRect();
        const gap = 8;
        let top = r.top - t.height - gap;
        if (top < 8) top = r.bottom + gap;
        const left = Math.min(Math.max(r.left + r.width / 2 - t.width / 2, 8), innerWidth - t.width - 8);
        tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    };
    const hide = () => {
        clearTimeout(timer);
        tip.classList.remove('visible');
        if (owner) {
            // Put the title back unless SillyTavern set a new one meanwhile.
            if (!owner.hasAttribute('title') && owner.dataset.seekerTitle) owner.setAttribute('title', owner.dataset.seekerTitle);
            delete owner.dataset.seekerTitle;
        }
        owner = null;
    };
    document.addEventListener('pointerover', event => {
        if (event.pointerType !== 'mouse') return;
        const target = event.target instanceof Element ? event.target.closest('[title]:not(iframe, svg *, title)') : null;
        if (!target || target === owner) return;
        const text = target.getAttribute('title')?.trim();
        hide();
        if (!text) return;
        owner = target;
        owner.dataset.seekerTitle = owner.getAttribute('title');
        owner.removeAttribute('title');
        tip.textContent = text;
        timer = setTimeout(() => { place(); tip.classList.add('visible'); }, 450);
    }, true);
    document.addEventListener('pointerout', event => {
        if (owner && !owner.contains(event.relatedTarget)) hide();
    }, true);
    for (const type of ['pointerdown', 'keydown', 'wheel']) document.addEventListener(type, hide, true);
    window.addEventListener('blur', hide);
}

// A reply on its way: SillyTavern puts "..." in it until the first words arrive. While a
// generation is running, that message gets .seeker-typing and style.css draws stars instead.
{
    const { eventSource, eventTypes } = SillyTavern.getContext();
    const chat = document.getElementById('chat');
    const stop = document.getElementById('mes_stop');
    const update = () => {
        const generating = stop && getComputedStyle(stop).display !== 'none';
        const last = chat.querySelector('.mes.last_mes');
        for (const mes of chat.querySelectorAll('.mes.seeker-typing')) if (mes !== last) mes.classList.remove('seeker-typing');
        if (!last) return;
        const waiting = generating && last.getAttribute('is_user') !== 'true'
            && last.querySelector('.mes_text')?.textContent.trim() === '...';
        last.classList.toggle('seeker-typing', waiting);
    };
    new MutationObserver(update).observe(chat, { childList: true, subtree: true, characterData: true });
    for (const event of [eventTypes.GENERATION_STARTED, eventTypes.GENERATION_ENDED, eventTypes.GENERATION_STOPPED, eventTypes.MESSAGE_RECEIVED]) {
        if (event) eventSource.on(event, () => setTimeout(update));
    }
}

// Desktop stage: fine grain, a soft vignette, and a thin-line ornament in its bottom-left
// corner. style.css draws them and shows them with the stage.
for (const id of ['seeker-stage-grain', 'seeker-stage-vignette', 'seeker-stage-ornament']) {
    const element = document.createElement('div');
    element.id = id;
    element.setAttribute('aria-hidden', 'true');
    document.body.append(element);
}

// Desktop stage: the character's name, set large and vertical along the stage's right
// edge, over the halftone (style.css). Solo chats only; a group has no one name.
{
    const { eventSource, eventTypes } = SillyTavern.getContext();
    const stageName = document.createElement('div');
    stageName.id = 'seeker-stage-name';
    stageName.setAttribute('aria-hidden', 'true'); // the name is in the chat already
    // The spine: a hairline beside the name, carrying the card's creator and version.
    const spine = document.createElement('div');
    spine.id = 'seeker-stage-spine';
    spine.setAttribute('aria-hidden', 'true');
    const spineText = document.createElement('span');
    spine.append(spineText);
    document.body.append(stageName, spine);
    const updateStageName = () => {
        const context = SillyTavern.getContext();
        const solo = !context.groupId && context.characterId !== undefined;
        stageName.textContent = solo ? context.name2 ?? '' : '';
        const card = solo ? context.characters[context.characterId]?.data : undefined;
        const version = card?.character_version?.trim();
        spineText.textContent = [card?.creator?.trim(), version && `v${version.replace(/^v/i, '')}`].filter(Boolean).join(' · ');
        // style.css sizes the name from the screen height and this length, so long names
        // shrink to fit in one column.
        stageName.style.setProperty('--seeker-stage-name-length', String(Math.max(stageName.textContent.length, 1)));
    };
    // Parallax: the name starts centred and rises at a third of the chat's scroll speed,
    // stopping when it reaches the top margin, so a long chat shows it pinned at the top.
    const chat = document.getElementById('chat');
    const PARALLAX = 0.35;
    const TOP_MARGIN = 32;
    let parallaxFrame = 0;
    const updateParallax = () => {
        parallaxFrame = 0;
        if (!chat || !stageName.textContent || getComputedStyle(stageName).display === 'none') return;
        // Where the name's text starts with no shift: centred in the screen's height.
        const range = document.createRange();
        range.selectNodeContents(stageName);
        const restingTop = range.getBoundingClientRect().top + Number(stageName.style.getPropertyValue('--seeker-stage-name-shift').replace('px', '') || 0);
        const travel = Math.max(restingTop - TOP_MARGIN, 0);
        const shift = Math.min(chat.scrollTop * PARALLAX, travel);
        stageName.style.setProperty('--seeker-stage-name-shift', `${shift.toFixed(1)}px`);
    };
    const queueParallax = () => { parallaxFrame ||= requestAnimationFrame(updateParallax); };
    chat?.addEventListener('scroll', queueParallax, { passive: true });
    window.addEventListener('resize', queueParallax);

    for (const event of [eventTypes.CHAT_CHANGED, eventTypes.CHARACTER_EDITED, eventTypes.CHARACTER_RENAMED, eventTypes.APP_READY]) {
        if (event) eventSource?.on(event, () => { updateStageName(); queueParallax(); });
    }
    // New messages lengthen the chat and SillyTavern scrolls to them.
    for (const event of [eventTypes.MESSAGE_RECEIVED, eventTypes.MESSAGE_SENT, eventTypes.MORE_MESSAGES_LOADED]) {
        if (event) eventSource?.on(event, queueParallax);
    }
    updateStageName();
}

// Characters: a "Characters" back button beside the open character's name. SillyTavern's
// own way back is an unlabelled list icon above it, which the theme hides.
{
    const tabs = document.getElementById('right-nav-panel-tabs');
    const list = document.getElementById('rm_button_characters');
    if (tabs && list) {
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'seeker-back-button';
        back.setAttribute('aria-label', 'Characters');
        back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Characters</span>';
        back.addEventListener('click', () => list.click());
        tabs.prepend(back);
    }
}

// Character portraits at full size: the cards, the editor portrait and the chat portrait
// show larger than SillyTavern's 96 x 144 avatar thumbnail, so they load the character's
// own image instead. Only avatar thumbnails in those places are swapped.
{
    const PLACES = '#rm_print_characters_block .avatar img, #avatar_load_preview, #chat .mes .avatar img';
    const full = src => {
        const match = src?.match(/^\/thumbnail\?type=avatar&file=([^&]+)/);
        // The query repeats the file after an =, as the thumbnail address does: SillyTavern
        // reads the file name from after the last = when a chat avatar is clicked to enlarge it.
        return match ? `/characters/${match[1]}?file=${match[1]}` : null;
    };
    const upgrade = img => {
        const src = full(img.getAttribute('src'));
        if (!src) return;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.setAttribute('src', src);
    };
    const scan = root => {
        if (root.matches?.(PLACES)) upgrade(root);
        root.querySelectorAll?.(PLACES).forEach(upgrade);
    };
    scan(document);
    new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.type === 'attributes') { if (m.target.matches(PLACES)) upgrade(m.target); continue; }
            for (const node of m.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}

// Card captions: each character and group card gets its name over the foot of its portrait
// (the front of the flip card; panels.css), with the version and author on a line beneath it
// for characters. The back repeats that line under its own name heading. SillyTavern redraws
// the list on every change, so new cards are captioned as they arrive.
{
    const ensure = (parent, className, place = el => parent.append(el)) => {
        let el = parent.querySelector(`:scope > .${className}`);
        if (!el) {
            el = document.createElement('div');
            el.className = className;
            place(el);
        }
        return el;
    };
    const setText = (el, text) => { if (el.textContent !== text) el.textContent = text; };
    const byline = card => {
        if (!card.classList.contains('character_select')) return '';
        const data = SillyTavern.getContext().characters[Number(card.dataset.chid)]?.data;
        const version = String(data?.character_version ?? '').trim();
        const author = String(data?.creator ?? '').trim();
        const parts = [];
        if (version) parts.push(/^v/i.test(version) ? version : `v${version}`);
        if (author) parts.push(`by ${author}`);
        return parts.join(' · ');
    };
    const label = card => {
        const avatar = card.querySelector(':scope > .avatar');
        const name = card.querySelector('.ch_name')?.textContent?.trim();
        if (!avatar || !name) return;
        const caption = ensure(avatar, 'seeker-card-name');
        caption.setAttribute('aria-hidden', 'true');
        setText(ensure(caption, 'seeker-card-title'), name);
        const text = byline(card);
        const front = caption.querySelector(':scope > .seeker-card-byline');
        const back = card.querySelector('.seeker-card-meta');
        if (!text) { front?.remove(); back?.remove(); return; }
        setText(ensure(caption, 'seeker-card-byline'), text);
        const container = card.querySelector('.character_select_container');
        const nameBlock = card.querySelector('.character_name_block');
        if (container && nameBlock) setText(ensure(container, 'seeker-card-meta', el => nameBlock.after(el)), text);
    };
    const scan = root => root.querySelectorAll?.(':is(.character_select, .group_select)').forEach(label);
    const list = document.getElementById('rm_print_characters_block');
    if (list) {
        scan(list);
        new MutationObserver(() => scan(list)).observe(list, { childList: true, subtree: true, characterData: true });
    }
}

// Card actions: the back of each character card has Chat (open the chat and close the menu)
// and Edit (SillyTavern's own card click: open the chat with the editor in the menu). With a
// mouse the card turns over on hover; on a touch screen the first tap turns it over and the
// buttons do the rest, and tapping elsewhere turns it back.
{
    const list = document.getElementById('rm_print_characters_block');
    const CARD = ':is(.character_select, .group_select)';
    const addActions = card => {
        if (!card.classList.contains('character_select')) return;
        const back = card.querySelector('.character_select_container');
        if (!back || back.querySelector(':scope > .seeker-card-actions')) return;
        const row = document.createElement('div');
        row.className = 'seeker-card-actions';
        for (const [kind, label, icon] of [['edit', 'Edit', 'fa-pen'], ['chat', 'Chat', 'fa-comments']]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `seeker-card-action seeker-card-${kind} menu_button`;
            button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span>`;
            row.append(button);
        }
        back.append(row);
    };
    const unflip = except => list.querySelectorAll(`${CARD}.seeker-flipped`).forEach(card => { if (card !== except) card.classList.remove('seeker-flipped'); });
    let pointerType = 'mouse';
    const touch = () => pointerType === 'touch' || pointerType === 'pen' || matchMedia('(hover: none)').matches && pointerType !== 'mouse';
    if (list) {
        list.querySelectorAll(CARD).forEach(addActions);
        new MutationObserver(() => list.querySelectorAll(CARD).forEach(addActions)).observe(list, { childList: true });
        document.addEventListener('pointerdown', event => { pointerType = event.pointerType || 'mouse'; }, true);
        list.addEventListener('click', async event => {
            const card = event.target.closest(CARD);
            if (!card) return;
            const chat = event.target.closest('.seeker-card-chat');
            if (chat) {
                event.stopPropagation();
                event.preventDefault();
                card.classList.remove('seeker-flipped');
                await SillyTavern.getContext().selectCharacterById(Number(card.dataset.chid));
                const panel = document.querySelector('#right-nav-panel.openDrawer');
                panel?.parentElement.querySelector('.drawer-toggle .drawer-icon')?.click();
                return;
            }
            if (event.target.closest('.seeker-card-edit')) {
                card.classList.remove('seeker-flipped');
                return; // falls through to SillyTavern's own card click
            }
            if (!touch()) return;
            // Touch: the first tap turns the card over; a tap on the back of a character card
            // waits for a button. Groups have no buttons, so their second tap opens them.
            if (!card.classList.contains('seeker-flipped')) {
                event.stopPropagation();
                event.preventDefault();
                unflip(card);
                card.classList.add('seeker-flipped');
            } else if (card.classList.contains('character_select')) {
                event.stopPropagation();
                event.preventDefault();
            }
        }, true);
        document.addEventListener('click', event => { if (!event.target.closest?.(CARD)) unflip(); });
    }
}

// Characters toolbar: search, a Filters button with a labelled panel, the sort order, and a
// New button whose menu holds New character, Import from file, Import from URL and New
// group. SillyTavern's own buttons and filter bar move into the panels (they stay inside
// #rm_characters_block, where SillyTavern looks for them), so they keep working.
{
    const top = document.getElementById('charListFixedTop');
    const bar = document.getElementById('rm_button_bar');
    const controls = top?.querySelector('.rm_tag_controls');
    const sort = document.getElementById('character_sort_order');
    if (top && bar && controls && sort) {
        const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
        const makeButton = (cls, html, label) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `seeker-toolbar-button ${cls}`;
            b.innerHTML = html;
            b.setAttribute('aria-label', label);
            b.setAttribute('aria-haspopup', 'true');
            b.setAttribute('aria-expanded', 'false');
            return b;
        };
        const makePanel = cls => {
            const p = document.createElement('div');
            p.className = `seeker-popover ${cls}`;
            p.hidden = true;
            return p;
        };

        const filtersButton = makeButton('seeker-filters-button',
            icon('<path d="M3 5h18M6 12h12M10 19h4"/>') + '<span>Filters</span><span class="seeker-count" hidden></span>', 'Filters');
        const filtersPanel = makePanel('seeker-filters-panel');
        filtersPanel.innerHTML = '<div class="seeker-popover-title">Show</div>';
        filtersPanel.append(controls);

        const newButton = makeButton('seeker-new-button',
            icon('<path d="M12 5v14M5 12h14"/>') + '<span>New</span>' + icon('<path d="m6 9 6 6 6-6"/>'), 'New');
        const newPanel = makePanel('seeker-new-panel');
        for (const id of ['rm_button_create', 'character_import_button', 'external_import_button', 'rm_button_group_chats', 'rm_buttons_container']) {
            const el = document.getElementById(id);
            if (el) newPanel.append(el);
        }

        const filtersWrap = document.createElement('div');
        filtersWrap.className = 'seeker-popover-anchor';
        filtersWrap.append(filtersButton, filtersPanel);
        const newWrap = document.createElement('div');
        newWrap.className = 'seeker-popover-anchor';
        newWrap.append(newButton, newPanel);
        bar.prepend(filtersWrap);
        sort.after(newWrap);

        const pairs = [[filtersButton, filtersPanel], [newButton, newPanel]];
        const close = () => pairs.forEach(([b, p]) => { p.hidden = true; b.setAttribute('aria-expanded', 'false'); });
        for (const [button, panel] of pairs) {
            button.addEventListener('click', event => {
                event.stopPropagation();
                const opening = panel.hidden;
                close();
                panel.hidden = !opening;
                button.setAttribute('aria-expanded', String(opening));
            });
        }
        // Choosing an action closes the New menu; filters stay open while you set them.
        newPanel.addEventListener('click', event => { if (event.target.closest('.menu_button')) close(); });
        document.addEventListener('click', event => {
            if (!event.target.closest('.seeker-popover, .seeker-toolbar-button')) close();
        });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); }, true);

        // The Filters button shows how many filters are on.
        const count = filtersButton.querySelector('.seeker-count');
        const updateCount = () => {
            const n = controls.querySelectorAll('.rm_tag_filter > .tag:is(.selected, .excluded):not(.showTagList, .manageTags)').length;
            count.textContent = String(n);
            count.hidden = n === 0;
            filtersButton.classList.toggle('active', n > 0);
        };
        new MutationObserver(updateCount).observe(controls, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
        updateCount();
    }
}

// The enlarged chat portrait closes on a click outside it or on Escape, not only with its
// close button.
{
    const closeZoom = () => document.querySelector('.zoomed_avatar[forChar] .dragClose')?.click();
    document.addEventListener('click', event => {
        if (document.body.classList.contains('movingUI') || !document.querySelector('.zoomed_avatar[forChar]')) return;
        if (event.target.closest('.zoomed_avatar, .mes .avatar')) return;
        closeZoom();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.querySelector('.zoomed_avatar[forChar]')) closeZoom();
    });
}


// The other menu panels: what applies to all of a panel joins its header.
{
    const byId = id => document.getElementById(id);
    // API connections: the connection profile, which fills in everything below it.
    pinToHeader(byId('rm_api_block'), [byId('rm_api_block')?.querySelector(':scope > .wide100p')]);
    // Extensions: install, manage and notifications.
    pinToHeader(byId('rm_extensions_block'), [byId('rm_extensions_block')?.querySelector('.extensions_block > .flex-container:first-child')]);
    // Persona: usage stats, backup and restore.
    pinToHeader(byId('PersonaManagement'), [byId('PersonaManagement')?.querySelector(':scope > .flex-container > .flex-container:first-child')]);
    // Backgrounds: fitting, auto-select, new folder, add, search and sort.
    pinToHeader(byId('Backgrounds'), [byId('bg-header-fixed')]);
    // Characters: the HotSwap row and, with a character open, the back button and name.
    pinToHeader(byId('right-nav-panel'), [byId('CharListButtonAndHotSwaps'), byId('rm_PinAndTabs')]);
}

// Install: adds the seeker and seeker gilt UI themes through SillyTavern's own theme import,
// and the first time switches to seeker. After that the choice is yours.
{
    const { eventSource, eventTypes, extensionSettings, saveSettingsDebounced } = SillyTavern.getContext();
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
    eventSource.on(eventTypes.APP_READY, install);
}

// Character editor: personality and scenario sit under the description, and the example
// messages under the first message, instead of behind Advanced definitions. They carry most
// of a card's prompt. SillyTavern's own blocks move whole: their textareas belong to the
// form through form="form_create" and keep their save and token-count listeners.
{
    const description = document.getElementById('descriptionWrapper');
    const firstMessage = document.getElementById('firstMessageWrapper');
    const personality = document.getElementById('personality_div');
    const scenario = document.getElementById('scenario_div');
    const examples = document.getElementById('mes_example_div');
    if (description && firstMessage && personality && scenario && examples) {
        for (const block of [personality, scenario, examples]) block.classList.add('seeker-editor-field');
        description.after(personality, scenario);
        firstMessage.after(examples);
    }
}

// Sprites: the Character Expressions section (the sprite grid and its settings) moves out
// of Extensions and into the character editor, above the description, next to the
// character it belongs to. It is SillyTavern's own drawer moved whole, so the extension's
// handlers keep working; only its title changes, to "Sprites". It goes inside the editor's
// form only if none of its inputs are named, so a save never picks them up.
{
    const place = () => {
        const list = document.getElementById('image_list');
        const drawer = list?.closest('.inline-drawer');
        const anchor = document.getElementById('descriptionWrapper');
        const form = document.getElementById('form_create');
        if (!drawer || !anchor || !form || drawer.classList.contains('seeker-sprites')) return false;
        drawer.classList.add('seeker-sprites');
        const title = drawer.querySelector('.inline-drawer-header b, .inline-drawer-header strong');
        if (title) {
            title.textContent = 'Sprites';
            // Retarget the translation key rather than removing it: SillyTavern translates
            // every data-i18n change, and a removed key makes it throw.
            title.dataset.i18n = 'Sprites';
        }
        const named = drawer.querySelector('input[name], select[name], textarea[name]');
        if (named) form.after(drawer); else anchor.before(drawer);
        arrange(drawer);
        return true;
    };

    // The section is laid out around the sprites: a bar with the set's name, how many are
    // filled, and Upload ZIP; a line on what clicking and dropping do; the grid; then the
    // folder override, the pack and cleanup buttons, the classifier settings and the naming
    // help folded under "Folder and settings". The elements are SillyTavern's own, moved,
    // so its handlers and ids keep working.
    function arrange(drawer) {
        const content = drawer.querySelector('.inline-drawer-content');
        const open = content?.querySelector('#open_chat_expressions');
        const list = open?.querySelector('#image_list');
        const header = open?.querySelector('#image_list_header');
        if (!open || !list || !header || content.querySelector('.seeker-sprites-settings')) return;

        const bar = document.createElement('div');
        bar.className = 'seeker-sprites-bar';
        const count = document.createElement('span');
        count.className = 'seeker-sprites-count';
        const zip = document.createElement('button');
        zip.type = 'button';
        zip.className = 'menu_button seeker-sprites-zip';
        zip.innerHTML = '<i class="fa-solid fa-file-zipper" aria-hidden="true"></i><span>Upload ZIP</span>';
        zip.addEventListener('click', () => document.getElementById('expression_upload_pack_button')?.click());
        const titles = document.createElement('div');
        titles.className = 'seeker-sprites-titles';
        titles.append(header, count);
        bar.append(titles, zip);

        const hint = document.createElement('p');
        hint.className = 'seeker-sprites-hint';
        hint.textContent = 'Click a sprite to show it on the stage, or an empty slot to add one. Drop an image on a sprite to replace it, drop several named after their expressions (joy.png, anger.webp) to fill them at once, or drop a ZIP to upload a whole pack.';

        open.prepend(bar, hint);
        hint.after(list);

        const settings = document.createElement('details');
        settings.className = 'seeker-sprites-settings';
        const summary = document.createElement('summary');
        summary.textContent = 'Folder and settings';
        settings.append(summary);
        // Everything in the section that is not the bar, the hint, the grid or the no-chat note.
        for (const el of [...open.children]) if (![bar, hint, list].includes(el) && !el.classList.contains('offline_mode')) settings.append(el);
        for (const el of [...content.children]) if (el !== open && el.id !== 'no_chat_expressions') settings.append(el);
        // The naming help goes last, after the controls it explains.
        const help = settings.querySelector(':scope > p.hint');
        if (help) settings.append(help);
        content.append(settings);

        // Count of filled expressions, kept current as SillyTavern redraws the grid.
        const recount = () => {
            const items = [...list.querySelectorAll('.expression_list_item')];
            const labels = new Set(items.map(i => i.dataset.expression));
            const missing = new Set(items.filter(i => i.dataset.expressionType === 'failure').map(i => i.dataset.expression));
            const total = labels.size;
            const text = !total ? '' : missing.size ? `${total - missing.size} of ${total} filled` : `All ${total} filled`;
            if (count.textContent !== text) count.textContent = text;
        };
        recount();
        new MutationObserver(recount).observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-expression-type'] });

        // An empty slot opens the file picker instead of setting a blank expression.
        list.addEventListener('click', event => {
            const tile = event.target.closest('.expression_list_item');
            if (!tile || tile.dataset.expressionType !== 'failure' || event.target.closest('.expression_list_buttons')) return;
            event.stopPropagation();
            tile.querySelector('.expression_list_upload')?.click();
        }, true);

        // Drag and drop. SillyTavern's upload buttons open a file picker by clicking a hidden
        // input; for a drop, that click is answered with the dropped file instead.
        const feed = (inputId, file, press) => new Promise(resolve => {
            const input = document.getElementById(inputId);
            if (!input) return resolve(false);
            const done = new MutationObserver(() => { done.disconnect(); clearTimeout(timer); resolve(true); });
            const timer = setTimeout(() => { done.disconnect(); resolve(true); }, 6000);
            input.click = function () {
                delete input.click;
                const transfer = new DataTransfer();
                transfer.items.add(file);
                input.files = transfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                done.observe(list, { childList: true });
            };
            press();
        });
        const extension = name => (name.match(/\.[^.]+$/) || ['.png'])[0];
        const toTile = (tile, file) => {
            const base = tile.dataset.expressionType === 'failure'
                ? tile.dataset.expression
                : (tile.dataset.filename || tile.dataset.expression).replace(/\.[^.]+$/, '');
            const named = new File([file], base + extension(file.name), { type: file.type });
            return feed('expression_upload', named, () => tile.querySelector('.expression_list_upload')?.click());
        };
        const tileFor = file => {
            const base = file.name.replace(/\.[^.]+$/, '').toLowerCase();
            const label = base.split(/[.-]/)[0];
            return list.querySelector(`.expression_list_item[data-expression="${CSS.escape(label)}"]`);
        };
        const hasFiles = event => [...(event.dataTransfer?.types || [])].includes('Files');
        let over = null;
        const mark = tile => {
            if (over === tile) return;
            over?.classList.remove('seeker-drop-target');
            over = tile;
            over?.classList.add('seeker-drop-target');
        };
        content.addEventListener('dragover', event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'copy';
            drawer.classList.add('seeker-dropping');
            mark(event.target.closest?.('.expression_list_item') || null);
        }, true);
        content.addEventListener('dragleave', event => {
            if (content.contains(event.relatedTarget)) return;
            drawer.classList.remove('seeker-dropping');
            mark(null);
        }, true);
        content.addEventListener('drop', async event => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.stopPropagation();
            const target = event.target.closest?.('.expression_list_item');
            drawer.classList.remove('seeker-dropping');
            mark(null);
            const files = [...event.dataTransfer.files];
            const zipFile = files.find(f => /\.zip$/i.test(f.name) || f.type.includes('zip'));
            if (zipFile) {
                await feed('expression_upload_pack', zipFile, () => document.getElementById('expression_upload_pack_button')?.click());
                return;
            }
            const images = files.filter(f => f.type.startsWith('image/'));
            if (!images.length) return;
            if (target && images.length === 1) { await toTile(target, images[0]); return; }
            const unmatched = [];
            for (const file of images) {
                const tile = tileFor(file);
                if (tile) await toTile(tile, file); else unmatched.push(file.name);
            }
            if (unmatched.length) toastr.warning(`No expression matches ${unmatched.join(', ')}. Name files after an expression, like joy.png, or drop one image on a sprite.`, 'Some images were skipped');
        }, true);
    }
    if (!place()) {
        const { eventSource, eventTypes } = SillyTavern.getContext();
        eventSource?.on(eventTypes.APP_READY, place);
    }
}

// Field headers in the character editor: the expand button moves from beside the label to
// the end of the row, next to the field's other buttons (Ext. Media, Alt. Greetings), so a
// field's actions sit together. The expanded editor gets the field's name as its title.
{
    const tidy = () => document.querySelectorAll('#form_create .title_restorable .editor_maximize').forEach(button => {
        const row = button.closest('.title_restorable');
        if (button.parentElement !== row) row.append(button);
    });
    const label = id => {
        const button = document.querySelector(`.editor_maximize[data-for="${CSS.escape(id)}"]`);
        const row = button?.closest('.title_restorable') || button?.parentElement;
        return row?.querySelector('span:not([class*="fa-"])')?.textContent?.trim() || '';
    };
    const title = dialog => {
        const area = dialog.querySelector('textarea.maximized_textarea');
        const content = dialog.querySelector('.popup-content');
        if (!area || !content || content.querySelector('.seeker-max-title')) return;
        const text = label(area.dataset.for);
        if (!text) return;
        const heading = document.createElement('h3');
        heading.className = 'seeker-max-title';
        heading.textContent = text;
        content.prepend(heading);
    };
    tidy();
    let queued = false;
    new MutationObserver(records => {
        if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; tidy(); }); }
        for (const r of records) for (const node of r.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.matches?.('dialog.popup')) title(node); else node.querySelectorAll?.('dialog.popup').forEach(title);
        }
    }).observe(document.body, { childList: true, subtree: true });
}

// Regenerate and delete on every message's button row. SillyTavern keeps regenerate in the
// composer's options menu and delete behind edit mode; here they sit beside the pencil.
// Delete rewinds: the message and everything after it go.
// The buttons are added to SillyTavern's message template, so every message cloned from it
// has them; messages already on screen get them in a pass. style.css shows regenerate on
// replies only (not your own messages), and icons.css paints both with Lucide like the rest.
{
    const context = SillyTavern.getContext();
    const make = (cls, icon, title) => {
        const button = document.createElement('div');
        button.className = `mes_button ${cls} fa-solid ${icon} interactable`;
        button.title = title;
        button.tabIndex = 0;
        return button;
    };
    const equip = row => {
        if (!row || row.querySelector('.seeker-mes-delete')) return;
        const edit = row.querySelector('.mes_edit');
        const regen = make('seeker-mes-regen', 'fa-arrows-rotate', 'Regenerate from here');
        const remove = make('seeker-mes-delete', 'fa-trash-can', 'Delete from here');
        if (edit) edit.before(regen, remove); else row.append(regen, remove);
    };
    const equipAll = () => {
        equip(document.querySelector('#message_template .mes_buttons'));
        for (const row of document.querySelectorAll('#chat .mes .mes_buttons')) equip(row);
    };
    equipAll();
    for (const event of [context.eventTypes.CHAT_CHANGED, context.eventTypes.MESSAGE_RECEIVED, context.eventTypes.MESSAGE_SENT, context.eventTypes.APP_READY]) {
        if (event) context.eventSource.on(event, () => setTimeout(equipAll));
    }
    document.getElementById('chat')?.addEventListener('click', async event => {
        const button = event.target instanceof Element ? event.target.closest('.seeker-mes-regen, .seeker-mes-delete') : null;
        if (!button) return;
        event.stopPropagation();
        const mes = button.closest('.mes');
        const id = Number(mes?.getAttribute('mesid'));
        if (button.classList.contains('seeker-mes-delete')) {
            if (Number.isNaN(id)) return;
            // Deleting a message takes everything after it with it: the chat rewinds to just
            // before that message, since what followed was a reply to it. Rewinding always
            // asks; the last message alone follows the "confirm message deletion" setting.
            const after = context.chat.length - 1 - id;
            if (after > 0) {
                const what = after === 1 ? 'the message after it' : `the ${after} messages after it`;
                const result = await context.callGenericPopup(`Delete this message and ${what}?`, context.POPUP_TYPE.CONFIRM, '', { okButton: 'Delete', cancelButton: 'Cancel' });
                if (result !== context.POPUP_RESULT.AFFIRMATIVE) return;
                for (let i = context.chat.length - 1; i >= id; i--) await context.deleteMessage(i, undefined, false);
            } else {
                await context.deleteMessage(id, undefined, context.powerUserSettings.confirm_message_delete);
            }
        } else {
            // Regenerating an earlier reply rewinds to it first: everything after it was a
            // response to the old text, so it goes, and then SillyTavern regenerates the
            // reply as the last message. Rewinding asks; the last message just regenerates.
            if (Number.isNaN(id)) return;
            const after = context.chat.length - 1 - id;
            if (after > 0) {
                const what = after === 1 ? 'the message after it' : `the ${after} messages after it`;
                const result = await context.callGenericPopup(`Regenerate this reply? This also deletes ${what}.`, context.POPUP_TYPE.CONFIRM, '', { okButton: 'Regenerate', cancelButton: 'Cancel' });
                if (result !== context.POPUP_RESULT.AFFIRMATIVE) return;
                for (let i = context.chat.length - 1; i > id; i--) await context.deleteMessage(i, undefined, false);
            }
            await context.executeSlashCommandsWithOptions('/regenerate');
        }
    });
}

// The prompt manager's Edit and Inspect views (opened from AI response) keep their close
// button at the foot of the form; each gets the panels' ✕ in its heading too, which
// presses SillyTavern's own close button so the form is cleared the usual way.
for (const [view, closeId] of [['completion_prompt_manager_popup_edit', 'completion_prompt_manager_popup_entry_form_close'],
                               ['completion_prompt_manager_popup_inspect', 'completion_prompt_manager_popup_close_button']]) {
    const heading = document.querySelector(`#${view} > h3`);
    if (!heading || heading.querySelector('.seeker-panel-close')) continue;
    const close = document.createElement('div');
    close.className = 'seeker-panel-close fa-solid fa-xmark interactable';
    close.setAttribute('role', 'button');
    close.setAttribute('tabindex', '0');
    close.setAttribute('title', 'Close');
    close.addEventListener('click', () => document.getElementById(closeId)?.click());
    close.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            close.click();
        }
    });
    heading.classList.add('seeker-prompt-heading');
    heading.append(close);
}

// Prompt list rows (AI response > Prompts) unfold in place: the chevron at the end of the
// row's controls (or the prompt's name) shows its text under the row, read-only, so blocks can be skimmed without opening the editor.
// In SillyTavern the name opens Inspect (what the block sent in the last generation); that
// stays one click away inside the unfolded row. Markers have no text of their own, so they
// say what SillyTavern fills them with. The list is re-rendered often, so which rows are
// open is kept by prompt id and put back after each render.
{
    const MARKERS = {
        chatHistory: 'the conversation so far',
        charDescription: 'the character card\'s Description',
        charPersonality: 'the character card\'s Personality',
        scenario: 'the character card\'s Scenario',
        personaDescription: 'your persona\'s description',
        dialogueExamples: 'the character card\'s example messages',
        worldInfoBefore: 'World Info entries set to go before the character',
        worldInfoAfter: 'World Info entries set to go after the character',
    };
    const open = new Set();
    const list = () => document.getElementById('completion_prompt_manager_list');
    const promptById = id => (SillyTavern.getContext().chatCompletionSettings?.prompts ?? []).find(p => p.identifier === id);

    const peekFor = row => {
        const id = row.dataset.pmIdentifier;
        const prompt = promptById(id);
        const peek = document.createElement('div');
        peek.className = 'seeker-prompt-peek';
        const body = document.createElement('div');
        const content = typeof prompt?.content === 'string' ? prompt.content.trim() : '';
        if (prompt?.marker || MARKERS[id]) {
            body.className = 'seeker-prompt-peek-note';
            body.textContent = `Filled in by SillyTavern with ${MARKERS[id] ?? 'content it supplies itself'}.`;
        } else if (!content) {
            body.className = 'seeker-prompt-peek-note';
            body.textContent = 'This block is empty.';
        } else {
            body.className = 'seeker-prompt-peek-text';
            body.textContent = content;
        }
        const inspect = document.createElement('a');
        inspect.className = 'seeker-prompt-peek-inspect interactable';
        inspect.tabIndex = 0;
        inspect.textContent = 'Inspect last prompt';
        inspect.title = 'What this block sent in the last generation';
        inspect.addEventListener('click', () => {
            const name = row.querySelector('.prompt-manager-inspect-action');
            if (!name) return;
            name.dataset.seekerPass = '1';
            name.click();
        });
        peek.append(body, inspect);
        return peek;
    };

    const setOpen = (row, state) => {
        row.querySelector(':scope > .seeker-prompt-peek')?.remove();
        row.classList.toggle('seeker-prompt-open', state);
        const chevron = row.querySelector('.seeker-prompt-chevron');
        if (chevron) chevron.title = state ? 'Hide prompt' : 'Show prompt';
        if (state) row.append(peekFor(row));
    };

    const toggle = row => {
        const id = row?.dataset.pmIdentifier;
        if (!id) return;
        const state = !open.has(id);
        if (state) open.add(id); else open.delete(id);
        setOpen(row, state);
    };

    // A chevron at the end of the row's controls, after the on/off toggle.
    const chevronFor = row => {
        const chevron = document.createElement('span');
        chevron.className = 'seeker-prompt-chevron fa-solid fa-chevron-down fa-xs interactable';
        chevron.setAttribute('role', 'button');
        chevron.tabIndex = 0;
        chevron.title = 'Show prompt';
        chevron.addEventListener('click', () => toggle(row));
        chevron.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle(row);
            }
        });
        return chevron;
    };

    const restore = () => {
        for (const row of list()?.querySelectorAll(':scope > .completion_prompt_manager_prompt') ?? []) {
            const controls = row.querySelector('.prompt_manager_prompt_controls');
            if (controls && !controls.querySelector('.seeker-prompt-chevron')) controls.append(chevronFor(row));
            if (open.has(row.dataset.pmIdentifier) && !row.classList.contains('seeker-prompt-open')) setOpen(row, true);
        }
    };

    document.addEventListener('click', event => {
        const name = event.target instanceof Element ? event.target.closest('#completion_prompt_manager_list .prompt-manager-inspect-action') : null;
        if (!name) return;
        if (name.dataset.seekerPass) {
            delete name.dataset.seekerPass; // the Inspect link: let SillyTavern have it
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        toggle(name.closest('.completion_prompt_manager_prompt'));
    }, true);

    // The list element itself is replaced on some renders, so watch its parent too.
    const holder = document.getElementById('completion_prompt_manager');
    if (holder) new MutationObserver(restore).observe(holder, { childList: true, subtree: true });
    restore();
}

// New chat: a button beside the menu button, shown while a chat is open. It presses
// SillyTavern's own "Start new chat" (in the composer's options menu), which asks first and
// offers to delete the current chat, so a reset is one click away instead of two menus deep.
{
    const newChat = document.createElement('div');
    newChat.id = 'seeker-new-chat';
    newChat.className = 'fa-solid fa-square-pen interactable';
    newChat.setAttribute('role', 'button');
    newChat.setAttribute('tabindex', '0');
    newChat.setAttribute('title', 'New chat');
    const start = () => document.getElementById('option_start_new_chat')?.click();
    newChat.addEventListener('click', start);
    newChat.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            start();
        }
    });
    document.body.append(newChat);
}
