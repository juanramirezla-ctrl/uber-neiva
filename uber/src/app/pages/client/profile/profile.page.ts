import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonFooter } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { ClientTabsComponent } from '../../../shared/components/client-tabs.component'; // Ajusta la ruta si se llama diferente

@Component({
  selector: 'app-client-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonFooter,
    ClientTabsComponent
  ],
})
export class ProfilePage implements OnInit {
  public auth = inject(AuthService);

  constructor() {}

  ngOnInit(): void {}
}