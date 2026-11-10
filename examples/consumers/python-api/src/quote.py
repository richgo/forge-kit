def total(subtotal: int, discount: int = 0) -> int:
    if not isinstance(subtotal, int) or isinstance(subtotal, bool) or subtotal < 0:
        raise ValueError("invalid subtotal")
    if not isinstance(discount, int) or isinstance(discount, bool) or discount < 0:
        raise ValueError("invalid discount")
    return subtotal
