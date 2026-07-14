import { describe, expect, it } from "vitest";

import {
  ADMIN_SOFT_DELETE_REASON,
  buildRangeConflictFilter,
} from "@/lib/booking-policy";

/**
 * Deleting a booking is a soft delete: the row keeps its `bookingStatus`, so
 * PENDING_REVIEW / APPROVED would otherwise keep holding the date
 * forever. Every conflict branch must exclude deleted bookings.
 */
describe("buildRangeConflictFilter", () => {
  const notSoftDeleted = {
    OR: [
      { cancelledReason: null },
      { cancelledReason: { not: ADMIN_SOFT_DELETE_REASON } },
    ],
  };

  it("excludes deleted bookings from the reserved branch", () => {
    const [reservedBranch] = buildRangeConflictFilter(new Date());

    expect(reservedBranch.bookingStatus).toEqual({
      in: ["PENDING_REVIEW", "APPROVED"],
    });
    expect(reservedBranch.AND).toEqual([notSoftDeleted]);
  });

  it("excludes deleted bookings from the draft-hold branch", () => {
    const [, holdBranch] = buildRangeConflictFilter(new Date());

    expect(holdBranch.AND).toEqual([notSoftDeleted]);
  });

  it("keeps narrowing the hold branch with the caller's own booking", () => {
    const [, holdBranch] = buildRangeConflictFilter(new Date(), {
      id: { not: "booking-1" },
    });

    expect(holdBranch.id).toEqual({ not: "booking-1" });
    expect(holdBranch.AND).toEqual([notSoftDeleted]);
  });
});
