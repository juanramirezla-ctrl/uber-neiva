import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subject, Subscription, catchError, debounceTime, of, switchMap } from 'rxjs';
import { PLACES, distanceKm, getRecents } from '../../core/data/places';
import { Place } from '../../core/models/models';
import { GeoService } from '../../core/services/geo.service';

type Field = 'origin' | 'destination';

@Component({
  selector: 'app-trip-planner',
  standalone: true,
  template: `
    <div class="wrap">
      <div class="top">
        <button type="button" class="back" (click)="closed.emit()">‹</button>
        <b>Planifica tu viaje</b>
      </div>

      <div class="box">
        <div class="icons"><span class="dot"></span><span class="line"></span><span class="sq"></span></div>
        <div class="fields">
          <input
            #originInput
            class="pinput"
            [class.on]="active() === 'origin'"
            placeholder="Origen"
            autocomplete="off"
            [value]="originText()"
            (focus)="onFocus('origin', $event)"
            (input)="onInput('origin', $any($event.target).value)"
          />
          <input
            #destInput
            class="pinput"
            [class.on]="active() === 'destination'"
            placeholder="¿A dónde vas?"
            autocomplete="off"
            [value]="destText()"
            (focus)="onFocus('destination', $event)"
            (input)="onInput('destination', $any($event.target).value)"
          />
        </div>
      </div>

      <div class="list">
        @if (showSearch()) {
          @if (loading()) {
            <div class="empty">Buscando…</div>
          } @else if (failed()) {
            <div class="empty">
              No se pudo buscar (revisa tu internet). Usa un lugar frecuente o elígelo en el mapa.
            </div>
          } @else {
            @for (p of results(); track $index) {
              <button type="button" class="item" (click)="pick(p)">
                <span class="ico"></span>
                <span class="txt">
                  <b>{{ p.name }}</b>
                  @if (p.subtitle) {
                    <small>{{ p.subtitle }}</small>
                  }
                </span>
                @if (km(p); as k) {
                  <span class="km">{{ k }} km</span>
                }
              </button>
            } @empty {
              <div class="empty">Sin resultados. Prueba otro nombre o elígelo en el mapa.</div>
            }
          }
        } @else {
          @if (active() === 'origin') {
            <button type="button" class="item" (click)="gps.emit()">
              <span class="ico"></span>
              <span class="txt"><b>Mi ubicación actual</b><small>Usar el GPS</small></span>
            </button>
          }
          <button type="button" class="item" (click)="pickOnMap.emit(active())">
            <span class="ico"></span>
            <span class="txt"><b>Elegir en el mapa</b><small>Toca cualquier punto de Neiva</small></span>
          </button>

          @if (recents.length) {
            <div class="head">Recientes</div>
            @for (p of recents; track p.name) {
              <button type="button" class="item" (click)="pick(p)">
                <span class="ico"></span>
                <span class="txt"><b>{{ p.name }}</b></span>
                @if (km(p); as k) {
                  <span class="km">{{ k }} km</span>
                }
              </button>
            }
          }

          <div class="head">Lugares frecuentes</div>
          @for (p of frequent; track p.name) {
            <button type="button" class="item" (click)="pick(p)">
              <span class="ico"></span>
              <span class="txt"><b>{{ p.name }}</b></span>
              @if (km(p); as k) {
                <span class="km">{{ k }} km</span>
              }
            </button>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host { position: absolute; inset: 0; z-index: 1000; background: #fff; display: flex; flex-direction: column; padding-top: env(safe-area-inset-top, 0px); }
      .wrap { width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; flex: 1; min-height: 0; }
      .top { display: flex; align-items: center; gap: 10px; padding: 12px 16px; font-size: 17px; }
      .back { background: none; border: 0; font-size: 32px; line-height: 1; cursor: pointer; padding: 0 8px 4px 0; color: #111; }
      .box { display: flex; gap: 12px; border: 1.5px solid #111; border-radius: 12px; padding: 10px 12px; margin: 0 16px; }
      .icons { display: flex; flex-direction: column; align-items: center; padding: 14px 0; }
      .dot { width: 10px; height: 10px; border-radius: 50%; background: #1fc16b; }
      .line { width: 2px; flex: 1; background: #bbb; margin: 3px 0; }
      .sq { width: 10px; height: 10px; background: #111; }
      .fields { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .pinput { width: 100%; border: 0; background: #f1f2f4; border-radius: 8px; padding: 10px 12px; font: inherit; font-size: 14px; color: #111; outline: none; }
      .pinput.on { background: #fff; box-shadow: inset 0 0 0 1.5px #111; }
      .list { flex: 1; overflow-y: auto; padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px)); }
      .item { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: none; border: 0; border-bottom: 1px solid #f0f0f0; padding: 12px 4px; cursor: pointer; font: inherit; color: #111; }
      .ico { width: 32px; height: 32px; border-radius: 50%; background: #eef0f2; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
      .ico::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background: #777; }
      .txt { flex: 1; min-width: 0; }
      .txt b { display: block; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .txt small { display: block; color: #888; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .km { font-size: 12px; color: #888; flex-shrink: 0; }
      .head { padding: 14px 4px 4px; font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; }
      .empty { padding: 14px 4px; font-size: 13px; color: #888; }
    `,
  ],
})
export class TripPlannerComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private geo = inject(GeoService);

  @Input() origin: Place | null = null;
  @Input() destination: Place | null = null;
  @Input() startField: Field = 'destination';

  @Output() picked = new EventEmitter<{ field: Field; place: Place }>();
  @Output() gps = new EventEmitter<void>();
  @Output() pickOnMap = new EventEmitter<Field>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('originInput') originInput!: ElementRef<HTMLInputElement>;
  @ViewChild('destInput') destInput!: ElementRef<HTMLInputElement>;

  active = signal<Field>('destination');
  originText = signal('');
  destText = signal('');
  typing = signal(false);
  loading = signal(false);
  failed = signal(false);
  results = signal<Place[]>([]);

  recents: Place[] = getRecents();
  frequent = PLACES;

  showSearch = computed(() => {
    const t = this.active() === 'origin' ? this.originText() : this.destText();
    return this.typing() && t.trim().length >= 3;
  });

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

  ngOnInit(): void {
    this.active.set(this.startField);
  }

  ngOnChanges(): void {
    if (!this.typing()) {
      this.originText.set(this.origin?.name ?? '');
      this.destText.set(this.destination?.name ?? '');
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.focusField(this.active()), 150);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onFocus(field: Field, ev: Event): void {
    this.active.set(field);
    this.typing.set(false);
    this.results.set([]);
    (ev.target as HTMLInputElement).select();
  }

  onInput(field: Field, v: string): void {
    this.active.set(field);
    if (field === 'origin') this.originText.set(v);
    else this.destText.set(v);

    this.typing.set(true);
    if (v.trim().length >= 3) {
      this.failed.set(false);
      this.loading.set(true);
      this.query$.next(v.trim());
    } else {
      this.results.set([]);
    }
  }

  pick(p: Place): void {
    const field = this.active();
    if (field === 'origin') this.originText.set(p.name);
    else this.destText.set(p.name);

    this.typing.set(false);
    this.results.set([]);
    this.picked.emit({ field, place: p });

    if (field === 'origin' && !this.destination) {
      this.active.set('destination');
      setTimeout(() => this.focusField('destination'), 50);
    }
  }

  km(p: Place): number | null {
    if (this.active() !== 'destination' || !this.origin) return null;
    return Math.round(distanceKm(this.origin, p) * 10) / 10;
  }

  private focusField(f: Field): void {
    const el = f === 'origin' ? this.originInput : this.destInput;
    el?.nativeElement.focus();
  }
}