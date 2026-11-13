import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonFooter, ToastController } from '@ionic/angular';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { distanceKm } from '../../../core/data/places';
import {
  DriverRequest,
  DriverTrip,
  LatLng,
  RouteInfo,
  Vehicle,
} from '../../../core/models/models';
import { AuthService } from '../../../core/services/auth.service';
import { DriverProfileInfo, DriverService } from '../../../core/services/driver.service';
import { GeoService } from '../../../core/services/geo.service';
import { num } from '../../../core/utils/api';
import { money } from '../../../core/utils/format';
import { APPROVAL_MESSAGES } from '../../../core/utils/mock-drivers';
import { pathLengthKm, pointAt } from '../../../core/utils/path';
import { session } from '../../../core/utils/session';
import { activeVehicle } from '../../../core/utils/vehicle-store';
import { DriverTabsComponent } from '../../../shared/components/driver-tabs.component';
import { TripMapComponent } from '../../../shared/components/trip-map.component';

/**
 * true  = el carro avanza solo por las calles (para probar en el computador:
 *         así el pasajero ve moverse al conductor con el backend real)
 * false = se usa el GPS real del celular
 */
const SIMULATE_GPS = true;

@Component({
  selector: 'app-driver-home',
  standalone: true,
  imports: [IonContent, IonFooter, IonButton, RouterLink, TripMapComponent, DriverTabsComponent],
  templateUrl: './driver-home.page.html',
})
export class DriverHomePage implements OnDestroy {
  auth = inject(AuthService);
  private driver = inject(DriverService);
  private geo = inject(GeoService);
  private toast = inject(ToastController);

  money = money;

  online = signal(session.getItem('driver_online') === '1');
  requests = signal<DriverRequest[]>([]);
  trip = signal<DriverTrip | null>(null);
  busy = signal(false);
  me = signal<LatLng | null>(null);
  route = signal<RouteInfo | null>(null);
  vehicle = signal<Vehicle | null>(null);
  blocked = signal<string | null>(null); // pending | suspended | rejected

  private pollSub?: Subscription;
  private locSub?: Subscription;
  private watchId: number | null = null;
  private lastPos: LatLng | null = null;
  private heading = 0;
  private speedKmh = 0;
  private travelled = 0;
  private routeKey = '';
  private simTimer?: ReturnType<typeof setInterval>;
  private idleTick = 0;
  private legDone = true; // el carro simulado ya llegó al final de su etapa

  current = computed(() => this.requests()[0] ?? null);
  focus = computed<DriverRequest | null>(() => this.trip()?.request ?? this.current());

  mapOrigin = computed<LatLng | null>(() => {
    const f = this.focus();
    return f?.origin_latitude != null && f.origin_longitude != null
      ? { lat: num(f.origin_latitude), lng: num(f.origin_longitude) }
      : null;
  });

  mapDestination = computed<LatLng | null>(() => {
    const f = this.focus();
    return f?.destination_latitude != null && f.destination_longitude != null
      ? { lat: num(f.destination_latitude), lng: num(f.destination_longitude) }
      : null;
  });

  mapRoute = computed<LatLng[] | null>(() => this.route()?.points ?? null);

  blockedText = computed(
    () => APPROVAL_MESSAGES[this.blocked() ?? ''] ?? 'Tu cuenta no está habilitada.',
  );

  tripText = computed(() => {
    switch (this.trip()?.status) {
      case 'assigned': return 'Ve al punto de recogida';
      case 'driver_arrived': return 'Esperando al pasajero';
      case 'in_progress': return 'Viaje en curso';
      default: return '';
    }
  });

  actionLabel = computed(() => {
    switch (this.trip()?.status) {
      case 'assigned': return 'Llegué al punto de recogida';
      case 'driver_arrived': return 'Iniciar viaje';
      case 'in_progress': return 'Finalizar viaje';
      default: return '';
    }
  });

