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
    const fin = await imprimirEnLaApp(
      app,
      perfil,
      { titulo, copias: [elemento] },
      { id, avanzar: () => undefined },
    );
    const msDeEnvio = ahora() - entrega;
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

  const resultado = await app.imprimir({
    id,
    destino: perfil.destino,
    documento: {
      tipo: 'crudo',
      base64: aBase64(armado.bytes),
      bloqueBytes: perfil.bloqueBytes,
      pausaMs: perfil.pausaMs,
    },
  });
  const msDeEnvio = ahora() - entrega;
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
