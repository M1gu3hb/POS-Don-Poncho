/**
 * DP-22 · Los flujos del mapa total: su estado y sus huecos.
 *
 * Un flujo de `qa/qa-final/datos/flujos.json` está (a) con pruebas, (b) «sin prueba» (un hueco
 * que hay que cerrar) o (c) declarado `"estado": "no aplica"` con su `"razon"` obligatoria: la
 * función no existe en la app y no se construye. (c) no cuenta como «sin prueba», pero no se
 * oculta: el mapa lo imprime con su razón y el resumen lo cuenta aparte.
 */

export const NO_APLICA = 'no aplica';

const esNoAplica = (flujo) => flujo.estado === NO_APLICA;

export function estadoDelFlujo(flujo) {
  if (esNoAplica(flujo)) return `${NO_APLICA}: ${String(flujo.razon ?? '').trim()}`;
  if (flujo.estado) return flujo.estado;
  return flujo.pruebas.length === 0 ? 'sin prueba' : 'con prueba, por recorrer con el arnés';
}

export function resumenDeFlujos(flujos) {
  return {
    total: flujos.length,
    sinPrueba: flujos.filter((f) => f.pruebas.length === 0 && !esNoAplica(f)).length,
    noAplica: flujos.filter(esNoAplica).length,
  };
}

export function huecosDeFlujos(flujos) {
  const salida = [];
  for (const flujo of flujos) {
    for (const falta of flujo.pruebasQueFaltan ?? []) {
      salida.push(`flujos.json cita una prueba que no existe (${flujo.id}): ${falta}`);
    }
    if (flujo.estado !== undefined && flujo.estado !== NO_APLICA) {
      salida.push(`flujos.json: estado desconocido en ${flujo.id}: «${String(flujo.estado)}»`);
    }
    if (esNoAplica(flujo)) {
      if (String(flujo.razon ?? '').trim() === '') {
        salida.push(`flujos.json: «no aplica» sin razón en ${flujo.id}`);
      }
      if (flujo.pruebas.length > 0) {
        salida.push(`flujos.json: ${flujo.id} es «no aplica» pero cita pruebas (o aplica o no)`);
      }
    }
  }
  return salida;
}
