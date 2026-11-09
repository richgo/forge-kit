const roles = [
  'orchestration', 'execution', 'checking', 'skills', 'mcp',
  'architecture', 'websiteChecking', 'repairChecking', 'delivery', 'buildRepair', 'securityReview',
];

function packageReference({ repository, path, ref }) {
  if (typeof repository !== 'string' || repository.trim() !== repository ||
      !/^[a-z0-9_-]+\/[a-z0-9_.-]+$/i.test(repository) || /\/\.{1,2}$/.test(repository) ||
      (path !== undefined && (typeof path !== 'string' || !path.split('/').every(
        part => part.trim() === part && /^[a-z0-9_.-]+$/i.test(part) && part !== '.' && part !== '..'
      )))) {
    throw new Error('Expected an external GitHub APM package');
  }
  if (repository.toLowerCase() === 'richgo/forge-kit') {
    throw new Error('Factory primitives must be external');
  }
  if (typeof ref !== 'string' || ref.length !== 40 || !/^[a-f0-9]{40}$/.test(ref)) {
    throw new Error('Expected a full commit SHA');
  }
  return repository + (path ? '/' + path : '') + '#' + ref;
}

export function assemble(manifest) {
  if (manifest.version !== 1 || !manifest.capabilities ||
      Object.keys(manifest.capabilities).length !== roles.length ||
      !roles.every(role => Object.hasOwn(manifest.capabilities, role))) {
    throw new Error('Invalid capability manifest');
  }
  const pending = roles.filter(role => manifest.capabilities[role] === null);
  const packages = Object.fromEntries(roles.filter(role => !pending.includes(role))
    .map(role => [role, packageReference(manifest.capabilities[role])]));
  const orchestration = manifest.capabilities.orchestration;
  let orchestrator = null;
  if (orchestration) {
    const { repository, workflow, ref } = orchestration;
    if (typeof workflow !== 'string' || workflow.trim() !== workflow ||
        !/^\.github\/workflows\/[a-z0-9_-]+\.lock\.yml$/.test(workflow)) {
      throw new Error('Expected a compiled reusable GH-AW workflow');
    }
    orchestrator = repository + '/' + workflow + '@' + ref;
  }
  return { pending, packages, orchestrator, rehearsal: packageReference(manifest.rehearsal) };
}

export function apmManifest(packages) {
  const references = [...new Set(Object.values(packages))].sort();
  const dependencies = references.length ? ['  apm:', ...references.map(ref => "    - '" + ref + "'")] : ['  apm: []'];
  return ['name: forge-kit', 'version: "0.1.0"', 'targets: [copilot]', 'dependencies:',
    ...dependencies, '  mcp: []', ''].join('\n');
}