  // ---------- Ciclo de vida (Ionic) ----------
  ionViewWillEnter(): void {
    const uid = this.auth.user()?.id;
    this.vehicle.set(uid ? activeVehicle(uid) : null);
    this.trip.set(this.driver.loadActive());
    this.updateRoute();
    // Estado real del conductor: aprobación y disponibilidad (GET /auth/me)
    this.driver.profile().subscribe((p) => this.onProfile(p));
  }

  ngOnDestroy(): void {
    this.stopLoops();
    clearInterval(this.simTimer);
  }

  firstName(): string {
    return (this.auth.user()?.name ?? '').split(' ')[0];
  }

  // ---------- En línea / desconectado ----------
  toggle(): void {
    if (this.busy()) return;
    const next = !this.online();

    if (this.trip()) {
      this.show('Termina el viaje en curso antes de cambiar tu estado', 'danger');
      return;
    }

    this.busy.set(true);
    this.driver.setAvailability(next).subscribe({
      next: () => {
        this.busy.set(false);
        this.online.set(next);
        session.setItem('driver_online', next ? '1' : '0');
        if (next) {
          this.blocked.set(null);
          this.startLoops();
        } else {
          this.stopLoops();
          this.requests.set([]);
          this.updateRoute();
        }
      },
      error: (err) => {
        this.busy.set(false);
        const st = err.error?.approval_status as string | undefined;
        if (st) this.blocked.set(st);
        this.show(
          st
            ? (APPROVAL_MESSAGES[st] ?? err.error?.message ?? 'Tu cuenta no está habilitada.')
            : (err.error?.message ?? 'No se pudo cambiar tu estado'),
          'danger',
        );
      },
    });
  }

  // ---------- Solicitudes ----------
  accept(req: DriverRequest): void {
    if (this.busy() || this.blocked()) return;
    this.busy.set(true);
    this.driver.accept(req).subscribe({
      next: (t) => {
        this.busy.set(false);
        this.requests.set([]);
        this.setTrip({ id: t.id, status: 'assigned', estimated_fare: req.estimated_fare, request: req });
      },
      error: (err) => {
        this.busy.set(false);
        if (err.status === 403) {
          this.onForbidden(err);
          return;
        }
        this.show(err.error?.message ?? 'No se pudo aceptar el servicio', 'danger');
        if (err.status === 409) {
          this.requests.set(this.requests().filter((r) => r.id !== req.id));
          this.updateRoute();
        }
      },
    });
  }

  reject(req: DriverRequest): void {
    this.driver.reject(req.id);
    this.requests.set(this.requests().filter((r) => r.id !== req.id));
    this.updateRoute();
  }

  // ---------- Avance del viaje: llegué → iniciar → finalizar ----------
  advance(): void {
    const t = this.trip();
        if (!t || this.busy()) return;

    // Con el carro simulado solo se avanza cuando llegó al final de la etapa
    if (SIMULATE_GPS && !this.legDone && (t.status === 'assigned' || t.status === 'in_progress')) {
      this.show(
        t.status === 'assigned' ? 'Espera a llegar al punto de recogida' : 'Espera a llegar al destino',
        'warning',
      );
      return;
    }

    this.busy.set(true);

    if (t.status === 'assigned') {
      this.driver.arrive(t.id).subscribe({
        next: () => this.after({ ...t, status: 'driver_arrived' }),
        error: (e) => this.fail(e),
      });
    } else if (t.status === 'driver_arrived') {
      this.driver.start(t.id).subscribe({
        next: () => {
          this.travelled = 0;
          this.lastPos = this.me();
          this.after({ ...t, status: 'in_progress', started_at: Date.now() });
        },
        error: (e) => this.fail(e),
      });
    } else if (t.status === 'in_progress') {
      const km =
        this.travelled >= 0.1
          ? Math.round(this.travelled * 100) / 100
          : t.request.estimated_distance_km;
      const min = Math.max(1, Math.round((Date.now() - (t.started_at ?? Date.now())) / 60000));

      this.driver.complete(t.id, km, min).subscribe({
        next: (fare) => {
          this.busy.set(false);
          this.setTrip(null);
          this.show(`Viaje finalizado · ${money(fare ?? t.estimated_fare)}`, 'success');
          this.driver.profile().subscribe((p) => this.onProfile(p));
        },
        error: (e) => this.fail(e),
      });
    }
  }

