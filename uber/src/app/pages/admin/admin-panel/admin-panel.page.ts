import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController, IonButton, IonContent, IonFooter } from '@ionic/angular';
import { AdminStats } from '../../../core/models/admin.models';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { money } from '../../../core/utils/format';
import { AdminTabsComponent } from '../../../shared/components/admin-tabs.component';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [IonContent, IonFooter, IonButton, RouterLink, AdminTabsComponent],
  templateUrl: './admin-panel.page.html',
})
export class AdminPanelPage {
  auth = inject(AuthService);
  private admin = inject(AdminService);
  private alert = inject(AlertController);

  money = money;
  stats = signal<AdminStats | null>(null);
  pendingComplaints = signal(0);
  failed = signal(false);

  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    this.failed.set(false);
    this.admin.dashboard().subscribe({
      next: (r) => {
        this.stats.set(r.stats);
        this.pendingComplaints.set(r.incidents.filter((i) => !this.admin.isResolved(i.key)).length);
      },
      error: (e) => {
  console.error('Dashboard falló:', e.status, e.error ?? e);
  this.failed.set(true);
},
    });
  }

  usersTotal(): number {
    const s = this.stats();
    return s ? s.total_clients + s.total_drivers : 0;
  }

  initial(): string {
    return (this.auth.user()?.name ?? 'A').charAt(0).toUpperCase();
  }

  async askLogout(): Promise<void> {
    const a = await this.alert.create({
      header: 'Cerrar sesión',
      message: '¿Quieres salir del panel de moderación?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Salir', role: 'destructive', handler: () => this.auth.logout() },
      ],
    });
    await a.present();
  }
}