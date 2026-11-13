import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AlertController, IonButton, IonContent, ToastController } from '@ionic/angular';
import { Incident } from '../../../core/models/admin.models';
import { AdminService } from '../../../core/services/admin.service';
import { dateLabel } from '../../../core/utils/format';

@Component({
  selector: 'app-complaint-detail',
  standalone: true,
  imports: [IonContent, IonButton, RouterLink],
  templateUrl: './complaint-detail.page.html',
})
export class ComplaintDetailPage {
  private admin = inject(AdminService);
  private route = inject(ActivatedRoute);
  private alert = inject(AlertController);
  private toast = inject(ToastController);

  dateLabel = dateLabel;
  inc = signal<Incident | null>(null);
  done = signal(false);
  loading = signal(true);
  busy = signal(false);

  ionViewWillEnter(): void {
    const key = this.route.snapshot.paramMap.get('key') ?? '';
    this.loading.set(true);
    this.admin.incident(key).subscribe({
      next: (i) => {
        this.inc.set(i);
        this.done.set(i ? this.admin.isResolved(i.key) : false);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  async penalize(): Promise<void> {
    const i = this.inc();
    if (!i) return;
    const a = await this.alert.create({
      header: 'Penalizar usuario',
      message: `${i.reported} quedará suspendido y no podrá recibir viajes.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Penalizar', handler: () => this.sanction(i, 'suspended', `Penalizado por la queja #${i.id}`) },
      ],
    });
    await a.present();
  }

  async remove(): Promise<void> {
    const i = this.inc();
    if (!i) return;
    const a = await this.alert.create({
      header: 'Eliminar usuario',
      message: `¿Seguro que quieres eliminar a ${i.reported}? Su cuenta quedará dada de baja (estado rechazado).`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => this.sanction(i, 'rejected', `Cuenta eliminada por la queja #${i.id}`),
        },
      ],
    });
    await a.present();
  }

  resolve(): void {
    const i = this.inc();
    if (!i) return;
    this.admin.markResolved(i.key);
    this.done.set(true);
    this.show('Queja marcada como resuelta', 'success');
  }

  private sanction(i: Incident, status: string, notes: string): void {
    this.busy.set(true);
    const run = (id: number) =>
      this.admin.setApproval(id, status, notes).subscribe({
        next: () => {
          this.busy.set(false);
          this.admin.markResolved(i.key);
          this.done.set(true);
          this.show('Acción aplicada y queja resuelta', 'success');
        },
        error: (e) => {
          this.busy.set(false);
          this.show(e.error?.message ?? 'No se pudo aplicar la acción', 'danger');
        },
      });

    if (i.reportedDriverId != null) {
      run(i.reportedDriverId);
      return;
    }
    // Si la queja no trae el id del conductor, lo buscamos por nombre
    this.admin.findDriverId(i.reported).subscribe({
      next: (id) => {
        if (id == null) {
          this.busy.set(false);
          this.show('No se pudo identificar al conductor reportado', 'danger');
        } else {
          run(id);
        }
      },
      error: () => {
        this.busy.set(false);
        this.show('No se pudo identificar al conductor reportado', 'danger');
      },
    });
  }

  private async show(message: string, color: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, color });
    t.present();
  }
}