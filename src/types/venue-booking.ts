export type VenueBookingSelectedAddon = {
  addonId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice?: number;
};

export type VenueBookingPricingSnapshot = {
  packageAmount: number;
  addonsAmount: number;
  cleaningFeeAmount: number;
  savingsAmount: number;
  subtotalAmount: number;
  depositAmount: number;
  remainingAmount: number;
};
