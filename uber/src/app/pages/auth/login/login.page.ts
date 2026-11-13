import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton, IonInput, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, IonButton, IonInput, ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private toast = inject(ToastController);

  loading = false;

  form = this.fb.nonNullable.group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    const { login, password } = this.form.getRawValue();

    this.auth.login(login, password).subscribe({
      next: (r) => {
        this.loading = false;
        this.auth.goHome(r.user.role);
      },
      error: async (e) => {
        this.loading = false;
        const t = await this.toast.create({
          message: e.error?.message ?? 'No se pudo conectar con el servidor',
          duration: 3000,
          color: 'danger',
        });
        t.present();
      },
    });
  }
}