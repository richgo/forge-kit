package tests

import (
    "testing"
    quote "example.com/forgekit/quote/src"
)

func TestTotal(t *testing.T) {
    cases := []struct{ subtotal, discount, want int }{
        {500, 0, 500}, {500, 125, 375}, {100, 200, 0},
    }
    for _, c := range cases {
        got, err := quote.Total(c.subtotal, c.discount)
        if err != nil || got != c.want { t.Fatalf("Total(%d,%d) = %d, %v; want %d", c.subtotal,c.discount,got,err,c.want) }
    }
    if _, err := quote.Total(-1, 0); err == nil { t.Fatal("negative subtotal accepted") }
    if _, err := quote.Total(1, -1); err == nil { t.Fatal("negative discount accepted") }
}
