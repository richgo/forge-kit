#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
root="$PWD"
if [[ -e apm_modules || -L apm_modules ]]; then
  echo 'Capability restore requires a clean apm_modules path.' >&2
  exit 1
fi
scratch="$(mktemp -d)"
staging="$(mktemp -d "$root/.capability-restore.XXXXXX")"
trap 'rm -rf -- "$scratch" "$staging"' EXIT
node factory/cli.mjs assemble --apm > "$scratch/generated.yml"
cmp apm.yml "$scratch/generated.yml"
mkdir "$scratch/project"
cp apm.yml apm.lock.yaml "$scratch/project/"
if [[ -n "${1:-}" ]]; then
  apm="$(command -v "$1")"
else
  case "$(uname -s):$(uname -m)" in
    Linux:x86_64)
      asset=606234092
      sha256=e6374402c74318f7c8bef97a90d8572d049fdab0dc3871492c6b0647ae9e881f
      ;;
    Linux:aarch64)
      asset=606234095
      sha256=ac40dd0efd1af35a56847beedde96854530d2f54851e026728da017d3af827f8
      ;;
    *)
      echo 'Use Linux or pass the reviewed APM 0.33.0 executable.' >&2
      exit 1
      ;;
  esac
  curl --max-time 90 --fail --location --silent --show-error --retry 2 \
    -H 'Accept: application/octet-stream' \
    "https://api.github.com/repos/microsoft/apm/releases/assets/$asset?download=1" \
    -o "$scratch/apm.tar.gz"
  printf '%s  %s\n' "$sha256" "$scratch/apm.tar.gz" | sha256sum --check
  tar -xzf "$scratch/apm.tar.gz" -C "$scratch"
  apm="$(find "$scratch" -type f -name apm -print -quit)"
fi
"$apm" --version | grep -Eq 'version 0\.33\.0([[:space:]]|$)'
(
  cd "$scratch/project"
  "$apm" install --target copilot --frozen
  "$apm" audit --ci
)
cmp apm.lock.yaml "$scratch/project/apm.lock.yaml"
node factory/agent-capability.mjs "$scratch/project/apm_modules/richgo/forge-kit-skills/packages/agent-delivery"
cp -a "$scratch/project/apm_modules" "$staging/"
mv -T "$staging/apm_modules" "$root/apm_modules"
