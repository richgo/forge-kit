# Product requirements

## Epic EPIC-001 — Checkout with confidence

Outcome: Customers know the amount and currency they will pay.

### Feature FEAT-001 — Currency-aware totals

Outcome: The checkout total displays the currency returned by the API.

#### Story STORY-001 — See the checkout currency

Architecture owner: `checkout_contract`, `checkout_api`, `checkout_web`

As a customer, I want to see the currency so that I know how much I will pay.

##### Acceptance AC-001 — Return the currency

- Given a checkout worth 2500 minor units in GBP
- When the customer requests the checkout total
- Then the API returns the numeric total and its currency code and the page displays £25.00
- Check: `checkout.currency`
