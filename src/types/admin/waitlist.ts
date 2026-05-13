export type WaitlistStatus = "NEW" | "CONTACTED" | "CLOSED";

export type AdminWaitlistEntry = {
  id: string;
  reference: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  locationPreference: string | null;
  theatrePreference: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  peopleCount: number | null;
  occasion: string | null;
  notes: string | null;
  status: WaitlistStatus;
  contactedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminWaitlistResponse = {
  success: boolean;
  message?: string;
  data: AdminWaitlistEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type AdminWaitlistUpdatePayload = {
  name: string;
  phone: string;
  email: string;
  city: string;
  locationPreference: string;
  theatrePreference: string;
  preferredDate: string;
  preferredTime: string;
  peopleCount: string;
  occasion: string;
  notes: string;
  status: WaitlistStatus;
};
