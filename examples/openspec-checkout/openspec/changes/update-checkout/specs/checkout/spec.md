## ADDED Requirements

### Requirement: Checkout response includes currency
The checkout response SHALL include a currency code alongside the existing total.

#### Scenario: Return the currency
- **WHEN** the customer requests the checkout total
- **THEN** the response includes the numeric total and its currency code