  private after(t: DriverTrip): void {
    this.busy.set(false);
    this.setTrip(t);
  }

  private fail(err: { status?: number; error?: { message?: string } }): void {
    this.busy.set(false);
    this.show(err.error?.message ?? 'No se pudo completar la acción', 'danger');
    // El viaje ya no existe o fue cancelado
    if (err.status === 404 || err.status === 409) this.setTrip(null);
  }

  private setTrip(t: DriverTrip | null): void {
    this.trip.set(t);
    this.driver.saveActive(t);
    this.updateRoute();
    this.planLeg();
  }

  // ---------- Aprobación del administrador ----------
  private onProfile(p: DriverProfileInfo): void {
    // Con un viaje en curso el servidor puede marcarlo como ocupado: no tocamos su estado
    if (p.online !== null && !this.trip()) {
      this.online.set(p.online);
      session.setItem('driver_online', p.online ? '1' : '0');
    }
    if (p.approval && p.approval !== 'approved') this.goBlocked(p.approval);
    else if (p.approval === 'approved') this.blocked.set(null);

    if ((this.online() || this.trip()) && !this.blocked()) this.startLoops();
    this.planLeg(); // si había un viaje en curso, el carro simulado sigue
  }

  /** El API respondió 403: el conductor no está aprobado (o lo penalizaron) */
  private onForbidden(err: { error?: { approval_status?: string } }): void {
    const st = err?.error?.approval_status;
    if (st) {
      this.goBlocked(st);
      return;
    }
    this.driver
      .profile()
      .subscribe((p) =>
        this.goBlocked(p.approval && p.approval !== 'approved' ? p.approval : 'pending'),
      );
  }

  /** El conductor no está aprobado (o lo penalizaron): se desconecta y no recibe viajes */
  private goBlocked(st: string): void {
    if (this.trip()) return; // deja terminar el viaje que ya tiene en curso
    this.blocked.set(st);
    if (this.online()) {
      this.online.set(false);
      session.setItem('driver_online', '0');
      this.stopLoops();
      this.requests.set([]);
      this.updateRoute();
      this.show(APPROVAL_MESSAGES[st] ?? 'Tu cuenta no está habilitada.', 'danger');
    }
  }

  // ---------- Ruta en el mapa (solo si el API trae coordenadas) ----------
  private updateRoute(): void {
    const r = this.focus();
    if (
      !r ||
      r.origin_latitude == null ||
      r.origin_longitude == null ||
      r.destination_latitude == null ||
      r.destination_longitude == null
    ) {
      this.route.set(null);
      this.routeKey = '';
      return;
    }

    const key = String(r.id);
    if (key === this.routeKey) return;
    this.routeKey = key;

    this.geo
      .route(
        { name: '', latitude: r.origin_latitude, longitude: r.origin_longitude },
        { name: '', latitude: r.destination_latitude, longitude: r.destination_longitude },
      )
      .subscribe((x) => {
        if (this.routeKey === key) this.route.set(x);
      });
  }

  // ---------- Sondeo y GPS ----------
  private startLoops(): void {
    this.stopLoops();
    this.startGps();

    this.pollSub = timer(0, 5000)
      .pipe(
        switchMap(() => {
          if (!this.auth.token) {
            this.stopLoops();
            return of(null);
          }
          if (this.trip()) return of(null);
          return this.driver.requests().pipe(
            catchError((err) => {
              if (err?.status === 403) this.onForbidden(err);
              return of(null);
            }),
          );
        }),
      )
      .subscribe((r) => {
        if (!r) return;
        this.requests.set(r);
        this.updateRoute();
      });

        // Simulado: se envía cada segundo para que el pasajero vea el carro moverse fluido
    this.locSub = timer(1000, environment.useMock ? 1000 : 4000).subscribe(() => this.pingLocation());
  }

