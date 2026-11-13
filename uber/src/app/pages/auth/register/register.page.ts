import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton, IonInput, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [IonContent, IonButton, IonInput, ReactiveFormsModule, RouterLink],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastController);

  loading = false;
  role: 'client' | 'driver' = 'client';

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    // Solo conductor
    license_number: [''],
    plate: [''],
    brand: [''],
    model: [''],
    year: [new Date().getFullYear()],
    capacity: [4],
    color: [''],
  });

  setRole(r: 'client' | 'driver') {
    this.role = r;
  }

  async submit() {
    const v = this.form.getRawValue();

    if (this.form.controls.name.invalid || this.form.controls.email.invalid ||
        this.form.controls.phone.invalid || this.form.controls.password.invalid) {
      this.form.markAllAsTouched();
      return this.show('Revisa los datos (contraseña mínimo 8 caracteres)', 'danger');
    }

    let body: any = {
      name: v.name, email: v.email, phone: v.phone, password: v.password, role: this.role,
    };

    if (this.role === 'driver') {
      if (!v.license_number || !v.plate || !v.brand || !v.model || !v.color) {
        return this.show('Completa los datos de licencia y vehículo', 'danger');
      }
      body = {
        ...body,
        license_number: v.license_number, plate: v.plate, brand: v.brand,
        model: v.model, year: Number(v.year), capacity: Number(v.capacity), color: v.color,
      };
    }

    this.loading = true;
    this.auth.register(body).subscribe({
      next: async (r) => {
        this.loading = false;
        if (r.user.role === 'driver') {
          await this.show('Cuenta creada. Un administrador debe aprobarte para conectarte.', 'success');
        }
        this.auth.goHome(r.user.role);
      },
      error: (e) => {
        this.loading = false;
        const errors = e.error?.errors ? Object.values(e.error.errors).flat().join(' ') : '';
        this.show(errors || e.error?.message || 'No se pudo registrar', 'danger');
      },
    });
  }

  private async show(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 3500, color });
    t.present();
  }
}