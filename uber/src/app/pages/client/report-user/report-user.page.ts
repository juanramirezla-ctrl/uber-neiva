import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, ToastController } from '@ionic/angular';
import { TripItem } from '../../../core/models/models';
import { ClientService } from '../../../core/services/client.service';
import { dateLabel } from '../../../core/utils/format';

@Component({
  selector: 'app-report-user',
  standalone: true,
  imports: [IonContent, IonButton, ReactiveFormsModule, RouterLink],
  templateUrl: './report-user.page.html',
})
export class ReportUserPage {
  private fb = inject(FormBuilder);
  private client = inject(ClientService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastController);

  dateLabel = dateLabel;
  motives = [
    'Conducción imprudente',
    'Cobro excesivo por el viaje',
    'Mal trato o falta de respeto',
    'Vehículo en mal estado o sucio',
    'Otro',
  ];

  trips = signal<TripItem[]>([]);
  tripId = signal<number | null>(null);
  stars = signal(3);
  busy = signal(false);
  loading = signal(true);

  current = computed(() => this.trips().find((t) => t.id === this.tripId()) ?? null);

  form = this.fb.nonNullable.group({
    motive: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
  });

  ionViewWillEnter(): void {
    const wanted = Number(this.route.snapshot.queryParamMap.get('trip'));
    this.loading.set(true);
    this.client.trips().subscribe({
      next: (t) => {
        this.trips.set(t);
        this.tripId.set(t.some((x) => x.id === wanted) ? wanted : (t[0]?.id ?? null));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  initial(t: TripItem | null): string {
    return (t?.driver?.user.name ?? 'C').charAt(0).toUpperCase();
  }

  submit(): void {
    const id = this.tripId();
    if (!id) {
      this.show('Elige el viaje que quieres reportar', 'danger');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.show('Elige un motivo y cuéntanos qué ocurrió (mínimo 10 caracteres)', 'danger');
      return;
    }

    const v = this.form.getRawValue();
    const comment = `Motivo: ${v.motive}\nDescripción: ${v.description.trim()}`;

    this.busy.set(true);
    // El API registra las quejas como una calificación con incidencia
    this.client.rate(id, this.stars(), comment, true).subscribe({
      next: () => {
        this.busy.set(false);
        this.show('Queja enviada. El administrador la revisará.', 'success');
        this.router.navigateByUrl('/client/history');
      },
      error: (e) => {
        this.busy.set(false);
        const errs = e.error?.errors ? Object.values(e.error.errors).flat().join(' ') : '';
        this.show(errs || e.error?.message || 'No se pudo enviar la queja', 'danger');
      },
    });
  }

  private async show(message: string, color: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3500, color });
    t.present();
  }
}