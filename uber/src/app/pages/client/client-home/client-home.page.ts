import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonFooter, ToastController } from '@ionic/angular';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { addRecent } from '../../../core/data/places';
import {
  ActiveData,
  ActiveResponse,
  Estimate,
  LatLng,
  Place,
  RouteInfo,
  TripItem,
} from '../../../core/models/models';
import { AuthService } from '../../../core/services/auth.service';
import { ClientService } from '../../../core/services/client.service';
import { GeoService } from '../../../core/services/geo.service';
import { dateLabel, money } from '../../../core/utils/format';
import { ClientTabsComponent } from '../../../shared/components/client-tabs.component';
import { TripMapComponent } from '../../../shared/components/trip-map.component';
import { TripPlannerComponent } from '../../../shared/components/trip-planner.component';

type Field = 'origin' | 'destination';

@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [
    IonContent,
    IonFooter,
    IonButton,
    TripMapComponent,
    ClientTabsComponent,
    TripPlannerComponent,
  ],
  templateUrl: './client-home.page.html',
})
export class ClientHomePage implements OnDestroy {
  auth = inject(AuthService);
  private client = inject(ClientService);
  private geo = inject(GeoService);
  private toast = inject(ToastController);

  money = money;
  dateLabel = dateLabel;

  origin = signal<Place | null>(null);
  destination = signal<Place | null>(null);
  route = signal<RouteInfo | null>(null);
  estimate = signal<Estimate | null>(null);
  active = signal<ActiveData | null>(null);
  trips = signal<TripItem[]>([]);
  busy = signal(false);
  showRating = signal(false);
  stars = signal(5);
  pickMode = signal<Field | null>(null);
  planner = signal<Field | null>(null); // null = cerrado; si no, campo activo
  comment = '';
  incident = false;

  private lastTripId: number | null = null;
  private sub?: Subscription;
  private refreshId = 0;
  private stageKey = '';
  private locating = false;

  mapOrigin = computed<LatLng | null>(() => {
    const a = this.active();
    if (a?.origin_latitude != null && a.origin_longitude != null) {
      return { lat: a.origin_latitude, lng: a.origin_longitude };
    }
    const o = this.origin();
    return o ? this.toLatLng(o) : null;
  });

  mapDestination = computed<LatLng | null>(() => {
    const a = this.active();
    if (a?.destination_latitude != null && a.destination_longitude != null) {
      return { lat: a.destination_latitude, lng: a.destination_longitude };
    }
    const d = this.destination();
    return d ? this.toLatLng(d) : null;
  });

  mapRoute = computed<LatLng[] | null>(() => this.route()?.points ?? null);

  driverPos = computed<LatLng | null>(() => {
    const loc = this.active()?.driver?.latest_location;
    return loc ? { lat: loc.latitude, lng: loc.longitude } : null;
  });

  statusText = computed(() => {
    switch (this.active()?.status) {
      case 'requested': return 'Buscando conductor cercano…';
      case 'assigned': return 'Tu conductor va en camino';
      case 'driver_arrived': return 'Tu conductor llegó';
      case 'in_progress': return 'Viaje en curso';
      default: return '';
    }
  });

  canCancel = computed(() => ['requested', 'assigned', 'driver_arrived'].includes(this.active()?.status ?? ''));

  // ---------- Ciclo de vida (Ionic) ----------
  ionViewWillEnter(): void {
    this.loadTrips();
    this.sub?.unsubscribe();
    this.sub = timer(0, environment.useMock ? 1000 : 3000)
      .pipe(switchMap(() => this.client.active().pipe(catchError(() => of(null)))))
      .subscribe((r) => this.onActive(r));

    if (!this.origin()) this.locate(false);
  }

