/**
 * Guard puro para evitar descargas concurrentes / doble clic.
 * Testeable sin DOM.
 */
export function createDownloadGuard() {
  let busy = false;

  return {
    tryStart(): boolean {
      if (busy) return false;
      busy = true;
      return true;
    },
    finish(): void {
      busy = false;
    },
    get isBusy(): boolean {
      return busy;
    },
  };
}
