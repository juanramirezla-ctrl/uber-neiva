import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AdminService } from '../../../core/services/admin.service';
import { dateLabel, money } from '../../../core/utils/format';

type Kind = 'trips' | 'reports' | 'audit-logs';
interface Field {
  label: string;
  value: string;
}

const TITLES: Record<Kind, string> = {
  trips: 'Viajes',
  reports: 'Reportes',
  'audit-logs': 'Auditoría',
};

const STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados' },
  { value: 'in_progress', label: 'En curso' },
];

function human(k: string): string {
  const t = k.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function fmt(key: string, v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return /fare|revenue|amount|price/i.test(key) ? money(v) : String(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? dateLabel(s) : s;
}

/** Aplana un objeto en pares etiqueta/valor (solo valores simples) */
function flat(o: unknown, prefix = '', depth = 3): Field[] {
  const out: Field[] = [];
  if (o === null || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    const path = prefix ? `${prefix} ${k}` : k;
    if (typeof v === 'object') {
      if (depth > 0 && !Array.isArray(v)) out.push(...flat(v, path, depth - 1));
      continue;
    }
    out.push({ label: human(path), value: fmt(k, v) });
  }
  return out;
}

@Component({
  selector: 'app-data',
  standalone: true,
  imports: [IonContent, RouterLink],
  templateUrl: './data.page.html',
})
export class DataPage {
  private admin = inject(AdminService);
  private route = inject(ActivatedRoute);

  kind: Kind = 'trips';
  title = TITLES.trips;
  statuses = STATUSES;
  status = signal('');
  summary = signal<Field[]>([]);
  rows = signal<Field[][]>([]);
  loading = signal(true);
  failed = signal(false);

  ionViewWillEnter(): void {
    const k = this.route.snapshot.paramMap.get('kind');
    this.kind = (k === 'reports' || k === 'audit-logs' ? k : 'trips') as Kind;
    this.title = TITLES[this.kind];
    this.load();
  }

  setStatus(s: string): void {
    this.status.set(s);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    const st = this.kind === 'trips' && this.status() ? this.status() : undefined;
    this.admin.list(this.kind, st).subscribe({
      next: (res) => {
        this.parse(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  private parse(res: unknown): void {
    const root = (res ?? {}) as Record<string, unknown>;
    let rows: unknown[] = [];
    const rest: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(root)) {
      if (k === 'success' || k === 'message') continue;
      let arr: unknown[] | null = null;
      if (Array.isArray(v)) arr = v;
      else if (v && typeof v === 'object' && Array.isArray((v as { data?: unknown }).data)) {
        arr = (v as { data: unknown[] }).data;
      }
      if (arr && rows.length === 0) rows = arr;
      else rest[k] = v;
    }

    this.rows.set(rows.slice(0, 60).map((r) => flat(r)));
    this.summary.set(flat(rest));
  }
}