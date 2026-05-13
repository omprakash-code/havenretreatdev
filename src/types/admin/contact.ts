export type ContactInquiryStatus = "NEW" | "CONTACTED" | "CLOSED";

export type AdminContactInquiry = {
  id: string;
  name: string;
  mobile: string;
  message: string;
  status: ContactInquiryStatus;
  isRead: boolean;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminContactInquiryResponse = {
  success: boolean;
  message?: string;
  data: AdminContactInquiry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type AdminContactInquiryUpdatePayload = {
  name?: string;
  mobile?: string;
  message?: string;
  status?: ContactInquiryStatus;
};

export type AdminContactInquiryEditPayload = {
  name: string;
  mobile: string;
  message: string;
  status: ContactInquiryStatus;
};
