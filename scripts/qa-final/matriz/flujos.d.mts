/** Tipos de `flujos.mjs` para su prueba. */
export interface FlujoDelMapa {
  readonly id: string;
  readonly pruebas: readonly string[];
  readonly pruebasQueFaltan?: readonly string[];
  readonly estado?: string;
  readonly razon?: string;
}

export const NO_APLICA: string;
export function estadoDelFlujo(flujo: FlujoDelMapa): string;
export function resumenDeFlujos(flujos: readonly FlujoDelMapa[]): {
  readonly total: number;
  readonly sinPrueba: number;
  readonly noAplica: number;
};
export function huecosDeFlujos(flujos: readonly FlujoDelMapa[]): string[];
