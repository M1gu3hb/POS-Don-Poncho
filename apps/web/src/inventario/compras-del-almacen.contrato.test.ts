import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PUESTOS_QUE_PAGAN_COMPRAS_DEL_CAJON,
  PUESTOS_QUE_REGISTRAN_COMPRAS,
  metodoDeCompraPermitido,
  puedePagarComprasDelCajon,
  puedeRegistrarCompras,
} from '../../heredado/components/configuracion/puestos.js';

/**
 * A5 · EL ALMACÉN REGISTRA COMPRAS: lo que la pantalla ofrece es lo que el servidor deja.
 *
 * La verdad es el servidor (`compras.registrar` y sus hermanas en la matriz de permisos; el efectivo
 * sale del cajón sólo para quien lleva la caja, `quien-paga-del-cajon.ts`). Aquí se ata la pantalla
 * a esa verdad y se lee el texto de las dos pantallas heredadas.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

const matriz = JSON.parse(leer('pruebas/e2e/matriz-de-permisos.json')) as {
  readonly incluidas: readonly { readonly ruta: string; readonly roles: readonly string[] }[];
};
const rolesDe = (ruta: string): readonly string[] => {
  const fila = matriz.incluidas.find((r) => r.ruta === ruta);
  if (fila === undefined) throw new Error(`La matriz no trae ${ruta}.`);
  return fila.roles;
};

function listaDelServidor(nombre: string): readonly string[] {
  const fuente = leer('packages/app/src/compras/quien-paga-del-cajon.ts');
  const coincide = new RegExp(`${nombre} = \\[([^\\]]*)\\]`).exec(fuente);
  if (coincide?.[1] === undefined) throw new Error(`No encuentro ${nombre} en el servidor.`);
  return [...coincide[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1] ?? '');
}

describe('quién registra compras', () => {
  it('la pantalla ofrece «Registrar compra» exactamente a quien el servidor deja (la matriz)', () => {
    for (const ruta of [
      '/api/compras/registrar',
      '/api/compras/plantilla',
      '/api/compras/plantilla/usar',
    ]) {
      expect([...PUESTOS_QUE_REGISTRAN_COMPRAS].sort(), ruta).toEqual([...rolesDe(ruta)].sort());
    }
    expect(puedeRegistrarCompras('almacen')).toBe(true);
    for (const puesto of ['mesero', 'cocina', 'cajero', null]) {
      expect(puedeRegistrarCompras(puesto), String(puesto)).toBe(false);
    }
  });

  it('el efectivo sólo se ofrece a quien el servidor deja pagar del cajón', () => {
    expect([...PUESTOS_QUE_PAGAN_COMPRAS_DEL_CAJON].sort()).toEqual(
      [...listaDelServidor('ROLES_QUE_PAGAN_DEL_CAJON')].sort(),
    );
    expect(puedePagarComprasDelCajon('almacen')).toBe(false);
    expect(puedePagarComprasDelCajon('gerente')).toBe(true);
  });
});

describe('la página Compras', () => {
  const pagina = leer('apps/web/heredado/pages/Compras.jsx');

  it('el botón de compras sale con el puesto real que registra compras', () => {
    expect(pagina).toMatch(/const registraCompras = puedeRegistrarCompras\(puesto\)/);
    expect(pagina).toMatch(/\{registraCompras && \(\s*<button[\s\S]{0,200}setOpenCompra\(true\)/);
  });

  it('los gastos siguen siendo de la gerencia: el botón de gasto no sale al almacén', () => {
    expect(pagina).toMatch(/\{registra && \(\s*<button[\s\S]{0,200}setOpenGasto\(true\)/);
  });
});

describe('el diálogo de compra', () => {
  const dialogo = leer('apps/web/heredado/components/compras/RegistrarCompraDialog.jsx');

  it('quien no paga del cajón no ve «Efectivo» y su forma de pago sale del puesto', () => {
    expect(dialogo).toMatch(/const pagaDelCajon = puedePagarComprasDelCajon\(puesto\)/);
    expect(dialogo).toMatch(/const metodoPago = metodoDeCompraPermitido\(metodoElegido, puesto\)/);
    expect(dialogo).toMatch(
      /\{pagaDelCajon && <SelectItem value="efectivo">Efectivo<\/SelectItem>\}/,
    );
  });

  it('al limpiar el diálogo vuelve a la forma de pago de su puesto', () => {
    expect(dialogo).toMatch(/setMetodoPago\(null\)/);
    expect(dialogo).not.toMatch(/useState\('efectivo'\)/);
  });
});

describe('la forma de pago de una compra, según el puesto', () => {
  it('quien lleva la caja arranca en efectivo; el almacén, en transferencia', () => {
    expect(metodoDeCompraPermitido(null, 'gerente')).toBe('efectivo');
    expect(metodoDeCompraPermitido(null, 'almacen')).toBe('transferencia');
  });

  it('sin puesto todavía, nadie arranca en efectivo', () => {
    expect(metodoDeCompraPermitido(null, null)).toBe('transferencia');
  });

  it('lo elegido vale, menos el efectivo del que no paga del cajón (un historial lo puede traer)', () => {
    expect(metodoDeCompraPermitido('tarjeta', 'almacen')).toBe('tarjeta');
    expect(metodoDeCompraPermitido('efectivo', 'almacen')).toBe('transferencia');
    expect(metodoDeCompraPermitido('efectivo', 'dueno')).toBe('efectivo');
    expect(metodoDeCompraPermitido('transferencia', 'dueno')).toBe('transferencia');
  });
});
