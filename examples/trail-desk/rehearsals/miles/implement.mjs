import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const picker = '<label>Distance units <select id="distance-units"><option value="km">Kilometers</option><option value="mi">Miles</option></select></label>';
const script = [
  '',
  '(() => {',
  '  const units = document.querySelector("#distance-units");',
  '  const distances = [...document.querySelectorAll("[data-distance-km]")].map(card => {',
  '    const label = card.querySelector("[data-distance-label]");',
  '    return { label, original: label.textContent, kilometers: Number(card.dataset.distanceKm) };',
  '  });',
  '  const showDistance = () => {',
  '    for (const { label, original, kilometers } of distances) {',
  '      label.textContent = units.value === "mi" ? (kilometers / 1.609344).toFixed(1) + " mi" : original;',
  '    }',
  '  };',
  '  units.addEventListener("change", showDistance);',
  '  showDistance();',
  '})();',
  '',
].join('\n');

function replaceOnce(html, search, replacement) {
  assert.equal(html.split(search).length, 2, 'Expected one Trail Desk marker: ' + search);
  return html.replace(search, replacement);
}

export async function implement(projectRoot) {
  const path = join(projectRoot, 'src', 'index.html');
  const approved = await readFile(path, 'utf8');
  const sourceHash = "'sha256-" + createHash('sha256').update(script).digest('base64') + "'";
  const toolbarEnd = '</select></label></div>';
  const catalog = /<footer>([0-9]+(?:\.[0-9]+)? km)(?= · )/g;
  const cardCount = [...approved.matchAll(/<article data-trail="/g)].length;
  assert.ok(cardCount > 0, 'Expected a Trail Desk catalog');
  assert.equal([...approved.matchAll(catalog)].length, cardCount, 'Expected a kilometer distance for every trail');

  let candidate = replaceOnce(approved, toolbarEnd, '</select></label>' + picker + '</div>');
  candidate = candidate.replace(catalog, '<footer><span data-distance-label>$1</span>');
  candidate = replaceOnce(candidate, '; style-src ', ' ' + sourceHash + '; style-src ');
  candidate = replaceOnce(candidate, '</body></html>', '<script>' + script + '</script>\n</body></html>');
  await writeFile(path, candidate);
}
