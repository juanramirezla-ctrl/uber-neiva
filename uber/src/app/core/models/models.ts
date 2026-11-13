export type Role = 'client' | 'driver' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  status: string;
  // Solo para conductores (la API lo manda en login, registro y /auth/me)
  driver_profile?: {
    id?: number;
    approval_status: string; // pending | approved | suspended | rejected
    availability_status?: string; // available | unavailable
    rating_average?: number | string;
    license_number?: string;
  };
}

export interface AuthResponse {
  success: boolean;
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}
export type TripStatus =
  | 'requested'
  | 'assigned'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place {
  name: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
}

export interface RouteInfo {
  points: LatLng[];
  distance_km: number;
  duration_min: number;
}

export interface Estimate {
  distance_km: number;
  duration_min: number;
  estimated_fare: number;
  currency: string;
}

export interface ActiveData {
  id: number;
  request_id?: number; // en un viaje (trip): id de la solicitud que lo originó
  status: TripStatus;
  estimated_fare: number;
  origin_name?: string;
  destination_name?: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  driver?: {
    id: number;
    rating_average: number;
    user: { name: string; phone: string };
    latest_location?: { latitude: number; longitude: number };
  };
  vehicle?: { plate: string; brand: string; model: string; color: string };
}

export interface ActiveResponse {
  success: boolean;
  has_active: boolean;
  type?: 'request' | 'trip';
  data?: ActiveData;
}

export interface TripItem {
  id: number;
  final_fare: number;
  status: string;
  completed_at: string;
  destination_name?: string;
  driver?: { user: { name: string } };
  vehicle?: { plate: string };
}
export interface DriverRequest {
  id: number;
  origin_name: string;
  destination_name: string;
  estimated_distance_km: number;
  estimated_fare: number;
  client?: { name: string; phone: string };
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
}

export interface DriverTrip {
  id: number;
  status: TripStatus;
  estimated_fare: number;
  request: DriverRequest;
  started_at?: number;
}

export interface Vehicle {
  id: number;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  active: boolean;
}