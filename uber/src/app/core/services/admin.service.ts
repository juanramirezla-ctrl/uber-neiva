/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminDriver, AdminStats, Fare, Incident } from '../models/admin.models';
import { User } from '../models/models';
import { getDriverStatusMap, setMockDriverStatus } from '../utils/mock-drivers';
import { getMockIncidents } from '../utils/mock-incidents';
import { getVehicles } from '../utils/vehicle-store';

const RESOLVED_KEY = 'resolved_incidents';

function pick(...vals: any[]): any {
  return vals.find((v) => v !== undefined && v !== null && v !== '');
}

/** Convierte lo que devuelva el backend en una queja uniforme (tolera distintas formas) */
function toIncident(i: any, n: number): Incident {
  const comment = String(
    pick(i?.comment, i?.description, i?.reason, i?.message) ?? 'Incidencia reportada',
  );
  const m = comment.match(/^Motivo:\s*(.*?)\s*(?:\r?\n)+Descripci[oó]n:\s*([\s\S]*)$/i);
  const id = pick(i?.id, i?.rating_id, i?.trip_id, n + 1);
  return {
    key: String(id),
    id,
    reporter:
      pick(
        i?.client?.name, i?.client?.user?.name, i?.user?.name,
        i?.trip?.client?.name, i?.trip?.client?.user?.name, i?.reporter?.name,
      ) ?? 'Pasajero',
    reported:
      pick(i?.driver?.user?.name, i?.driver?.name, i?.trip?.driver?.user?.name, i?.reported?.name) ??
      'Conductor',
    reportedDriverId:
      pick(i?.driver?.id, i?.driver_id, i?.trip?.driver?.id, i?.trip?.driver_id) ?? null,
    motive: m ? m[1] : 'Incidencia reportada',
    detail: m ? m[2] : comment,
    date: String(pick(i?.created_at, i?.updated_at, i?.trip?.completed_at) ?? ''),
  };
}
/** Los contadores a veces llegan como texto: se convierten a número */
function fixStats(s: any): AdminStats {
  const out: any = { ...(s ?? {}) };
  for (const k of Object.keys(out)) {
    const n = parseFloat(String(out[k]));
    if (Number.isFinite(n)) out[k] = n;
  }
  return out as AdminStats;
}
function asArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  return [];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/admin`;
  private mock = environment.useMock;

  private cache: Incident[] = [];

  // Conductores de ejemplo (el id 2 es el de conductor@uber.com)
  private mockBase: AdminDriver[] = [
    {
      id: 2, license_number: 'LC-88291-CO', approval_status: 'approved', rating_average: 4.9,
      user: { name: 'Carlos Pérez', email: 'conductor@uber.com', phone: '3002223344' },
      vehicles: [{ plate: 'ABC123', brand: 'Chevrolet', model: 'Spark', year: 2019 }],
    },
    {
      id: 4, license_number: 'LC-55120-CO', approval_status: 'suspended', rating_average: 4.1,
      user: { name: 'Andrés Rojas', email: 'andres@uber.com', phone: '3005556677' },
      vehicles: [{ plate: 'XYZ789', brand: 'Renault', model: 'Logan', year: 2017 }],
    },
    {
      id: 5, license_number: 'LC-11928-C', approval_status: 'pending', rating_average: 5,
      user: { name: 'Mauricio Díaz', email: 'mauricio@uber.com', phone: '3008889900' },
      vehicles: [{ plate: 'NEW456', brand: 'Kia', model: 'Rio', year: 2024 }],
    },
  ];

  /** Conductores simulados: los de ejemplo + los que te registraste desde la app */
  private mockList(): AdminDriver[] {
    const map = getDriverStatusMap();
    const base = this.mockBase.map((d) => ({
      ...d,
      approval_status: map[String(d.id)] ?? d.approval_status,
    }));
    const saved = JSON.parse(localStorage.getItem('mock_users') ?? '[]') as User[];
    const registered: AdminDriver[] = saved
      .filter((u) => u.role === 'driver')
      .map((u) => ({
        id: u.id,
        approval_status: map[String(u.id)] ?? (u.status === 'pending' ? 'pending' : 'approved'),
        rating_average: 5,
        user: { name: u.name, email: u.email, phone: u.phone },
        vehicles: getVehicles(u.id).map((v) => ({
          plate: v.plate, brand: v.brand, model: v.model, year: v.year,
        })),
      }));
    return [...registered.reverse(), ...base]; // los nuevos primero
  }

  private mockFares: Fare[] = [
    {
      id: 1, name: 'Tarifa Estándar Urbana', base_fare: 3800, price_per_km: 4000,
      price_per_minute: 250, minimum_fare: 6500, surge_multiplier: 1, active: true,
    },
  ];

  // ---------- Panel ----------
  dashboard(): Observable<{ stats: AdminStats; incidents: Incident[] }> {
    if (this.mock) {
      const d = this.mockList();
      const day = 86400000;
      const res = {
        stats: {
          total_clients: 83,
          total_drivers: 42 + d.length,
          pending_drivers: d.filter((x) => x.approval_status === 'pending').length,
          approved_drivers: d.filter((x) => x.approval_status === 'approved').length,
          active_trips: 1,
          completed_trips: 212,
          cancelled_trips: 9,
          pending_requests: 2,
          total_revenue: 1845300,
        } as AdminStats,
        incidents: [
          ...getMockIncidents(),
          {
            key: '14', id: 14, reporter: 'Laura Gómez', reported: 'Carlos Pérez', reportedDriverId: 2,
            motive: 'Conducción imprudente',
            detail: 'El conductor tomó la vía a alta velocidad y pasó un semáforo en rojo durante el viaje.',
            date: new Date(Date.now() - day).toISOString(),
          },
          {
            key: '13', id: 13, reporter: 'Diego Ortiz', reported: 'Andrés Rojas', reportedDriverId: 4,
            motive: 'Cobro excesivo por el viaje',
            detail: 'Me cobraron más de lo que mostraba la aplicación al solicitar el viaje.',
            date: new Date(Date.now() - 2 * day).toISOString(),
          },
        ] as Incident[],
      };
      return of(res).pipe(delay(300), tap((r) => (this.cache = r.incidents)));
    }
    return this.http.get<any>(`${this.api}/dashboard`).pipe(
      map((r) => ({
        stats: fixStats(r.stats),
        incidents: asArray(r.recent_incidents).map((i, n) => toIncident(i, n)),
      })),
      tap((r) => (this.cache = r.incidents)),
    );
  }

  incident(key: string): Observable<Incident | null> {
    const hit = this.cache.find((i) => i.key === key);
    if (hit) return of(hit);
    return this.dashboard().pipe(map((r) => r.incidents.find((i) => i.key === key) ?? null));
  }

  // ---------- Estado de las quejas (el API no lo guarda: queda en este dispositivo) ----------
  resolvedKeys(): string[] {
    try {
      return JSON.parse(localStorage.getItem(RESOLVED_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  }

  isResolved(key: string): boolean {
    return this.resolvedKeys().includes(key);
  }

  markResolved(key: string): void {
    const l = this.resolvedKeys();
    if (!l.includes(key)) localStorage.setItem(RESOLVED_KEY, JSON.stringify([...l, key]));
  }

  // ---------- Conductores ----------
  drivers(status?: string): Observable<AdminDriver[]> {
    if (this.mock) {
      const all = this.mockList();
      const l = status ? all.filter((d) => d.approval_status === status) : all;
      return of(l).pipe(delay(250));
    }
    return this.http
      .get<{ drivers: unknown }>(`${this.api}/drivers`, {
        params: status ? { approval_status: status } : {},
      })
      .pipe(map((r) => asArray(r.drivers) as AdminDriver[]));
  }

  setApproval(id: number, status: string, notes: string): Observable<unknown> {
    if (this.mock) {
      setMockDriverStatus(id, status);
      return of({ success: true }).pipe(delay(300));
    }
    return this.http.patch(`${this.api}/drivers/${id}/approval`, {
      approval_status: status,
      admin_notes: notes,
    });
  }

  findDriverId(name: string): Observable<number | null> {
    return this.drivers().pipe(map((l) => l.find((d) => d.user.name === name)?.id ?? null));
  }

  // ---------- Tarifas ----------
  fares(): Observable<Fare[]> {
    if (this.mock) return of([...this.mockFares]).pipe(delay(250));
    return this.http
      .get<any>(`${this.api}/fares`)
      .pipe(map((r) => asArray(r.fares ?? r.data ?? (r.fare ? [r.fare] : [])) as Fare[]));
  }

  createFare(f: Fare): Observable<unknown> {
    if (this.mock) {
      const id = Math.max(0, ...this.mockFares.map((x) => x.id ?? 0)) + 1;
      if (f.active) this.mockFares = this.mockFares.map((x) => ({ ...x, active: false }));
      this.mockFares = [{ ...f, id }, ...this.mockFares];
      return of({ success: true }).pipe(delay(300));
    }
    return this.http.post(`${this.api}/fares`, f);
  }

  // ---------- Viajes, reportes y auditoría (vista genérica) ----------
  list(kind: 'trips' | 'reports' | 'audit-logs', status?: string): Observable<unknown> {
    if (this.mock) {
      const iso = new Date().toISOString();
      if (kind === 'trips') {
        const all = [
          { id: 3, status: 'completed', final_fare: 9200, completed_at: iso, client: { name: 'Laura Gómez' }, driver: { user: { name: 'Carlos Pérez' } } },
          { id: 2, status: 'cancelled', estimated_fare: 7500, client: { name: 'Diego Ortiz' }, driver: { user: { name: 'Andrés Rojas' } } },
          { id: 1, status: 'in_progress', estimated_fare: 8400, client: { name: 'Marta Silva' }, driver: { user: { name: 'Carlos Pérez' } } },
        ];
        return of({
          success: true,
          trips: { data: status ? all.filter((t) => t.status === status) : all },
        }).pipe(delay(250));
      }
      if (kind === 'reports') {
        return of({
          success: true,
          report: { total_revenue: 1845300, completed_trips: 212, cancelled_trips: 9, cancellation_rate: 4.1 },
        }).pipe(delay(250));
      }
      return of({
        success: true,
        logs: [
          { id: 2, action: 'driver.approval', description: 'Conductor aprobado', created_at: iso },
          { id: 1, action: 'fare.created', description: 'Tarifa configurada', created_at: iso },
        ],
      }).pipe(delay(250));
    }
    return this.http.get<unknown>(`${this.api}/${kind}`, {
      params: status ? { status } : {},
    });
  }
}