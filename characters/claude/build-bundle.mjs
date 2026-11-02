import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(fs.readFileSync(path.join(dir, 'Claude.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'asset-manifest.json'), 'utf8'));
const files = {};
const assets = [];

function addAsset(type, name, file) {
    const uri = `assets/${file}`;
    files[uri] = fs.readFileSync(path.join(dir, file));
    assets.push({ type, name, uri: `embeded://${uri}`, ext: path.extname(file).slice(1) });
}

addAsset('icon', 'main', manifest.portrait.file);
for (const [label, expression] of Object.entries(manifest.expressions)) {
    addAsset('emotion', label, expression.sprite);
}
addAsset('background', 'claude', manifest.sceneBackground.file);

const data = structuredClone(source.data);
data.assets = assets;
data.creator_notes = data.creator_notes.replace(
    'Import Claude.png for the character and portrait, then upload Claude.expressions.zip in Character Expressions and choose neutral as the fallback.',
    'Import Claude.charx through SillyTavern\'s character importer. The package includes the portrait, expressions and background. Choose neutral as the fallback in Character Expressions.',
);
files['card.json'] = strToU8(JSON.stringify({ spec: 'chara_card_v3', spec_version: '3.0', data }, null, 2) + '\n');

// Fixed ZIP timestamps keep rebuilds identical when the source assets are unchanged.
const archive = zipSync(files, { level: 0, mtime: new Date(1980, 0, 1) });
const output = path.join(dir, 'Claude.charx');
fs.writeFileSync(output, archive);
console.log(`Wrote ${output} (${archive.length} bytes)`);
