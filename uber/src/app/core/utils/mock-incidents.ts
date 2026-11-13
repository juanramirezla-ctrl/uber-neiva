import { Incident } from '../models/admin.models';

/** Quejas enviadas por pasajeros en el modo simulado (useMock: true) */
const KEY = 'mock_incidents';

export function getMockIncidents(): Incident[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Incident[];
  } catch {
    return [];
  }
}

export function addMockIncident(i: {
  reporter: string;
  reported: string;
  reportedDriverId: number | null;
  motive: string;
  detail: string;
}): void {
  const list = getMockIncidents();
  const id = Math.max(100, ...list.map((x) => Number(x.id) || 0)) + 1;
  const next: Incident = { ...i, key: String(id), id, date: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify([next, ...list]));
}