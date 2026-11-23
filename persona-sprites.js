/*
 * Persona sprites: expression sprites for the user's personas, managed in the Persona panel
 * under the persona's description, and shown on the stage beside (or instead of) the
 * character's sprite. Ported from the standalone Persona Sprites extension, which this replaces:
 * it keeps that extension's settings key, sprite folders (characters/_personas/<name>, through
 * SillyTavern's /api/sprites endpoints) and chat metadata, so nothing has to be set up again.
 * While that extension is still enabled this module stays out of its way and does nothing.
 *  - Per persona: Show in scenes, sprite folder, fallback, mirror, scale and offset.
 *  - Per chat: Auto / Show / Hide.
 *  - On the stage: solo, beside a character, or with a group; crossfades, hover peek, speaker
 *    emphasis, and the expression classified from the user's own messages.
 * persona-sprites.css (loaded from here, only when this module is active) draws both.
 */
import { user_avatar, setUserAvatar } from '../../../personas.js';
import { power_user } from '../../../power-user.js';

const MODULE = 'personaSprites';
const ctx = () => SillyTavern.getContext();

const DEFAULT_EXPRESSIONS = [
    'admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring',
    'confusion', 'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust',
    'embarrassment', 'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love',
    'nervousness', 'optimism', 'pride', 'realization', 'relief', 'remorse',
    'sadness', 'surprise', 'neutral',
];

const OPTION_NONE = '#none';
const RESET_LABEL = '#reset';

const DEFAULTS = {
    enabled: true,
    showHud: true,
    autoClassify: true,
    showInGroups: true,
    speakerEmphasis: true,
    hoverPeek: true,
    stageSide: 'left', // 'left' | 'right' | 'center'
    hud: {
        collapsed: true,
        top: null,
        tray: '', // '' | 'settings'
        spritesOpen: true,
        filter: 'all', // 'all' | 'filled'
    },
    personas: {},
};

const PERSONA_DEFAULTS = {
    showInScenes: true,
    folderOverride: '',
    pinnedFolder: '',
    fallback: '', // '' = inherit SillyTavern's global fallback, '#none', or label
    flipX: false,
    scale: 100,
    offsetX: 0,
    lastExpression: '',
    lastSpriteFile: '',
};

/* ------------------------------------------------------------------- state */

/** @type {Record<string, { label: string, files: Array<{ expression: string, fileName: string, title: string, imageSrc: string, type: string, isCustom: boolean }> }[]>} */
const spriteCache = {};
/** @type {Record<string, number>} folder -> count of sprites detected in character folder */
const charFolderProbeCache = {};

let expressionsModPromise = null;
let cachedLabels = null;
let searchQuery = '';
let detailsOpen = false;
let classifySeq = 0;
let activeStageSprite = { folder: '', expression: '', fileName: '', imageSrc: '' };
let lastSpeaker = 'char'; // 'user' | 'char'

function getExpressionsMod() {
    if (!expressionsModPromise) {
        expressionsModPromise = import('../../expressions/index.js').catch((err) => {
            console.debug(`[${MODULE}] Built-in expressions module unavailable, using fallback:`, err);
            return null;
        });
    }
    return expressionsModPromise;
}

function settings() {
    const es = ctx().extensionSettings;
    if (!es[MODULE]) es[MODULE] = structuredClone(DEFAULTS);
    const s = es[MODULE];
    for (const [k, v] of Object.entries(DEFAULTS)) {
        if (s[k] === undefined) s[k] = typeof v === 'object' && v !== null ? structuredClone(v) : v;
    }
    s.hud ||= structuredClone(DEFAULTS.hud);
    for (const [k, v] of Object.entries(DEFAULTS.hud)) {
        if (s.hud[k] === undefined) s.hud[k] = v;
    }
    s.personas ||= {};
    return s;
}

function saveSettings() {
    ctx().saveSettingsDebounced?.();
}

function personaCfg(avatarId) {
    const s = settings();
    const key = avatarId || '__default__';
    if (!s.personas[key]) s.personas[key] = structuredClone(PERSONA_DEFAULTS);
    const cfg = s.personas[key];
    for (const [k, v] of Object.entries(PERSONA_DEFAULTS)) {
        if (cfg[k] === undefined) cfg[k] = v;
    }
    return cfg;
}

function chatMeta() {
    const m = ctx().chatMetadata;
    if (!m) return null;
    if (!m[MODULE]) m[MODULE] = { sceneMode: 'default', expressions: {} };
    m[MODULE].sceneMode ||= 'default';
    m[MODULE].expressions ||= {};
    return m[MODULE];
}

function saveMeta() {
    ctx().saveMetadataDebounced?.();
}

function inActiveChat() {
    const c = ctx();
    const hasChat = c.characterId !== undefined || Boolean(c.groupId);
    const welcome = Boolean(document.querySelector('#chat > .welcomePanel'));
    return hasChat && !welcome;
}

/* ---------------------------------------------------------------- helpers */

function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[m]);
}

