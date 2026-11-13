import { Place } from '../models/models';

// Coordenadas aproximadas de sitios de Neiva (ajústalas si quieres)
export const PLACES: Place[] = [
  { name: 'Parque Santander', latitude: 2.9273, longitude: -75.2819 },
  { name: 'Universidad Surcolombiana', latitude: 2.9421, longitude: -75.2887 },
  { name: 'Centro Comercial San Pedro Plaza', latitude: 2.9335, longitude: -75.2845 },
  { name: 'Terminal de Transportes', latitude: 2.95, longitude: -75.281 },
  { name: 'Aeropuerto Benito Salas', latitude: 2.9501, longitude: -75.294 },
  { name: 'Malecón del Río Magdalena', latitude: 2.932, longitude: -75.27 },
  { name: 'Hospital Hernando Moncaleano', latitude: 2.9374, longitude: -75.2866 },
];

export function distanceKm(a: Place, b: Place): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const RECENTS_KEY = 'recent_places';

export function getRecents(): Place[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as Place[];
  } catch {
    return [];
  }
}

export function addRecent(p: Place): void {
  if (p.name === 'Mi ubicación actual' || p.name === 'Punto seleccionado') return;
  const list = getRecents().filter((x) => x.name !== p.name);
  localStorage.setItem(RECENTS_KEY, JSON.stringify([p, ...list].slice(0, 6)));
}