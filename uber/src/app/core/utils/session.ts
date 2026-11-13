import { environment } from '../../../environments/environment';

/**
 * Dónde se guarda la sesión (token, usuario, viaje en curso del conductor).
 * - Modo simulado: sessionStorage -> cada pestaña tiene su propia sesión.
 * - Con el backend real: localStorage, igual que antes.
 */
export const session: Storage = environment.useMock ? sessionStorage : localStorage;