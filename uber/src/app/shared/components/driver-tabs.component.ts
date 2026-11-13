import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-driver-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabbar">
      <a routerLink="/driver/home" routerLinkActive="active"><span class="dot"></span>Inicio</a>
      <a routerLink="/driver/vehicles" routerLinkActive="active"><span class="dot"></span>Vehículos</a>
      <a routerLink="/driver/profile" routerLinkActive="active"><span class="dot"></span>Perfil</a>
    </nav>
  `,
})
export class DriverTabsComponent {}