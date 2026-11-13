import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, ToastController } from '@ionic/angular';
import { Fare } from '../../../core/models/admin.models';
import { AdminService } from '../../../core/services/admin.service';
import { money } from '../../../core/utils/format';

@Component({
  selector: 'app-fares',
  standalone: true,
  imports: [IonContent, IonButton, ReactiveFormsModule, RouterLink],
  templateUrl: './fares.page.html',
})
export class FaresPage {
  private admin = inject(AdminService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastController);

  money = money;
  fares = signal<Fare[]>([]);
  loading = signal(true);
  failed = signal(false);
  showForm = signal(false);
  busy = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    base_fare: [4500, [Validators.required, Validators.min(0)]],
    price_per_km: [1500, [Validators.required, Validators.min(0)]],
    price_per_minute: [350, [Validators.required, Validators.min(0)]],
    minimum_fare: [8000, [Validators.required, Validators.min(0)]],
    surge_multiplier: [1, [Validators.required, Validators.min(1)]],
    active: [true],
  });

  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.admin.fares().subscribe({
      next: (l) => {
        this.fares.set(l);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.show('Completa todos los campos con valores válidos', 'danger');
      return;
    }
    const v = this.form.getRawValue();
    const body: Fare = {
      name: v.name.trim(),
      base_fare: Number(v.base_fare),
      price_per_km: Number(v.price_per_km),
      price_per_minute: Number(v.price_per_minute),
      minimum_fare: Number(v.minimum_fare),
      surge_multiplier: Number(v.surge_multiplier),
      active: v.active,
    };

    this.busy.set(true);
    this.admin.createFare(body).subscribe({
      next: () => {
        this.busy.set(false);
        this.showForm.set(false);
        this.form.patchValue({ name: '' });
        this.show('Tarifa configurada exitosamente', 'success');
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        const errs = e.error?.errors ? Object.values(e.error.errors).flat().join(' ') : '';
        this.show(errs || e.error?.message || 'No se pudo crear la tarifa', 'danger');
      },
    });
  }

  private async show(message: string, color: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3500, color });
    t.present();
  }
}