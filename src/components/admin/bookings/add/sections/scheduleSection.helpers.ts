export function getDateHoverHint(locationId: string) {
  if (!locationId) return "Select location first.";
  return "";
}

export function getTheatreHoverHint(locationId: string, date: string) {
  if (!locationId) return "Select location first.";
  if (!date) return "Select date first.";
  return "";
}

export function getSlotHoverHint(params: {
  locationId: string;
  date: string;
  theatreId: string;
}) {
  if (!params.locationId) return "Select location first.";
  if (!params.date) return "Select date first.";
  if (!params.theatreId) return "Select a package first.";
  return "";
}