function sanitizeSegment(str) {
    return String(str ?? '')
        .replace(/[/\\?%*:|"<>]/g, '')
        .replace(/^\.+|\.+$/g, '')
        .trim();
}

function cleanFolderOverride(raw) {
    const parts = String(raw ?? '').trim().split('/').map(sanitizeSegment).filter(Boolean);
    if (!parts.length) return '';
    return parts.slice(0, 2).join('/');
}

function withoutExt(fileName) {
    return String(fileName ?? '').replace(/\.[^/.]+$/, '');
}

function extOf(fileName) {
    const m = String(fileName ?? '').match(/\.[^/.]+$/);
    return m ? m[0] : '.png';
}

function activePersonaId() {
    return user_avatar || '';
}

function getPersonaList() {
    const c = ctx();
    const map = power_user?.personas || {};
    const descs = power_user?.persona_descriptions || {};
    const curId = activePersonaId();

    const entries = Object.entries(map).map(([id, name]) => ({
        id,
        name: String(name || withoutExt(id) || 'User'),
        title: String(descs[id]?.title || '').trim(),
        description: String(descs[id]?.description || ''),
        avatarUrl: c.getThumbnailUrl ? c.getThumbnailUrl('persona', id) : `/User Avatars/${encodeURIComponent(id)}`,
        isActive: id === curId,
    }));

    // Ensure current persona is represented even if not yet listed in power_user.personas
    if (curId && !entries.some((e) => e.id === curId)) {
        entries.unshift({
            id: curId,
            name: c.name1 || withoutExt(curId) || 'User',
            title: String(descs[curId]?.title || '').trim(),
            description: String(descs[curId]?.description || ''),
            avatarUrl: c.getThumbnailUrl ? c.getThumbnailUrl('persona', curId) : `/User Avatars/${encodeURIComponent(curId)}`,
            isActive: true,
        });
    }

    const asc = power_user?.persona_sort_order !== 'desc';
    entries.sort((a, b) => asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

    // Disambiguate duplicate names with title or avatar filename
    const nameCounts = new Map();
    for (const e of entries) nameCounts.set(e.name.toLowerCase(), (nameCounts.get(e.name.toLowerCase()) || 0) + 1);
    for (const e of entries) {
        if (e.title) {
            e.label = `${e.name} — ${e.title}`;
        } else if ((nameCounts.get(e.name.toLowerCase()) || 0) > 1) {
            e.label = `${e.name} (${withoutExt(e.id)})`;
        } else {
            e.label = e.name;
        }
    }

    return entries;
}

function getActivePersona() {
    const list = getPersonaList();
    const curId = activePersonaId();
    const found = list.find((p) => p.id === curId);
    if (found) return found;
    const c = ctx();
    return {
        id: curId || '__default__',
        name: c.name1 || 'User',
        label: c.name1 || 'User',
        title: '',
        description: '',
        avatarUrl: curId && c.getThumbnailUrl ? c.getThumbnailUrl('persona', curId) : '',
        isActive: true,
    };
}

/**
 * Default folder for a persona lives under /characters/_personas/<name> so it
 * uses SillyTavern's native /api/sprites/* endpoints without ever colliding
 * with a character's sprite folder unless the user explicitly sets an override.
 */
function getDefaultFolderForPersona(persona) {
    const safeName = sanitizeSegment(persona.name) || 'persona';
    const list = getPersonaList();
    const duplicates = list.filter((p) => (sanitizeSegment(p.name) || 'persona').toLowerCase() === safeName.toLowerCase());
    if (duplicates.length > 1 && persona.id && persona.id !== '__default__') {
        const suffix = sanitizeSegment(withoutExt(persona.id)).slice(0, 24);
        if (suffix && suffix.toLowerCase() !== safeName.toLowerCase()) {
            return `_personas/${safeName}_${suffix}`;
        }
    }
    return `_personas/${safeName}`;
}

function getSpriteFolder(persona) {
    const cfg = personaCfg(persona.id);
    if (cfg.folderOverride) {
        const cleaned = cleanFolderOverride(cfg.folderOverride);
        if (cleaned) return cleaned;
    }
    if (cfg.pinnedFolder) return cfg.pinnedFolder;
    return getDefaultFolderForPersona(persona);
}

function getFallbackExpression(personaId) {
    const cfg = personaCfg(personaId);
    if (cfg.fallback === OPTION_NONE) return null;
    if (cfg.fallback) return cfg.fallback;
    const globalFallback = ctx().extensionSettings?.expressions?.fallback_expression;
    if (globalFallback) return globalFallback;
    return 'neutral';
}

function shouldShowInScene(personaId) {
    const s = settings();
    if (!s.enabled) return false;
    if (!inActiveChat()) return false;
    if (ctx().groupId && !s.showInGroups) return false;

    const meta = chatMeta();
    const mode = meta?.sceneMode || 'default';
    if (mode === 'show') return true;
    if (mode === 'hide') return false;

    return personaCfg(personaId).showInScenes !== false;
}

/* -------------------------------------------------------------- sprites API */

async function getExpressionLabels() {
    const custom = Array.isArray(ctx().extensionSettings?.expressions?.custom)
        ? ctx().extensionSettings.expressions.custom
        : [];
    if (!cachedLabels) {
        const mod = await getExpressionsMod();
        if (mod?.getExpressionsList) {
            try {
                const list = await mod.getExpressionsList({ filterAvailable: false });
                if (Array.isArray(list) && list.length) cachedLabels = list.slice();
            } catch {
                cachedLabels = null;
            }
        }
    }
    const base = cachedLabels || DEFAULT_EXPRESSIONS;
    return [...new Set([...base, ...custom])].sort((a, b) => a.localeCompare(b));
}

async function fetchSprites(folder, force = false) {
    if (!folder) return [];
    if (!force && spriteCache[folder]) return spriteCache[folder];
    try {
        const res = await fetch(`/api/sprites/get?name=${encodeURIComponent(folder)}`, {
            headers: ctx().getRequestHeaders(),
            cache: 'no-cache',
        });
        const raw = res.ok ? await res.json() : [];
        const custom = ctx().extensionSettings?.expressions?.custom || [];
        const grouped = [];
        for (const sprite of Array.isArray(raw) ? raw : []) {
            const fileName = String(sprite.path || '').split('/').pop().split('?')[0];
            const title = withoutExt(fileName);
            const item = {
                expression: sprite.label,
                fileName,
                title,
                imageSrc: sprite.path,
                type: 'success',
                isCustom: custom.includes(sprite.label),
            };
            let group = grouped.find((g) => g.label === sprite.label);
            if (!group) {
                group = { label: sprite.label, files: [] };
                grouped.push(group);
            }
            group.files.push(item);
        }
        for (const group of grouped) {
            group.files.sort((a, b) => {
                if (a.title === group.label) return -1;
                if (b.title === group.label) return 1;
                return a.title.localeCompare(b.title);
            });
            for (let i = 1; i < group.files.length; i++) group.files[i].type = 'additional';
        }
        spriteCache[folder] = grouped;
        return grouped;
    } catch (err) {
        console.error(`[${MODULE}] Failed to fetch sprites for ${folder}:`, err);
        return [];
    }
}

async function probeCharacterFolder(persona) {
    const safeName = sanitizeSegment(persona.name);
    if (!safeName) return 0;
    if (charFolderProbeCache[safeName] !== undefined) return charFolderProbeCache[safeName];
    try {
        const res = await fetch(`/api/sprites/get?name=${encodeURIComponent(safeName)}`, {
            headers: ctx().getRequestHeaders(),
        });
        const raw = res.ok ? await res.json() : [];
        charFolderProbeCache[safeName] = Array.isArray(raw) ? raw.length : 0;
    } catch {
        charFolderProbeCache[safeName] = 0;
    }
    return charFolderProbeCache[safeName];
}

function chooseSprite(folder, expression, { prevSrc = null, overrideFile = null, fallback = null } = {}) {
    const list = spriteCache[folder];
    if (!Array.isArray(list) || !list.length) return null;
    if (expression === RESET_LABEL) return null;

    let group = expression ? list.find((x) => x.label === expression) : null;
    if (!(group?.files?.length > 0) && fallback) {
        group = list.find((x) => x.label === fallback);
    }
    if (!(group?.files?.length > 0)) return null;

    let chosen = group.files[0];
    const exprSettings = ctx().extensionSettings?.expressions || {};
    if (overrideFile) {
        const exact = group.files.find((f) => f.fileName === overrideFile);
        if (exact) chosen = exact;
    } else if (exprSettings.allowMultiple && group.files.length > 1) {
        let pool = group.files;
        if (exprSettings.rerollIfSame && prevSrc) {
            const filtered = pool.filter((f) => f.imageSrc !== prevSrc);
            if (filtered.length) pool = filtered;
        }
        chosen = pool[Math.floor(Math.random() * pool.length)];
    }
    return chosen;
}

function generateUniqueSpriteName(expression, existingFiles) {
    let i = 1;
    let candidate = `${expression}-${i}`;
    while (existingFiles.some((f) => withoutExt(f.fileName) === candidate)) {
        i++;
        candidate = `${expression}-${i}`;
    }
    return candidate;
}

function validVariantName(expression, spriteName) {
    const escaped = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}(?:[-.].*?)?$`, 'i').test(spriteName);
}

async function uploadSpriteFile(persona, folder, expression, file, spriteName) {
    const formData = new FormData();
    formData.append('name', folder);
    formData.append('label', expression);
    formData.append('avatar', file);
    formData.append('spriteName', spriteName || expression);

    const res = await fetch('/api/sprites/upload', {
        method: 'POST',
        headers: ctx().getRequestHeaders({ omitContentType: true }),
        body: formData,
        cache: 'no-cache',
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    const cfg = personaCfg(persona.id);
    if (!cfg.folderOverride && !cfg.pinnedFolder) {
        cfg.pinnedFolder = folder;
        saveSettings();
    }
    delete spriteCache[folder];
    await fetchSprites(folder, true);
}

async function uploadSpriteZipFile(persona, folder, zipFile) {
    const formData = new FormData();
    formData.append('name', folder);
    formData.append('avatar', zipFile);

    const toast = toastr.info('Uploading sprite pack…', 'Persona Sprites', { timeOut: 0, extendedTimeOut: 0 });
    try {
        const res = await fetch('/api/sprites/upload-zip', {
            method: 'POST',
            headers: ctx().getRequestHeaders({ omitContentType: true }),
            body: formData,
            cache: 'no-cache',
        });
        if (!res.ok) throw new Error(`ZIP upload failed (${res.status})`);
        const data = await res.json();
        const cfg = personaCfg(persona.id);
        if (!cfg.folderOverride && !cfg.pinnedFolder) {
            cfg.pinnedFolder = folder;
            saveSettings();
        }
        delete spriteCache[folder];
        await fetchSprites(folder, true);
        if (data?.count) toastr.success(`Uploaded ${data.count} sprite(s) for ${persona.name}.`, 'Persona Sprites');
        return data?.count || 0;
    } finally {
        toastr.clear(toast);
    }
}

async function deleteSpriteFile(folder, expression, spriteName) {
    const res = await fetch('/api/sprites/delete', {
        method: 'POST',
        headers: ctx().getRequestHeaders(),
        body: JSON.stringify({ name: folder, label: expression, spriteName }),
        cache: 'no-cache',
    });
    if (!res.ok) throw new Error(`Delete failed (${res.status})`);
    delete spriteCache[folder];
    await fetchSprites(folder, true);
}

/* ----------------------------------------------------------- classification */

async function classifyMessageText(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return '';

    const api = ctx().extensionSettings?.expressions?.api;
    if (api === 99) return ''; // classifier disabled ([ None ])

    const mod = await getExpressionsMod();
    if (mod?.getExpressionLabel) {
        try {
            // Pass filterAvailable: false so LLM mode doesn't filter against the AI character's sprites.
            const label = await mod.getExpressionLabel(trimmed, api, { filterAvailable: false });
            if (label) return String(label).trim().toLowerCase();
        } catch (err) {
            console.debug(`[${MODULE}] Classification via expressions extension failed:`, err);
        }
    }

    // Fallback direct call to local classifier if local API is configured
    if (api === 0) {
        try {
            const res = await fetch('/api/extra/classify', {
                method: 'POST',
                headers: ctx().getRequestHeaders(),
                body: JSON.stringify({ text: trimmed.replace(/[*"]/g, '').slice(0, 500) }),
            });
            if (res.ok) {
                const data = await res.json();
                return String(data?.classification?.[0]?.label || '').trim().toLowerCase();
            }
        } catch (err) {
            console.debug(`[${MODULE}] Direct local classify failed:`, err);
        }
    }

    return '';
}

function getLastUserMessage() {
    const chat = ctx().chat || [];
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (m && m.is_user && !m.is_system) return m;
    }
    return null;
}

function detectLastSpeaker() {
    const chat = ctx().chat || [];
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (!m || m.is_system) continue;
        return m.is_user ? 'user' : 'char';
    }
    return 'char';
}

/* ------------------------------------------------------------- stage render */

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function ensureStage() {
    let holder = document.getElementById('ps-stage-holder');
    if (holder) return holder;

    holder = document.createElement('div');
    holder.id = 'ps-stage-holder';
    holder.className = 'ps-stage-holder';
    holder.hidden = true;
    holder.innerHTML = `
        <div class="ps-sprite-box">
            <img id="ps-stage-image" class="ps-stage-image" alt="" draggable="false">
        </div>`;
    document.body.appendChild(holder);
    mountStageHoverPeek(holder);
    return holder;
}

/** Hover peek over the persona sprite, matching SillyTavern-seeker's character sprite peek. */
function mountStageHoverPeek(holder) {
    let current = null; // { base, peek }
    const leave = () => {
        if (!current) return;
        const { peek } = current;
        current = null;
        if (!peek) return;
        peek.classList.remove('ps-shown');
        const remove = () => peek.remove();
        peek.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 800);
    };

    holder.addEventListener('pointerover', async (event) => {
        if (!settings().hoverPeek || event.pointerType !== 'mouse') return;
        const base = event.target;
        if (!(base instanceof HTMLImageElement) || base.id !== 'ps-stage-image') return;
        if (current?.base === base) return;
        leave();
        const folder = base.dataset.spriteFolderName;
        if (!folder) return;
        const entry = { base, peek: null };
        current = entry;
        const showing = base.dataset.spriteFilename || '';
        const list = await fetchSprites(folder);
        const others = list.flatMap((g) => g.files).filter((f) => f.fileName !== showing);
        if (current !== entry || !others.length) return;
        const pick = others[Math.floor(Math.random() * others.length)];
        const peek = new Image();
        peek.className = 'ps-sprite-peek';
        peek.alt = '';
        peek.src = pick.imageSrc;
        try { await peek.decode(); } catch { return; }
        const parent = base.offsetParent;
        if (current !== entry || !base.isConnected || !parent) return;
        Object.assign(peek.style, {
            left: `${base.offsetLeft}px`,
            top: `${base.offsetTop}px`,
            width: `${base.offsetWidth}px`,
            height: `${base.offsetHeight}px`,
        });
        parent.appendChild(peek);
        entry.peek = peek;
        peek.getBoundingClientRect();
        peek.classList.add('ps-shown');
    });

    holder.addEventListener('pointerout', (event) => {
        if (current && event.target === current.base && event.relatedTarget !== current.base) leave();
    });
    for (const type of ['pointerdown', 'keydown', 'wheel']) {
        document.addEventListener(type, leave, true);
    }
    window.addEventListener('blur', leave);
}

function applyStageTransform(persona) {
    const holder = ensureStage();
    const cfg = personaCfg(persona.id);
    holder.style.setProperty('--ps-flip', cfg.flipX ? '-1' : '1');
    holder.style.setProperty('--ps-scale', String((Number(cfg.scale) || 100) / 100));
    holder.style.setProperty('--ps-offset-x', `${Number(cfg.offsetX) || 0}%`);
}

async function setStageSprite(persona, spriteFile, folder) {
    const holder = ensureStage();
    const box = holder.querySelector('.ps-sprite-box');
    const img = holder.querySelector('#ps-stage-image');
    applyStageTransform(persona);

    if (!spriteFile || !spriteFile.imageSrc) {
        activeStageSprite = { folder: folder || '', expression: '', fileName: '', imageSrc: '' };
        img.removeAttribute('src');
        delete img.dataset.spriteFolderName;
        delete img.dataset.spriteFilename;
        delete img.dataset.expression;
        holder.hidden = true;
        syncStageClasses();
        return;
    }

    const prevSrc = img.getAttribute('src') || '';
    const nextSrc = spriteFile.imageSrc;
    activeStageSprite = {
        folder,
        expression: spriteFile.expression,
        fileName: spriteFile.fileName,
        imageSrc: nextSrc,
    };

    if (prevSrc === nextSrc && !holder.hidden) {
        syncStageClasses();
        return;
    }

    // Pre-decode incoming image so crossfade never flashes blank
    const pre = new Image();
    pre.src = nextSrc;
    try { await pre.decode(); } catch { /* render anyway */ }

    // If state changed while decoding, bail
    if (activeStageSprite.imageSrc !== nextSrc) return;

    // Crossfade dissolve from old sprite to new sprite (matching SillyTavern-seeker)
    if (prevSrc && !holder.hidden && !reduceMotion()) {
        const ghost = img.cloneNode(false);
        ghost.removeAttribute('id');
        ghost.className = 'ps-sprite-ghost';
        ghost.style.opacity = '1';
        box.appendChild(ghost);
        img.src = nextSrc;
        ghost.getBoundingClientRect();
        ghost.style.opacity = '0';
        const remove = () => ghost.remove();
        ghost.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 1400);
    } else {
        img.src = nextSrc;
    }

    img.dataset.spriteFolderName = folder;
    img.dataset.spriteFilename = spriteFile.fileName;
    img.dataset.expression = spriteFile.expression;
    img.title = `${persona.name}: ${spriteFile.expression}`;
    holder.hidden = false;
    syncStageClasses();
}

function hasSoloCharSprite() {
    const wrap = document.getElementById('expression-wrapper');
    if (!wrap || getComputedStyle(wrap).display === 'none') return false;
    const img = document.getElementById('expression-image');
    return Boolean(img && img.getAttribute('src'));
}

function hasGroupCharSprites() {
    const vn = document.getElementById('visual-novel-wrapper');
    if (!vn || getComputedStyle(vn).display === 'none') return false;
    return Boolean(vn.querySelector('.expression-holder:not(.hidden) img[src]:not([src=""])'));
}

let stageSyncFrame = 0;
function queueStageSync() {
    if (!stageSyncFrame) {
        stageSyncFrame = requestAnimationFrame(() => {
            stageSyncFrame = 0;
            syncStageClasses();
        });
    }
}

function syncStageClasses() {
    const body = document.body;
    const s = settings();
    const holder = document.getElementById('ps-stage-holder');
    const img = document.getElementById('ps-stage-image');
    const personaVisible = Boolean(holder && !holder.hidden && img && img.getAttribute('src') && inActiveChat());

    const soloChar = hasSoloCharSprite();
    const groupChar = hasGroupCharSprites();

    body.classList.toggle('ps-stage-active', personaVisible);
    body.classList.toggle('ps-stage-solo', personaVisible && !soloChar && !groupChar);
    body.classList.toggle('ps-stage-duo', personaVisible && soloChar && !groupChar);
    body.classList.toggle('ps-stage-group', personaVisible && groupChar);
    body.classList.toggle('ps-side-left', s.stageSide === 'left');
    body.classList.toggle('ps-side-right', s.stageSide === 'right');
    body.classList.toggle('ps-side-center', s.stageSide === 'center');
    body.classList.toggle('ps-emphasis', Boolean(s.speakerEmphasis));
    body.classList.toggle('ps-speaker-user', lastSpeaker === 'user');
    body.classList.toggle('ps-speaker-char', lastSpeaker !== 'user');
}

function watchCharacterStage() {
    const observer = new MutationObserver(queueStageSync);
    const observeIfPresent = () => {
        for (const id of ['expression-wrapper', 'expression-holder', 'visual-novel-wrapper', 'chat']) {
            const el = document.getElementById(id);
            if (el) observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'src'] });
        }
    };
    observeIfPresent();
    ctx().eventSource.on(ctx().eventTypes.CHAT_CHANGED, () => {
        observeIfPresent();
        queueStageSync();
    });
}

/* ----------------------------------------------------- expression selection */

async function applyPersonaExpression(expression, { spriteFile = null, remember = true, classifyIfEmpty = false } = {}) {
    const persona = getActivePersona();
    const folder = getSpriteFolder(persona);
    const sprites = await fetchSprites(folder);

    if (!shouldShowInScene(persona.id) || !sprites.length) {
        if (remember && expression !== undefined) {
            saveRememberedExpression(persona.id, expression, spriteFile);
        }
        await setStageSprite(persona, null, folder);
        return;
    }

    let expr = expression;
    let file = spriteFile;

    if (expr === undefined || expr === null || expr === '') {
        const meta = chatMeta();
        const savedChatExpr = meta?.expressions?.[persona.id];
        if (savedChatExpr && savedChatExpr.expression) {
            expr = savedChatExpr.expression;
            file = savedChatExpr.spriteFile || null;
        } else if (classifyIfEmpty && settings().autoClassify) {
            const lastUser = getLastUserMessage();
            if (lastUser?.mes) {
                const seq = ++classifySeq;
                const detected = await classifyMessageText(lastUser.mes);
                if (seq !== classifySeq) return;
                if (detected) expr = detected;
            }
        }
        if (!expr) {
            const cfg = personaCfg(persona.id);
            expr = cfg.lastExpression || getFallbackExpression(persona.id) || '';
            if (!file && cfg.lastExpression === expr) file = cfg.lastSpriteFile || null;
        }
    }

    if (remember && expr !== undefined) {
        saveRememberedExpression(persona.id, expr, file);
    }

    const fallback = getFallbackExpression(persona.id);
    const prevSrc = document.getElementById('ps-stage-image')?.getAttribute('src') || null;
    const chosen = chooseSprite(folder, expr, { prevSrc, overrideFile: file, fallback });
    await setStageSprite(persona, chosen, folder);
}

function saveRememberedExpression(personaId, expression, spriteFile) {
    const cfg = personaCfg(personaId);
    cfg.lastExpression = expression === RESET_LABEL ? '' : (expression || '');
    cfg.lastSpriteFile = expression === RESET_LABEL ? '' : (spriteFile || '');
    saveSettings();

    const meta = chatMeta();
    if (meta) {
        if (expression === RESET_LABEL) {
            meta.expressions[personaId] = { expression: RESET_LABEL, spriteFile: '' };
        } else {
            meta.expressions[personaId] = { expression: expression || '', spriteFile: spriteFile || '' };
        }
        saveMeta();
    }
}

/* ------------------------------------------- HUD: drag & collapse animation */

const PANEL_HIDDEN = { clipPath: 'inset(0 100% 0 0 round 0 12px 12px 0)', opacity: 0.2 };
const PANEL_SHOWN = { clipPath: 'inset(0 0% 0 0 round 0 12px 12px 0)', opacity: 1 };
const TAB_HIDDEN = { transform: 'translateX(-100%)', opacity: 0 };
const TAB_SHOWN = { transform: 'translateX(0)', opacity: 1 };
const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

let shownCollapsed = null;
let leaving = null;
let suppressClick = false;

async function setCollapsed(to) {
    const s = settings();
    if (Boolean(s.hud.collapsed) === to || leaving) return;
    const hud = document.getElementById('ps-hud');
    if (hud && !hud.hidden && !reduceMotion()) {
        leaving = to
            ? hud.animate([PANEL_SHOWN, PANEL_HIDDEN], { duration: 170, easing: EASE_IN, fill: 'forwards' })
            : hud.animate([TAB_SHOWN, TAB_HIDDEN], { duration: 130, easing: EASE_IN, fill: 'forwards' });
        try { await leaving.finished; } catch { /* cancelled */ }
    }
    s.hud.collapsed = to;
    saveSettings();
    await renderHud();
}

function afterRender(hud, collapsed) {
    const prev = shownCollapsed;
    shownCollapsed = collapsed;
    const changed = prev !== null && prev !== collapsed;
    if (leaving) { leaving.cancel(); leaving = null; }
    if (!changed || reduceMotion()) return;
    if (collapsed) {
        hud.animate([TAB_HIDDEN, TAB_SHOWN], { duration: 240, easing: EASE_OUT });
        return;
    }
    hud.animate([PANEL_HIDDEN, PANEL_SHOWN], { duration: 280, easing: EASE_OUT });
    hud.querySelectorAll(':scope > .ps-top, :scope > .ps-body > *').forEach((el, i) => {
        el.animate(
            [{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }],
            { duration: 230, delay: 50 + i * 45, easing: EASE_OUT, fill: 'backwards' },
        );
    });
}

function setTop(hud, y) {
    const max = Math.max(0, window.innerHeight - hud.offsetHeight);
    Object.assign(hud.style, { top: `${Math.round(Math.max(0, Math.min(y, max)))}px`, bottom: 'auto' });
}

function placeHud() {
    const hud = document.getElementById('ps-hud');
    if (!hud || hud.hidden) return;
    const top = settings().hud.top;
    if (top == null) Object.assign(hud.style, { top: '', bottom: '' });
    else setTop(hud, top);
}
window.addEventListener('resize', placeHud);

function makeDraggable(hud) {
    let drag = null;
    const move = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dy = e.clientY - drag.y0;
        if (!drag.moved) {
            if (Math.abs(dy) < 4) return;
            drag.moved = true;
            hud.classList.add('ps-dragging');
        }
        setTop(hud, drag.top0 + dy);
    };
    const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        if (drag.moved) {
            settings().hud.top = Math.round(hud.getBoundingClientRect().top);
            saveSettings();
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
        }
        hud.classList.remove('ps-dragging');
        drag = null;
    };
    hud.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || drag) return;
        const handle = e.target.closest('.ps-top, .ps-emblem');
        if (!handle) return;
        if (handle.classList.contains('ps-top') && e.target.closest('button, select, input')) return;
        drag = { y0: e.clientY, top0: hud.getBoundingClientRect().top, id: e.pointerId, moved: false };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
    });
}

/* --------------------------------------------------------------- HUD DOM */

let hiddenUploadInput = null;
let hiddenZipInput = null;
let pendingUploadCtx = null; // { persona, folder, expression, clickedFileName }

function ensureFileInputs() {
    if (!hiddenUploadInput) {
        hiddenUploadInput = document.createElement('input');
        hiddenUploadInput.type = 'file';
        hiddenUploadInput.accept = 'image/*';
        hiddenUploadInput.hidden = true;
        document.body.appendChild(hiddenUploadInput);
        hiddenUploadInput.addEventListener('change', onSingleFilePicked);
    }
    if (!hiddenZipInput) {
        hiddenZipInput = document.createElement('input');
        hiddenZipInput.type = 'file';
        hiddenZipInput.accept = 'application/zip,.zip';
        hiddenZipInput.hidden = true;
        document.body.appendChild(hiddenZipInput);
        hiddenZipInput.addEventListener('change', onZipFilePicked);
    }
}

async function onSingleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const uploadCtx = pendingUploadCtx;
    pendingUploadCtx = null;
    if (!file || !uploadCtx) return;

    const { persona, folder, expression, clickedFileName } = uploadCtx;
    const exprSettings = ctx().extensionSettings?.expressions || {};
    const existingFiles = spriteCache[folder]?.find((g) => g.label === expression)?.files || [];

    let spriteName = expression;

    if (exprSettings.allowMultiple) {
        const base = withoutExt(file.name);
        const matchesExisting = existingFiles.some((f) => f.fileName === file.name);
        const isValid = validVariantName(expression, base);

        if (!clickedFileName && isValid) {
            spriteName = base;
        } else if (clickedFileName === file.name) {
            spriteName = base;
        } else if (!matchesExisting && isValid) {
            spriteName = base;
        } else if (clickedFileName || existingFiles.length > 0) {
            const suggested = generateUniqueSpriteName(expression, existingFiles);
            const replaceLabel = clickedFileName ? `Replace ${clickedFileName}` : 'Replace existing';
            const customButtons = [{
                text: replaceLabel,
                result: ctx().POPUP_RESULT?.NEGATIVE ?? 0,
                action: () => { spriteName = clickedFileName ? withoutExt(clickedFileName) : expression; },
            }];
            spriteName = null;
            const promptHtml = `<p>Enter a sprite name starting with <code>${esc(expression)}</code> (e.g. <code>${esc(suggested)}</code>) to add another variant, or choose <strong>${esc(replaceLabel)}</strong>.</p>`;
            const input = await ctx().callGenericPopup(promptHtml, ctx().POPUP_TYPE.INPUT, suggested, { customButtons });
            if (typeof input === 'string' && input.trim()) {
                const chosen = input.trim();
                if (!validVariantName(expression, chosen)) {
                    toastr.warning(`Sprite name must start with "${expression}" (like "${suggested}").`, 'Persona Sprites');
                    return;
                }
                spriteName = chosen;
            }
        }
    }

    if (!spriteName) return;

    try {
        await uploadSpriteFile(persona, folder, expression, file, spriteName);
        toastr.success(`Saved "${spriteName}" for ${persona.name}.`, 'Persona Sprites');
        await refreshAll();
    } catch (err) {
        console.error(err);
        toastr.error(err.message || 'Failed to upload sprite.', 'Persona Sprites');
    }
}

async function onZipFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const persona = getActivePersona();
    const folder = getSpriteFolder(persona);
    try {
        await uploadSpriteZipFile(persona, folder, file);
        await refreshAll();
    } catch (err) {
        console.error(err);
        toastr.error(err.message || 'Failed to upload ZIP pack.', 'Persona Sprites');
    }
}

function ensureHud() {
    let hud = document.getElementById('ps-hud');
    if (hud) return hud;

    ensureFileInputs();
    hud = document.createElement('div');
    hud.id = 'ps-hud';
    hud.classList.add('ps-embedded');
    // In the Persona panel, under the selected persona's own fields.
    const host = document.querySelector('#PersonaManagement .persona_management_current_persona');
    if (host) host.after(hud);
    else document.body.appendChild(hud);

    hud.addEventListener('click', onHudClick);
    hud.addEventListener('change', onHudChange);
    hud.addEventListener('input', onHudInput);
    hud.addEventListener('keydown', onHudKeydown);
    hud.addEventListener('dragstart', (e) => e.preventDefault());

    // Drag & drop files (images / ZIPs) directly onto the Sprites section or tiles
    mountHudFileDrop(hud);
    return hud;
}

function mountHudFileDrop(hud) {
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    let overTile = null;
    const markTile = (tile) => {
        if (overTile === tile) return;
        overTile?.classList.remove('ps-drop-target');
        overTile = tile;
        overTile?.classList.add('ps-drop-target');
    };

    hud.addEventListener('dragover', (e) => {
        if (!hasFiles(e)) return;
        const body = e.target.closest?.('.ps-sprites-body');
        if (!body) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        body.classList.add('ps-dropping');
        markTile(e.target.closest?.('.ps-tile') || null);
    }, true);

    hud.addEventListener('dragleave', (e) => {
        const body = hud.querySelector('.ps-sprites-body');
        if (!body || body.contains(e.relatedTarget)) return;
        body.classList.remove('ps-dropping');
        markTile(null);
    }, true);

    hud.addEventListener('drop', async (e) => {
        if (!hasFiles(e)) return;
        const body = e.target.closest?.('.ps-sprites-body');
        if (!body) return;
        e.preventDefault();
        e.stopPropagation();
        const targetTile = e.target.closest?.('.ps-tile');
        body.classList.remove('ps-dropping');
        markTile(null);

        const persona = getActivePersona();
        const folder = getSpriteFolder(persona);
        const files = [...(e.dataTransfer?.files || [])];
        if (!files.length) return;

        const zipFile = files.find((f) => /\.zip$/i.test(f.name) || f.type.includes('zip'));
        if (zipFile) {
            try {
                await uploadSpriteZipFile(persona, folder, zipFile);
                await refreshAll();
            } catch (err) {
                console.error(err);
                toastr.error(err.message || 'ZIP upload failed.', 'Persona Sprites');
            }
            return;
        }

        const images = files.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name));
        if (!images.length) return;

        // Dropping 1 image directly onto a specific tile assigns/replaces that tile
        if (targetTile && images.length === 1) {
            const expr = targetTile.dataset.expression;
            const isFailure = targetTile.dataset.type === 'failure';
            const spriteName = isFailure ? expr : withoutExt(targetTile.dataset.filename || expr);
            const file = images[0];
            const named = new File([file], spriteName + extOf(file.name), { type: file.type });
            try {
                await uploadSpriteFile(persona, folder, expr, named, spriteName);
                toastr.success(`Saved "${spriteName}" for ${persona.name}.`, 'Persona Sprites');
                await refreshAll();
            } catch (err) {
                console.error(err);
                toastr.error(err.message || 'Failed to upload sprite.', 'Persona Sprites');
            }
            return;
        }

        // Multiple images (or dropped onto the grid background): match by filename
        const labels = await getExpressionLabels();
        const labelSet = new Set(labels.map((l) => l.toLowerCase()));
        const unmatched = [];
        let uploaded = 0;

        for (const file of images) {
            const base = withoutExt(file.name).toLowerCase();
            const label = base.split(/[.-]/)[0];
            if (!labelSet.has(label)) {
                unmatched.push(file.name);
                continue;
            }
            const spriteName = validVariantName(label, withoutExt(file.name)) ? withoutExt(file.name) : label;
            try {
                await uploadSpriteFile(persona, folder, label, file, spriteName);
                uploaded++;
            } catch (err) {
                console.error(err);
                unmatched.push(file.name);
            }
        }

        if (uploaded) {
            toastr.success(`Uploaded ${uploaded} sprite${uploaded === 1 ? '' : 's'} for ${persona.name}.`, 'Persona Sprites');
            await refreshAll();
        }
        if (unmatched.length) {
            toastr.warning(`Skipped ${unmatched.join(', ')}. Name files after an expression (like joy.png) or drop one image directly on a slot.`, 'Persona Sprites');
        }
    }, true);
}

/* --------------------------------------------------------------- HUD render */

async function renderHud() {
    const s = settings();
    const hud = ensureHud();
    const show = s.enabled;
    hud.hidden = !show;
    if (!show) {
        if (leaving) { leaving.cancel(); leaving = null; }
        return;
    }

    const persona = getActivePersona();
    const cfg = personaCfg(persona.id);
    const folder = getSpriteFolder(persona);
    const sprites = await fetchSprites(folder);
    const labels = await getExpressionLabels();
    const showingNow = shouldShowInScene(persona.id) && sprites.length > 0;

    // In the panel it is always open; the collapsed tab belonged to the floating menu.
    if (false) {
        const statusText = !sprites.length
            ? 'No sprites yet'
            : showingNow
                ? `Shown in scene${activeStageSprite.expression ? ` · ${activeStageSprite.expression}` : ''}`
                : 'Hidden in scenes';
        const avatarHtml = persona.avatarUrl
            ? `<img class="ps-emblem-avatar" src="${esc(persona.avatarUrl)}" alt="" draggable="false">`
            : '<i class="fa-solid fa-user ps-emblem-fallback" aria-hidden="true"></i>';
        hud.innerHTML = `<button type="button" class="ps-emblem${showingNow ? ' ps-live' : ''}" data-act="expand" title="Persona: ${esc(persona.name)} · ${esc(statusText)} (drag to move)">${avatarHtml}</button>`;
        placeHud();
        afterRender(hud, true);
        return;
    }

    const personas = getPersonaList();
    const filledSet = new Set(sprites.map((g) => g.label));
    const filledCount = labels.filter((l) => filledSet.has(l)).length;
    const totalCount = labels.length;
    const inChat = inActiveChat();
    const chatMode = chatMeta()?.sceneMode || 'default';
    const globalFallback = ctx().extensionSettings?.expressions?.fallback_expression || 'neutral';

    // Probe matching character folder only when persona has 0 sprites and no override
    let suggestedFolder = null;
    if (!sprites.length && !cfg.folderOverride) {
        const safeName = sanitizeSegment(persona.name);
        if (safeName) {
            const count = await probeCharacterFolder(persona);
            if (count > 0) suggestedFolder = { name: safeName, count };
        }
    }

    // Settings tray (under sliders button)
    const trayHtml = s.hud.tray === 'settings' ? `
        <div class="ps-tray">
            <div class="ps-tray-head">Stage &amp; Behavior</div>
            <div class="ps-row">
                <span>Stage side</span>
                <select data-act="stage-side">
                    <option value="left"${s.stageSide === 'left' ? ' selected' : ''}>Left</option>
                    <option value="right"${s.stageSide === 'right' ? ' selected' : ''}>Right</option>
                    <option value="center"${s.stageSide === 'center' ? ' selected' : ''}>Center</option>
                </select>
            </div>
            <div class="ps-row"><label><input type="checkbox" data-act="opt" data-key="autoClassify"${s.autoClassify ? ' checked' : ''}> Auto-classify my messages</label></div>
            <div class="ps-row"><label><input type="checkbox" data-act="opt" data-key="showInGroups"${s.showInGroups ? ' checked' : ''}> Show in group chats</label></div>
            <div class="ps-row"><label><input type="checkbox" data-act="opt" data-key="speakerEmphasis"${s.speakerEmphasis ? ' checked' : ''}> Highlight active speaker</label></div>
            <div class="ps-row"><label><input type="checkbox" data-act="opt" data-key="hoverPeek"${s.hoverPeek ? ' checked' : ''}> Random expression on hover</label></div>
            <div class="ps-tray-head">${esc(persona.name)} Framing</div>
            <div class="ps-row"><label><input type="checkbox" data-act="p-flip"${cfg.flipX ? ' checked' : ''}> Mirror horizontally (flip)</label></div>
            <div class="ps-row">
                <span>Scale</span>
                <input type="range" min="70" max="130" step="2" value="${Number(cfg.scale) || 100}" data-act="p-scale">
                <span class="ps-range-val" data-val="scale">${Number(cfg.scale) || 100}%</span>
            </div>
            <div class="ps-row">
                <span>Offset</span>
                <input type="range" min="-25" max="25" step="1" value="${Number(cfg.offsetX) || 0}" data-act="p-offset">
                <span class="ps-range-val" data-val="offset">${Number(cfg.offsetX) || 0}%</span>
            </div>
        </div>` : '';

    // Persona switcher options
    const personaOpts = personas.map((p) =>
        `<option value="${esc(p.id)}"${p.id === persona.id ? ' selected' : ''}>${esc(p.label)}</option>`
    ).join('');

    const statusLine = !sprites.length
        ? 'No sprites configured yet'
        : showingNow
            ? 'Showing in scene'
            : !inChat
                ? (cfg.showInScenes ? 'Ready to show in scenes' : 'Hidden in scenes')
                : 'Hidden in this scene';

    // Per-chat scene override row (only shown inside a chat)
    const chatRowHtml = inChat ? `
        <div class="ps-chat-row">
            <span>This scene</span>
            <div class="ps-seg" role="group" aria-label="Show persona in this scene">
                <button type="button" data-act="chat-mode" data-mode="default" class="${chatMode === 'default' ? 'ps-seg-on' : ''}" title="Use this persona's default setting">Auto</button>
                <button type="button" data-act="chat-mode" data-mode="show" class="${chatMode === 'show' ? 'ps-seg-on' : ''}" title="Always show in this chat">Show</button>
                <button type="button" data-act="chat-mode" data-mode="hide" class="${chatMode === 'hide' ? 'ps-seg-on' : ''}" title="Hide in this chat">Hide</button>
            </div>
        </div>` : '';

    const activeExprName = activeStageSprite.expression || cfg.lastExpression || (sprites.length ? (getFallbackExpression(persona.id) || 'none') : 'none');

    // Build sprite grid tiles
    const filter = s.hud.filter || 'all';
    const q = searchQuery.trim().toLowerCase();
    const tiles = [];
    for (const label of labels) {
        const group = sprites.find((g) => g.label === label);
        const hasFiles = Boolean(group?.files?.length);
        if (filter === 'filled' && !hasFiles) continue;
        const hiddenBySearch = q && !label.toLowerCase().includes(q);

        if (!hasFiles) {
            tiles.push(`
                <div class="ps-tile" data-act="tile-click" data-expression="${esc(label)}" data-type="failure"${hiddenBySearch ? ' hidden' : ''} title="Click or drop an image to add ${esc(label)}">
                    <div class="ps-tile-label">${esc(label)}</div>
                </div>`);
        } else {
            for (const f of group.files) {
                const isCurrent = activeStageSprite.imageSrc === f.imageSrc && activeStageSprite.folder === folder;
                tiles.push(`
                    <div class="ps-tile${isCurrent ? ' ps-tile-current' : ''}" data-act="tile-click" data-expression="${esc(label)}" data-filename="${esc(f.fileName)}" data-type="${esc(f.type)}"${hiddenBySearch ? ' hidden' : ''} title="${esc(f.title)} — click to show in scene">
                        <div class="ps-tile-actions">
                            <button type="button" data-act="upload-sprite" title="Upload / replace sprite"><i class="fa-solid fa-upload"></i></button>
                            <button type="button" data-act="del-sprite" title="Delete sprite"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <img class="ps-tile-img" src="${esc(f.imageSrc)}" alt="${esc(f.title)}" loading="lazy" draggable="false">
                        <div class="ps-tile-label">${esc(f.type === 'additional' ? f.title : label)}</div>
                    </div>`);
            }
        }
    }

    const fallbackOptions = [
        `<option value=""${!cfg.fallback ? ' selected' : ''}>Global (${esc(globalFallback || 'none')})</option>`,
        `<option value="${OPTION_NONE}"${cfg.fallback === OPTION_NONE ? ' selected' : ''}>[ No fallback ]</option>`,
        ...labels.map((l) => `<option value="${esc(l)}"${cfg.fallback === l ? ' selected' : ''}>${esc(l)}</option>`),
    ].join('');

    const suggestHtml = suggestedFolder ? `
        <div class="ps-suggest">
            <span>Found character sprites <strong>${esc(suggestedFolder.name)}</strong> (${suggestedFolder.count})</span>
            <button type="button" data-act="use-suggested" data-folder="${esc(suggestedFolder.name)}">Use</button>
        </div>` : '';

    const spritesSectionHtml = `
        <div class="ps-sprites-section${s.hud.spritesOpen ? ' ps-open' : ''}">
            <div class="ps-sprites-head" data-act="toggle-sprites">
                <div class="ps-sprites-head-title">
                    <strong>Sprites</strong>
                    <span class="ps-sprites-count">${filledCount} of ${totalCount} filled</span>
                </div>
                <i class="fa-solid fa-chevron-down ps-chevron" aria-hidden="true"></i>
            </div>
            ${s.hud.spritesOpen ? `
            <div class="ps-sprites-body">
                <div class="ps-sprites-toolbar">
                    <div class="ps-seg">
                        <button type="button" data-act="filter" data-filter="all" class="${filter === 'all' ? 'ps-seg-on' : ''}">All</button>
                        <button type="button" data-act="filter" data-filter="filled" class="${filter === 'filled' ? 'ps-seg-on' : ''}">Filled</button>
                    </div>
                    <input type="search" class="ps-search-input" data-act="search" value="${esc(searchQuery)}" placeholder="Filter…" autocomplete="off">
                    <button type="button" class="ps-zip-btn" data-act="upload-zip" title="Upload a ZIP sprite pack"><i class="fa-solid fa-file-zipper"></i><span>ZIP</span></button>
                </div>
                <p class="ps-sprites-hint">Click a sprite to show it in the scene, or an empty slot to upload. Drop images (joy.png) or a ZIP here.</p>
                ${suggestHtml}
                <div class="ps-grid">
                    ${tiles.join('') || '<div class="ps-sprites-hint" style="grid-column:1/-1;text-align:center;padding:10px 0;">No sprites yet. Switch to <strong>All</strong> to upload slots, or drop a ZIP pack here.</div>'}
                </div>
                <details class="ps-details"${detailsOpen ? ' open' : ''}>
                    <summary>Folder and fallback</summary>
                    <div class="ps-details-body">
                        <label class="ps-field-label">
                            <span>Sprite folder override (e.g. <code>Alex</code> or <code>Alex/casual</code>)</span>
                            <div class="ps-inline-form">
                                <input type="text" class="ps-folder-input" data-act="folder-input" value="${esc(cfg.folderOverride)}" placeholder="${esc(getDefaultFolderForPersona(persona))}">
                                <button type="button" class="ps-btn-filled" data-act="apply-folder">Apply</button>
                                ${cfg.folderOverride ? '<button type="button" class="ps-btn-filled" data-act="clear-folder" title="Reset to persona default folder">Reset</button>' : ''}
                            </div>
                        </label>
                        <div class="ps-folder-path">Active folder: ${esc(folder)}</div>
                        <label class="ps-field-label">
                            <span>Fallback expression</span>
                            <select data-act="p-fallback">${fallbackOptions}</select>
                        </label>
                    </div>
                </details>
            </div>` : ''}
        </div>`;

    hud.innerHTML = `
        <div class="ps-top">
            <span class="ps-title">Expression sprites<span class="ps-title-count">${filledCount}/${totalCount}</span></span>
            <button type="button" data-act="tray" data-tray="settings" class="${s.hud.tray === 'settings' ? 'ps-on' : ''}" title="Scene and framing settings"><i class="fa-solid fa-sliders"></i></button>
        </div>
        <div class="ps-body">
            ${trayHtml}
            <div class="ps-card">
                <div class="ps-persona-row">
                    ${persona.avatarUrl ? `<img class="ps-avatar" src="${esc(persona.avatarUrl)}" alt="" draggable="false">` : '<div class="ps-avatar"></div>'}
                    <div class="ps-persona-picker">
                        <div class="ps-persona-name">${esc(persona.label)}</div>
                        <div class="ps-persona-meta">
                            <span class="ps-dot${showingNow ? ' ps-dot-live' : ''}"></span>
                            <span>${esc(statusLine)}</span>
                        </div>
                    </div>
                </div>
                <div class="ps-scene-toggle${cfg.showInScenes ? ' ps-active' : ''}" data-act="toggle-scene" role="switch" aria-checked="${cfg.showInScenes ? 'true' : 'false'}" tabindex="0" title="Choose whether ${esc(persona.name)} appears in scenes by default">
                    <span class="ps-scene-toggle-label">
                        <i class="fa-solid ${cfg.showInScenes ? 'fa-eye' : 'fa-eye-slash'}" aria-hidden="true"></i>
                        <span>Show in scenes</span>
                    </span>
                    <span class="ps-switch" aria-hidden="true"></span>
                </div>
                ${chatRowHtml}
                ${sprites.length ? `
                <div class="ps-expr-strip">
                    <span>Sprite</span>
                    <span class="ps-expr-pill" title="Current persona expression">${esc(activeExprName)}</span>
                    ${inChat ? '<button type="button" data-act="reclassify" title="Classify expression from your last message"><i class="fa-solid fa-wand-magic-sparkles"></i></button>' : ''}
                    <button type="button" data-act="reset-sprite" title="Clear sprite from scene"><i class="fa-solid fa-rotate-left"></i></button>
                </div>` : ''}
            </div>
            ${spritesSectionHtml}
        </div>`;

    const detailsEl = hud.querySelector('.ps-details');
    detailsEl?.addEventListener('toggle', () => { detailsOpen = detailsEl.open; });

    placeHud();
    afterRender(hud, false);
}

/* ----------------------------------------------------------- HUD handlers */

async function onHudClick(e) {
    if (suppressClick) return;
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const s = settings();
    const persona = getActivePersona();
    const folder = getSpriteFolder(persona);

    if (act === 'expand') { setCollapsed(false); return; }
    if (act === 'collapse') { setCollapsed(true); return; }

    if (act === 'open-manager') {
        const panel = document.getElementById('PersonaManagement');
        if (panel && !panel.classList.contains('openDrawer')) {
            document.querySelector('#persona-management-button .drawer-icon')?.click();
        }
        return;
    }

    if (act === 'tray') {
        const name = btn.dataset.tray;
        s.hud.tray = s.hud.tray === name ? '' : name;
        saveSettings();
        await renderHud();
        return;
    }

    if (act === 'toggle-sprites') {
        s.hud.spritesOpen = !s.hud.spritesOpen;
        saveSettings();
        await renderHud();
        return;
    }

    if (act === 'toggle-scene') {
        const cfg = personaCfg(persona.id);
        cfg.showInScenes = !cfg.showInScenes;
        saveSettings();
        await applyPersonaExpression(undefined, { remember: false, classifyIfEmpty: cfg.showInScenes });
        await renderHud();
        return;
    }

    if (act === 'chat-mode') {
        const meta = chatMeta();
        if (!meta) return;
        meta.sceneMode = btn.dataset.mode || 'default';
        saveMeta();
        await applyPersonaExpression(undefined, { remember: false, classifyIfEmpty: shouldShowInScene(persona.id) });
        await renderHud();
        return;
    }

    if (act === 'filter') {
        s.hud.filter = btn.dataset.filter || 'all';
        saveSettings();
        await renderHud();
        return;
    }

    if (act === 'upload-zip') {
        ensureFileInputs();
        hiddenZipInput.click();
        return;
    }

    if (act === 'upload-sprite') {
        e.stopPropagation();
        const tile = btn.closest('.ps-tile');
        if (!tile) return;
        ensureFileInputs();
        pendingUploadCtx = {
            persona,
            folder,
            expression: tile.dataset.expression,
            clickedFileName: tile.dataset.type !== 'failure' ? tile.dataset.filename : null,
        };
        hiddenUploadInput.click();
        return;
    }

    if (act === 'del-sprite') {
        e.stopPropagation();
        const tile = btn.closest('.ps-tile');
        if (!tile || tile.dataset.type === 'failure') return;
        const expression = tile.dataset.expression;
        const fileName = tile.dataset.filename;
        const ok = await ctx().callGenericPopup(
            `Delete sprite <code>${esc(fileName)}</code> for <strong>${esc(persona.name)}</strong>?`,
            ctx().POPUP_TYPE.CONFIRM,
        );
        if (!ok) return;
        try {
            await deleteSpriteFile(folder, expression, withoutExt(fileName));
            await refreshAll();
        } catch (err) {
            console.error(err);
            toastr.error(err.message || 'Failed to delete sprite.', 'Persona Sprites');
        }
        return;
    }

    if (act === 'tile-click') {
        if (e.target.closest('.ps-tile-actions')) return;
        const expression = btn.dataset.expression;
        const isFailure = btn.dataset.type === 'failure';
        if (isFailure) {
            ensureFileInputs();
            pendingUploadCtx = { persona, folder, expression, clickedFileName: null };
            hiddenUploadInput.click();
            return;
        }
        const fileName = btn.dataset.filename || null;
        lastSpeaker = 'user';
        await applyPersonaExpression(expression, { spriteFile: fileName, remember: true });
        if (inActiveChat() && !shouldShowInScene(persona.id)) {
            toastr.info(`Selected "${expression}" — turn on Show in scenes to display ${persona.name}.`, 'Persona Sprites');
        }
        await renderHud();
        return;
    }

    if (act === 'reset-sprite') {
        await applyPersonaExpression(RESET_LABEL, { remember: true });
        await renderHud();
        return;
    }

    if (act === 'reclassify') {
        const lastUser = getLastUserMessage();
        if (!lastUser?.mes) {
            toastr.info('No user message in this chat yet.', 'Persona Sprites');
            return;
        }
        const detected = await classifyMessageText(lastUser.mes);
        if (!detected) {
            toastr.info('No expression returned by classifier.', 'Persona Sprites');
            return;
        }
        lastSpeaker = 'user';
        await applyPersonaExpression(detected, { remember: true });
        await renderHud();
        return;
    }

    if (act === 'use-suggested') {
        const suggested = cleanFolderOverride(btn.dataset.folder);
        if (!suggested) return;
        const cfg = personaCfg(persona.id);
        cfg.folderOverride = suggested;
        saveSettings();
        delete spriteCache[suggested];
        await refreshAll();
        return;
    }

    if (act === 'apply-folder') {
        const input = document.querySelector('#ps-hud [data-act="folder-input"]');
        if (!input) return;
        const raw = input.value.trim();
        if (raw.split('/').filter(Boolean).length > 2) {
            toastr.warning('SillyTavern supports at most one subfolder (e.g. Name/outfit).', 'Persona Sprites');
        }
        const cfg = personaCfg(persona.id);
        cfg.folderOverride = cleanFolderOverride(raw);
        saveSettings();
        delete spriteCache[getSpriteFolder(persona)];
        await refreshAll();
        return;
    }

    if (act === 'clear-folder') {
        const cfg = personaCfg(persona.id);
        cfg.folderOverride = '';
        saveSettings();
        delete spriteCache[getSpriteFolder(persona)];
        await refreshAll();
    }
}

async function onHudChange(e) {
    const el = e.target;
    const act = el.dataset?.act;
    if (!act) return;
    const s = settings();
    const persona = getActivePersona();

    if (act === 'switch-persona') {
        const targetId = el.value;
        if (targetId && targetId !== activePersonaId()) {
            try {
                await setUserAvatar(targetId, { toastPersonaNameChange: true });
            } catch (err) {
                console.error(`[${MODULE}] Failed to switch persona:`, err);
            }
            await refreshAll({ classifyIfEmpty: true });
        }
        return;
    }

    if (act === 'stage-side') {
        s.stageSide = el.value;
        saveSettings();
        syncStageClasses();
        return;
    }

    if (act === 'opt') {
        const k = el.dataset.key;
        if (k) {
            s[k] = Boolean(el.checked);
            saveSettings();
            await applyPersonaExpression(undefined, { remember: false });
            syncStageClasses();
        }
        return;
    }

    if (act === 'p-flip') {
        personaCfg(persona.id).flipX = Boolean(el.checked);
        saveSettings();
        applyStageTransform(persona);
        return;
    }

    if (act === 'p-scale') {
        personaCfg(persona.id).scale = Number(el.value) || 100;
        saveSettings();
        applyStageTransform(persona);
        return;
    }

    if (act === 'p-offset') {
        personaCfg(persona.id).offsetX = Number(el.value) || 0;
        saveSettings();
        applyStageTransform(persona);
        return;
    }

    if (act === 'p-fallback') {
        personaCfg(persona.id).fallback = el.value;
        saveSettings();
        await applyPersonaExpression(undefined, { remember: false });
        await renderHud();
    }
}

function onHudInput(e) {
    const el = e.target;
    const act = el.dataset?.act;
    if (!act) return;

    if (act === 'search') {
        searchQuery = el.value || '';
        const q = searchQuery.trim().toLowerCase();
        document.querySelectorAll('#ps-hud .ps-tile').forEach((tile) => {
            const label = (tile.dataset.expression || '').toLowerCase();
            const file = (tile.dataset.filename || '').toLowerCase();
            tile.hidden = Boolean(q && !label.includes(q) && !file.includes(q));
        });
        return;
    }

    if (act === 'p-scale') {
        const val = Number(el.value) || 100;
        const readout = document.querySelector('#ps-hud [data-val="scale"]');
        if (readout) readout.textContent = `${val}%`;
        const holder = ensureStage();
        holder.style.setProperty('--ps-scale', String(val / 100));
        return;
    }

    if (act === 'p-offset') {
        const val = Number(el.value) || 0;
        const readout = document.querySelector('#ps-hud [data-val="offset"]');
        if (readout) readout.textContent = `${val}%`;
        const holder = ensureStage();
        holder.style.setProperty('--ps-offset-x', `${val}%`);
    }
}

function onHudKeydown(e) {
    const el = e.target;
    if (e.key === 'Enter' && el.dataset?.act === 'folder-input') {
        e.preventDefault();
        document.querySelector('#ps-hud [data-act="apply-folder"]')?.click();
    } else if ((e.key === 'Enter' || e.key === ' ') && el.dataset?.act === 'toggle-scene') {
        e.preventDefault();
        el.click();
    }
}

/* ----------------------------------------------------------- refresh loop */

let refreshTimer = null;
function queueRefresh(opts = {}) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshAll(opts), 90);
}

async function refreshAll({ classifyIfEmpty = false } = {}) {
    lastSpeaker = detectLastSpeaker();
    await applyPersonaExpression(undefined, { remember: false, classifyIfEmpty });
    await renderHud();
    syncStageClasses();
}

/* ------------------------------------------------------------- settings UI */

function mountExtensionSettings() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || host.querySelector('.ps-ext-settings')) return;
    const s = settings();
    const chk = (k, label) => `<label class="checkbox_label"><input type="checkbox" data-ps-set="${k}"${s[k] ? ' checked' : ''}><span>${label}</span></label>`;

    const wrap = document.createElement('div');
    wrap.className = 'ps-ext-settings';
    wrap.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Persona Sprites</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                ${chk('enabled', 'Enable Persona Sprites')}
                ${chk('showHud', 'Show collapsible Persona menu HUD')}
                ${chk('autoClassify', 'Automatically classify persona expression when you send a message')}
                ${chk('showInGroups', 'Show persona sprites in group chats')}
                ${chk('speakerEmphasis', 'Highlight active speaker in duo & group scenes')}
                ${chk('hoverPeek', 'Show a random expression when hovering over the persona sprite')}
                <label class="m-t-1">Stage placement
                    <select data-ps-set="stageSide" class="text_pole">
                        <option value="left">Left side of stage</option>
                        <option value="right">Right side of stage</option>
                        <option value="center">Center</option>
                    </select>
                </label>
            </div>
        </div>`;
    host.appendChild(wrap);
    wrap.querySelector('[data-ps-set="stageSide"]').value = s.stageSide;

    wrap.addEventListener('change', async (e) => {
        const k = e.target.dataset?.psSet;
        if (!k) return;
        const cur = settings();
        cur[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        saveSettings();
        await refreshAll();
    });
}

/* ----------------------------------------------------------- slash commands */

function registerCommands() {
    const c = ctx();
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = c;
    if (!SlashCommandParser?.addCommandObject) return;

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'persona-sprite',
        callback: async (_, expr) => {
            const label = String(expr || '').trim().toLowerCase();
            if (!label) return activeStageSprite.expression || '';
            lastSpeaker = 'user';
            await applyPersonaExpression(label, { remember: true });
            await renderHud();
            return activeStageSprite.expression || '';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({
            description: 'expression label (or #reset to clear)',
            typeList: [ARGUMENT_TYPE.STRING],
        })],
        helpString: 'Sets the active persona sprite expression in the scene (or prints the current one if empty).',
        returns: 'active persona expression',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'persona-scene',
        callback: async (_, mode) => {
            const val = String(mode || 'toggle').trim().toLowerCase();
            const persona = getActivePersona();
            const meta = chatMeta();
            if (meta) {
                if (val === 'on' || val === 'show') meta.sceneMode = 'show';
                else if (val === 'off' || val === 'hide') meta.sceneMode = 'hide';
                else if (val === 'default' || val === 'auto') meta.sceneMode = 'default';
                else meta.sceneMode = shouldShowInScene(persona.id) ? 'hide' : 'show';
                saveMeta();
            } else {
                const cfg = personaCfg(persona.id);
                cfg.showInScenes = val === 'on' || val === 'show' ? true : val === 'off' || val === 'hide' ? false : !cfg.showInScenes;
                saveSettings();
            }
            await refreshAll({ classifyIfEmpty: true });
            return shouldShowInScene(persona.id) ? 'shown' : 'hidden';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({
            description: 'on | off | toggle | default',
            typeList: [ARGUMENT_TYPE.STRING],
        })],
        helpString: 'Shows or hides the active persona sprite in the current scene.',
        returns: 'shown or hidden',
    }));
}

