import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, defer, delay, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { distanceKm } from '../data/places';
import { ActiveResponse, Estimate, Place, TripItem } from '../models/models';
import { num, numOrUndef, toList } from '../utils/api';
import { addMockIncident } from '../utils/mock-incidents';
import { clientActive, clientCancel, clientRequest, clientTrips, findRide } from '../utils/mock-rides';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = `${environment.apiUrl}/client`;
  private mock = environment.useMock;

  estimate(o: Place, d: Place): Observable<Estimate> {
    if (this.mock) {
      const km = Math.round(distanceKm(o, d) * 1.3 * 100) / 100;
      const min = Math.max(2, Math.round((km / 25) * 60));
      const fare = Math.max(6500, Math.round((3800 + 4000 * km + 250 * min) / 100) * 100);
      return of({ distance_km: km, duration_min: min, estimated_fare: fare, currency: 'COP' }).pipe(delay(300));
    }
    return this.http
      .post<{ estimate: Estimate }>(`${this.api}/estimate-fare`, {
        origin_latitude: o.latitude,
        origin_longitude: o.longitude,
        destination_latitude: d.latitude,
        destination_longitude: d.longitude,
      })
      .pipe(map((r) => r.estimate));
  }

  requestRide(o: Place, d: Place, est: Estimate): Observable<{ id: number }> {
    if (this.mock) {
      const u = this.auth.user();
      return defer(() =>
        of(clientRequest({ id: u?.id ?? 0, name: u?.name ?? 'Pasajero', phone: u?.phone }, o, d, est)).pipe(
          delay(300),
        ),
      );
    }
    return this.http
      .post<{ ride_request: { id: number } }>(`${this.api}/ride-requests`, {
        origin_name: o.name,
        origin_latitude: o.latitude,
        origin_longitude: o.longitude,
        destination_name: d.name,
        destination_latitude: d.latitude,
        destination_longitude: d.longitude,
      })
      .pipe(map((r) => r.ride_request));
  }

  active(): Observable<ActiveResponse> {
    if (this.mock) return defer(() => of(clientActive(this.auth.user()?.id ?? 0)));
    return this.http
      .get<ActiveResponse>(`${this.api}/active`)
      .pipe(map((r) => this.fixActive(r)));
  }

  /** fallbackId: en un viaje, algunos servidores esperan el id de la solicitud y no el del viaje */
  cancel(id: number, reason: string, fallbackId?: number): Observable<unknown> {
    if (this.mock) {
      clientCancel(id);
      return of({ success: true }).pipe(delay(200));
    }
    return this.http.post(`${this.api}/cancel/${id}`, { reason }).pipe(
      catchError((err) =>
        err?.status === 404 && fallbackId && fallbackId !== id
          ? this.http.post(`${this.api}/cancel/${fallbackId}`, { reason })
          : throwError(() => err),
      ),
    );
  }

  trips(): Observable<TripItem[]> {
    if (this.mock) return defer(() => of(clientTrips(this.auth.user()?.id ?? 0)).pipe(delay(200)));
    return this.http.get<{ trips: unknown }>(`${this.api}/trips`).pipe(
      map((r) =>
        toList<any>(r.trips)
          .map((t) => this.toTrip(t))
          .filter((t) => !t.status || t.status === 'completed'),
      ),
    );
  }

  /** Viaje del API -> el que usan nuestras pantallas (el destino puede venir dentro de "request") */
  private toTrip(t: any): TripItem {
    const q = t.request ?? t.ride_request ?? {};
    return {
      id: t.id,
      final_fare: num(t.final_fare ?? t.estimated_fare),
      status: t.status,
      completed_at: t.completed_at ?? t.created_at ?? '',
      destination_name: t.destination_name ?? q.destination_name,
      driver: t.driver?.user ? { user: { name: t.driver.user.name } } : undefined,
      vehicle: t.vehicle ? { plate: t.vehicle.plate } : undefined,
    };
  }

  /** El API manda números como texto ("2.93") y a veces anida las coordenadas dentro de "request" */
  private fixActive(r: ActiveResponse): ActiveResponse {
    const d = r?.data as any;
    if (!r?.has_active || !d) return r;
    const q = d.request ?? d.ride_request ?? {};
    const loc = d.driver?.latest_location;
    return {
      ...r,
      data: {
        ...d,
        request_id: d.request_id ?? q.id,
        estimated_fare: num(d.estimated_fare ?? q.estimated_fare),
        origin_name: d.origin_name ?? q.origin_name,
        destination_name: d.destination_name ?? q.destination_name,
        origin_latitude: numOrUndef(d.origin_latitude ?? q.origin_latitude),
        origin_longitude: numOrUndef(d.origin_longitude ?? q.origin_longitude),
        destination_latitude: numOrUndef(d.destination_latitude ?? q.destination_latitude),
        destination_longitude: numOrUndef(d.destination_longitude ?? q.destination_longitude),
        driver: d.driver
          ? {
              ...d.driver,
              latest_location:
                loc && loc.latitude != null && loc.longitude != null
                  ? { latitude: num(loc.latitude), longitude: num(loc.longitude) }
                  : undefined,
            }
          : undefined,
      },
    };
  }

  rate(tripId: number, score: number, comment: string, hasIncident = false): Observable<unknown> {
    if (this.mock) {
      if (hasIncident) {
        // Se guarda para que el administrador la vea en Quejas
        const m = comment.match(/^Motivo:\s*(.*?)\s*(?:\r?\n)+Descripci[oó]n:\s*([\s\S]*)$/i);
        const trip = findRide(tripId);
        addMockIncident({
          reporter: this.auth.user()?.name ?? 'Pasajero',
          reported: trip?.driver?.name ?? 'Conductor',
          reportedDriverId: trip?.driver?.id ?? 2,
          motive: m ? m[1] : 'Incidencia reportada',
          detail: m ? m[2] : comment,
        });
      }
      return of({ success: true }).pipe(delay(300));
    }
    return this.http.post(`${this.api}/trips/${tripId}/rating`, {
      score,
      comment,
      has_incident: hasIncident,
    });
  }
}