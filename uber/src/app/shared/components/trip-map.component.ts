import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { LatLng } from '../../core/models/models';

@Component({
  selector: 'app-trip-map',
  standalone: true,
  template: '<div #mapEl class="trip-map"></div>',
  styles: [':host{display:block;height:100%}.trip-map{height:100%;width:100%}'],
})
export class TripMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  @Input() origin: LatLng | null = null;
  @Input() destination: LatLng | null = null;
  @Input() driver: LatLng | null = null;
  @Input() route: LatLng[] | null = null;
  @Output() mapClick = new EventEmitter<LatLng>();

  private map?: L.Map;
  private layer = L.layerGroup();
  private fitKey = '';

  // El conductor tiene su propio marcador y se mueve con animación
  private driverMarker?: L.CircleMarker;
  private driverShown: LatLng | null = null; // dónde se está dibujando ahora
  private driverTarget: LatLng | null = null; // última posición recibida
  private lastChangeAt = 0;
  private anim = 0;
  private trail?: L.Polyline; // recorrido que ya hizo el conductor

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, { zoomControl: false }).setView(
      [2.9273, -75.2819],
      14,
    );

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.layer.addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.mapClick.emit({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    setTimeout(() => {
      this.map?.invalidateSize();
      this.fitKey = '';
      this.draw();
      this.moveDriver();
    }, 250);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['origin'] || changes['destination'] || changes['route']) this.draw();
    if (changes['driver']) this.moveDriver();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.anim);
    this.map?.remove();
  }

  /** Origen, destino y ruta (el conductor se maneja aparte) */
  private draw(): void {
    const map = this.map;
    if (!map) return;
    this.layer.clearLayers();

    const dot = (p: L.LatLngTuple, color: string, radius = 8) =>
      L.circleMarker(p, { radius, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 });

    const o: L.LatLngTuple | null = this.origin ? [this.origin.lat, this.origin.lng] : null;
    const d: L.LatLngTuple | null = this.destination
      ? [this.destination.lat, this.destination.lng]
      : null;

    let bounds: L.LatLngTuple[] = [];
    if (o) bounds.push(o);
    if (d) bounds.push(d);

    if (this.route && this.route.length > 1) {
      const pts: L.LatLngTuple[] = this.route.map((p) => [p.lat, p.lng]);
      L.polyline(pts, { color: '#111', weight: 5, opacity: 0.85 }).addTo(this.layer);
      bounds = pts;
    } else if (o && d) {
      L.polyline([o, d], { color: '#999', weight: 3, dashArray: '6 8' }).addTo(this.layer);
    }

    if (o) dot(o, '#1fc16b').addTo(this.layer);
    if (d) dot(d, '#111').addTo(this.layer);

    const key = `${o}|${d}|${this.route?.length ?? 0}`;
    if (key !== this.fitKey) {
      this.fitKey = key;
      if (bounds.length >= 2) map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] });
      else if (bounds.length === 1) map.setView(bounds[0], 15);
    }
  }

  /** Mueve el marcador del conductor con suavidad hasta la nueva posición */
  private moveDriver(): void {
    const map = this.map;
    if (!map) return;
    const to = this.driver;

    if (!to) {
      cancelAnimationFrame(this.anim);
      this.driverMarker?.remove();
      this.driverMarker = undefined;
      this.trail?.remove();
      this.trail = undefined;
      this.driverShown = null;
      this.driverTarget = null;
      return;
    }

    // Primera vez: se dibuja directamente
    if (!this.driverMarker) {
      this.driverMarker = L.circleMarker([to.lat, to.lng], {
        radius: 9,
        color: '#fff',
        weight: 3,
        fillColor: '#2f6bff',
        fillOpacity: 1,
      })
        .bindTooltip('Conductor')
        .addTo(map);
      this.trail = L.polyline([[to.lat, to.lng]], {
        color: '#2f6bff',
        weight: 4,
        opacity: 0.6,
      }).addTo(map);
      this.driverShown = to;
      this.driverTarget = to;
      this.lastChangeAt = performance.now();
      this.keepInView(to, true);
      return;
    }

    // Misma posición que ya teníamos: no hacemos nada (así no se acelera)
    if (this.driverTarget && this.driverTarget.lat === to.lat && this.driverTarget.lng === to.lng) {
      return;
    }

    const from = this.driverShown ?? to;
    const now = performance.now();
    // Tarda lo mismo que pasó entre una posición y la siguiente, así se ve continuo
    const dur = Math.min(9000, Math.max(1200, now - this.lastChangeAt));
    this.lastChangeAt = now;
    this.driverTarget = to;
    this.keepInView(to, false);

    cancelAnimationFrame(this.anim);
    const t0 = performance.now();
    const step = (t: number): void => {
      const k = Math.min(1, (t - t0) / dur);
      const p: LatLng = {
        lat: from.lat + (to.lat - from.lat) * k,
        lng: from.lng + (to.lng - from.lng) * k,
      };
      this.driverMarker?.setLatLng([p.lat, p.lng]);
      this.driverShown = p;
      if (k === 1) this.trail?.addLatLng([p.lat, p.lng]);
      if (k < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }

  /** Evita que el conductor salga de la pantalla del mapa */
  private keepInView(p: LatLng, first: boolean): void {
    const map = this.map;
    if (!map) return;
    const ll = L.latLng(p.lat, p.lng);

    if (first && !this.origin && !this.destination) {
      map.setView(ll, 15);
      return;
    }
    if (map.getBounds().contains(ll)) return;

    if (first) {
      const pts: L.LatLng[] = [ll];
      if (this.origin) pts.push(L.latLng(this.origin.lat, this.origin.lng));
      if (this.destination) pts.push(L.latLng(this.destination.lat, this.destination.lng));
      map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
    } else {
      map.panInside(ll, { padding: [40, 40] });
    }
  }
}