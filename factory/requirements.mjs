import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function requirementsPackage(entry = 'checks/product-requirements.mjs') {
  const location = process.env.FORGE_REQUIREMENTS_PACKAGE;
  return import(location ? pathToFileURL(join(location, entry)) :
    new URL('../apm_modules/richgo/forge-kit-skills/packages/requirements/' + entry, import.meta.url));
}

export async function readProductRequirements(path, { website } = {}) {
  const source = await readFile(path);
  if (path.endsWith('.json')) {
    return { document: JSON.parse(source), files: { 'product-requirements.json': source } };
  }
  const {
    acceptanceSource, compileFixtureRequirements, fixtureIdentity, markdownSource,
  } = await requirementsPackage('checks/fixture-requirements.mjs');
  const root = dirname(path);
  const [acceptance, catalog] = await Promise.all([
    readFile(join(root, acceptanceSource)),
    website === false ? undefined : readFile(join(root, 'catalog.json')).catch(error => {
      if (website || error.code !== 'ENOENT') throw error;
    }),
  ]);
  const document = compileFixtureRequirements(source, acceptance, catalog && JSON.parse(catalog));
  return {
    document,
    identity: fixtureIdentity(source, acceptance, document, catalog),
    files: { [markdownSource]: source, [acceptanceSource]: acceptance, ...(catalog && { 'catalog.json': catalog }) },
  };
}
