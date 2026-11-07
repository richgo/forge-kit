import { spawnSync } from 'node:child_process';
const child = spawnSync(process.execPath, ['-e', "console.log(\"ready\");\nconsole.error(\"worker:readiness_worker\");"], { env: {}, timeout: 1500 });
if (child.error) throw child.error;
process.stdout.write(child.stdout);
process.stderr.write(child.stderr);
process.exitCode = child.status ?? 1;
