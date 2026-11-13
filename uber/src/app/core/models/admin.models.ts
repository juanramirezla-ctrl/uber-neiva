export interface AdminStats {
  total_clients: number;
  total_drivers: number;
  pending_drivers: number;
  approved_drivers: number;
  active_trips: number;
  completed_trips: number;
  cancelled_trips: number;
  pending_requests: number;
  total_revenue: number;
}

export interface AdminDriver {
  id: number;
  license_number?: string;
  approval_status: string; // pending | approved | suspended | rejected
  rating_average?: number;
  user: { name: string; email: string; phone?: string };
  vehicles?: { plate: string; brand: string; model: string; year?: number }[];
}

export interface Fare {
  id?: number;
  name: string;
  base_fare: number;
  price_per_km: number;
  price_per_minute: number;
  minimum_fare: number;
  surge_multiplier: number;
  active: boolean;
}

export interface Incident {
  key: string;
  id: number | string;
  reporter: string;
  reported: string;
  reportedDriverId: number | null;
  motive: string;
  detail: string;
  date: string;
}