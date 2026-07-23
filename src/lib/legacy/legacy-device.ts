/** Helpers de dispositivo seguros para cliente (sin dependencias de servidor). */

export function isMobileExportDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
