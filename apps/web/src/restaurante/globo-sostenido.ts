import { MS_PARA_MANTENER, seAlejo } from './portal-mesero/pulsacion-larga';

/**
 * MANTENER PRESIONADO UN GLOBO DE SOLICITUD (DP-13.4) · la decisión, sin React.
 *
 * Tocar un globo atiende la solicitud. Mantenerlo presionado hace LO MISMO (y no abre el menú de
 * la mesa que hay debajo, que es lo que pasaba): al cumplirse el tiempo de «mantener», atiende
 * sin esperar a que el dedo se levante. Si el dedo se desliza (era un desplazamiento) o el
 * navegador cancela el gesto, no se atiende. Y el clic que llega al soltar —en el ratón; en el
 * tacto a veces no llega— ya no atiende otra vez: se tira UNA vez.
 */
export function crearGloboSostenido() {
  let reloj: ReturnType<typeof setTimeout> | null = null;
  let origen: { x: number; y: number } | null = null;
  let atendio = false;

  const cancelar = (): void => {
    if (reloj !== null) clearTimeout(reloj);
    reloj = null;
    origen = null;
  };

  return {
    /** El dedo (o el ratón) bajó sobre el globo en (x, y). */
    bajar(x: number, y: number, alSostener: () => void): void {
      cancelar();
      atendio = false;
      origen = { x, y };
      reloj = setTimeout(() => {
        reloj = null;
        origen = null;
        atendio = true;
        alSostener();
      }, MS_PARA_MANTENER);
    },

    mover(x: number, y: number): void {
      if (origen !== null && seAlejo(origen, x, y)) cancelar();
    },

    /** Se levantó o el navegador canceló el gesto: lo que no se cumplió, no se atiende. */
    cancelar,

    /** ¿El clic que llega ya fue atendido por haber mantenido? Se tira una sola vez. */
    tirarElClic(): boolean {
      const tirar = atendio;
      atendio = false;
      return tirar;
    },
  };
}
