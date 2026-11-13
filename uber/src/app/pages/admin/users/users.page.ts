import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, IonButton, IonContent, IonFooter, ToastController } from '@ionic/angular';
import { catchError, forkJoin, of } from 'rxjs';
import { AdminDriver } from '../../../core/models/admin.models';
import { AdminService } from '../../../core/services/admin.service';
import { AdminTabsComponent } from '../../../shared/components/admin-tabs.component';

type Filter = 'all' | 'drivers' | 'clients' | 'pending';
type Status = 'approved' | 'suspended' | 'rejected';

const TEXTS: Record<Status, { header: string; message: string; note: string }> = {
  approved: {
    header: 'Aprobar conductor',
    message: 'Podrá conectarse y recibir viajes.',
    note: 'Documentación verificada por el administrador.',
  },
  suspended: {
    header: 'Penalizar conductor',
    message: 'Quedará suspendido y no podrá recibir viajes.',
    note: 'Conductor penalizado por el administrador.',
  },
  rejected: {
    header: 'Rechazar conductor',
    message: 'Su cuenta quedará rechazada.',
    note: 'Conductor rechazado por el administrador.',
  },
};

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [IonContent, IonFooter, IonButton, AdminTabsComponent],
  templateUrl: './users.page.html',
})
export class UsersPage {
  private admin = inject(AdminService);
  private alert = inject(AlertController);
  private toast = inject(ToastController);
  private route = inject(ActivatedRoute);

  filter = signal<Filter>('all');
  search = signal('');
  drivers = signal<AdminDriver[]>([]);
  clientsTotal = signal(0);
  loading = signal(true);
  failed = signal(false);
  expanded = signal<number | null>(null);

  list = computed(() => {
    const f = this.filter();
    if (f === 'clients') return [];
    let l = this.drivers();
    if (f === 'pending') l = l.filter((d) => d.approval_status === 'pending');
    const q = this.search().trim().toLowerCase();
    if (q) {
      l = l.filter(
        (d) => d.user.name.toLowerCase().includes(q) || d.user.email.toLowerCase().includes(q),
      );
    }
    return l;
  });

  pendingCount = computed(() => this.drivers().filter((d) => d.approval_status === 'pending').length);

  ionViewWillEnter(): void {
    const f = this.route.snapshot.queryParamMap.get('filter');
    if (f === 'pending') this.filter.set('pending');
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      d: this.admin.drivers(),
      s: this.admin.dashboard().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ d, s }) => {
        this.drivers.set(d);
        this.clientsTotal.set(s?.stats.total_clients ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  toggle(id: number): void {
    this.expanded.set(this.expanded() === id ? null : id);
  }

  statusLabel(s: string): string {
    switch (s) {
      case 'approved': return 'Activo';
      case 'pending': return 'Pendiente';
      case 'suspended': return 'Penalizado';
      case 'rejected': return 'Rechazado';
      default: return s;
    }
  }

  statusClass(s: string): string {
    switch (s) {
      case 'approved': return 'active';
      case 'rejected': return 'danger';
      default: return 'warn';
    }
  }

  async change(d: AdminDriver, status: Status): Promise<void> {
    const t = TEXTS[status];
    const a = await this.alert.create({
      header: t.header,
      message: `${d.user.name}: ${t.message}`,
      inputs: [{ name: 'notes', type: 'textarea', placeholder: 'Notas del administrador (opcional)' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: (v: { notes?: string }) => {
            this.apply(d, status, v?.notes?.trim() || t.note);
          },
        },
      ],
    });
    await a.present();
  }

  private apply(d: AdminDriver, status: Status, notes: string): void {
    this.admin.setApproval(d.id, status, notes).subscribe({
      next: () => {
        this.drivers.set(
          this.drivers().map((x) => (x.id === d.id ? { ...x, approval_status: status } : x)),
        );
        this.show('Estado actualizado', 'success');
      },
      error: (e) => this.show(e.error?.message ?? 'No se pudo actualizar el conductor', 'danger'),
    });
  }

  private async show(message: string, color: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, color });
    t.present();
  }
}