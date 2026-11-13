## Context

A shared response contract is consumed by the API and web components.

## Goals / Non-Goals

Expose the currency alongside the existing numeric total.

## Decisions

Keep the existing total field and add an ISO currency code.

## Risks / Trade-offs

Consumers that use strict field validation need a compatible schema update.
