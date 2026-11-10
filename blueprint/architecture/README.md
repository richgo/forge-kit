# Architecture inputs

Place the product's authoritative FINOS CALM architecture and its LikeC4
projection in the consuming project. Validate with the **pinned native**
`calm` and `likec4` CLIs as part of the project's protected
`.forge/verify-change` entry point.

Do not infer architectural compatibility from a generated narrative.
Breaking interfaces, dependencies and data-flow changes must be assessed by
the project's independent acceptance suite. This blueprint deliberately does
not impose a flat node-only model or a programming language.
