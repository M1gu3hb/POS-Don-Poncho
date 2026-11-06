import { expect, test } from '@playwright/test';

import {
  abrirLaCaja,
  abrirLaMesa,
  armarElPedido,
  botonDeLaMesa,
  dialogoDeLaMesa,
  mesaEnElServidor,
} from '../ayudantes/mesas-heredadas.ts';
import { consultarPuente } from '../ayudantes/sesion.ts';

import { anotar, escribir, Jornada, leerEstado, sesionDeLaCaja } from './ayudantes-qa.ts';

/**
 * QA-1 · 08 · CAPTURAS Y COMPROBACIONES PARA LOS HALLAZGOS (docs/qa/evidencia), después de las purgas:
 *   · QA1-4: el mesero manda «Quesadilla» sin que se le abra el diálogo de opciones (el portal sí marca
 *     el Relleno «Obligatorio»);
 *   · QA1-5: el camino de «Dividir» desde la mesa del mesero (enlace «Dividir, unir, separar o cambiar de
 *     mesa» → mesa activa → «Acciones de la mesa»), y si la cajera tiene por dónde dividir desde Caja;
 *   · QA1-2: «Nueva mesa» con la zona en blanco; QA1-7: «Folio null» en la pre-cuenta.
 */

const EVIDENCIA = 'docs/qa/evidencia';

