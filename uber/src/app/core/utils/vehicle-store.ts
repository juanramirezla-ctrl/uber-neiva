import { environment } from '../../../environments/environment';
import { Vehicle } from '../models/models';

const key = (uid: number) => `vehicles_${uid}`;

// Aviso "Vehículo guardado con éxito" entre pantallas
export const flash = { saved: false };

export function setVehicles(uid: number, list: Vehicle[]): void {
  localStorage.setItem(key(uid), JSON.stringify(list));
}

export function getVehicles(uid: number): Vehicle[] {
  const raw = localStorage.getItem(key(uid));
  if (raw === null) {
    if (environment.useMock) {
      const seed: Vehicle[] = [
        { id: 1, brand: 'Chevrolet', model: 'Spark', year: 2019, plate: 'ABC123', color: 'Blanco', active: true },
      ];
      setVehicles(uid, seed);
      return seed;
    }
    return [];
  }
  try {
    return JSON.parse(raw) as Vehicle[];
  } catch {
    return [];
  }
}

export function activeVehicle(uid: number): Vehicle | null {
  const list = getVehicles(uid);
  return list.find((v) => v.active) ?? list[0] ?? null;
}

// Guarda el vehículo que el conductor envió al registrarse
export function seedVehicle(
  uid: number,
  b: { brand: string; model: string; year: number | string; plate: string; color: string },
): void {
  setVehicles(uid, [
    {
      id: 1,
      brand: b.brand,
      model: b.model,
      year: Number(b.year),
      plate: String(b.plate).toUpperCase(),
      color: b.color,
      active: true,
    },
  ]);
}