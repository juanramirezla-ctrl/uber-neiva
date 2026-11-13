import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-client-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabbar">
      <a routerLink="/client/home" routerLinkActive="active"><span class="dot"></span>Inicio</a>
      <a routerLink="/client/history" routerLinkActive="active"><span class="dot"></span>Historial</a>
      <a routerLink="/client/profile" routerLinkActive="active"><span class="dot"></span>Perfil</a>
    </nav>
  `,
})
export class ClientTabsComponent {}