# ForgeKit consumer examples

The quote examples apply a nonnegative discount and clamp the total at zero
while preserving each project's invalid-input behavior. Each example uses the
same pinned APMX factory and a project-owned `.forge/verify-change`. The
checker restricts patches to `src/`, applies the candidate in a disposable
tree and runs tests copied from the approved base.

| Consumer | Approved request | Protected acceptance command |
| --- | --- | --- |
| Python quote API | [python-api](python-api/request.md) | `PYTHONPATH=. python3 -m unittest discover -s tests` |
| Go quote service | [go-service](go-service/request.md) | `GOWORK=off GOPROXY=off go test ./...` |
| TypeScript price calculator | [typescript-web](typescript-web/request.md) | `tsc -p tsconfig.json && node --test tests/*.test.cjs` |

## Exercise the independent checks

From the repository root, use Bash with Git, Python 3, Go, Node.js and
TypeScript available on the path. The CI job uses Python 3.12, Go 1.23.6,
Node.js 22 and TypeScript 5.9.3.

```sh
bash scripts/qualify-native-consumers.sh
```

The suite generates one valid patch per project and checks rejection of
protected-path and empty patches. The checked-in source is a seed, so its
new behavior tests pass after applying the requested change.
[Expected results](../../factory/test/native-consumers.md)

## Run with an agent

Stage one consumer in a clean directory with its approved request, tests,
source and verifier. Install the corresponding toolchain and follow the
[APMX runbook](../../docs/apmx-factory.md). For a hosted run, use
[Qualify APMX language consumers](../../factory/test/apmx-language-qualification.md)
to select the fixture and collect independent replay evidence.
