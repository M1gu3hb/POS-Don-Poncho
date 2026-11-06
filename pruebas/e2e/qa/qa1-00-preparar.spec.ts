import { randomInt } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { crearEstacion, laEstacion } from '../ayudantes/estaciones.ts';
import { consultarPuente, vigilarFallos } from '../ayudantes/sesion.ts';

import { anotar, escribir, guardarEstado, Jornada, leerEstado } from './ayudantes-qa.ts';
import { INSUMOS, RECETAS } from './carta-qa.ts';

/**
 * QA-1 · 00 · LA COPIA, LISTA PARA EL DÍA: 25 mesas con sus meseros y su QR, cuatro estaciones de cocina
 * (Cocina, Bebidas, Postres y Barbacoa) con su cocinero, y un almacén con insumos y recetas que
 * Don Poncho no traía. Todo en la copia desechable.
 */

const MESAS = 25;
const ESTACIONES_NUEVAS = [
  { nombre: 'Postres', categorias: ['Lo dulce'] },
  { nombre: 'Barbacoa', categorias: ['Lo fuerte'] },
] as const;

interface MesaDelPuente {
  readonly id: string;
  readonly numero: number;
  readonly activo?: boolean | null;
  readonly qr_token?: string | null;
}

const activas = async (lector: Page): Promise<readonly MesaDelPuente[]> =>
  (await consultarPuente<MesaDelPuente>(lector, 'Mesa', { limite: 200 })).filter(
    (m) => m.activo !== false,
  );