  ionViewWillLeave(): void {
    this.sub?.unsubscribe();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // ---------- Saludo ----------
  firstName(): string {
    return (this.auth.user()?.name ?? '').split(' ')[0];
  }

  initial(): string {
    return (this.auth.user()?.name ?? '?').charAt(0).toUpperCase();
  }

  // ---------- Planificar viaje ----------
  openPlanner(f: Field): void {
    this.planner.set(f);
  }

  closePlanner(): void {
    this.planner.set(null);
  }

  onPlannerPick(e: { field: Field; place: Place }): void {
    this.setPlace(e.field, e.place, false);
    if (this.origin() && this.destination()) {
      this.closePlanner();
      this.refresh();
    }
  }

  onPlannerGps(): void {
    this.locate(true, () => {
      if (this.destination()) this.closePlanner();
    });
  }

  onPlannerMap(f: Field): void {
    this.closePlanner();
    this.startPick(f);
  }

  // ---------- Origen y destino ----------
  setPlace(kind: Field, p: Place, refresh = true): void {
    if (kind === 'origin') this.origin.set(p);
    else this.destination.set(p);
    if (refresh) this.refresh();
  }

  locate(manual: boolean, done?: () => void): void {
    if (!navigator.geolocation) {
      if (manual) this.show('Tu dispositivo no permite ubicación', 'danger');
      return;
    }
    if (this.locating) return;
    this.locating = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating = false;
        if (!manual && this.origin()) return;
        this.setPlace('origin', {
          name: 'Mi ubicación actual',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        done?.();
      },
      () => {
        this.locating = false;
        if (manual) {
          this.show('No se pudo obtener tu ubicación. Búscala o márcala en el mapa.', 'danger');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  startPick(kind: Field): void {
    this.pickMode.set(kind);
  }

  onMapClick(p: LatLng): void {
    const kind = this.pickMode();
    if (!kind) return;
    this.pickMode.set(null);

    const place: Place = { name: 'Punto seleccionado', latitude: p.lat, longitude: p.lng };
    this.setPlace(kind, place);

    this.geo.reverse(p.lat, p.lng).subscribe((name) => {
      if (!name) return;
      const cur = kind === 'origin' ? this.origin() : this.destination();
      if (cur && cur.latitude === p.lat && cur.longitude === p.lng) {
        this.setPlace(kind, { ...place, name }, false);
      }
    });
  }

  private refresh(): void {
    this.estimate.set(null);
    this.route.set(null);

    const o = this.origin();
    const d = this.destination();
    if (!o || !d) return;

    if (
      Math.abs(o.latitude - d.latitude) < 0.0002 &&
      Math.abs(o.longitude - d.longitude) < 0.0002
    ) {
      this.show('El origen y el destino están muy cerca o son iguales', 'danger');
      return;
    }

    const id = ++this.refreshId;

    this.client.estimate(o, d).subscribe({
      next: (e) => {
        if (id === this.refreshId) this.estimate.set(e);
      },
      error: (err) => {
        console.error('Estimar tarifa falló:', err?.status, err?.error ?? err);
        const detail = err?.error?.errors
          ? Object.values(err.error.errors).flat().join(' ')
          : (err?.error?.message ?? (err?.status ? `código ${err.status}` : 'sin respuesta del servidor'));
        this.show(`No se pudo calcular la tarifa (${detail})`, 'danger');
      },
    });

    this.geo.route(o, d).subscribe((r) => {
      if (id === this.refreshId) this.route.set(r);
    });
  }

  // ---------- Viaje ----------
  request(): void {
    const o = this.origin();
    const d = this.destination();
    const e = this.estimate();
    if (!o || !d || !e) return;

    this.busy.set(true);
    this.client.requestRide(o, d, e).subscribe({
      next: () => {
        this.busy.set(false);
        addRecent(d);
        this.client.active().subscribe((r) => this.onActive(r));
      },
            error: (err) => {
        this.busy.set(false);
        this.show(
          err.error?.message ??
            (err.name === 'TimeoutError'
              ? 'El servidor tardó demasiado en responder'
              : 'No se pudo solicitar el viaje'),
          'danger',
        );
      },
    });
  }

  cancel(): void {
    const a = this.active();
    if (!a) return;
    this.client.cancel(a.id, 'Cambio de planes del usuario', a.request_id).subscribe({
      next: () => {
        this.active.set(null);
        this.lastTripId = null;
        this.show('Solicitud cancelada', 'success');
      },
      error: (err) => this.show(err.error?.message ?? 'No se pudo cancelar', 'danger'),
    });
  }

  // ---------- Calificación ----------
    sendRating(): void {
    const id = this.lastTripId;
    if (!id) return;
    const text = this.incident
      ? `Motivo: Problema durante el viaje\nDescripción: ${this.comment.trim() || 'Sin detalle'}`
      : this.comment;
    this.client.rate(id, this.stars(), text, this.incident).subscribe({
      next: () => {
        this.show(
          this.incident ? 'Queja enviada. ¡Gracias por avisar!' : '¡Gracias por tu calificación!',
          'success',
        );
        this.closeRating();
      },
      error: (err) =>
        this.show(err.error?.message ?? 'No se pudo enviar la calificación', 'danger'),
    });
  }

  closeRating(): void {
    this.showRating.set(false);
    this.lastTripId = null;
    this.destination.set(null);
    this.estimate.set(null);
    this.route.set(null);
    this.comment = '';
    this.incident = false;
    this.stars.set(5);
  }

  // ---------- Internos ----------
  private onActive(r: ActiveResponse | null): void {
    if (!r) return;

    if (r.has_active && r.data) {
      this.active.set(r.data);
      if (r.type === 'trip') this.lastTripId = r.data.id;
      this.updateStageRoute(r.data);
      return;
    }

    const had = this.active();
    this.active.set(null);
    this.stageKey = '';
    if (!had) return;

    if (had.status === 'requested') {
      this.show('Tu solicitud ya no está activa', 'danger');
    } else if (this.lastTripId) {
      this.showRating.set(true);
      this.loadTrips();
    }
  }

  /** Ruta del mapa según la fase: conductor -> pasajero, y luego origen -> destino */
  private updateStageRoute(a: ActiveData): void {
    const hasO = a.origin_latitude != null && a.origin_longitude != null;
    const hasD = a.destination_latitude != null && a.destination_longitude != null;
    if (!hasO || !hasD) return;
    const o: Place = { name: '', latitude: a.origin_latitude!, longitude: a.origin_longitude! };
    const d: Place = { name: '', latitude: a.destination_latitude!, longitude: a.destination_longitude! };

    let from: Place;
    let to: Place;
    let phase: string;
    const loc = a.driver?.latest_location;
    if (a.status === 'assigned' && loc) {
      // Ruta del conductor hasta el pasajero (se calcula una sola vez desde donde sale)
      from = { name: '', latitude: loc.latitude, longitude: loc.longitude };
      to = o;
      phase = 'pickup';
    } else if (a.status === 'in_progress' || a.status === 'driver_arrived') {
      from = o;
      to = d;
      phase = 'trip';
    } else {
      return;
    }

    const key = `${a.id}:${phase}`;
    if (key === this.stageKey) return;
    this.stageKey = key;
    this.geo.route(from, to).subscribe((r) => {
      if (this.stageKey === key && r) this.route.set(r);
    });
  }

  private loadTrips(): void {
    this.client.trips().subscribe({
      next: (t) => this.trips.set(t.slice(0, 3)),
      error: () => undefined,
    });
  }

  private toLatLng(p: Place): LatLng {
    return { lat: p.latitude, lng: p.longitude };
  }

  private async show(message: string, color: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, color });
    t.present();
  }
}