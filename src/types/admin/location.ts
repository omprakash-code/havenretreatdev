export type AdminLocationRecord = {
  id: string;
  name: string;
  city: string;
  isActive: boolean;
  sortOrder: number;
  theatresCount: number;
  productsCount: number;
  couponsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminLocationsResponse = {
  success: true;
  data: AdminLocationRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
