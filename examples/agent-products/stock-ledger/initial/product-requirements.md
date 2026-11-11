# Product requirements

## Epic EPIC-201 — Manage stockroom inventory

Outcome: Stockroom clerks can use a movement journal to determine on-hand stock and replenishment.

### Feature FEAT-201 — Stock balances

Outcome: Clerks can calculate the current balance for every SKU.

#### Story STORY-201 — Calculate balances from the movement journal

Architecture owner: `stock_cli`, `stock_ledger`

A stockroom clerk derives current inventory from an ordered movement journal. Read one JSON request from stdin. A balance request is an object with op equal to balance and movements as an array. Each movement has sku, a nonempty string of uppercase ASCII letters and digits, and delta, a nonzero JSON integer in the inclusive range -1000000 to 1000000 (booleans are invalid). Starting at zero per SKU, apply movements in order. Return {"balances":[{"sku":"SKU","onHand":0}]} with one row for every SKU encountered, including zero balances, sorted by ascending ASCII SKU. An empty journal returns {"balances":[]}. Use src/main.py for Python standard-library stdin/stdout routing and src/ledger.py for movement validation and replay. Emit one JSON value to stdout and exit successfully even for invalid requests.

##### Acceptance AC-201 — Report sorted balances including zero

- Given the journal leaves A1 with zero units and B2 with six units.
- When the clerk requests a balance calculation.
- Then the result lists A1 with zero units followed by B2 with six units.
- Check: `ac-201`

##### Acceptance AC-202 — Calculate balances for an empty journal

- Given the journal is empty.
- When the clerk requests a balance calculation.
- Then the result contains an empty balance list.
- Check: `ac-202`

### Feature FEAT-202 — Journal validation

Outcome: Clerks can identify invalid requests and overdrafts.

#### Story STORY-202 — Reject invalid requests and negative stock

Architecture owner: `stock_cli`, `stock_ledger`

Reject an invalid request object, unknown operation, missing or malformed movements, or invalid row with exactly {"error":"INVALID_REQUEST"}. Validate the shape of every row before applying any movement. If any intermediate balance becomes negative, return exactly {"error":"NEGATIVE_STOCK","sku":"SKU"} for the first SKU that fails in journal order. A later restock cannot legalize a preceding overdraft.

##### Acceptance AC-203 — Reject an overdraft followed by a restock

- Given a movement for C3 takes its balance below zero before a later restock.
- When the clerk requests a balance calculation.
- Then the request returns `NEGATIVE_STOCK` for C3.
- Check: `ac-203`

##### Acceptance AC-204 — Reject a boolean movement quantity

- Given the journal contains a movement with a boolean quantity.
- When the clerk requests a balance calculation.
- Then the request returns `INVALID_REQUEST`.
- Check: `ac-204`

##### Acceptance AC-205 — Reject an unknown operation

- Given the journal is valid.
- When the clerk requests a snapshot operation.
- Then the request returns `INVALID_REQUEST`.
- Check: `ac-205`
