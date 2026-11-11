import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function replace(source, pattern, replacement) {
  const result = source.replace(pattern, replacement);
  assert.notEqual(result, source, 'Expected to update the reviewed Trail Desk source at ' + pattern);
  return result;
}

export async function implement(projectRoot) {
  const source = name => join(projectRoot, 'src', name);
  const [html, server, catalog] = await Promise.all([
    readFile(source('index.html'), 'utf8'),
    readFile(source('server.mjs'), 'utf8'),
    readFile(join(projectRoot, 'catalog.json')),
  ]);
  const existingScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(existingScripts.length, 2, 'Expected the reviewed filter and sort scripts');
  const script = `
async function loadCatalog() {
  const count = document.querySelector('#count');
  try {
    const response = await fetch('/api/v1/trails');
    if (!response.ok) throw new Error('Catalog request failed');
    const { trails: records } = await response.json();
    const grid = document.querySelector('.grid');
    const cards = records.map(record => {
      const card = document.createElement('article');
      card.dataset.trail = record.id;
      card.dataset.stepFree = record.stepFree;
      card.dataset.distanceKm = Number.parseFloat(record.distance);
      const fields = [
        ['div', 'tag', record.terrain],
        ['h2', '', record.name],
        ['p', '', record.description],
        ['footer', '', record.distance + (record.stepFree ? ' · Step-free' : ' · Uneven terrain')],
      ];
      for (const [tag, className, text] of fields) {
        const element = document.createElement(tag);
        element.className = className;
        element.textContent = text;
        card.append(element);
      }
      return card;
    });
    grid.append(...cards);
${existingScripts.map(([, body]) => body.trim().split('\n').map(line => '    ' + line).join('\n')).join('\n')}
    document.querySelector('#distance-sort').dispatchEvent(new Event('change'));
  } catch {
    count.textContent = 'Trail catalog unavailable';
  }
}
loadCatalog();
`;
  const hash = createHash('sha256').update(script).digest('base64');
  let updatedHtml = replace(html, /<section class="grid" aria-label="Trail catalog">[\s\S]*?<\/section>/,
    '<section class="grid" aria-label="Trail catalog"></section>');
  updatedHtml = replace(updatedHtml, /(<strong id="count" aria-live="polite">)\d+ trails/, '$1Loading trails…');
  updatedHtml = replace(updatedHtml, "connect-src 'none'", "connect-src 'self'");
  updatedHtml = replace(updatedHtml, /script-src [^;]+;/, `script-src 'sha256-${hash}';`);
  updatedHtml = replace(updatedHtml, existingScripts.map(([tag]) => tag).join(''), () => `<script>${script}</script>`);

  let updatedServer = replace(server, 'const server = createServer',
    `const { trails } = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url), 'utf8'));
const catalogResponse = JSON.stringify({ trails });
const server = createServer`);
  updatedServer = replace(updatedServer, /  if \(request\.method !== 'GET' \|\| request\.url !== '\/'\) \{/,
    `  if (request.method === 'GET' && request.url === '/api/v1/trails') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(catalogResponse);
    return;
  }
$&`);
  await Promise.all([
    writeFile(source('index.html'), updatedHtml),
    writeFile(source('server.mjs'), updatedServer),
    writeFile(source('catalog.json'), catalog),
  ]);
}
