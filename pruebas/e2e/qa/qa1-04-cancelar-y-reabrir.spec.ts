import { expect, test } from '@playwright/test';

import {
  cancelarConElPinDelGerente,
  cancelarLaCuenta,
  quitarUnPlatillo,
} from '../ayudantes/cancelar-desde-la-mesa.ts';
import {
  abrirLaMesa,
  alMapa,
  avisosDeLaMesa,
  comandar,
  dialogoDeLaMesa,
  laMesa,
  mesaEnElServidor,
  yaAbierto,
} from '../ayudantes/mesas-heredadas.ts';
import { vigilarFallos } from '../ayudantes/sesion.ts';

import { anotar, leerEstado, Jornada, loQueDijo, pinDe, ultimoSonido } from './ayudantes-qa.ts';
import { comoPedido, importe, PRECIO, type Renglon } from './carta-qa.ts';
import {
  abrirEstaciones,
  cobrarEnCaja,
  entregarListos,
  pedirLaCuentaQa,
  sacarTodo,
} from './flujos-qa.ts';
import { agregarAlPortal, escanearConLista, pedirAyuda } from './portal-qa.ts';

/**
 * QA-1 · 04 · CANCELACIONES, ANULACIONES, CUENTA PEDIDA, SOLICITUDES Y VOZ.
 *   Mesa 13 · antes de preparar: quita el pastel y cancela la cuenta (nada se pierde, nada sale del almacén).
 *   Mesa 14 · con todo ya LISTO: quita el mole y cancela la cuenta (pérdida y merma «Por cancelación»).
 *   Mesa 15 · servida y con la cuenta PEDIDA: cancelar pide el PIN de la gerente.
 *   Mesa 17 · cuenta pedida, el comensal arma un pastel; el mesero reabre desde «Pedido del portal» y cobra (tarjeta).
 *   Mesa 6 (Mesero 2, teléfono) · una ayuda del portal con voz y sonido, y «Atender».
 */

const M13: readonly Renglon[] = [
  { platillo: 'corona', veces: 2 },
  { platillo: 'mole', veces: 1 },
  { platillo: 'pastel', veces: 1 },
];
const M14: readonly Renglon[] = [
  { platillo: 'mole', veces: 1 },
  { platillo: 'corona', veces: 1 },
  { platillo: 'guacamole', veces: 1 },
];
const M15: readonly Renglon[] = [{ platillo: 'victoria', veces: 2 }];
const M17_ANTES: readonly Renglon[] = [{ platillo: 'tlacoyo', veces: 2 }];
const M17_PASTEL: readonly Renglon[] = [{ platillo: 'pastel', veces: 1 }];

const asientoDeCancelacion = (mesa: number, tipo: string, monto: number, perdida: number) => {
  anotar({
    aparato: 'tableta',
    quien: 'Mesero 1',
    accion: `Mesa ${String(mesa)}: ${tipo}`,
    esperado: `monto ${String(monto)}, pérdida ${String(perdida)}`,
    datos: { tipo: 'cancelacion', mesa, que: tipo, monto, perdida },
  });
};

const asientoDeMerma = (mesa: number, insumo: string, cantidad: number) => {
  anotar({
    aparato: 'servidor',
    quien: 'Almacén',
    accion: `Merma «Por cancelación» de la mesa ${String(mesa)}`,
    esperado: `${insumo}: −${String(cantidad)}`,
    datos: { tipo: 'merma', mesa, insumo, cantidad },
  });
};

