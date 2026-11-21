import { describe, expect, it } from 'vitest';

import {
  copiasAlImprimir,
  crearMemoriaDeCopias,
  type LectorDeCopias,
} from './copias-al-imprimir.ts';
import { copiasDe, type CopiasDeImpresion } from './copias.ts';

/**
 * DP-24 · Parte 6.1 · LAS COPIAS SE LEEN AL IMPRIMIR, no al montar la pantalla.
 *
 * La falla: se guardaron 2 copias en un POS; otro siguió imprimiendo 1 y un tercero 2. Las copias
 * vivían en una variable del módulo que sólo llenaba una consulta de la barra de impresión (con
 * `staleTime` de un minuto, sin volver a leer al enfocar la ventana): un aparato que no recargaba
 * seguía con lo viejo. Aquí hay dos «aparatos» (dos memorias, dos lectores) contra UN servidor
 * falso que cambia el valor entre impresiones.
 */

const UNA: CopiasDeImpresion = { ticket: 1, precuenta: 1, corte: 1 };
const DOS: CopiasDeImpresion = { ticket: 2, precuenta: 1, corte: 1 };

function servidorFalso(inicial: CopiasDeImpresion) {
  const estado = { valor: inicial, lecturas: 0, caido: false };
  const lector: LectorDeCopias = () => {
    estado.lecturas += 1;
    return estado.caido ? Promise.reject(new Error('sin red')) : Promise.resolve(estado.valor);
  };
  return { estado, lector };
}

describe('copiasAlImprimir', () => {
  it('lee del servidor EN CADA impresión y respeta el cambio sin recargar (dos aparatos)', async () => {
    const servidor = servidorFalso(UNA);
    const aparatoA = crearMemoriaDeCopias();
    const aparatoB = crearMemoriaDeCopias();

    expect(copiasDe((await copiasAlImprimir(servidor.lector, aparatoA)).copias, 'ticket')).toBe(1);
    expect(copiasDe((await copiasAlImprimir(servidor.lector, aparatoB)).copias, 'ticket')).toBe(1);

    // El dueño cambia a 2 copias desde un aparato; ninguno de los dos recarga.
    servidor.estado.valor = DOS;

    expect(copiasDe((await copiasAlImprimir(servidor.lector, aparatoA)).copias, 'ticket')).toBe(2);
    expect(copiasDe((await copiasAlImprimir(servidor.lector, aparatoB)).copias, 'ticket')).toBe(2);

    servidor.estado.valor = UNA;
    expect(copiasDe((await copiasAlImprimir(servidor.lector, aparatoB)).copias, 'ticket')).toBe(1);
    expect(servidor.estado.lecturas).toBe(5);
  });

  it('si la lectura falla, lo DICE y usa la última conocida (nunca 1 en silencio)', async () => {
    const servidor = servidorFalso(DOS);
    const memoria = crearMemoriaDeCopias();
    expect((await copiasAlImprimir(servidor.lector, memoria)).aviso).toBeNull();

    servidor.estado.caido = true;
    const sinRed = await copiasAlImprimir(servidor.lector, memoria);
    expect(sinRed.copias).toEqual(DOS);
    expect(sinRed.aviso).toMatch(/últimas/);
  });

  it('sin lectura y sin última conocida sale 1 copia, y lo dice', async () => {
    const servidor = servidorFalso(DOS);
    servidor.estado.caido = true;
    const resultado = await copiasAlImprimir(servidor.lector, crearMemoriaDeCopias());
    expect(resultado.copias).toEqual(UNA);
    expect(resultado.aviso).toMatch(/1 copia/);
  });

  it('un servidor que no contesta a tiempo no detiene el papel', async () => {
    const colgado: LectorDeCopias = () => new Promise<CopiasDeImpresion>(() => undefined);
    const memoria = crearMemoriaDeCopias();
    memoria.guardar(DOS);
    const resultado = await copiasAlImprimir(colgado, memoria, 20);
    expect(resultado.copias).toEqual(DOS);
    expect(resultado.aviso).not.toBeNull();
  });

  it('una lectura buena se recuerda para la siguiente vez que falle', async () => {
    const servidor = servidorFalso(DOS);
    const memoria = crearMemoriaDeCopias();
    await copiasAlImprimir(servidor.lector, memoria);
    expect(memoria.ultima()).toEqual(DOS);
  });
});
