import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonButton, IonContent, IonFooter } from '@ionic/angular';
import { Vehicle } from '../../../core/models/models';
import { AuthService } from '../../../core/services/auth.service';
import { flash, getVehicles, setVehicles } from '../../../core/utils/vehicle-store';
import { DriverTabsComponent } from '../../../shared/components/driver-tabs.component';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [IonContent, IonFooter, IonButton, DriverTabsComponent],
  templateUrl: './vehicles.page.html',
})
export class VehiclesPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private alert = inject(AlertController);

  vehicles = signal<Vehicle[]>([]);
  saved = signal(false);

  ionViewWillEnter(): void {
    this.reload();
    if (flash.saved) {
      flash.saved = false;
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    }
  }

  add(): void {
    this.router.navigateByUrl('/driver/vehicle-form');
  }

  edit(v: Vehicle): void {
    this.router.navigate(['/driver/vehicle-form'], { queryParams: { id: v.id } });
  }

  async remove(v: Vehicle): Promise<void> {
    const a = await this.alert.create({
      header: 'Eliminar vehículo',
      message: `¿Eliminar ${v.brand} ${v.model} (${v.plate})?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.doRemove(v) },
      ],
    });
    await a.present();
  }

  private doRemove(v: Vehicle): void {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    const list = getVehicles(uid).filter((x) => x.id !== v.id);
    if (list.length && !list.some((x) => x.active)) list[0].active = true;
    setVehicles(uid, list);
    this.reload();
  }

  private reload(): void {
    const uid = this.auth.user()?.id;
    this.vehicles.set(uid ? getVehicles(uid) : []);
  }
}