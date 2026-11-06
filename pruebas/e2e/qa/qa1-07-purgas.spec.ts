import { expect, test } from '@playwright/test';

import { consultarPuente } from '../ayudantes/sesion.ts';

import { anotar, escribir, Jornada } from './ayudantes-qa.ts';

/**
 * QA-1 · 07 · LAS PURGAS DE MANTENIMIENTO, SÓLO AL FINAL y sólo con la persona de plataforma
 * («Miguel · Morphiq»): «Limpiar ventas de prueba» (revirtiendo el inventario) y «Limpiar cortes» (Registros); «Eliminar todas»
 * las mesas se NIEGA con una cuenta abierta; la cuarta operación de la hora
 * se niega (el límite es de tres); y el salón queda limpio: sin cuentas, sin cortes, sin carritos ni solicitudes, y el almacén como al abrir.
 */

const NEGOCIO = 'Don Poncho';

test.describe('QA-1 · 07 · purgas', () => {
  test('mesas negadas con cuenta abierta, ventas, cortes y movimientos purgados, salón limpio', async ({
    browser,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const j = new Jornada(browser, info);
    try {
      const duena = await j.pagina('Dueño Don Poncho', 'pc');
      const miguel = await j.pagina('Miguel · Morphiq', 'pc');

      const antes = {
        ventas: (await consultarPuente<{ id: string }>(duena, 'Venta', { limite: 500 })).length,
        cortes: (await consultarPuente<{ id: string }>(duena, 'CorteCaja', { limite: 200 })).length,
      };
      anotar({
        aparato: 'servidor',
        quien: 'Conciliación',
        accion: `Antes de purgar: ${String(antes.ventas)} ventas y ${String(antes.cortes)} cortes`,
        esperado: 'Hay ventas y cortes de la jornada',
      });
      expect(antes.ventas, 'La jornada no dejó ventas que purgar.').toBeGreaterThan(0);

      await test.step('Ventas → «Limpiar ventas de prueba», revirtiendo el inventario', async () => {
        await miguel.goto('/ventas');
        await miguel.getByRole('button', { name: 'Limpiar ventas de prueba' }).click();
        const dialogo = miguel.getByRole('dialog').filter({ hasText: 'Limpiar ventas de prueba' });
        await dialogo.getByPlaceholder('Nombre del negocio').fill(NEGOCIO);
        await dialogo.getByRole('button', { name: 'Confirmar limpieza' }).click();
        await expect(miguel.getByText('Ventas de prueba limpiadas correctamente')).toBeVisible({
          timeout: 30_000,
        });
        anotar({
          aparato: 'pc',
          quien: 'Miguel · Morphiq',
          accion: 'Ventas → Limpiar ventas de prueba (con «revertir consumo de inventario»)',
          esperado: 'Sin ventas ni cuentas; el almacén recupera lo que cobró',
        });
      });

      await test.step('Registros → «Limpiar cortes»', async () => {
        await miguel.goto('/registros?tab=cortes');
        await miguel.getByRole('button', { name: 'Limpiar cortes' }).click();
        const alerta = miguel.getByRole('alertdialog');
        await alerta.getByPlaceholder('Nombre del negocio').fill(NEGOCIO);
        await alerta.getByRole('button', { name: 'Eliminar historial' }).click();
        await expect(miguel.getByText(/Se eliminaron \d+ registros de/)).toBeVisible({
          timeout: 30_000,
        });
        anotar({
          aparato: 'pc',
          quien: 'Miguel · Morphiq',
          accion: 'Registros → Limpiar cortes',
          esperado: 'El historial de cortes queda vacío',
        });
      });

      await test.step('«Eliminar todas las mesas» se niega con una cuenta abierta', async () => {
        const [mesa] = await consultarPuente<{ id: string }>(duena, 'Mesa', {
          filtro: { numero: 20 },
          limite: 1,
        });
        const ap = await escribir(duena, '/api/restaurante/abrir-mesa', {
          mesaId: mesa?.id,
          personas: 2,
        });
        await miguel.goto('/configuracion?tab=mesas');
        await miguel.getByRole('button', { name: 'Eliminar todas' }).click();
        await miguel.getByRole('button', { name: 'Sí, eliminar todas' }).click();
        await expect(
          miguel
            .getByText(/mesa|cuenta|venta|ocupad/i)
            .filter({ hasText: /20|abiert|ocupad/i })
            .first(),
        ).toBeVisible({ timeout: 15_000 });
        const todavia = await consultarPuente<{ id: string; activo?: boolean | null }>(
          duena,
          'Mesa',
          {
            limite: 200,
          },
        );
        expect(
          todavia.filter((m) => m.activo !== false).length,
          'Se borraron mesas con una cuenta abierta.',
        ).toBeGreaterThanOrEqual(25);
        await escribir(duena, '/api/restaurante/cancelar-orden', {
          ordenId: String(ap['ordenId']),
          motivo: 'Prueba de la purga de mesas',
        });
        anotar({
          aparato: 'pc',
          quien: 'Miguel · Morphiq',
          accion: 'Configuración → Mesas → «Eliminar todas» con la mesa 20 abierta',
          esperado: 'El servidor se niega y dice qué mesa; las 25 siguen',
        });
      });

      await test.step('la cuarta purga de la hora se niega (el límite es de 3 por hora)', async () => {
        await miguel.goto('/registros?tab=movimientos');
        await miguel.getByRole('button', { name: 'Limpiar movimientos de inventario' }).click();
        const alerta = miguel.getByRole('alertdialog');
        await alerta.getByPlaceholder('Nombre del negocio').fill(NEGOCIO);
        await alerta.getByRole('button', { name: 'Eliminar historial' }).click();
        await expect(miguel.getByText(/Demasiadas operaciones de mantenimiento/)).toBeVisible({
          timeout: 30_000,
        });
        anotar({
          aparato: 'pc',
          quien: 'Miguel · Morphiq',
          accion:
            'Registros → Limpiar movimientos de inventario (la cuarta operación de mantenimiento de la hora)',
          esperado:
            'Se niega: «Demasiadas operaciones de mantenimiento. Vuelve a intentarlo en N minutos»',
        });
      });

      await test.step('el salón queda limpio', async () => {
        // La cuenta de la mesa 20 de la prueba de «Eliminar todas» (cancelada, sin cobrar) es de DESPUÉS de la purga.
        const ventas = await consultarPuente<{ estado?: string | null }>(duena, 'Venta', {
          limite: 500,
        });
        expect(
          ventas.filter((v) => v.estado !== 'cancelada'),
          'Quedaron ventas tras «Limpiar ventas de prueba».',
        ).toEqual([]);
        expect(
          await consultarPuente<{ id: string }>(duena, 'CorteCaja', { limite: 200 }),
        ).toHaveLength(0);
        const mesas = await consultarPuente<{
          numero: number;
          estado?: string;
          venta_activa_id?: string | null;
          unida_a_mesa_id?: string | null;
        }>(duena, 'Mesa', { limite: 200 });
        const sucias = mesas.filter(
          (m) => m.estado !== 'libre' || m.venta_activa_id != null || m.unida_a_mesa_id != null,
        );
        expect(
          sucias.map((m) => `${String(m.numero)}:${String(m.estado)}`),
          'Mesas que no quedaron libres.',
        ).toEqual([]);
        const solicitudes = await consultarPuente<{ estado?: string }>(duena, 'SolicitudQR', {
          limite: 200,
        });
        expect(
          solicitudes.filter((s) => s.estado === 'pendiente'),
          'Quedaron solicitudes pendientes.',
        ).toEqual([]);
        anotar({
          aparato: 'pc',
          quien: 'Dueño',
          accion: 'Revisa el salón tras las purgas',
          esperado:
            '25 mesas libres, sin cuenta ni unión, sin ventas, sin cortes, sin solicitudes pendientes',
        });
      });
    } finally {
      await j.cerrar();
    }
  });
});