/* --------------------------------------------------------------------- init */

function init() {
    settings();
    ensureStage();
    watchCharacterStage();
    registerCommands();

    const { eventSource, eventTypes: et } = ctx();

    const onUserMessage = async () => {
        lastSpeaker = 'user';
        syncStageClasses();
        const persona = getActivePersona();
        if (!settings().autoClassify || !shouldShowInScene(persona.id)) {
            await renderHud();
            return;
        }
        const msg = getLastUserMessage();
        if (!msg?.mes) return;
        const seq = ++classifySeq;
        const detected = await classifyMessageText(msg.mes);
        if (seq !== classifySeq) return;
        if (detected) {
            await applyPersonaExpression(detected, { remember: true });
        } else {
            await applyPersonaExpression(undefined, { remember: false });
        }
        await renderHud();
    };

    if (et.MESSAGE_SENT) eventSource.on(et.MESSAGE_SENT, onUserMessage);
    if (et.MESSAGE_EDITED) {
        eventSource.on(et.MESSAGE_EDITED, (mesId) => {
            const msg = ctx().chat?.[mesId];
            if (msg?.is_user) onUserMessage();
        });
    }
    if (et.MESSAGE_RECEIVED) {
        eventSource.on(et.MESSAGE_RECEIVED, () => {
            lastSpeaker = 'char';
            syncStageClasses();
        });
    }

    for (const ev of [et.CHAT_CHANGED, et.PERSONA_CHANGED]) {
        if (ev) eventSource.on(ev, () => queueRefresh({ classifyIfEmpty: true }));
    }
    for (const ev of [et.PERSONA_CREATED, et.PERSONA_UPDATED, et.PERSONA_RENAMED, et.GROUP_UPDATED, et.SETTINGS_UPDATED, et.MESSAGE_DELETED]) {
        if (ev) eventSource.on(ev, () => queueRefresh());
    }

    refreshAll({ classifyIfEmpty: true });
}

// The standalone extension, if it is still installed and enabled: SillyTavern adds its script
// and stylesheet to the page by address.
const standaloneLoaded = () => Boolean(document.querySelector('script[src*="SillyTavern-PersonaSprites"], link[href*="SillyTavern-PersonaSprites"]'));

export function mountPersonaSprites() {
    const { eventSource, eventTypes } = ctx();
    eventSource.on(eventTypes.APP_READY, () => {
        if (standaloneLoaded()) {
            console.info('seeker: the Persona Sprites extension is enabled, so the built-in persona sprites are off. Disable the extension to use the built-in ones.');
            return;
        }
        const sheet = document.createElement('link');
        sheet.rel = 'stylesheet';
        sheet.href = new URL('persona-sprites.css', import.meta.url).href;
        document.head.append(sheet);
        init();
    });
}
