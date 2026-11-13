/* eslint-disable @typescript-eslint/no-explicit-any */

/** Convierte un valor de la API (número o texto como "9200.00") en número */
export function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

/** Igual que num(), pero devuelve undefined cuando el campo no viene */
export function numOrUndef(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

/** Algunas respuestas vienen paginadas ({ data: [...] }) y otras como lista directa */
export function toList<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
}