package quote

import "errors"

func Total(subtotal, discount int) (int, error) {
    if subtotal < 0 || discount < 0 {
        return 0, errors.New("negative amount")
    }
    return subtotal, nil
}
