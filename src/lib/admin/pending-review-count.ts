// Lets the pending-review page push its fresh count to the admin sidebar
// badge right after it reloads (e.g. after an approve/reject), without a
// separate request.

export const PENDING_REVIEW_COUNT_EVENT = "admin:pending-review-count";

export function announcePendingReviewCount(count: number) {
  window.dispatchEvent(
    new CustomEvent<number>(PENDING_REVIEW_COUNT_EVENT, { detail: count })
  );
}