test('capturas y comprobaciones para los hallazgos', async ({ browser }, info) => {
  test.setTimeout(5 * 60_000);
  const j = new Jornada(browser, info);
  try {
    const tokens = leerEstado()['tokens'] as Record<string, string>;
    const [duena, caja, mesero] = [
      await j.pagina('Dueño Don Poncho', 'pc'),
      await j.pagina('Caja', 'pc'),
      await j.pagina('Mesero 1', 'tableta'),
    ];

    // Tras el cierre del día no hay caja abierta: se abre una (se limpia al final).
    await caja.goto('/caja');
    if ((await sesionDeLaCaja(caja)) === null) await abrirLaCaja(caja, 50_000);

    await test.step('QA1-4 · pasos exactos: «Quesadilla» sin opciones desde la mesa del mesero', async () => {
      const tel = await j.comensal(tokens['21'] ?? '');
      await tel.getByRole('button', { name: 'Agregar Quesadilla', exact: true }).click();
      await expect(tel.getByText('Obligatorio')).toBeVisible();
      await tel.screenshot({ path: `${EVIDENCIA}/portal-quesadilla-relleno-obligatorio.png` });
      await tel.getByRole('button', { name: 'Cancelar' }).click();

      await mesero.goto('/mesero');
      const { ordenId } = await abrirLaMesa(mesero, duena, 14, 2);
      // Ronda 2 (QA1-4 arreglado): el mosaico abre «Personalizar producto» y exige el relleno.
      await armarElPedido(mesero, 14, [{ nombre: 'Quesadilla', veces: 1 }]);
      const personalizar = mesero.getByRole('dialog', { name: 'Personalizar producto' });
      await expect(personalizar).toBeVisible();
      await personalizar.getByRole('button', { name: 'Agregar al pedido' }).click();
      await expect(personalizar.getByText('Selecciona una opción en: Relleno')).toBeVisible();
      await mesero.screenshot({ path: `${EVIDENCIA}/mesero-quesadilla-pide-relleno.png` });
      await personalizar.getByRole('button', { name: 'Pollo', exact: true }).click();
      await personalizar.getByRole('button', { name: 'Agregar al pedido' }).click();
      await expect(personalizar).toHaveCount(0);
      const enviar = await botonDeLaMesa(mesero, 14, 'Enviar a Cocina');
      await expect(enviar).toBeEnabled();
      await enviar.click();
      await expect(mesero.getByText('¡Pedido enviado a cocina!').first()).toBeVisible();
      anotar({
        aparato: 'tableta',
        quien: 'Mesero 1',
        accion:
          'QA1-4 (ronda 2): mesa 14 → Abrir mesa (2) → mosaico «Quesadilla» → «Agregar al pedido» sin relleno → Pollo → Enviar a Cocina',
        detalle:
          'Se abrió «Personalizar producto»; sin relleno dijo «Selecciona una opción en: Relleno»',
        esperado: 'Se abre el diálogo de opciones y exige el Relleno antes de agregar',
      });
      await escribir(duena, '/api/restaurante/cancelar-orden', {
        ordenId,
        motivo: 'Captura de evidencia',
      });
      await mesero.keyboard.press('Escape');
      await expect(mesero.getByRole('dialog')).toHaveCount(0);
    });

    await test.step('QA1-5 · dividir por el camino del mesero y desde Caja', async () => {
      const { ordenId, mesaId } = await abrirLaMesa(mesero, duena, 15, 2);
      await armarElPedido(mesero, 15, [
        { nombre: 'Guacamole', veces: 2 },
        { nombre: 'Corona', veces: 2 },
      ]);
      await (await botonDeLaMesa(mesero, 15, 'Enviar a Cocina')).click();
      await expect(mesero.getByText('¡Pedido enviado a cocina!').first()).toBeVisible();
      // La cuenta ya pedida: es cuando se divide.
      await escribir(duena, '/api/restaurante/solicitar-cuenta', { ordenId });
      await mesero.waitForTimeout(3_000); // la mesa se relee cada pocos segundos
      // El enlace «Dividir, unir, separar o cambiar de mesa» vive en MesaActivaView.jsx: ¿lo monta la pantalla?
      const enlaces = await dialogoDeLaMesa(mesero, 15)
        .getByRole('link', { name: /Dividir, unir, separar/ })
        .count();
      await mesero.screenshot({ path: `${EVIDENCIA}/mesero-mesa-sin-enlace-para-dividir.png` });
      anotar({
        aparato: 'tableta',
        quien: 'Mesero 1',
        accion:
          'QA1-5: mesa 15 con pedido enviado: busca el enlace «Dividir, unir, separar o cambiar de mesa»',
        detalle: `enlaces con ese texto en el diálogo de la mesa: ${String(enlaces)}`,
        esperado: 'El enlace está y lleva a la mesa activa',
      });
      // Y la mesa activa, tecleada: ¿la mesera (y la cajera) pueden usar «Acciones de la mesa → Dividir»?
      for (const [quien, pagina, nombre] of [
        ['Mesero 1', mesero, 'mesero'],
        ['Caja', caja, 'cajera'],
        ['Dueño', duena, 'duena'],
      ] as const) {
        await pagina.goto(`/restaurante/mesa-activa?mesa=${mesaId}`);
        await pagina.waitForTimeout(2500);
        const quedo = new URL(pagina.url()).pathname;
        const acciones = pagina.getByRole('group', { name: /^Acciones de/ });
        const hayAcciones = await acciones.count();
        const dividir = await pagina.getByRole('button', { name: /Dividir/ }).count();
        await pagina.screenshot({ path: `${EVIDENCIA}/${nombre}-mesa-activa-tecleada.png` });
        anotar({
          aparato: quien === 'Mesero 1' ? 'tableta' : 'pc',
          quien,
          accion: `QA1-5: teclea /restaurante/mesa-activa?mesa=… de la mesa 15`,
          detalle: `queda en ${quedo}; grupo «Acciones de la mesa»: ${String(hayAcciones)}; botón «Dividir» en la pantalla: ${String(dividir)}`,
          esperado: 'Hay «Acciones de la mesa» con «Dividir»',
        });
      }
      await mesero.goto('/mesero');

      // La cajera: la cuenta en Pendientes y su cobro (¿hay «Dividir»?).
      await caja.goto('/caja');
      await caja.getByRole('tab', { name: /^Pendientes/ }).click();
      await caja
        .getByRole('button', { name: /^Mesa 15 Cuenta/ })
        .first()
        .click();
      await caja.waitForTimeout(1500);
      const dividirEnCaja = await caja.getByText(/Dividir/).count();
      await caja.screenshot({ path: `${EVIDENCIA}/cajera-cobro-sin-dividir.png` });
      await caja.keyboard.press('Escape');
      anotar({
        aparato: 'pc',
        quien: 'Caja',
        accion: 'QA1-5: abre la cuenta de la mesa 15 en Pendientes para cobrarla',
        detalle: `textos «Dividir» en el diálogo de cobro: ${String(dividirEnCaja)}`,
        esperado: 'La matriz deja dividir al cajero: debe haber por dónde',
      });
      await escribir(duena, '/api/restaurante/cancelar-orden', {
        ordenId,
        motivo: 'Captura de evidencia',
      });
      expect((await mesaEnElServidor(duena, 15)).estado).toBe('libre');
    });

    await test.step('QA1-7 · «Folio null» en la pre-cuenta, y QA1-2 · «Nueva mesa» con la zona en blanco', async () => {
      const [mesa] = await consultarPuente<{ id: string }>(duena, 'Mesa', {
        filtro: { numero: 16 },
        limite: 1,
      });
      const productos = await consultarPuente<{ id: string; nombre: string }>(
        duena,
        'ProductoTerminado',
        { limite: 200 },
      );
      const ap = await escribir(duena, '/api/restaurante/abrir-mesa', {
        mesaId: mesa?.id,
        personas: 2,
      });
      const ordenId = String(ap['ordenId']);
      await escribir(duena, '/api/restaurante/enviar-pedido', {
        ordenId,
        lineas: [
          { productoId: productos.find((p) => p.nombre === 'Guacamole')?.id, cantidad: '1' },
        ],
      });
      await escribir(duena, '/api/restaurante/solicitar-cuenta', { ordenId });
      await duena.goto(`/restaurante/precuenta?cuenta=${ordenId}`);
      await expect(duena.getByText('PRE-CUENTA')).toBeVisible({ timeout: 30_000 });
      const texto = (await duena.locator('body').innerText()).replace(/\s+/g, ' ');
      await duena.screenshot({ path: `${EVIDENCIA}/precuenta-folio-null.png` });
      anotar({
        aparato: 'pc',
        quien: 'Dueño',
        accion: 'QA1-7: abre /restaurante/precuenta de una cuenta pedida',
        detalle: `texto: ${/Folio[^·]*/.exec(texto)?.[0] ?? '(sin «Folio»)'}`,
        esperado: 'Un folio o nada; no la palabra «null»',
      });
      await escribir(duena, '/api/restaurante/cancelar-orden', {
        ordenId,
        motivo: 'Captura de evidencia',
      });

      await duena.goto('/configuracion?tab=mesas');
      await duena.getByRole('button', { name: 'Nueva mesa' }).click();
      const dialogo = duena.getByRole('dialog').filter({ hasText: 'Nombre visible' });
      await expect(dialogo).toBeVisible();
      await duena.screenshot({ path: `${EVIDENCIA}/nueva-mesa-zona-en-blanco.png` });
      await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    });
  } finally {
    await j.cerrar();
  }
});
