import { expect, test } from '@playwright/test';

import {
  cancelacionesDelCorte,
  cancelacionesDelDia,
  cancelarComoCajaConElPin,
  cancelarLaCuenta,
  elMeseroNoPuede,
  empezarElDia,
  ERROR_DEL_MESERO,
  FONDO_CENTAVOS,
  pedirLaCuenta,
  quitarUnPlatillo,
  SLUG,
  tocar,
} from './ayudantes/cancelar-desde-la-mesa.ts';
import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import { enPesos, exigirElPdfDelCorte } from './ayudantes/corte.ts';
import {
  abrirLaMesa,
  CARTA,
  cocinaDejaLista,
  comandar,
  dialogoDeLaMesa,
  esperadoDelCajon,
  exigirEstadoDeLaMesa,
  mesaEnElServidor,
} from './ayudantes/mesas-heredadas.ts';
import { personaDe } from './ayudantes/roles.ts';
import { abrirPantalla, consultarPuente, exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-12.4 · QUITAR Y CANCELAR DESDE LA MESA, Y EL CORTE LO DICE (DP-24 · Parte 2: ya no es del mesero).
 *
 * DP-24 · Lupita (mesera) NO ve «Quitar un platillo» ni «Cancelar la cuenta», y si manda el comando
 * a mano el servidor lo rechaza (403). La dueña los hace desde el diálogo de la mesa ocupada (sin
 * PIN), con tacto real en la tableta y el teléfono (`tap()`) y con el clic de la PC; y la caja
 * (Rosa) cancela con el PIN de la gerente (422 sin él). Después se lee lo que el servidor guardó y
 * se mira cómo lo dicen las dos hojas del corte —la de Cierre diario y la heredada de Registros—
 * y la pestaña «Cancelaciones» de Registros.
 *
 * ── Qué se provoca ───────────────────────────────────────────────────────────
 *   · Mesa 3 (sopa y guacamole): quita el guacamole ANTES de que cocina lo haga; cocina deja listo
 *     lo demás; cancela la cuenta con la sopa ya lista (el aviso de pérdida sale ANTES de cancelar).
 *   · Mesa 4 (tacos al pastor): cancela la cuenta ANTES de que cocina la prepare (sin aviso).
 *   · Mesa 5 (guacamole y arrachera): cocina deja listo; quita la arrachera (el platillo dice «Ya
 *     salió de cocina») y cancela la cuenta.
 *   · Mesa 6 (tacos al pastor): con la cuenta ya pedida, la caja cancela sólo con el PIN de la
 *     gerente (la autorización es de ESA cuenta); sin él, 422.
 *
 * ── Qué se afirma ────────────────────────────────────────────────────────────
 *   · Cada cancelación queda con QUIÉN canceló (la dueña; en la mesa 6, Rosa), el motivo y el
 *     importe; sólo lo que ya estaba listo es pérdida.
 *   · Las dos hojas del corte dicen lo mismo: la pérdida APARTE y resaltada, y lo cancelado antes
 *     de prepararse sin resaltar.
 *   · Registros enseña las cinco, con la marca de pérdida donde toca.
 */

test.describe('el mesero cancela desde su pantalla, y el corte lo dice', () => {
  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('quita un platillo y cancela tres cuentas; las dos hojas del corte y Registros lo dicen', async ({
    browser,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const dia = await empezarElDia(browser, info);
    const { duena, rosa, lupita, tono } = dia;
    const nombreDeLaDuena = personaDe(SLUG, 'dueno').nombre;
    const nombreDeRosa = personaDe(SLUG, 'cajero').nombre;
    const sesion = (await sesionDeLaCaja(rosa)) ?? '';
    expect(sesion, 'La caja de Rosa no quedó abierta.').not.toBe('');

    // ── MESA 3: quita el guacamole antes de que cocina lo haga, y cancela con la sopa lista ──
    await test.step('mesa 3: quita el guacamole ANTES de prepararse', async () => {
      await abrirLaMesa(lupita, duena, 3, 2);
      await comandar(lupita, 3, [
        { nombre: CARTA.sopa.nombre, veces: 1 },
        { nombre: CARTA.guacamole.nombre, veces: 1 },
      ]);
      // DP-24 · La mesera no ve los botones y el servidor le contesta 403 si manda el comando a mano.
      const enLaMesa3 = await mesaEnElServidor(duena, 3);
      const renglones = await consultarPuente<{ id?: string }>(duena, 'DetalleVenta', {
        filtro: { venta_id: enLaMesa3.ordenId ?? '' },
        limite: 5,
      });
      await elMeseroNoPuede(lupita, 3, enLaMesa3.ordenId ?? '', renglones[0]?.id ?? '');
      await quitarUnPlatillo(duena, info, 3, CARTA.guacamole.nombre, false);
      // La pantalla ya no lo lista: el segundo intento de quitar sólo ofrece la sopa.
      await tocar(
        dialogoDeLaMesa(duena, 3).getByRole('button', { name: 'Quitar un platillo' }),
        info,
      );
      const lista = duena.getByRole('dialog', { name: 'Quitar un platillo' });
      await expect(
        lista.getByRole('button', { name: `Quitar ${CARTA.sopa.nombre}` }),
      ).toBeVisible();
      await expect(
        lista.getByRole('button', { name: `Quitar ${CARTA.guacamole.nombre}` }),
      ).toHaveCount(0);
      await duena.keyboard.press('Escape');
      await expect(lista).toBeHidden();
    });

    await test.step('mesa 3: con la sopa LISTA, cancelar la cuenta avisa de la pérdida y la cuenta queda cancelada', async () => {
      const mesa = await mesaEnElServidor(duena, 3);
      await cocinaDejaLista(tono, duena, mesa.ordenId ?? '', 1);
      await cancelarLaCuenta(duena, info, 3, 'El cliente se fue sin pagar', true);
      await exigirEstadoDeLaMesa(duena, 3, 'libre', 'La mesa 3 cancelada no volvió al servicio.');
    });

    // ── MESA 4: cancela antes de que cocina prepare nada ─────────────────────────────────────
    await test.step('mesa 4: cancelar ANTES de prepararse no avisa de pérdida', async () => {
      await abrirLaMesa(lupita, duena, 4, 2);
      await comandar(lupita, 4, [{ nombre: CARTA.pastor.nombre, veces: 1 }]);
      await cancelarLaCuenta(duena, info, 4, 'Capturé la mesa equivocada', false);
      await exigirEstadoDeLaMesa(duena, 4, 'libre', 'La mesa 4 cancelada no volvió al servicio.');
    });

    // ── MESA 5: quita lo que ya salió, y cancela ─────────────────────────────────────────────
    await test.step('mesa 5: quitar un platillo que YA SALIÓ lo dice, y cancelar la cuenta también', async () => {
      await abrirLaMesa(lupita, duena, 5, 2);
      await comandar(lupita, 5, [
        { nombre: CARTA.guacamole.nombre, veces: 1 },
        { nombre: CARTA.arrachera.nombre, veces: 1 },
      ]);
      const mesa = await mesaEnElServidor(duena, 5);
      await cocinaDejaLista(tono, duena, mesa.ordenId ?? '', 1);
      await quitarUnPlatillo(duena, info, 5, CARTA.arrachera.nombre, true);
      await cancelarLaCuenta(duena, info, 5, 'Se fueron sin pagar', true);
      await exigirEstadoDeLaMesa(duena, 5, 'libre', 'La mesa 5 cancelada no volvió al servicio.');
    });

    // ── MESA 6: la cuenta pedida pide el PIN de la gerente (DP-13.2) ──────────────────────────
    await test.step('mesa 6: la caja cancela la cuenta PEDIDA sólo con el PIN de la gerente', async () => {
      await abrirLaMesa(lupita, duena, 6, 2);
      await comandar(lupita, 6, [{ nombre: CARTA.pastor.nombre, veces: 1 }]);
      const mesa = await mesaEnElServidor(duena, 6);
      await pedirLaCuenta(lupita, mesa.ordenId ?? '');
      await cancelarComoCajaConElPin(
        rosa,
        mesa.ordenId ?? '',
        'Se arrepintieron',
        personaDe(SLUG, 'gerente'),
      );
      await exigirEstadoDeLaMesa(duena, 6, 'libre', 'La mesa 6 cancelada no volvió al servicio.');
    });

    // ── LO QUE EL SERVIDOR GUARDÓ ────────────────────────────────────────────────────────────
    const cancelaciones =
      await test.step('el servidor guardó cada cancelación con quién, motivo, importe y pérdida', async () => {
        // DP-13.2 · El corte de la caja de Rosa (abierta) trae sólo las de SUS cuentas: lo que
        // canceló Lupita es del Cierre del día, y se lee del día de la sucursal.
        const deLaCaja = await cancelacionesDelCorte(rosa, sesion);
        expect(deLaCaja.alcance).toBe('caja');
        expect(
          deLaCaja.cancelaciones.filter((f) => f.mesa !== 'Mesa 6'),
          'Lo que canceló la dueña no es de la caja de Rosa.',
        ).toHaveLength(0);
        const filas = await cancelacionesDelDia(rosa);
        const de = (mesa: string, tipo: string) =>
          filas.find((f) => f.mesa === mesa && f.tipo === tipo);
        expect(filas, 'El día debe traer las seis cancelaciones.').toHaveLength(6);
        // La dueña canceló las mesas 3, 4 y 5; Rosa, con el PIN de la gerente, la 6.
        expect(
          filas.filter((f) => f.mesa !== 'Mesa 6').every((f) => f.usuario === nombreDeLaDuena),
        ).toBe(true);
        expect(de('Mesa 6', 'orden')?.usuario).toBe(nombreDeRosa);
        expect(de('Mesa 3', 'linea')).toMatchObject({
          producto: CARTA.guacamole.nombre,
          motivo: ERROR_DEL_MESERO,
          montoCentavos: String(CARTA.guacamole.centavos),
          perdida: false,
        });
        expect(de('Mesa 3', 'orden')).toMatchObject({
          motivo: 'El cliente se fue sin pagar',
          montoCentavos: String(CARTA.sopa.centavos),
          perdidaCentavos: String(CARTA.sopa.centavos),
          perdida: true,
        });
        expect(de('Mesa 4', 'orden')).toMatchObject({
          motivo: 'Capturé la mesa equivocada',
          montoCentavos: String(CARTA.pastor.centavos),
          perdida: false,
        });
        expect(de('Mesa 5', 'linea')).toMatchObject({
          producto: CARTA.arrachera.nombre,
          montoCentavos: String(CARTA.arrachera.centavos),
          perdida: true,
        });
        expect(de('Mesa 5', 'orden')).toMatchObject({
          motivo: 'Se fueron sin pagar',
          montoCentavos: String(CARTA.guacamole.centavos),
          perdidaCentavos: String(CARTA.guacamole.centavos),
          perdida: true,
        });
        expect(de('Mesa 6', 'orden')).toMatchObject({
          motivo: 'Se arrepintieron',
          perdidaCentavos: '0',
          perdida: false,
        });
        return filas;
      });
    expect(cancelaciones.filter((f) => f.perdida)).toHaveLength(3);

    // ── REGISTROS: la pestaña «Cancelaciones» ───────────────────────────────────────────────
    await test.step('Registros → Cancelaciones enseña las seis, con la marca de pérdida y su importe', async () => {
      await duena.goto('/registros?tab=cancelaciones');
      await expect(duena.getByText(/^Pérdida .+ · ya preparado$/)).toHaveCount(3, {
        timeout: 30_000,
      });
      await expect(duena.getByText('Antes de prepararse')).toHaveCount(3);
      await expect(duena.getByText(nombreDeLaDuena).first()).toBeVisible();
      await expect(duena.getByText('El cliente se fue sin pagar').first()).toBeVisible();
      await expect(duena.getByText(ERROR_DEL_MESERO).first()).toBeVisible();
      await duena.getByRole('button', { name: /^Sólo pérdidas/ }).click();
      await expect(duena.getByText('Antes de prepararse')).toHaveCount(0);
    });

    // ── EL CORTE DE CIERRE DIARIO (el del servidor) ──────────────────────────────────────────
    await test.step('Cierre diario: la hoja del servidor saca la pérdida APARTE, con quién, motivo e importe', async () => {
      const esperado = await esperadoDelCajon(rosa);
      await abrirPantalla(rosa, '/restaurante/cierre-diario-y-arqueo', /Cierre diario/);
      await rosa.locator('#contado').fill((esperado / 100).toFixed(2));
      await rosa.locator('#fondo').fill((FONDO_CENTAVOS / 100).toFixed(2));
      await rosa.getByRole('button', { name: 'CERRAR CAJA' }).click();
      await rosa.getByRole('button', { name: 'Sí, cerrar el día' }).click({ timeout: 30_000 });
      await expect(rosa.getByRole('heading', { name: 'Caja cerrada' })).toBeVisible({
        timeout: 30_000,
      });
      await exigirElPdfDelCorte(rosa, {
        titulo: 'CORTE DE CAJA',
        textos: [
          'Pérdidas por cancelación · ya preparado o entregado',
          'Cancelaciones antes de prepararse',
          nombreDeLaDuena,
          'El cliente se fue sin pagar',
          'Capturé la mesa equivocada',
          ERROR_DEL_MESERO,
          enPesos(CARTA.arrachera.centavos),
        ],
      });
      // La pérdida está en su propia sección resaltada, y la otra no lo está.
      const hoja = rosa.locator('#cash-cut-pdf-document');
      await expect(hoja.locator('section[data-tono="perdida"]')).toHaveCount(1);
      await expect(hoja.locator('section[data-tono="perdida"]')).toContainText('Mesa 3');
      await expect(hoja.locator('section[data-tono="perdida"]')).not.toContainText('Mesa 4');
    });

    // ── EL CORTE HEREDADO DE LA CAJA, abierto desde Registros ────────────────────────────────
    await test.step('Registros → Cortes: la hoja heredada dice lo MISMO, también quién canceló', async () => {
      await duena.goto('/registros');
      await duena.getByRole('button', { name: 'Ver PDF' }).first().click();
      const visor = duena.getByRole('dialog').filter({ hasText: 'Cancelaciones' });
      await expect(
        visor.getByText('Pérdidas por cancelación', { exact: false }).first(),
      ).toBeVisible({
        timeout: 30_000,
      });
      for (const texto of [
        'Cancelaciones antes de prepararse',
        nombreDeLaDuena,
        'El cliente se fue sin pagar',
        'Capturé la mesa equivocada',
        ERROR_DEL_MESERO,
      ]) {
        await expect(
          visor.getByText(texto).first(),
          `El corte heredado no dice «${texto}».`,
        ).toBeVisible();
      }
      // La pérdida es de la dueña (mesas 3 y 5); Rosa sólo canceló la mesa 6, que no es pérdida.
      const seccionDePerdida = visor.locator('section[data-tono="perdida"]');
      await expect(seccionDePerdida).toHaveCount(1);
      await expect(seccionDePerdida).not.toContainText(nombreDeRosa);
    });

    dia.exigirSinFallos();
  });
});
