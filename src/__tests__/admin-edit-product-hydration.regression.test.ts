// Regression coverage for the admin Edit Booking screen loading a booking's
// saved products.
//
// The edit form used to map prefill items inline inside a React effect, which
// made the rule untestable and hid two defects:
//   1. `item.quantity <= 0` rows were skipped, so a package-included line the
//      customer reduced to nothing loaded as "not selected" and was then
//      re-seeded to the package default on save — silently undoing the
//      reduction.
//   2. An included line with no stored row loaded as "not selected", while the
//      server writes the package default for exactly that case. Form and server
//      disagreed about what an absent line meant.
//
// The mapping now lives in buildEditProductSelections() and is exercised here
// against the real shapes stored in the database.

import { describe, expect, it } from "vitest";

import {
  buildEditProductSelections,
  getSelectionKey,
} from "@/components/admin/bookings/add/shared";

const TABLES_P = "tables-product";
const TABLES_V = "tables-default";
const CHAIRS_P = "chairs-product";
const CHAIRS_V = "chairs-default";

const TABLES_KEY = getSelectionKey(TABLES_P, TABLES_V);
const CHAIRS_KEY = getSelectionKey(CHAIRS_P, CHAIRS_V);

// Premium: 4 tables @ $15 + 32 chairs @ $3 = the package's $156 line.
const PREMIUM_ALLOWANCES = [
  { productId: TABLES_P, variantId: TABLES_V, includedQuantity: 4 },
  { productId: CHAIRS_P, variantId: CHAIRS_V, includedQuantity: 32 },
];

function item(
  productId: string,
  variantId: string,
  quantity: number,
  extra: Record<string, unknown> = {}
) {
  return { productId, variantId, quantity, ...extra };
}

