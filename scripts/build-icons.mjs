// Builds icons.css, which paints Lucide icons over SillyTavern's Font Awesome ones.
//
// SillyTavern draws every icon as a Font Awesome glyph in an <i class="fa-solid fa-NAME">.
// Font Awesome's own stylesheet maps each class to a glyph code, and several class names
// share one code (fa-gear / fa-cog). We read those groups, pick a Lucide icon per code, and
// emit a rule that hides the glyph and paints the Lucide SVG as a mask in currentColor, so
// colour, size modifiers (fa-lg, fa-2x) and animations (fa-spin) keep working.
//
// Brand logos (fa-brands) live in a separate stylesheet and are left alone; Lucide has none.
// Codes with no Lucide counterpart are also left alone and keep their Font Awesome glyph.
//
//   npm run build:icons                      reads ~/SillyTavern
//   SILLYTAVERN=/path/to/st npm run build:icons

import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const st = process.env.SILLYTAVERN || join(homedir(), 'SillyTavern');
const faCss = join(st, 'public/css/fontawesome.min.css');
const lucideDir = join(root, 'node_modules/lucide-static/icons');
const strokeWidth = process.env.STROKE || '2';

// Font Awesome name -> Lucide name, where the two sets name the same idea differently.
// Any name of a glyph group may be listed; exact name matches need no entry.
const ALIASES = {
    'address-book': 'book-user',
    'address-card': 'contact',
    'arrow-alt-circle-right': 'circle-arrow-right',
    'arrow-down-9-1': 'arrow-down-wide-narrow',
    'arrow-right-arrow-left': 'arrow-left-right',
    'arrow-right-rotate': 'rotate-cw',
    'arrow-turn-up': 'corner-left-up',
    'arrows-alt': 'move',
    'arrows-rotate': 'refresh-cw',
    'at': 'at-sign',
    'bars': 'menu',
    'book-atlas': 'book-marked',
    'book-open-reader': 'book-open-text',
    'box-open': 'package-open',
    'bug-slash': 'bug-off',
    'bullhorn': 'megaphone',
    'chain': 'link',
    'chain-broken': 'unlink',
    'check-double': 'check-check',
    'check-to-slot': 'vote',
    'circle-chevron-down': 'chevron-down',
    'circle-chevron-up': 'chevron-up',
    'circle-exclamation': 'circle-alert',
    'circle-info': 'info',
    'circle-question': 'circle-question-mark',
    'circle-xmark': 'x',
    'clock-rotate-left': 'history',
    'clone': 'copy',
    'cloud-arrow-down': 'cloud-download',
    'code-branch': 'git-branch',
    'code-compare': 'git-compare',
    'comment': 'message-square',
    'comment-dots': 'message-square-more',
    'comment-slash': 'message-square-off',
    'comments': 'messages-square',
    'compress': 'minimize',
    'crow': 'bird',
    'cubes': 'boxes',
    'cut': 'scissors',
    'desktop': 'monitor',
    'dragon': 'flame',
    'envelope-open-text': 'mail-open',
    'eye-slash': 'eye-off',
    'face-smile': 'smile',
    'file-alt': 'file-text',
    'file-arrow-up': 'file-up',
    'file-circle-plus': 'file-plus',
    'file-export': 'file-output',
    'file-import': 'file-input',
    'file-zipper': 'file-archive',
    'filter-circle-xmark': 'funnel-x',
    'fire': 'flame',
    'flag-checkered': 'flag',
    'flask': 'flask-conical',
    'floppy-disk': 'save',
    'font': 'type',
    'frog': 'turtle',
    'gear': 'settings',
    'gears': 'settings-2',
    'hdd': 'hard-drive',
    'headphones-simple': 'headphones',
    'hourglass-half': 'hourglass',
    'image-portrait': 'square-user',
    'kiwi-bird': 'bird',
    'language': 'languages',
    'layer-group': 'layers',
    'left-long': 'move-left',
    'link-slash': 'unlink',
    'list-ol': 'list-ordered',
    'list-ul': 'list',
    'magnifying-glass': 'search',
    'markdown': 'letter-text',
    'message': 'message-square',
    'mobile-screen-button': 'smartphone',
    'note-sticky': 'sticky-note',
    'notes-medical': 'clipboard-plus',
    'otter': 'squirrel',
    'panorama': 'image',
    'paper-plane': 'send',
    'passport': 'book-user',
    'paste': 'clipboard-paste',
    'pen-to-square': 'square-pen',
    'people-arrows': 'arrow-left-right',
    'people-group': 'users',
    'person-circle-question': 'user-round-search',
    'photo-film': 'images',
    'plane-slash': 'plane-landing',
    'plug-circle-check': 'plug',
    'plug-circle-exclamation': 'unplug',
    'question': 'circle-question-mark',
    'quote-left': 'quote',
    'ranking-star': 'trophy',
    'right-from-bracket': 'log-out',
    'right-left': 'arrow-left-right',
    'robot': 'bot',
    'rotate-left': 'rotate-ccw',
    'scale-balanced': 'scale',
    'sd-card': 'memory-stick',
    'share-from-square': 'share',
    'shoe-prints': 'footprints',
    'spinner': 'loader-circle',
    'square-poll-horizontal': 'chart-bar',
    'star-of-life': 'asterisk',
    'stop': 'square',
    'table-cells-large': 'layout-grid',
    'thumbtack': 'pin',
    'toggle-off': 'toggle-left',
    'toggle-on': 'toggle-right',
    'trash-can': 'trash-2',
    'triangle-exclamation': 'triangle-alert',
    'truck-arrow-right': 'truck',
    'up-right-from-square': 'external-link',
    'user-graduate': 'graduation-cap',
    'user-secret': 'venetian-mask',
    'user-slash': 'user-x',
    'user-tie': 'user-round',
    'users-gear': 'user-cog',
    'vial': 'test-tube',
    'volume-high': 'volume-2',
    'volume-low': 'volume-1',
    'volume-xmark': 'volume-x',
    'wand-magic': 'wand',
    'wand-magic-sparkles': 'wand-sparkles',
    'window-maximize': 'maximize-2',
    'window-restore': 'app-window',
    'xmark': 'x',
};

