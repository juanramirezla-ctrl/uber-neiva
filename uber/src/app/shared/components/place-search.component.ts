import { Component, EventEmitter, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { Subject, Subscription, catchError, debounceTime, of, switchMap } from 'rxjs';
import { PLACES } from '../../core/data/places';
import { Place } from '../../core/models/models';
import { GeoService } from '../../core/services/geo.service';

@Component({
  selector: 'app-place-search',
  standalone: true,
  template: `
    <div class="ps">
      <input
        class="field"
        type="text"
        autocomplete="off"
        [value]="text()"
        [placeholder]="placeholder"
        (focus)="onFocus($event)"
        (blur)="onBlur()"
        (input)="onInput($any($event.target).value)"
      />

      @if (open()) {
        <div class="ps-list">
          @if (!typing() || text().length < 3) {
            @if (allowGps) {
              <button type="button" class="ps-item" (click)="useGps()">
                <b>Mi ubicación actual</b>
                <small>Usar el GPS</small>
              </button>
            }
            <div class="ps-head">Lugares frecuentes</div>
            @for (p of quick; track p.name) {
              <button type="button" class="ps-item" (click)="pick(p)">
                <b>{{ p.name }}</b>
              </button>
            }
          } @else if (loading()) {
            <div class="ps-empty">Buscando…</div>
          } @else if (failed()) {
            <div class="ps-empty">
              No se pudo buscar (revisa tu internet). Elige un lugar frecuente o márcalo en el mapa.
            </div>
          } @else {
            @for (p of results(); track $index) {
              <button type="button" class="ps-item" (click)="pick(p)">
                <b>{{ p.name }}</b>
                @if (p.subtitle) {
                  <small>{{ p.subtitle }}</small>
                }
              </button>
            } @empty {
              <div class="ps-empty">Sin resultados. Prueba otro nombre o elígelo en el mapa.</div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class PlaceSearchComponent implements OnDestroy {
  private geo = inject(GeoService);

  @Input() placeholder = '';
  @Input() allowGps = false;
  @Input() set value(v: string) {
    this.committed = v ?? '';
    this.text.set(this.committed);
    this.typing.set(false);
  }

  @Output() picked = new EventEmitter<Place>();
  @Output() gps = new EventEmitter<void>();

  quick = PLACES;
  text = signal('');
  typing = signal(false);
  open = signal(false);
  loading = signal(false);
  failed = signal(false);
  results = signal<Place[]>([]);

  private committed = '';
  private query$ = new Subject<string>();
  private sub: Subscription;

  constructor() {
    this.sub = this.query$
      .pipe(
        debounceTime(450),
        switchMap((q) =>
          this.geo.search(q).pipe(
            catchError(() => {
              this.failed.set(true);
              return of([] as Place[]);
            }),
          ),
        ),
      )
      .subscribe((r) => {
        this.results.set(r);
        this.loading.set(false);
      });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onFocus(ev: Event): void {
    (ev.target as HTMLInputElement).select();
    this.open.set(true);
  }

  onBlur(): void {
    // Pequeña espera para que alcance a registrarse el clic en una opción
    setTimeout(() => {
      this.open.set(false);
      this.typing.set(false);
      this.text.set(this.committed);
    }, 200);
  }

  onInput(v: string): void {
    this.text.set(v);
    this.typing.set(true);
    this.open.set(true);
    if (v.trim().length >= 3) {
      this.failed.set(false);
      this.loading.set(true);
      this.query$.next(v.trim());
    }
  }

  pick(p: Place): void {
    this.committed = p.name;
    this.text.set(p.name);
    this.typing.set(false);
    this.open.set(false);
    this.picked.emit(p);
  }

  useGps(): void {
    this.open.set(false);
    this.gps.emit();
  }
}