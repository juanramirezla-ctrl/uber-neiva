import { LatLng } from '../models/models';

function segmentKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Punto situado a la fracción t (0 a 1) de un recorrido, medida por distancia sobre la ruta */
export function pointAt(path: LatLng[], t: number): LatLng {
  if (path.length === 0) return { lat: 0, lng: 0 };
  if (t <= 0) return path[0];
  if (t >= 1) return path[path.length - 1];

  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = segmentKm(path[i - 1], path[i]);
    lens.push(l);
    total += l;
  }

  let target = total * t;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i]) {
      const k = lens[i] === 0 ? 0 : target / lens[i];
      return {
        lat: path[i].lat + (path[i + 1].lat - path[i].lat) * k,
        lng: path[i].lng + (path[i + 1].lng - path[i].lng) * k,
      };
    }
    target -= lens[i];
  }
  return path[path.length - 1];
}

/** Largo total de un recorrido, en km */
export function pathLengthKm(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += segmentKm(path[i - 1], path[i]);
  return total;
}