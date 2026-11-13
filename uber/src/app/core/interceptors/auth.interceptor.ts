import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Solo para nuestro backend; los servicios externos pasan sin tocar
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const auth = inject(AuthService);
  const token = auth.token;

  const cloned = req.clone({
    setHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // La sesión solo se cierra con el botón "Cerrar sesión": un 401 aislado
  // (p. ej. al recargar) no debe sacar al usuario de la app.
  return next(cloned).pipe(
    timeout(15000),
    catchError((err) => throwError(() => err)),
  );
};
