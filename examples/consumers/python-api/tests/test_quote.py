import unittest
from src.quote import total

class QuoteTests(unittest.TestCase):
    def test_existing_behavior(self):
        self.assertEqual(total(500), 500)

    def test_discount(self):
        self.assertEqual(total(500, 125), 375)

    def test_discount_clamped(self):
        self.assertEqual(total(100, 200), 0)

    def test_invalid_inputs(self):
        for value in [-1, True, 1.5]:
            with self.assertRaises(ValueError):
                total(value)