  private stopLoops(): void {
    this.pollSub?.unsubscribe();
    this.locSub?.unsubscribe();
    if (this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
  }

  private startGps(): void {
    if (!navigator.geolocation || this.watchId !== null) return;
    this.watchId = navigator.geolocation.watchPosition((pos) => this.onPos(pos), () => undefined, {
      enableHighAccuracy: true,
      maximumAge: 5000,
    });
  }

  /** GPS real */
  private onPos(pos: GeolocationPosition): void {
    if (SIMULATE_GPS && this.trip()) return; // mientras hay viaje manda el carro simulado
    const h = pos.coords.heading;
    this.applyPoint(
      { lat: pos.coords.latitude, lng: pos.coords.longitude },
      h != null && Number.isFinite(h) ? h : 0,
      Math.round((pos.coords.speed ?? 0) * 3.6 * 10) / 10,
    );
  }

  /** Nueva posición del conductor (real o simulada): la muestra y suma los km del viaje */
  private applyPoint(p: LatLng, heading = 0, speedKmh = 0): void {
    this.me.set(p);
    this.heading = heading;
    this.speedKmh = speedKmh;

    if (this.trip()?.status === 'in_progress' && this.lastPos) {
      const d = distanceKm(
        { name: '', latitude: this.lastPos.lat, longitude: this.lastPos.lng },
        { name: '', latitude: p.lat, longitude: p.lng },
      );
      if (d > 0.01) {
        this.travelled += d;
        this.lastPos = p;
      }
    } else {
      this.lastPos = p;
    }
  }

  // ---------- Carro simulado (para probar en el computador) ----------
  /** Asignado: va hacia el pasajero · En curso: va hacia el destino */
    /** Asignado: va hacia el pasajero · En curso: va hacia el destino */
  private planLeg(): void {
    clearInterval(this.simTimer);
    this.legDone = true;
    const t = this.trip();
    const r = t?.request;
    if (!SIMULATE_GPS || !t || !r) return;
    if (
      r.origin_latitude == null ||
      r.origin_longitude == null ||
      r.destination_latitude == null ||
      r.destination_longitude == null
    ) {
      return; // sin coordenadas no se puede simular el recorrido
    }

    const o: LatLng = { lat: num(r.origin_latitude), lng: num(r.origin_longitude) };
    const d: LatLng = { lat: num(r.destination_latitude), lng: num(r.destination_longitude) };
    const leg = t.status;

    if (leg === 'driver_arrived') {
      this.applyPoint(o);
      return;
    }
    if (leg !== 'assigned' && leg !== 'in_progress') return;

    let from: LatLng = o;
    if (leg === 'assigned') {
      // Sigue desde donde va; si no hay posición cercana, sale a ~1 km del pasajero
      const here = this.me();
      const near =
        here &&
        distanceKm(
          { name: '', latitude: here.lat, longitude: here.lng },
          { name: '', latitude: o.lat, longitude: o.lng },
        ) < 3;
      from = near && here ? here : { lat: o.lat + 0.009, lng: o.lng + 0.006 };
    }
    const to = leg === 'assigned' ? o : d;

    this.legDone = false;
    this.applyPoint(from);
    this.geo
      .route(
        { name: '', latitude: from.lat, longitude: from.lng },
        { name: '', latitude: to.lat, longitude: to.lng },
      )
      .subscribe((res) => {
        if (this.trip()?.status !== leg) return;
        this.drive(res?.points?.length ? res.points : [from, to], leg);
      });
  }

  /** Mueve el carro por la ruta, un paso por segundo (cada etapa dura entre 3 y 7 segundos) */
  private drive(path: LatLng[], leg: string): void {
    if (path.length < 2) {
      this.legDone = true;
      return;
    }
    const seconds = Math.min(7, Math.max(3, pathLengthKm(path) * 2));
    const t0 = Date.now();
    clearInterval(this.simTimer);
    this.simTimer = setInterval(() => {
      if (this.trip()?.status !== leg) {
        clearInterval(this.simTimer);
        return;
      }
      const k = Math.min(1, (Date.now() - t0) / 1000 / seconds);
      this.applyPoint(pointAt(path, k));
      if (k >= 1) {
        this.legDone = true;
        clearInterval(this.simTimer);
      }
    }, 1000);
  }