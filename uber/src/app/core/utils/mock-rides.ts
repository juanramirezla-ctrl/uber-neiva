/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActiveResponse, DriverRequest, Estimate, LatLng, Place, TripItem, TripStatus } from '../models/models';

/**
 * "Base de datos" compartida del modo simulado.
 * Vive en localStorage, así que todas las pestañas del navegador la ven.
 * En el modo simulado el id de la solicitud y el del viaje es el mismo.
 */
export interface MockRide {
  id: number;
  clientId: number;
  client: { name: string; phone: string };
  origin: Place;
  destination: Place;
  estimate: Estimate;
  status: TripStatus;
  driver?: { id: number; name: string; phone: string };
  vehicle?: { plate: string; brand: string; model: string; color: string };
  location?: LatLng;
  createdAt: number;
  updatedAt: number;
  finalFare?: number;
  completedAt?: string;
}

const KEY = 'mock_rides';
const ACTIVE: TripStatus[] = ['requested', 'assigned', 'driver_arrived', 'in_progress'];
const REQUEST_TTL = 10 * 60 * 1000; // solicitud que nadie acepta: se descarta a los 10 min
const TRIP_TTL = 15 * 60 * 1000; // viaje sin ninguna novedad: se descarta a los 15 min

function fail(status: number, message: string): never {
  throw { status, error: { message } };
}

function read(): MockRide[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as MockRide[];
  } catch {
    return [];
  }
}

function write(list: MockRide[]): void {
  localStorage.setItem(KEY, JSON.stringify(list.slice(-100)));
}

function isLive(r: MockRide): boolean {
  if (!ACTIVE.includes(r.status)) return false;
  const now = Date.now();
  return r.status === 'requested' ? now - r.createdAt < REQUEST_TTL : now - r.updatedAt < TRIP_TTL;
}

function change(id: number, fn: (r: MockRide) => void): MockRide | null {
  const list = read();
  const r = list.find((x) => x.id === id);
  if (!r) return null;
  fn(r);
  r.updatedAt = Date.now();
  write(list);
  return r;
}

export function findRide(id: number): MockRide | null {
  return read().find((r) => r.id === id) ?? null;
}

// ---------------- Cliente ----------------
export function clientRequest(
  user: { id: number; name: string; phone?: string },
  origin: Place,
  destination: Place,
  estimate: Estimate,
): { id: number } {
  if (read().some((r) => r.clientId === user.id && isLive(r))) {
    fail(400, 'Ya cuenta con una solicitud o viaje activo en curso.');
  }
  const list = read();
  const id = Math.max(100, ...list.map((r) => r.id)) + 1;
  const now = Date.now();
  list.push({
    id,
    clientId: user.id,
    client: { name: user.name, phone: user.phone ?? '' },
    origin,
    destination,
    estimate,
    status: 'requested',
    createdAt: now,
    updatedAt: now,
  });
  write(list);
  return { id };
}

export function clientActive(userId: number): ActiveResponse {
  const r = read()
    .filter((x) => x.clientId === userId && isLive(x))
    .pop();
  if (!r) return { success: true, has_active: false };

  const base = {
    id: r.id,
    status: r.status,
    estimated_fare: r.estimate.estimated_fare,
    origin_name: r.origin.name,
    destination_name: r.destination.name,
    origin_latitude: r.origin.latitude,
    origin_longitude: r.origin.longitude,
    destination_latitude: r.destination.latitude,
    destination_longitude: r.destination.longitude,
  };
  if (r.status === 'requested' || !r.driver) {
    return { success: true, has_active: true, type: 'request', data: base };
  }
  return {
    success: true,
    has_active: true,
    type: 'trip',
    data: {
      ...base,
      driver: {
        id: r.driver.id,
        rating_average: 5,
        user: { name: r.driver.name, phone: r.driver.phone },
        latest_location: r.location
          ? { latitude: r.location.lat, longitude: r.location.lng }
          : undefined,
      },
      vehicle: r.vehicle ?? { plate: '—', brand: '', model: '', color: '' },
    },
  };
}

export function clientCancel(id: number): void {
  const r = findRide(id);
  if (!r || !['requested', 'assigned', 'driver_arrived'].includes(r.status)) return;
  change(id, (x) => (x.status = 'cancelled'));
}

export function clientTrips(userId: number): TripItem[] {
  return read()
    .filter((r) => r.clientId === userId && r.status === 'completed')
    .reverse()
    .map((r) => ({
      id: r.id,
      final_fare: r.finalFare ?? r.estimate.estimated_fare,
      status: 'completed',
      completed_at: r.completedAt ?? new Date(r.updatedAt).toISOString(),
      destination_name: r.destination.name,
      driver: r.driver ? { user: { name: r.driver.name } } : undefined,
      vehicle: r.vehicle ? { plate: r.vehicle.plate } : undefined,
    }));
}

// ---------------- Conductor ----------------
export function driverRequests(hidden: Set<number>): DriverRequest[] {
  return read()
    .filter((r) => r.status === 'requested' && isLive(r) && !hidden.has(r.id))
    .map((r) => ({
      id: r.id,
      origin_name: r.origin.name,
      destination_name: r.destination.name,
      estimated_distance_km: r.estimate.distance_km,
      estimated_fare: r.estimate.estimated_fare,
      client: r.client,
      origin_latitude: r.origin.latitude,
      origin_longitude: r.origin.longitude,
      destination_latitude: r.destination.latitude,
      destination_longitude: r.destination.longitude,
    }));
}

export function driverAccept(
  id: number,
  driver: { id: number; name: string; phone: string },
  vehicle: MockRide['vehicle'],
): { id: number; status: TripStatus } {
  const r = findRide(id);
  if (!r || r.status !== 'requested' || !isLive(r)) {
    fail(409, 'Esta solicitud ya no está disponible.');
  }
  change(id, (x) => {
    x.status = 'assigned';
    x.driver = driver;
    x.vehicle = vehicle;
  });
  return { id, status: 'assigned' };
}

/** arrive / start / complete: solo avanza si el viaje está en el estado esperado */
export function driverStep(id: number, from: TripStatus, to: TripStatus): number | null {
  const r = findRide(id);
  if (!r) fail(404, 'El viaje no existe.');
  if (r.status === 'cancelled') fail(409, 'El pasajero canceló el viaje.');
  if (r.status !== from) fail(409, 'El viaje ya cambió de estado.');
  const done = change(id, (x) => {
    x.status = to;
    if (to === 'completed') {
      x.finalFare = x.estimate.estimated_fare;
      x.completedAt = new Date().toISOString();
    }
  });
  return to === 'completed' ? (done?.finalFare ?? null) : null;
}

export function driverLocation(id: number, p: LatLng): void {
  const r = findRide(id);
  if (!r) return;
  if (r.status === 'cancelled') fail(409, 'El pasajero canceló el viaje.');
  if (!ACTIVE.includes(r.status)) return;
  change(id, (x) => (x.location = p));
}