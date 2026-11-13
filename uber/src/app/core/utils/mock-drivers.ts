/** Estado de aprobación de conductores en el modo simulado (useMock: true) */
const KEY = 'mock_driver_status';

export const APPROVAL_MESSAGES: Record<string, string> = {
  pending: 'Tu cuenta está pendiente de aprobación por un administrador.',
  suspended: 'Tu cuenta está suspendida (penalizada) por un administrador.',
  rejected: 'Tu cuenta fue rechazada por un administrador.',
};

export function getDriverStatusMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function setMockDriverStatus(id: number, status: string): void {
  const m = getDriverStatusMap();
  m[String(id)] = status;
  localStorage.setItem(KEY, JSON.stringify(m));
}

/** approved | pending | suspended | rejected */
export function mockApprovalFor(userId: number, userStatus?: string): string {
  const saved = getDriverStatusMap()[String(userId)];
  if (saved) return saved;
  return userStatus === 'pending' ? 'pending' : 'approved';
}