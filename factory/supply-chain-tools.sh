#!/usr/bin/env bash
# Install the reviewed release in a private scratch directory. Only stdout is the path.
set -euo pipefail
scratch="$(mktemp -d)"
archive="$scratch/trivy.tar.gz"
curl --fail --silent --show-error --location --retry 2 --retry-all-errors --retry-max-time 120 \
  --max-time 90 --header 'Accept: application/octet-stream' \
  'https://api.github.com/repos/aquasecurity/trivy/releases/assets/713401165?download=1' -o "$archive"
printf '%s  %s\n' 'bc0fc726e017b8927a62b2d3531d7a84ee01769daf5c99ed866dced54089fdbf' "$archive" | sha256sum --check --status
tar -xzf "$archive" -C "$scratch" trivy
rm "$archive"
test -x "$scratch/trivy"
printf '%s\n' "$scratch/trivy"
