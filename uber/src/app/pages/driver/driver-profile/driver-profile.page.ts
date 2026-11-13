import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// Agregamos IonButton y IonFooter que faltaban
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonFooter } from '@ionic/angular'; 
// Importamos tu servicio y tabs (ajusta la ruta si es diferente)
import { AuthService } from '../../../core/services/auth.service';
import { DriverService } from '../../../core/services/driver.service';
import { DriverTabsComponent } from '../../../shared/components/driver-tabs.component';
import { session } from '../../../core/utils/session';

@Component({
  selector: 'app-driver-profile',
  templateUrl: './driver-profile.page.html',
  styleUrls: ['./driver-profile.page.scss'],
  standalone: true, // IMPORTANTE: Falta esta línea si usas el arreglo 'imports'
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, 
    IonButton, IonFooter, // Se agregan aquí
    CommonModule, FormsModule,
    DriverTabsComponent   // Se agrega para que reconozca <app-driver-tabs>
  ],
})
export class DriverProfilePage implements OnInit {
  // Aquí declaramos 'auth' para que el HTML pueda usar auth.user() y auth.logout()
  public auth = inject(AuthService);
    private driver = inject(DriverService);

  /** Al salir, el conductor queda desconectado también en el servidor */
  logout(): void {
    const leave = () => this.auth.logout();
    if (session.getItem('driver_online') === '1') {
      this.driver.setAvailability(false).subscribe({ complete: leave, error: leave });
    } else {
      leave();
    }
  }

  constructor() {}

  ngOnInit() {}
}