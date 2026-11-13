/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, defer, delay, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DriverRequest, DriverTrip, TripStatus, User } from '../models/models';
import { num, numOrUndef, toList } from '../utils/api';
import { APPROVAL_MESSAGES, mockApprovalFor } from '../utils/mock-drivers';
import { driverAccept, driverLocation, driverRequests, driverStep } from '../utils/mock-rides';
import { session } from '../utils/session';
import { activeVehicle } from '../utils/vehicle-store';
import { AuthService } from './auth.service';

/** approval: pending | approved | suspended | rejected (null = no se sabe) */
export interface DriverProfileInfo {
  approval: string | null;
  online: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class DriverService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = `${environment.apiUrl}/driver`;
  private mock = environment.useMock;

  private rejected = new Set<number>();

  /** Simulado: lo que decidió el admin. Con el backend real se pregunta con profile() */
  knownApproval(): string | null {
    if (!this.mock) return null;
    const u = this.auth.user();
    return mockApprovalFor(u?.id ?? 0, u?.status);
  }

  private forbidden(st: string): Observable<never> {
    return throwError(() => ({
      status: 403,
      error: {
        message: APPROVAL_MESSAGES[st] ?? 'Tu cuenta no está habilitada.',
        approval_status: st,
      },
    }));
  }

  /** Estado real del conductor: GET /auth/me trae driver_profile con la aprobación y la disponibilidad */
  profile(): Observable<DriverProfileInfo> {
    if (this.mock) return of({ approval: this.knownApproval(), online: null });
    return this.http.get<{ user: User }>(`${environment.apiUrl}/auth/me`).pipe(
      tap((r) => {
        this.auth.user.set(r.user);
        session.setItem('user', JSON.stringify(r.user));
      }),
      map((r) => ({
        approval: r.user.driver_profile?.approval_status ?? null,
        online: r.user.driver_profile
          ? r.user.driver_profile.availability_status === 'available'
          : null,
      })),
      catchError(() => of({ approval: null, online: null })),
    );
  }

  setAvailability(online: boolean): Observable<unknown> {
    if (this.mock) {
      const st = this.knownApproval() ?? 'approved';
      if (online && st !== 'approved') return this.forbidden(st);
      return of({ success: true }).pipe(delay(300));
    }
    return this.http.put(`${this.api}/availability`, {
      status: online ? 'available' : 'unavailable',
    });
  }

  requests(): Observable<DriverRequest[]> {
    if (this.mock) {
      const st = this.knownApproval() ?? 'approved';
      if (st !== 'approved') return this.forbidden(st);
      return defer(() => of(driverRequests(this.rejected)));
    }
    return this.http.get<{ requests: unknown }>(`${this.api}/ride-requests`).pipe(
      map((r) =>
        toList<any>(r.requests)
          .map((x) => this.fixRequest(x))
          .filter((x) => !this.rejected.has(x.id)),
      ),
    );
  }

  /** El API manda números como texto ("2.93"): se convierten */
  private fixRequest(x: any): DriverRequest {
    return {
      ...x,
      estimated_distance_km: num(x.estimated_distance_km),
      estimated_fare: num(x.estimated_fare),
      origin_latitude: numOrUndef(x.origin_latitude),
      origin_longitude: numOrUndef(x.origin_longitude),
      destination_latitude: numOrUndef(x.destination_latitude),
      destination_longitude: numOrUndef(x.destination_longitude),
    };
  }

  /** El API no tiene "rechazar": solo la ocultamos en este dispositivo */
  reject(id: number): void {
    this.rejected.add(id);
  }

  accept(req: DriverRequest): Observable<{ id: number; status: TripStatus }> {
    if (this.mock) {
      const st = this.knownApproval() ?? 'approved';
      if (st !== 'approved') return this.forbidden(st);
      const u = this.auth.user();
      const v = u ? activeVehicle(u.id) : null;
      return defer(() =>
        of(
          driverAccept(
            req.id,
            { id: u?.id ?? 0, name: u?.name ?? 'Conductor', phone: u?.phone ?? '' },
            v ? { plate: v.plate, brand: v.brand, model: v.model, color: v.color } : undefined,
          ),
        ).pipe(delay(300)),
      );
    }
    return this.http
      .post<{ trip: { id: number; status: TripStatus } }>(
        `${this.api}/ride-requests/${req.id}/accept`,
        {},
      )
      .pipe(map((r) => r.trip));
  }

  arrive(id: number): Observable<unknown> {
    if (this.mock) return defer(() => of(driverStep(id, 'assigned', 'driver_arrived')).pipe(delay(300)));
    return this.http.post(`${this.api}/trips/${id}/arrive`, {});
  }

  start(id: number): Observable<unknown> {
    if (this.mock) return defer(() => of(driverStep(id, 'driver_arrived', 'in_progress')).pipe(delay(300)));
    return this.http.post(`${this.api}/trips/${id}/start`, {});
  }

  complete(id: number, km: number, min: number): Observable<number | null> {
    if (this.mock) return defer(() => of(driverStep(id, 'in_progress', 'completed')).pipe(delay(300)));
    return this.http
      .post<{ trip?: { final_fare?: unknown } }>(`${this.api}/trips/${id}/complete`, {
        actual_distance_km: km,
        actual_duration_min: min,
      })
      .pipe(map((r) => (r.trip?.final_fare != null ? num(r.trip.final_fare) : null)));
  }

  sendLocation(body: {
    latitude: number;
    longitude: number;
    heading: number;
    speed: number;
    trip_id?: number;
  }): Observable<unknown> {
    if (this.mock) {
      const tripId = body.trip_id;
      if (!tripId) return of(null);
      return defer(() => {
        driverLocation(tripId, { lat: body.latitude, lng: body.longitude });
        return of(null);
      });
    }
    return this.http.post(`${this.api}/location`, body).pipe(catchError(() => of(null)));
  }

  // ---------- Viaje activo (el API no lo expone, lo guardamos aquí) ----------
  loadActive(): DriverTrip | null {
    try {
      return JSON.parse(session.getItem('driver_active') ?? 'null') as DriverTrip | null;
    } catch {
      return null;
    }
  }

  saveActive(t: DriverTrip | null): void {
    if (t) session.setItem('driver_active', JSON.stringify(t));
    else session.removeItem('driver_active');
  }
}