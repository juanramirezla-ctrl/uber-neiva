import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabbar">
      <a routerLink="/admin/panel" routerLinkActive="active"><span class="dot"></span>Panel</a>
      <a routerLink="/admin/users" routerLinkActive="active"><span class="dot"></span>Usuarios</a>
      <a routerLink="/admin/complaints" routerLinkActive="active"><span class="dot"></span>Quejas</a>
    </nav>
  `,
})
export class AdminTabsComponent {}