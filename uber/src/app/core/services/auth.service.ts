import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, delay, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, Role, User } from '../models/models';
import { seedVehicle } from '../utils/vehicle-store';
import { session } from '../utils/session';

// Usuarios de prueba para el modo simulado (cualquier contraseña sirve)
const MOCK_USERS: User[] = [
  { id: 1, name: 'Laura Gómez', email: 'cliente@uber.com', phone: '3001112233', role: 'client', status: 'active' },
  { id: 2, name: 'Carlos Pérez', email: 'conductor@uber.com', phone: '3002223344', role: 'driver', status: 'active' },
  { id: 3, name: 'Administrador', email: 'admin@uber.com', phone: '3003334455', role: 'admin', status: 'active' },
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = environment.apiUrl;
  private mock = environment.useMock;

  user = signal<User | null>(this.restoreSession());

  /** Una sesión creada en modo simulado no sirve con el backend real (y al revés): se descarta */
  private restoreSession(): User | null {
    const modeNow = environment.useMock ? 'mock' : 'real';
    const modeSaved = session.getItem('session_mode');
    const fakeToken = session.getItem('token') === 'mock-token';
    if (modeSaved !== modeNow || (!environment.useMock && fakeToken)) {
      ['token', 'user', 'driver_online', 'driver_active', 'session_mode'].forEach((k) =>
        session.removeItem(k),
      );
      return null;
    }
    return JSON.parse(session.getItem('user') ?? 'null');
  }

  get token(): string | null {
    return session.getItem('token');
  }

  login(login: string, password: string): Observable<AuthResponse> {
    if (this.mock) {
      const saved = JSON.parse(localStorage.getItem('mock_users') ?? '[]') as User[];
      const u = [...MOCK_USERS, ...saved].find((x) => x.email === login || x.phone === login);
      if (!u) {
        return throwError(() => ({ error: { message: 'Usuario no encontrado (modo simulado)' } }));
      }
      return of(this.mockResponse(u)).pipe(delay(500), tap((r) => this.save(r)));
    }
    return this.http
      .post<AuthResponse>(`${this.api}/auth/login`, { login, password })
      .pipe(tap((r) => this.save(r)));
  }

  register(body: any): Observable<AuthResponse> {
    if (this.mock) {
      const saved = JSON.parse(localStorage.getItem('mock_users') ?? '[]') as User[];
      const u: User = {
        id: Date.now(),
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: body.role,
        status: body.role === 'driver' ? 'pending' : 'active',
      };
      localStorage.setItem('mock_users', JSON.stringify([...saved, u]));
      if (body.role === 'driver') seedVehicle(u.id, body);
      return of(this.mockResponse(u)).pipe(delay(500), tap((r) => this.save(r)));
    }
    return this.http.post<AuthResponse>(`${this.api}/auth/register`, body).pipe(
      tap((r) => {
        this.save(r);
        if (body.role === 'driver') seedVehicle(r.user.id, body);
      }),
    );
  }

  logout(): void {
    if (this.mock) {
      this.clear();
      return;
    }
    this.http.post(`${this.api}/auth/logout`, {}).subscribe({
      complete: () => this.clear(),
      error: () => this.clear(),
    });
  }

  goHome(role: Role): void {
    const routes: Record<Role, string> = {
      client: '/client/home',
      driver: '/driver/home',
      admin: '/admin/panel',
    };
    this.router.navigateByUrl(routes[role], { replaceUrl: true });
  }

  private mockResponse(user: User): AuthResponse {
    return {
      success: true,
      message: 'Modo simulado',
      access_token: 'mock-token',
      token_type: 'bearer',
      expires_in: 3600,
      user,
    };
  }

  private save(r: AuthResponse): void {
    // Una sesión nueva siempre empieza desconectada y sin viaje en curso
    session.removeItem('driver_online');
    session.removeItem('driver_active');
    session.setItem('session_mode', environment.useMock ? 'mock' : 'real');
    session.setItem('token', r.access_token);
    session.setItem('user', JSON.stringify(r.user));
    this.user.set(r.user);
  }

  private clear(): void {
    ['token', 'user', 'driver_online', 'driver_active', 'session_mode'].forEach((k) => session.removeItem(k));
    this.user.set(null);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}