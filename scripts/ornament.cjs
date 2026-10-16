// Corner ornament for the chat column: thin-line geometry centred on the top-left corner.
// Usage: node scripts/ornament.cjs ornament.svg
const fs = require('fs');
const S = 260, O = 14;                 // size, and the corner the geometry radiates from
const f = n => +n.toFixed(2);
const pt = (r, deg) => [f(O + r * Math.cos(deg * Math.PI / 180)), f(O + r * Math.sin(deg * Math.PI / 180))];
const arc = (r, a0 = 0, a1 = 90, extra = '') => { const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1); return `<path d="M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}"${extra}/>`; };
const line = ([x0, y0], [x1, y1], extra = '') => `<path d="M${x0} ${y0}L${x1} ${y1}"${extra}/>`;
const out = [];
// Edge rules: a double hairline along the top and the left, running out from the corner.
out.push(line([O, O], [S, O]), line([O, O], [O, S]));
out.push(line([O + 6, O + 6], [S * 0.72, O + 6]), line([O + 6, O + 6], [O + 6, S * 0.72]));
// Quarter arcs.
out.push(arc(40), arc(46), arc(104), arc(150, 0, 90, ' stroke-dasharray="0.6 5" stroke-linecap="round"'), arc(196, 4, 86, ' stroke-opacity="0.6"'));
// Ticks between the inner arcs, longer every 15 degrees.
for (let a = 5; a < 90; a += 5) { const long = a % 15 === 0; out.push(line(pt(46, a), pt(long ? 58 : 51, a))); }
// Rays from the corner to the big arc at 15-degree steps (faint), and at 45 the main axis.
for (let a = 15; a < 90; a += 15) if (a !== 45) out.push(line(pt(58, a), pt(104, a), ' stroke-opacity="0.45"'));
// The axis breaks around the seal and the stars on it.
out.push(line(pt(58, 45), pt(104 - 21, 45)), line(pt(104 + 21, 45), pt(150 - 7, 45)), line(pt(150 + 7, 45), pt(196 - 6, 45)));
// The seal on the 45-degree axis: circle, two interlaced squares (an eight-point star), inner circle.
const [cx, cy] = pt(104, 45), R = 17;
out.push(`<circle cx="${cx}" cy="${cy}" r="${R}"/>`, `<circle cx="${cx}" cy="${cy}" r="${R + 4}" stroke-opacity="0.5"/>`, `<circle cx="${cx}" cy="${cy}" r="4"/>`);
const sq = rot => { const p = [0, 90, 180, 270].map(a => { const t = (a + rot) * Math.PI / 180; return [f(cx + R * Math.cos(t)), f(cy + R * Math.sin(t))]; }); return `<path d="M${p.map(q => q.join(' ')).join('L')}Z"/>`; };
out.push(sq(0), sq(45));
// Small four-pointed stars where the arcs cross the edges and on the axis, and dots on the big arc.
// Each point is a curve drawn in towards the centre, so the sides are concave.
const star = ([x, y], r = 4.5) => { const k = f(r * 0.16); return `<path d="M${x} ${f(y - r)}Q${f(x + k)} ${f(y - k)} ${f(x + r)} ${y}Q${f(x + k)} ${f(y + k)} ${x} ${f(y + r)}Q${f(x - k)} ${f(y + k)} ${f(x - r)} ${y}Q${f(x - k)} ${f(y - k)} ${x} ${f(y - r)}Z"/>`; };
out.push(star(pt(104, 0)), star(pt(104, 90)), star(pt(150, 45), 5.5), star(pt(196, 45), 4));
out.push(star([S * 0.72 + 8, O + 6], 3.5), star([O + 6, S * 0.72 + 8], 3.5));
for (const a of [15, 30, 60, 75]) { const [x, y] = pt(104, a); out.push(`<circle cx="${x}" cy="${y}" r="1.3" fill="#fff" stroke="none"/>`); }
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" fill="none" stroke="#fff" stroke-width="0.75">${out.join('')}</svg>\n`;
fs.writeFileSync(process.argv[2], svg);
console.log(svg.length, 'bytes');
