import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register/register.page').then((m) => m.RegisterPage),
  },

  // ---------- Pasajero ----------
  {
    path: 'client',
    canActivate: [roleGuard('client')],
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/client/client-home/client-home.page').then((m) => m.ClientHomePage),
      },
      {
        path: 'history',
        loadComponent: () => import('./pages/client/history/history.page').then((m) => m.HistoryPage),
      },
            {
        path: 'report-user',
        loadComponent: () =>
          import('./pages/client/report-user/report-user.page').then((m) => m.ReportUserPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/client/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },

  // ---------- Conductor ----------
  {
    path: 'driver',
    canActivate: [roleGuard('driver')],
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/driver/driver-home/driver-home.page').then((m) => m.DriverHomePage),
      },
      {
        path: 'vehicles',
        loadComponent: () =>
          import('./pages/driver/vehicles/vehicles.page').then((m) => m.VehiclesPage),
      },
      {
        path: 'vehicle-form',
        loadComponent: () =>
          import('./pages/driver/vehicle-form/vehicle-form.page').then((m) => m.VehicleFormPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/driver/driver-profile/driver-profile.page').then(
            (m) => m.DriverProfilePage,
          ),
      },
    ],
  },

  // ---------- Administrador ----------
  {
    path: 'admin',
    canActivate: [roleGuard('admin')],
    children: [
      {
        path: 'panel',
        loadComponent: () =>
          import('./pages/admin/admin-panel/admin-panel.page').then((m) => m.AdminPanelPage),
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/admin/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'complaints',
        loadComponent: () =>
          import('./pages/admin/complaints/complaints.page').then((m) => m.ComplaintsPage),
      },
      {
        path: 'complaints/:key',
        loadComponent: () =>
          import('./pages/admin/complaint-detail/complaint-detail.page').then(
            (m) => m.ComplaintDetailPage,
          ),
      },
      {
        path: 'fares',
        loadComponent: () => import('./pages/admin/fares/fares.page').then((m) => m.FaresPage),
      },
      {
        path: 'data/:kind',
        loadComponent: () => import('./pages/admin/data/data.page').then((m) => m.DataPage),
      },
    ],
  },

  // Siempre al final
  { path: '**', redirectTo: 'login' },
];