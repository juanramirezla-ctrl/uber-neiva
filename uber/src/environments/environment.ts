// ============================================================
//  CONFIGURACIÓN DEL BACKEND
//  - Sin backend:  useMock: true   (todo simulado en la app)
//  - Con backend:  useMock: false  y apiUrl = IP:puerto del servidor
// ============================================================
export const environment = {
  apiUrl: 'http://20.20.1.22:8000/api',
  useMock: true,
};
