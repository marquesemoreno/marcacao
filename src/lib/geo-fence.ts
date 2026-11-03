/** Cerca da clínica pro QR de chegada: o celular manda a localização, o servidor confere.
 * (Dá pra falsificar o GPS, mas impede o caso comum de pegar senha de casa.) */

export type Point = { lat: number; lng: number };

export function distanceMeters(a: Point, b: Point): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Precisão do GPS conta a favor (até 200 m) — dentro de prédio o erro é grande. */
export const MAX_ACCURACY_BONUS_M = 200;

export function isInsideFence(fence: Point & { radiusM: number }, pos: Point & { accuracy: number }): boolean {
  if (![pos.lat, pos.lng, pos.accuracy].every(Number.isFinite)) return false;
  const bonus = Math.min(Math.max(pos.accuracy, 0), MAX_ACCURACY_BONUS_M);
  return distanceMeters(fence, pos) <= fence.radiusM + bonus;
}
