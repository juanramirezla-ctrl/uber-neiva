export function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export function dateLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}