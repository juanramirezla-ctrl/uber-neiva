import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { flash, getVehicles, setVehicles } from '../../../core/utils/vehicle-store';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [IonContent, IonButton, ReactiveFormsModule, RouterLink],
  templateUrl: './vehicle-form.page.html',
})
export class VehicleFormPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastController);

  editingId: number | null = null;

  form = this.fb.nonNullable.group({
    brand: ['', Validators.required],
    model: ['', Validators.required],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1990), Validators.max(2100)]],
    plate: ['', [Validators.required, Validators.minLength(5)]],
    color: ['', Validators.required],
    active: [false],
  });

  ionViewWillEnter(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('id'));
    const uid = this.auth.user()?.id;
    this.editingId = id || null;

    if (id && uid) {
      const v = getVehicles(uid).find((x) => x.id === id);
      if (v) {
        this.form.setValue({
          brand: v.brand,
          model: v.model,
          year: v.year,
          plate: v.plate,
          color: v.color,
          active: v.active,
        });
        return;
      }
    }
    this.form.reset({ brand: '', model: '', year: new Date().getFullYear(), plate: '', color: '', active: false });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return this.show('Completa todos los campos (placa mínimo 5 caracteres)');
    }
    const uid = this.auth.user()?.id;
    if (!uid) return;

    const v = this.form.getRawValue();
    const plate = v.plate.trim().toUpperCase();
    let list = getVehicles(uid);

    if (list.some((x) => x.plate === plate && x.id !== this.editingId)) {
      return this.show('Ya tienes un vehículo con esa placa');
    }

    const data = {
      brand: v.brand.trim(),
      model: v.model.trim(),
      year: Number(v.year),
      plate,
      color: v.color.trim(),
    };

    if (this.editingId) {
      list = list.map((x) => (x.id === this.editingId ? { ...x, ...data, active: v.active } : x));
    } else {
      const id = Math.max(0, ...list.map((x) => x.id)) + 1;
      list = [...list, { id, ...data, active: v.active || list.length === 0 }];
    }

    // Solo un vehículo activo a la vez
    const savedId = this.editingId ?? Math.max(...list.map((x) => x.id));
    if (v.active) list = list.map((x) => ({ ...x, active: x.id === savedId }));
    if (!list.some((x) => x.active)) list[0].active = true;

    setVehicles(uid, list);
    flash.saved = true;
    this.router.navigateByUrl('/driver/vehicles');
  }

  cancel(): void {
    this.router.navigateByUrl('/driver/vehicles');
  }

  private async show(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, color: 'danger' });
    t.present();
  }
}