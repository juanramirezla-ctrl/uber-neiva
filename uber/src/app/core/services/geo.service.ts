import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { LatLng, Place, RouteInfo } from '../models/models';

interface PhotonResponse {
  features: {
    geometry: { coordinates: [number, number] };
    properties: {
      name?: string;
      street?: string;
      housenumber?: string;
      district?: string;
      locality?: string;
      city?: string;
    };
  }[];
}

interface OsrmResponse {
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
}

interface NominatimReverse {
  name?: string;
  address?: { road?: string; neighbourhood?: string; suburb?: string; quarter?: string };
}

@Injectable({ providedIn: 'root' })
export class GeoService {
  private http = inject(HttpClient);

  // Caja que encierra a Neiva: minLon,minLat,maxLon,maxLat
  private bbox = '-75.38,2.80,-75.18,3.05';

  /** Busca lugares dentro de Neiva (Photon / OpenStreetMap) */
  search(q: string): Observable<Place[]> {
    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
      `&limit=6&lat=2.9273&lon=-75.2819&bbox=${this.bbox}`;

    return this.http.get<PhotonResponse>(url).pipe(
      timeout(8000),
      map((r) =>
        r.features
          .map((f) => {
            const p = f.properties;
            const name =
              p.name ?? (p.street ? `${p.street}${p.housenumber ? ' ' + p.housenumber : ''}` : '');
            const subtitle = [p.name ? p.street : '', p.district ?? p.locality, p.city]
              .filter(Boolean)
              .join(', ');
            return {
              name,
              subtitle,
              latitude: f.geometry.coordinates[1],
              longitude: f.geometry.coordinates[0],
            } as Place;
          })
          .filter((p) => p.name),
      ),
    );
  }

  /** Nombre aproximado de un punto tocado en el mapa (Nominatim) */
  reverse(lat: number, lng: number): Observable<string | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`;
    return this.http.get<NominatimReverse>(url).pipe(
      timeout(8000),
      map((r) => {
        const a = r.address ?? {};
        const area = a.neighbourhood ?? a.suburb ?? a.quarter;
        return [a.road, area].filter(Boolean).join(', ') || r.name || null;
      }),
      catchError(() => of(null)),
    );
  }

  /** Ruta por calles entre dos puntos (OSRM) */
  route(o: Place, d: Place): Observable<RouteInfo | null> {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${o.longitude},${o.latitude};${d.longitude},${d.latitude}?overview=full&geometries=geojson`;

    return this.http.get<OsrmResponse>(url).pipe(
      timeout(10000),
      map((r) => {
        const x = r.routes?.[0];
        if (!x) return null;
        const points: LatLng[] = x.geometry.coordinates.map((c) => ({ lat: c[1], lng: c[0] }));
        return {
          points,
          distance_km: Math.round(x.distance / 10) / 100,
          duration_min: Math.max(1, Math.round(x.duration / 60)),
        };
      }),
      catchError(() => of(null)),
    );
  }
}