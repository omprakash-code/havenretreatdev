export function isMinimumPayableSatisfied(input: {
  bookingTotal: number;
  totalDiscount: number;
  minimumPayable: number;
}) {
  const bookingTotal = Math.max(Number(input.bookingTotal) || 0, 0);
  const totalDiscount = Math.max(Number(input.totalDiscount) || 0, 0);
  const minimumPayable = Math.max(Number(input.minimumPayable) || 0, 0);

  const effectiveDiscount = Math.min(totalDiscount, bookingTotal);
  const payableAfterDiscount = Math.max(bookingTotal - effectiveDiscount, 0);

  return {
    satisfied: payableAfterDiscount >= minimumPayable,
    payableAfterDiscount,
    effectiveDiscount,
    minimumPayable,
  };
}

export function buildMinimumPayableMessage(minimumPayable: number) {
  const amount = Math.max(Number(minimumPayable) || 0, 0);
  return `This coupon cannot be applied because minimum payable requirement is ₹${amount}.`;
}
