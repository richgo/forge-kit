# Product requirements

## Epic EPIC-001 — Accurate customer quotes

Outcome: Customers see the amount they owe before placing an order.

### Feature FEAT-001 — Quote discounts

Outcome: Quotes reflect eligible discounts without returning a negative total.

#### Story STORY-001 — Apply a nonnegative discount

Architecture owner: `price-calculator`

As a customer, I want the calculator to apply my discount so I can see my final price.

##### Acceptance AC-001 — Deduct the discount

- Given a subtotal of 500 and a discount of 125
- When the caller calculates the quote
- Then the total is 375
- Check: `quote.acceptance`

##### Acceptance AC-002 — Clamp the total at zero

- Given a subtotal of 100 and a discount of 200
- When the caller calculates the quote
- Then the total is zero
- Check: `quote.acceptance`

##### Acceptance AC-003 — Keep quotes with zero discount unchanged

- Given a subtotal of 500 and a zero discount
- When the caller calculates the quote
- Then the total remains 500
- Check: `quote.acceptance`

##### Acceptance AC-004 — Preserve invalid-input errors

- Given an invalid amount
- When the caller calculates the quote
- Then the caller receives a validation error for a negative, fractional, non-finite, or boolean subtotal.
- Check: `quote.acceptance`
