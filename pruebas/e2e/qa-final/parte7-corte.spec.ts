import { join } from 'node:path';

import { sesionDeLaCaja } from '../ayudantes/conciliacion.ts';
import {
  abrirElQrDeLaMesa,
  CARTA,
  mesaEnElServidor,
  pesos,
  prepararElPortalDelComensal,
  yaAbierto,
} from '../ayudantes/mesas-heredadas.ts';
import { Equipo, contextoDe } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';
import {
  SLUG,
  cajaAbierta,
  capturar,
  mandar,
  mesaConPedido,
  buscarClave,
  cobrarLaMesa,
  resetearLaDemo,
  sqlLocal,
} from './parte7/comun.ts';

/**
 * PARTE 7 · puntos 5 (las propinas por mesero: corte y Registros dicen lo mismo, al centavo) y 6 (el
 * corte de turno no cierra la caja ni cambia folios, y sus números son un subconjunto exacto del
 * corte final), con el dedo en la Caja (Windows 1366×768 al 125 %).
 */

const MARIO = { nombre: 'Mario', pin: '5871' } as const;

interface PropinaDelServidor {
  readonly mesero: string;
  readonly centavos: number;
}

test.describe('parte 7 · propinas y cortes', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('5 · tres cuentas de dos meseros (efectivo, tarjeta y del portal): el corte y Registros dicen lo mismo por mesero, al centavo', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(15 * 60_000);
    const navegador = navegadorDe(browser, aparato);
    const equipo = new Equipo(navegador, SLUG);
    const abiertos: { close(): Promise<void> }[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      await mandar(duena, '/api/identidad/empleados', {
        nombre: MARIO.nombre,
        puesto: 'mesero',
        pin: MARIO.pin,
      });
      await prepararElPortalDelComensal(duena, { mesa: 3, zona: 'Interior', mesero: null });
      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      vigilarPagina(rosa);
      await cajaAbierta(rosa);
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);
      const contextoDeMario = await contextoDe(
        navegador,
        info,
        { slug: SLUG, nombre: MARIO.nombre, pin: MARIO.pin, rol: 'mesero' },
        join('pruebas', 'e2e', '.sesiones', `${SLUG}-mesero-mario-spec-p7.json`),
      );
      abiertos.push(contextoDeMario);
      await prepararContexto(contextoDeMario, aparato);
      const mario = contextoDeMario.pages()[0] ?? (await contextoDeMario.newPage());

      // Lupita: una en efectivo con el 10 %, otra con tarjeta con el 15 %. Mario: la del portal.
      const a = await mesaConPedido(lupita, duena, 1, [{ nombre: CARTA.arrachera.nombre }]);
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', {
        ordenId: a.ordenId,
        propinaTipo: 'porcentaje',
        propinaPuntosBase: 1000,
      });
      const b = await mesaConPedido(lupita, duena, 2, [
        { nombre: CARTA.guacamole.nombre, cantidad: '2' },
      ]);
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', {
        ordenId: b.ordenId,
        propinaTipo: 'porcentaje',
        propinaPuntosBase: 1500,
      });
      await mesaConPedido(mario, duena, 3, [{ nombre: 'Sopa de tortilla', cantidad: '2' }]);

      const token = (await mesaEnElServidor(duena, 3)).qrToken ?? '';
      expect(token, 'La mesa 3 no tiene su QR.').not.toBe('');
      const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      abiertos.push({ close: () => comensal.cerrar() });
      const telefono = comensal.page;
      await toque(telefono, telefono.getByRole('button', { name: 'Atención' }));
      await toque(telefono, telefono.getByRole('button', { name: 'Pedir cuenta' }));
      const hoja = telefono
        .locator('div.fixed.inset-0')
        .filter({ hasText: 'Pedir cuenta — Mesa 3' });
      await expect(hoja.getByText('¿Quieres dejar propina?')).toBeVisible();
      await toque(telefono, hoja.getByRole('button', { name: /^10%/ }));
      await toque(telefono, hoja.getByRole('button', { name: 'Confirmar' }));
      await expect(telefono.getByText('¡Cuenta solicitada!')).toBeVisible();

      const cobroA = await cobrarLaMesa(rosa, 1, 'Efectivo');
      const cobroB = await cobrarLaMesa(rosa, 2, 'Tarjeta');
      const cobroC = await cobrarLaMesa(rosa, 3, 'Efectivo');
      const esperada = {
        Lupita:
          Math.round(CARTA.arrachera.centavos * 0.1) +
          Math.round(CARTA.guacamole.centavos * 2 * 0.15),
        Mario: Math.round(CARTA.sopa.centavos * 2 * 0.1),
      };
      expect(cobroA.propinaCentavos).toBe(Math.round(CARTA.arrachera.centavos * 0.1));
      expect(cobroB.propinaCentavos).toBe(Math.round(CARTA.guacamole.centavos * 2 * 0.15));
      expect(cobroC.propinaCentavos).toBe(esperada.Mario);

      // ── Lo que dice Registros (propinas.del_rango) ──────────────────────────────────────────
      const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const hasta = new Date(Date.now() + 3_600_000).toISOString();
      const delRango = await mandar<{
        totalCentavos: string;
        meseros: readonly { meseroNombre?: string; mesero?: string; propinaCentavos: string }[];
      }>(duena, '/api/propinas/del-rango', { desde, hasta, estado: 'todas' });
      const enRegistros: PropinaDelServidor[] = delRango.meseros.map((m) => ({
        mesero: m.meseroNombre ?? m.mesero ?? '?',
        centavos: Number(m.propinaCentavos),
      }));

      // ── Lo que dice el corte (la hoja del servidor) ─────────────────────────────────────────
      const sesion = await sesionDeLaCaja(rosa);
      expect(sesion, 'La caja no tiene sesión.').not.toBeNull();
      const hojaDelCorte = await mandar<{
        propinasPorMesero: readonly { mesero: string | null; propinaCentavos: string }[];
      }>(rosa, '/api/caja/hoja-del-corte', { sesionCajaId: sesion });
      const filasDelCorte =
        (buscarClave(hojaDelCorte, 'propinasPorMesero') as
          readonly { mesero: string | null; propinaCentavos: string }[] | undefined) ?? [];
      const enElCorte: PropinaDelServidor[] = filasDelCorte.map((m) => ({
        mesero: m.mesero ?? '?',
        centavos: Number(m.propinaCentavos),
      }));
      process.stdout.write(
        `PROPINAS registros=${JSON.stringify(enRegistros)} corte=${JSON.stringify(enElCorte)}\n`,
      );

      const porNombre = (l: readonly PropinaDelServidor[]) =>
        Object.fromEntries(
          [...l]
            .sort((x, y) => x.mesero.localeCompare(y.mesero))
            .map((m) => [m.mesero, m.centavos]),
        );
      expect(porNombre(enElCorte), 'El corte no suma lo que se cobró por mesero.').toEqual(
        esperada,
      );
      expect(porNombre(enRegistros), 'Registros no dice lo mismo que el corte.').toEqual(
        porNombre(enElCorte),
      );
      // Y en pantalla, con el dedo: Registros → Propinas dice a cada mesero con su importe.
      await duena.goto('/registros', { waitUntil: 'domcontentloaded' });
      await toque(duena, duena.getByRole('tab', { name: /^Propinas/ }));
      for (const [mesero, centavos] of Object.entries(esperada)) {
        const fila = duena.getByText(mesero, { exact: true }).first();
        await expect(fila, `Registros no muestra a ${mesero}.`).toBeVisible({ timeout: 60_000 });
        await expect(duena.getByText(`$${pesos(centavos)}`).first()).toBeVisible();
      }
      await capturar(duena, 'propinas', aparato.id, 'registros-por-mesero');
    } finally {
      for (const c of abiertos) await c.close();
      await equipo.cerrar();
    }
  });

  test('6 · el corte de turno no cierra la caja ni cambia folios; sus números son un subconjunto exacto del corte final', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(15 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      vigilarPagina(rosa);
      await cajaAbierta(rosa);
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);

      const a = await mesaConPedido(lupita, duena, 1, [{ nombre: CARTA.arrachera.nombre }]);
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', {
        ordenId: a.ordenId,
        propinaTipo: 'sin_propina',
      });
      const cobroA = await cobrarLaMesa(rosa, 1, 'Efectivo');
      const sesion = (await sesionDeLaCaja(rosa)) ?? '';
      const folios = () =>
        sqlLocal(
          `select coalesce(string_agg(serie || '-' || folio::text, ',' order by folio), '') from ordenes where folio is not null`,
        );
      const foliosAntes = folios();

      // ── El corte de turno, con el dedo ───────────────────────────────────────────────────────
      await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
      await rosa.getByRole('tab', { name: /^Pendientes/ }).waitFor({ timeout: 90_000 });
      await toque(rosa, rosa.getByRole('button', { name: /Corte de turno/ }));
      const turno = rosa.getByRole('dialog', { name: /Corte de turno/ });
      await yaAbierto(turno);
      const resumenDelTurno = await turno.innerText();
      process.stdout.write(`TURNO: ${resumenDelTurno.replaceAll('\n', ' / ')}\n`);
      await capturar(rosa, 'corte-de-turno', aparato.id, 'turno');
      await turno
        .getByPlaceholder('0.00')
        .first()
        .fill(pesos(150_000 + cobroA.totalCentavos));
      const [hecho] = await Promise.all([
        rosa.waitForResponse((r) => new URL(r.url()).pathname === '/api/caja/corte-turno'),
        toque(
          rosa,
          turno.getByRole('button', { name: /Registrar|Confirmar|Guardar|Hacer corte/i }).last(),
        ),
      ]);
      expect(hecho.status(), await hecho.text()).toBe(200);
      await expect(rosa.getByText('Corte de turno registrado').first()).toBeVisible();

      // No cerró la caja y no tocó los folios de las ventas.
      expect(await sesionDeLaCaja(rosa), 'El corte de turno cerró la caja.').toBe(sesion);
      expect(folios(), 'El corte de turno cambió los folios.').toBe(foliosAntes);

      // ── Después del turno: otra cuenta, otra forma de pago; y el cierre final ───────────────
      const b = await mesaConPedido(lupita, duena, 2, [{ nombre: CARTA.guacamole.nombre }]);
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', {
        ordenId: b.ordenId,
        propinaTipo: 'sin_propina',
      });
      const cobroB = await cobrarLaMesa(rosa, 2, 'Tarjeta');

      const finalDelServidor = await mandar<{
        ventasPorMetodo?: readonly { metodo: string; ventasCentavos: string; pagos: number }[];
        totalVentasCentavos?: string;
      }>(rosa, '/api/caja/hoja-del-corte', { sesionCajaId: sesion });
      const porMetodo =
        (buscarClave(finalDelServidor, 'metodos') as
          readonly { metodo: string; ventasCentavos: string }[] | undefined) ?? [];
      process.stdout.write(`POR-METODO: ${JSON.stringify(porMetodo)}\n`);
      const efectivo = Number(porMetodo.find((m) => m.metodo === 'efectivo')?.ventasCentavos ?? -1);
      const tarjeta = Number(porMetodo.find((m) => m.metodo === 'tarjeta')?.ventasCentavos ?? -1);
      // Lo del turno (la arrachera en efectivo) está EXACTO dentro del final, y lo de después se suma.
      expect(efectivo, 'El efectivo del final no es el del turno.').toBe(cobroA.totalCentavos);
      expect(tarjeta, 'La tarjeta del final no es la cobrada después del turno.').toBe(
        cobroB.totalCentavos,
      );
      expect(resumenDelTurno).toContain(`$${pesos(cobroA.totalCentavos)}`);
      expect(resumenDelTurno).not.toContain(`$${pesos(cobroB.totalCentavos)}`);
    } finally {
      await equipo.cerrar();
    }
  });
});
