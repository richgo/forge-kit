import assert from 'node:assert/strict';

export function architectureChange(model, view) {
  const architecture = structuredClone(model);
  const browser = architecture.nodes.find(node => node['unique-id'] === 'browser');
  const pages = architecture.nodes.find(node => node['unique-id'] === 'pages');
  const catalog = architecture.nodes.find(node => node['unique-id'] === 'trail_catalog');
  const embeddedCatalog = architecture.relationships.findIndex(edge => edge['unique-id'] === 'pages-trail_catalog');
  assert.ok(browser && pages && catalog && embeddedCatalog >= 0, 'Expected the static Trail Desk architecture');

  browser.description = 'Renders the Trail Desk page and loads its catalog from the same origin.';
  pages.name = 'Trail Desk origin';
  pages.description = 'Serves the checked site and its catalog API on the same origin.';
  catalog.description = 'The approved trail records served by the catalog API.';
  const api = {
    'unique-id': 'catalog_api', 'node-type': 'service', name: 'Trail catalog API',
    description: 'Returns the approved trail catalog from GET /api/v1/trails.',
  };
  architecture.nodes.push(api);
  const connections = [
    ['browser', 'catalog_api', 'Fetches GET /api/v1/trails from the same origin.'],
    ['pages', 'catalog_api', 'Serves the catalog API on the site origin.'],
    ['catalog_api', 'trail_catalog', 'Reads the approved trail records.'],
  ];
  architecture.relationships.splice(embeddedCatalog, 1, ...connections.map(([source, destination, description]) => ({
    'unique-id': source + '-' + destination, description,
    'relationship-type': { connects: { source: { node: source }, destination: { node: destination } } },
  })));

  const pagesElement = /^  pages = service 'GitHub Pages'$/m;
  const oldConnection = /^  pages -> trail_catalog '.+'$/m;
  assert.ok(pagesElement.test(view) && oldConnection.test(view), 'Expected the static Trail Desk LikeC4 view');
  const apiConnections = connections.map(([source, destination, description]) =>
    `  ${source} -> ${destination} '${description}'`).join('\n');
  const updatedView = view.replace(pagesElement, `  pages = service '${pages.name}'\n  catalog_api = service '${api.name}'`)
    .replace(oldConnection, apiConnections);
  return { architecture, view: updatedView };
}