describe("edit booking loads the saved package products", () => {
  it("loads a booking stored at the package quantities verbatim", () => {
    const { selections } = buildEditProductSelections({
      items: [item(TABLES_P, TABLES_V, 4), item(CHAIRS_P, CHAIRS_V, 32)],
      allowances: PREMIUM_ALLOWANCES,
    });

    expect(selections[TABLES_KEY].quantity).toBe(4);
    expect(selections[CHAIRS_KEY].quantity).toBe(32);
  });

  it("loads an adjusted booking at its adjusted quantities, not the defaults", () => {
    // The reported requirement: a booking saved as 2 tables / 20 chairs must
    // load as exactly that, never as the package's 4 / 32.
    const { selections } = buildEditProductSelections({
      items: [item(TABLES_P, TABLES_V, 2), item(CHAIRS_P, CHAIRS_V, 20)],
      allowances: PREMIUM_ALLOWANCES,
    });

    expect(selections[TABLES_KEY].quantity).toBe(2);
    expect(selections[CHAIRS_KEY].quantity).toBe(20);
  });

  it("loads a line reduced to zero as zero, not as missing", () => {
    // Regression #1: this row used to be dropped, so the next save re-seeded
    // the full 32 chairs and the customer's reduction disappeared.
    const { selections } = buildEditProductSelections({
      items: [item(TABLES_P, TABLES_V, 4), item(CHAIRS_P, CHAIRS_V, 0)],
      allowances: PREMIUM_ALLOWANCES,
    });

    expect(CHAIRS_KEY in selections).toBe(true);
    expect(selections[CHAIRS_KEY].quantity).toBe(0);
    expect(selections[TABLES_KEY].quantity).toBe(4);
  });

  it("loads quantities above the allowance verbatim", () => {
    const { selections } = buildEditProductSelections({
      items: [item(CHAIRS_P, CHAIRS_V, 35)],
      allowances: PREMIUM_ALLOWANCES,
    });

    expect(selections[CHAIRS_KEY].quantity).toBe(35);
  });

  it("falls back to the package allowance only when no row exists", () => {
    // Regression #2: the server writes the package default for an included line
    // the payload never mentions, so the form has to show the same thing.
    const { selections } = buildEditProductSelections({
      items: [],
      allowances: PREMIUM_ALLOWANCES,
    });

    expect(selections[TABLES_KEY].quantity).toBe(4);
    expect(selections[CHAIRS_KEY].quantity).toBe(32);
  });

  it("never lets the allowance override a stored quantity", () => {
    // Tables stored at 1, chairs absent entirely.
    const { selections } = buildEditProductSelections({
      items: [item(TABLES_P, TABLES_V, 1)],
      allowances: PREMIUM_ALLOWANCES,
    });

    expect(selections[TABLES_KEY].quantity).toBe(1); // stored wins
    expect(selections[CHAIRS_KEY].quantity).toBe(32); // absent -> default
  });

  it("never lets the allowance override a stored zero", () => {
    const { selections } = buildEditProductSelections({
      items: [item(CHAIRS_P, CHAIRS_V, 0)],
      allowances: PREMIUM_ALLOWANCES,
    });

    expect(selections[CHAIRS_KEY].quantity).toBe(0);
  });

  it("loads a booking with no allowance at all from its rows only", () => {
    // A legacy booking whose package config yields nothing: rows are the only
    // source of truth and nothing is invented.
    const { selections } = buildEditProductSelections({
      items: [item(TABLES_P, TABLES_V, 4)],
      allowances: [],
    });

    expect(selections[TABLES_KEY].quantity).toBe(4);
    expect(CHAIRS_KEY in selections).toBe(false);
  });

  it("keeps non-package add-ons untouched", () => {
    const CAKE_KEY = getSelectionKey("cake-product", "cake-1kg");
    const { selections } = buildEditProductSelections({
      items: [item("cake-product", "cake-1kg", 2), item(CHAIRS_P, CHAIRS_V, 20)],
      allowances: PREMIUM_ALLOWANCES,
    });

    expect(selections[CAKE_KEY].quantity).toBe(2);
    expect(selections[CHAIRS_KEY].quantity).toBe(20);
  });

  it("selects the stored variant as active for each product", () => {
    const { activeVariants } = buildEditProductSelections({
      items: [item(CHAIRS_P, "chairs-alternate", 12)],
      allowances: PREMIUM_ALLOWANCES,
    });

    // The stored variant wins over the allowance's default variant.
    expect(activeVariants[CHAIRS_P]).toBe("chairs-alternate");
  });

  it("carries LED numbers through, including the occasion-data fallback", () => {
    const LED_KEY = getSelectionKey("led-product", "led-v");
    const { selections, ledDrafts } = buildEditProductSelections({
      items: [item("led-product", "led-v", 1)],
      resolveLedNumber: () => "021",
    });

    expect(selections[LED_KEY].ledNumber).toBe("021");
    expect(ledDrafts[LED_KEY]).toBe("021");
  });

  it("ignores malformed rows without discarding the rest", () => {
    const { selections } = buildEditProductSelections({
      items: [
        item("", "", 5),
        item(TABLES_P, TABLES_V, Number.NaN),
        item(CHAIRS_P, CHAIRS_V, 20),
      ],
      allowances: PREMIUM_ALLOWANCES,
    });

    expect(selections[CHAIRS_KEY].quantity).toBe(20);
    // The NaN row is unusable, so tables fall back to the package allowance.
    expect(selections[TABLES_KEY].quantity).toBe(4);
  });

  it("is stable across repeated loads of the same booking", () => {
    const input = {
      items: [item(TABLES_P, TABLES_V, 2), item(CHAIRS_P, CHAIRS_V, 0)],
      allowances: PREMIUM_ALLOWANCES,
    };
    const first = buildEditProductSelections(input);
    const second = buildEditProductSelections(input);

    expect(second.selections).toEqual(first.selections);
    expect(second.selections[TABLES_KEY].quantity).toBe(2);
    expect(second.selections[CHAIRS_KEY].quantity).toBe(0);
  });
});