// Pseudo-elements in SillyTavern's own CSS that set a Font Awesome glyph code directly.
const RAW_GLYPHS = [
    {selector: '.menu_button.toggleable.toggled::before', code: 'f00c'},
    {selector: '.menu_button.toggleable:not(.toggled)::before', code: 'f00d'},
    {selector: '.rm_tag_bogus_drilldown .tag:not(:first-child)::before', code: 'f054'},
    {selector: '.bg_example.selected-background::before', code: 'f00c'},
    {selector: '#Backgrounds.bg-selection-mode #bg_menu_content .bg_example.folder-group-selected::before', code: 'f00c'},
    {selector: '.bg_example.locked-background::after', code: 'f023'},
];

if (!existsSync(faCss)) throw new Error(`Font Awesome stylesheet not found at ${faCss}; set SILLYTAVERN.`);
if (!existsSync(lucideDir)) throw new Error('lucide-static is not installed; run npm install.');

// Glyph code -> every class name that draws it.
const groups = new Map();
for (const [, selectors, code] of readFileSync(faCss, 'utf8').matchAll(/([^{}]+)\{content:"\\([0-9a-f]+)"\}/g)) {
    const names = [...selectors.matchAll(/\.fa-([a-z0-9-]+):before/g)].map(match => match[1]);
    if (names.length) groups.set(code, [...(groups.get(code) || []), ...names]);
}

const lucideFor = names => {
    for (const name of names) if (ALIASES[name]) return ALIASES[name];
    return names.find(name => existsSync(join(lucideDir, `${name}.svg`)));
};

const dataUri = icon => {
    const svg = readFileSync(join(lucideDir, `${icon}.svg`), 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s*class="[^"]*"/, '')
        .replace(/\s*(width|height)="24"/g, '')
        .replace('stroke="currentColor"', 'stroke="#000"')
        .replace(/stroke-width="2"/, `stroke-width="${strokeWidth}"`)
        .replace(/\s+/g, ' ')
        .replace(/> </g, '><')
        .trim();
    const escaped = svg.replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E');
    return `url("data:image/svg+xml,${escaped}")`;
};

for (const icon of Object.values(ALIASES)) {
    if (!existsSync(join(lucideDir, `${icon}.svg`))) throw new Error(`Alias target lucide/${icon} does not exist.`);
}

const iconByCode = new Map();
const classRules = [];
const mapped = [];
let unmapped = 0;
for (const [code, names] of groups) {
    const icon = lucideFor(names);
    if (!icon) {
        unmapped += 1;
        continue;
    }
    iconByCode.set(code, icon);
    const selector = names.map(name => `.fa-${name}::before`).join(',');
    classRules.push(`${selector}{--seeker-icon:var(--seeker-icon-${icon})}`);
    mapped.push(...names);
}

const used = new Set(iconByCode.values());
const variables = [...used].sort().map(icon => `  --seeker-icon-${icon}:${dataUri(icon)};`);

const paint = `content:""!important;display:inline-block;width:1em;height:1em;vertical-align:-0.125em;background-color:currentColor;-webkit-mask:var(--seeker-icon) center/contain no-repeat;mask:var(--seeker-icon) center/contain no-repeat`;
const rawRules = RAW_GLYPHS.map(({selector, code}) => {
    const icon = iconByCode.get(code);
    if (!icon) throw new Error(`No Lucide icon for raw glyph \\${code}.`);
    return `${selector}{--seeker-icon:var(--seeker-icon-${icon});${paint}}`;
});

const lucideVersion = JSON.parse(readFileSync(join(root, 'node_modules/lucide-static/package.json'), 'utf8')).version;
const output = [
    '/* Generated by scripts/build-icons.mjs, do not edit; run npm run build:icons.',
    `   Lucide icons v${lucideVersion} (https://lucide.dev), ISC License, see LICENSE-lucide.`,
    `   ${mapped.length} Font Awesome classes across ${iconByCode.size} glyphs draw a Lucide icon. */`,
    '',
    ':root {',
    ...variables,
    '}',
    '',
    // Only mapped classes are painted; anything else keeps its Font Awesome glyph.
    `:is(${mapped.map(name => `.fa-${name}`).join(',')})::before{${paint}}`,
    ...classRules,
    '',
    ...rawRules,
    '',
].join('\n');

writeFileSync(join(root, 'icons.css'), output);
writeFileSync(join(root, 'LICENSE-lucide'), readFileSync(join(root, 'node_modules/lucide-static/LICENSE'), 'utf8'));
console.log(`icons.css: ${mapped.length} classes, ${iconByCode.size} glyphs, ${used.size} Lucide icons; ${unmapped} glyphs left on Font Awesome.`);
