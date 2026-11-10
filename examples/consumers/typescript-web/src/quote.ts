export function total(subtotal: number, discount = 0): number {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 ||
      !Number.isSafeInteger(discount) || discount < 0) {
    throw new RangeError("invalid amount");
  }
  return subtotal;
}