test.describe('QA-1 · 00 · preparar la copia', () => {
  test('mesas, estaciones, cocineros, almacén y recetas', async ({ browser }, info) => {
    test.setTimeout(15 * 60_000);
    const j = new Jornada(browser, info);
    try {
      const duena = await j.pagina('Dueño Don Poncho', 'pc');
      const sinFallos = vigilarFallos(duena);

      await test.step('25 mesas: las 15 que faltan con «Nueva mesa»', async () => {
        await duena.goto('/configuracion?tab=mesas');
        const dialogo = duena.getByRole('dialog').filter({ hasText: 'Nombre visible' });
        for (let i = (await activas(duena)).length; i < MESAS; i += 1) {
          await duena.getByRole('button', { name: 'Nueva mesa' }).click();
          // QA1-2: la zona sale en blanco en este diálogo (la mesa se guarda con «Salón» igual).
          await dialogo.getByRole('combobox').first().click();
          await duena.getByRole('option', { name: 'Salón' }).click();
          await dialogo.getByRole('button', { name: 'Crear mesa' }).click();
          await expect(dialogo).toBeHidden();
        }
        expect(await activas(duena)).toHaveLength(MESAS);
        anotar({
          aparato: 'pc',
          quien: 'Dueño',
          accion: 'Configuración → Mesas: crea las mesas 11 a 25',
          esperado: '25 mesas activas',
        });
      });

      await test.step('meseros: 1 a 5 y 11 a 18 de Mesero 1; 6 a 10 y 19 a 25 de Mesero 2', async () => {
        const lista = await duena.request.get('/api/auth/empleados?negocio=don-poncho');
        const { datos } = (await lista.json()) as {
          datos: { usuarios: { id: string; nombre: string }[] };
        };
        const id = (nombre: string) => datos.usuarios.find((e) => e.nombre === nombre)?.id;
        const [uno, dos] = [id('Mesero 1'), id('Mesero 2')];
        expect(uno, 'No encuentro a Mesero 1.').toBeDefined();
        expect(dos, 'No encuentro a Mesero 2.').toBeDefined();
        for (const m of await activas(duena)) {
          const suyo = m.numero <= 5 || (m.numero >= 11 && m.numero <= 18) ? uno : dos;
          await escribir(duena, '/api/datos/escribir', {
            entidad: 'Mesa',
            operacion: 'update',
            id: m.id,
            datos: { mesero_asignado_id: suyo },
          });
        }
      });

      await test.step('QR de las 25: «Generar tokens faltantes»', async () => {
        await duena.goto('/portal-qr');
        await duena.getByRole('tab', { name: 'Mesas QR' }).click();
        duena.once('dialog', (aviso) => void aviso.accept());
        await duena.getByRole('button', { name: 'Generar tokens faltantes' }).click();
        await expect
          .poll(async () => (await activas(duena)).filter((m) => (m.qr_token ?? '') !== '').length)
          .toBe(MESAS);
        const tokens = Object.fromEntries(
          (await activas(duena)).map((m) => [String(m.numero), m.qr_token ?? '']),
        );
        guardarEstado({ tokens });
      });

      await test.step('estaciones: Postres y Barbacoa, con su categoría y su cocinero', async () => {
        if (leerEstado()['cocineros'] !== undefined) return; // ya hechas en una vuelta anterior
        await duena.goto('/configuracion?tab=negocio');
        const cocineros: Record<string, { nombre: string; pin: string }> = {};
        for (const { nombre, categorias } of ESTACIONES_NUEVAS) {
          await crearEstacion(duena, nombre);
          const estacion = await laEstacion(duena, nombre);
          const todas = await consultarPuente<{ id: string; nombre: string }>(
            duena,
            'CategoriaProducto',
            { limite: 50 },
          );
          for (const c of categorias) {
            const fila = todas.find((x) => x.nombre === c);
            expect(fila, `No existe la categoría ${c}.`).toBeDefined();
            await escribir(duena, '/api/datos/escribir', {
              entidad: 'CategoriaProducto',
              operacion: 'update',
              id: fila?.id,
              datos: { estacion_preparacion_id: estacion.id },
            });
          }
          // El PIN de cuatro cifras sí se teclea en la pantalla de acceso (QA1-1).
          const pin = String(randomInt(1000, 10_000));
          const cocinero = `Cocina ${nombre} QA`;
          await escribir(duena, '/api/identidad/empleados', {
            nombre: cocinero,
            puesto: 'cocina',
            estacionPreparacionId: estacion.id,
            pin,
          });
          cocineros[nombre] = { nombre: cocinero, pin };
          anotar({
            aparato: 'pc',
            quien: 'Dueño',
            accion: `Estación «${nombre}» con ${categorias.join(', ')} y su cocinero`,
            esperado: `Las comandas de ${categorias.join(', ')} salen en la pantalla de ${nombre}`,
          });
        }
        guardarEstado({ cocineros });
      });

      await test.step('almacén, insumos con existencia y recetas', async () => {
        const previo = leerEstado()['almacenId'];
        const almacenId =
          typeof previo === 'string'
            ? previo
            : (
                (await escribir(duena, '/api/inventario/almacenes/crear', {
                  nombre: 'Almacén general QA',
                })) as { id: string }
              ).id;
        const insumos: Record<string, string> = {};
        for (const i of INSUMOS) {
          const { id } = (await escribir(duena, '/api/inventario/insumos/crear', {
            nombre: i.nombre,
            unidad: i.unidad,
            costoUnitario: i.costo,
            stockMinimo: '1',
          })) as { id: string };
          insumos[i.nombre] = id;
          await escribir(duena, '/api/inventario/inicial', {
            almacenId,
            insumoId: id,
            cantidad: i.existencia,
          });
        }
        const productos = await consultarPuente<{ id: string; nombre: string }>(
          duena,
          'ProductoTerminado',
          { limite: 200 },
        );
        for (const r of RECETAS) {
          const producto = productos.find((p) => p.nombre === r.platillo);
          expect(producto, `No existe «${r.platillo}».`).toBeDefined();
          await escribir(duena, '/api/inventario/recetas', {
            productoId: producto?.id,
            ingredientes: r.lineas.map((l) => ({
              insumoId: insumos[l.insumo],
              cantidad: l.cantidad,
              unidad: INSUMOS.find((i) => i.nombre === l.insumo)?.unidad,
              mermaBp: 0,
              aplicaCanal: 'ambos',
            })),
          });
        }
        guardarEstado({ almacenId, insumos });
        anotar({
          aparato: 'pc',
          quien: 'Dueño',
          accion: `Crea ${String(INSUMOS.length)} insumos con existencia y ${String(RECETAS.length)} recetas`,
          esperado: 'Existencias iniciales = las de la tabla de insumos',
          datos: Object.fromEntries(INSUMOS.map((i) => [i.nombre, Number(i.existencia)])),
        });
      });
      sinFallos();
    } finally {
      await j.cerrar();
    }
  });
});