test.describe('QA-1 · 04 · cancelar, anular, reabrir y solicitudes', () => {
  test('cuatro cuentas que no se cobran como siempre, una reabierta y una ayuda con voz', async ({
    browser,
  }, info) => {
    test.setTimeout(25 * 60_000);
    const j = new Jornada(browser, info);
    const fallos: (() => void)[] = [];
    let esperandoRechazo = false;
    try {
      const tokens = leerEstado()['tokens'] as Record<string, string>;
      const duena = await j.pagina('Dueño Don Poncho', 'pc');
      const [caja, gerente] = [await j.pagina('Caja', 'pc'), await j.pagina('Gerente', 'tableta')];
      const mesero1 = await j.pagina('Mesero 1', 'tableta');
      const mesero2 = await j.pagina('Mesero 2', 'telefono');
      const cocinas = await abrirEstaciones(j);
      for (const p of [duena, caja, gerente, mesero1, mesero2, ...Object.values(cocinas)]) {
        fallos.push(vigilarFallos(p, { sondeando: () => esperandoRechazo }));
      }
      await caja.goto('/caja');
      await gerente.goto('/caja');
      await mesero1.goto('/mesero');
      await mesero2.goto('/mesero');

      await test.step('mesa 13: antes de preparar, quita el pastel y cancela la cuenta (sin pérdida)', async () => {
        await abrirLaMesa(mesero1, duena, 13, 2);
        await comandar(mesero1, 13, comoPedido(M13));
        await quitarUnPlatillo(mesero1, info, 13, 'Pastel de la casa', false);
        asientoDeCancelacion(13, 'anula el pastel antes de prepararse', importe([M13[2]!]), 0);
        await cancelarLaCuenta(mesero1, info, 13, 'Capturé la mesa equivocada', false);
        asientoDeCancelacion(
          13,
          'cancela la cuenta antes de prepararse',
          importe(M13.slice(0, 2)),
          0,
        );
      });

      await test.step('mesa 14: con todo LISTO, quita el mole y cancela la cuenta (pérdida y merma)', async () => {
        await abrirLaMesa(mesero1, duena, 14, 2);
        await comandar(mesero1, 14, comoPedido(M14));
        await alMapa(mesero1);
        expect(await sacarTodo(cocinas, M14)).toBe(3);
        await laMesa(mesero1, 14).click();
        await yaAbierto(dialogoDeLaMesa(mesero1, 14));
        await quitarUnPlatillo(mesero1, info, 14, 'Mole con pollo', true);
        asientoDeCancelacion(
          14,
          'anula el mole que ya salió',
          PRECIO.mole.centavos,
          PRECIO.mole.centavos,
        );
        asientoDeMerma(14, 'Mole poblano', 50);
        asientoDeMerma(14, 'Pollo', 300);
        await cancelarLaCuenta(mesero1, info, 14, 'Se fueron sin pagar', true);
        const resto = importe([M14[1]!, M14[2]!]);
        asientoDeCancelacion(
          14,
          'cancela la cuenta con la bebida y el guacamole ya listos',
          resto,
          resto,
        );
        asientoDeMerma(14, 'Cerveza Corona', 1);
        asientoDeMerma(14, 'Aguacate', 250);
      });

      await test.step('mesa 15: servida y con la cuenta pedida, cancelar pide el PIN de la gerente', async () => {
        await abrirLaMesa(mesero1, duena, 15, 2);
        await comandar(mesero1, 15, comoPedido(M15));
        await alMapa(mesero1);
        expect(await sacarTodo(cocinas, M15)).toBe(1);
        await entregarListos(mesero1, 15);
        await pedirLaCuentaQa(mesero1, 15, null);
        if (!(await dialogoDeLaMesa(mesero1, 15).isVisible())) await laMesa(mesero1, 15).click();
        await yaAbierto(dialogoDeLaMesa(mesero1, 15));
        esperandoRechazo = true; // el 422 «sin PIN» es la respuesta que se espera
        await cancelarConElPinDelGerente(mesero1, info, 15, 'Se arrepintieron', {
          nombre: 'Gerente',
          pin: pinDe('Gerente'),
        });
        esperandoRechazo = false;
        asientoDeCancelacion(
          15,
          'cancela con la cuenta pedida y el PIN de la gerente',
          importe(M15),
          importe(M15),
        );
        asientoDeMerma(15, 'Cerveza Victoria', 2);
      });

      await test.step('mesa 17: cuenta pedida, el comensal arma un pastel y el mesero reabre y envía', async () => {
        await abrirLaMesa(mesero1, duena, 17, 2);
        await comandar(mesero1, 17, comoPedido(M17_ANTES));
        await alMapa(mesero1);
        expect(await sacarTodo(cocinas, M17_ANTES)).toBe(1);
        await entregarListos(mesero1, 17);
        // El comensal arma su pastel ANTES de que se pida la cuenta (después el portal ya no deja agregar).
        const tel = await j.comensal(tokens['17'] ?? '');
        fallos.push(vigilarFallos(tel));
        await agregarAlPortal(tel, 'pastel');
        await pedirLaCuentaQa(mesero1, 17, null);
        await tel.getByRole('button', { name: /^Pedido de la mesa/ }).click();
        const hoja = tel.getByRole('dialog', { name: 'El pedido de la mesa' });
        await expect(hoja.getByText('Tu cuenta ya se pidió: tu mesero lo revisa.')).toBeVisible();
        await expect(hoja.getByRole('button', { name: 'Enviar a cocina' })).toHaveCount(0);
        await hoja.getByRole('button', { name: 'Seguir viendo el menú' }).click();

        await escanearConLista(mesero1, 17);
        const portal = mesero1.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' });
        await expect(portal.getByText(/La cuenta de esta mesa ya se pidió/)).toBeVisible();
        await portal.getByRole('button', { name: 'Reabrir la cuenta y enviar' }).click();
        await mesero1
          .getByRole('alertdialog')
          .getByRole('button', { name: 'Reabrir y enviar' })
          .click();
        await expect(mesero1.getByText('Pedido de la mesa 17 enviado a cocina.')).toBeVisible();
        expect((await mesaEnElServidor(duena, 17)).estado).not.toBe('cuenta_solicitada');
        expect(await sacarTodo(cocinas, M17_PASTEL)).toBe(1);
        await entregarListos(mesero1, 17);
        await pedirLaCuentaQa(mesero1, 17, null);
        const venta = importe(M17_ANTES) + importe(M17_PASTEL);
        const hecho = await cobrarEnCaja(
          gerente,
          /^Mesa 17 Cuenta/,
          'Mesa 17',
          { metodo: 'Tarjeta' },
          'Sin propina',
        );
        expect(hecho).toMatchObject({ ventaCentavos: venta, propinaCentavos: 0 });
        anotar({
          aparato: 'tableta',
          quien: 'Gerente',
          accion:
            'Cobra la mesa 17 (cuenta reabierta con un pastel del portal) con tarjeta, sin propina',
          esperado: `venta ${String(venta)}`,
          datos: {
            tipo: 'cobro',
            mesa: 17,
            caja: 'Gerente',
            venta,
            propina: 0,
            efectivo: 0,
            tarjeta: venta,
            transferencia: 0,
            cambio: 0,
          },
        });
      });

      await test.step('mesa 6 (Mesero 2, teléfono): una ayuda del portal suena, habla y se atiende', async () => {
        await mesero2.getByRole('button', { name: /^Solicitudes/ }).click();
        const tel = await j.comensal(tokens['6'] ?? '');
        await pedirAyuda(tel);
        const fila = mesero2.getByRole('listitem', { name: 'Mesa 6: Necesita ayuda' });
        await expect(fila).toBeVisible({ timeout: 30_000 });
        await expect
          .poll(async () => (await loQueDijo(mesero2)).join(' | '), {
            message: 'No dijo la ayuda de la mesa 6.',
          })
          .toContain('Mesa 6 requiere ayuda.');
        anotar({
          aparato: 'telefono',
          quien: 'Mesero 2',
          accion: 'Recibe la ayuda de la mesa 6 en «Solicitudes»',
          detalle: `voz: ${(await loQueDijo(mesero2)).join(' | ')}; último sonido: ${String(await ultimoSonido(mesero2))}`,
          esperado: 'Voz «Mesa 6 requiere ayuda.» y un sonido de aviso',
        });
        await mesero2.getByRole('button', { name: 'Atender Mesa 6: Necesita ayuda' }).click();
        await expect(fila).toBeHidden({ timeout: 20_000 });
        expect((await avisosDeLaMesa(duena, 6)).map((a) => a.estado)).toContain('atendida');
      });
      for (const exigir of fallos) exigir();
    } finally {
      await j.cerrar();
    }
  });
});
