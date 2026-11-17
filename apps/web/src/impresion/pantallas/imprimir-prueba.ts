/**
 * IMPRIMIR UNA PRUEBA DEL LABORATORIO (DP-20). Sólo navegador.
 *
 * Dibuja el elemento al ancho del perfil, arma los bytes y se los entrega a la app. Deja a la
 * vista lo que salió —los bytes, los mapas, cuánto tardó cada paso— para la vista previa y para
 * el hexadecimal. No guarda «el último ticket» del aparato: una prueba no se reimprime.
 */
import type { ReactElement } from 'react';

import type { MorphiqApp } from '../puente/contrato.ts';
import { imprimirEnLaApp, armarDocumento } from '../imprimir-en-la-app.ts';
import type { MapaDeBits } from '../termico/mapa.ts';
import type { PerfilDeImpresion } from '../termico/perfil.ts';
import { aBase64, nuevoIdDeTrabajo } from '../termico/trabajo.ts';
import { PLAZO_PARA_ENVIAR_MS } from '../trabajos.ts';
import { RESULTADO_SIN_RESPUESTA, conPlazoDeSilencio } from './plazo-de-la-prueba.ts';
import {
  resultadoDelFin,
  resultadoDelPuente,
  type ResultadoDePrueba,
} from './resultado-de-prueba.ts';

export interface UltimoTrabajo {
  readonly titulo: string;
  readonly bytes: Uint8Array;
  readonly mapas: readonly MapaDeBits[];
  readonly avisos: readonly string[];
  /** Lo que tardó dibujar el documento y armar los bytes. */
  readonly msDeDibujo: number;
  /** Lo que tardó la app en contestar. */
  readonly msDeEnvio: number;
}

const ahora = (): number => performance.now();

export async function imprimirElementoDePrueba(
  app: MorphiqApp,
  perfil: PerfilDeImpresion,
  elemento: ReactElement,
  titulo: string,
  alTenerElTrabajo: (trabajo: UltimoTrabajo) => void,
): Promise<ResultadoDePrueba> {
  const inicio = ahora();
  const armado = await armarDocumento(perfil, [elemento], false);
  const msDeDibujo = ahora() - inicio;
  const id = nuevoIdDeTrabajo('lab');

  const entrega = ahora();
  if (perfil.lenguaje === 'driver') {
    // Por el driver de Windows se manda la misma imagen de 1 bit, como página.
    // El MISMO plazo que los trabajos de la Caja (`PLAZO_PARA_ENVIAR_MS`): de silencio, y cada aviso
    // de avance de la app lo renueva. Sin él, una app colgada dejaba el botón en «Enviando…».
    const fin = await conPlazoDeSilencio(
      (renovar) =>
        imprimirEnLaApp(app, perfil, { titulo, copias: [elemento] }, { id, avanzar: renovar }),
      PLAZO_PARA_ENVIAR_MS,
      () => null,
    );
    const msDeEnvio = ahora() - entrega;
    if (fin === null) return RESULTADO_SIN_RESPUESTA;
    alTenerElTrabajo({
      titulo,
      bytes: armado.bytes,
      mapas: armado.mapas,
      avisos: armado.avisos,
      msDeDibujo,
      msDeEnvio,
    });
    return resultadoDelFin(fin, { ms: msDeDibujo + msDeEnvio });
  }

  const resultado = await conPlazoDeSilencio(
    () =>
      app.imprimir({
        id,
        destino: perfil.destino,
        documento: {
          tipo: 'crudo',
          base64: aBase64(armado.bytes),
          bloqueBytes: perfil.bloqueBytes,
          pausaMs: perfil.pausaMs,
        },
      }),
    PLAZO_PARA_ENVIAR_MS,
    () => null,
  );
  const msDeEnvio = ahora() - entrega;
  if (resultado === null) return RESULTADO_SIN_RESPUESTA;
  alTenerElTrabajo({
    titulo,
    bytes: armado.bytes,
    mapas: armado.mapas,
    avisos: armado.avisos,
    msDeDibujo,
    msDeEnvio,
  });
  return resultadoDelPuente(resultado, { ms: msDeDibujo + msDeEnvio, bytes: armado.bytes.length });
}
