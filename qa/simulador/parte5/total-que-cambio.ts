/**
 * HALLAZGO 12 · «EL TOTAL CAMBIÓ» CON EL COBRO ABIERTO, EN EL NAVEGADOR Y CON EL DEDO.
 *
 * La cajera (tableta 1024×768, dedo) abre el cobro de una mesa; el mesero (teléfono) agrega un
 * platillo a esa cuenta; la cajera toca «Cobrar» → sale el aviso «El total cambió…», el total en
 * pantalla pasa al nuevo y lo tecleado se limpia; cobra de nuevo y la cuenta queda pagada por el
 * total nuevo. Sale con código 1 si algo no pasa como debe.
 *
 *   node --conditions=react-server qa/simulador/parte5/total-que-cambio.ts --app … --base … --pines … --reloj … --salida …
 */
import { join } from 'node:path';

import { expect } from '@playwright/test';

import {
  abrirMesa,
  agregarLinea,
  alMapa,
  entrarALaMesa,
  enviarACocina,
  mesasEnPantalla,
} from '../bots/mesero-ui.ts';
import { pedirLaCuenta, quitarPlatillo } from '../bots/mesero-cuenta.ts';
import { leerCatalogo } from '../catalogo.ts';
import { ponerElDedo } from '../dedo.ts';
import { leerEntorno } from '../entorno.ts';
import { mundoVacio } from '../mundo.ts';
import {
  abrirCaja,
  decidirLaPropina,
  estadoDeLaCaja,
  irACaja,
  totalEnPantalla,
  traerLaCaja,
} from '../pantallas/caja.ts';
import { dialogoCon, tocarYEsperar } from '../pantallas/comun.ts';
import { abrirNavegador, sesionDe } from '../sesion.ts';

const entorno = leerEntorno();
const mundo = mundoVacio();
await leerCatalogo(mundo, entorno.baseUrl);
const sencillos = mundo.catalogo.filter(
  (p) => p.grupos.length === 0 && p.tipoVenta === 'precio_fijo',
);
const [primero, segundo] = sencillos.filter(
  (p) => p.precioCentavos > 0 && p.precioCentavos % 100 === 0,
);
if (primero === undefined || segundo === undefined)
  throw new Error('El catálogo no trae dos platillos sencillos.');

const navegador = await abrirNavegador();
let codigoDeSalida = 0;
let paginaDeLaCaja: import('@playwright/test').Page | undefined;
let paginaDelMesero: import('@playwright/test').Page | undefined;
try {
  const mesero = (await sesionDe(navegador, entorno, 'Mesero 1', 'android-412')).pagina;
  const caja = (await sesionDe(navegador, entorno, 'Caja', 'tableta-1024')).pagina;
  paginaDelMesero = mesero;
  mesero.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/'))
      void r.text().then((t) =>
        process.stdout
          .write(`mesero ${String(r.status())} ${new URL(r.url()).pathname} ${t.slice(0, 300)}
`),
      );
  });
  ponerElDedo(mesero);
  paginaDeLaCaja = caja;
  ponerElDedo(caja);

  // 0 · la cajera abre la caja (el mesero no puede pedir la cuenta con la caja cerrada)
  await irACaja(caja, entorno.appUrl);
  const estado = await estadoDeLaCaja(caja);
  if (estado === 'cerrada') await abrirCaja(caja, 100_000);
  if (estado === 'en-otro-aparato') await traerLaCaja(caja);

  // 1 · el mesero abre una mesa libre, pide un platillo y pide la cuenta
  await mesero.getByText(/mesa/i).first().waitFor({ timeout: 60_000 });
  const libre = (await mesasEnPantalla(mesero)).find((m) => m.estado === 'Libre');
  if (libre === undefined) throw new Error('El mesero no ve ninguna mesa libre.');
  const mesa = libre.numero;
  await abrirMesa(mesero, mesa, 2, { celebracion: false, alergia: '' });
  await agregarLinea(mesero, mesa, {
    producto: primero,
    cantidad: 1,
    opciones: [],
    nota: '',
    importeCentavos: primero.precioCentavos,
  });
  await agregarLinea(mesero, mesa, {
    producto: segundo,
    cantidad: 1,
    opciones: [],
    nota: '',
    importeCentavos: segundo.precioCentavos,
  });
  await enviarACocina(mesero, '');
  const precuenta = await pedirLaCuenta(mesero, mesa, 'sin');
  process.stdout.write(`mesa ${String(mesa)} · precuenta ${String(precuenta.totalCentavos)} ¢\n`);

  // 2 · la cajera (con el dedo) abre el cobro de esa mesa
  await caja.getByRole('tab', { name: /^Pendientes/ }).click();
  await caja
    .getByText(`Mesa ${String(mesa)}`, { exact: true })
    .first()
    .click();
  const cobro = dialogoCon(caja, `Cobrar — Mesa ${String(mesa)}`);
  await decidirLaPropina(caja, cobro, 'Sin propina');
  await expect(cobro).toBeVisible();
  const antes = await totalEnPantalla(cobro);
  await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await cobro.getByPlaceholder('0.00').fill(((antes + 50_000) / 100).toFixed(2));
  await caja.screenshot({ path: join(entorno.salida, 'h12-1-cobro-abierto.png') });

  // 3 · desde el aparato del mesero cambia la MISMA cuenta. Agregar un platillo ya no se puede una vez pedida
  //     la cuenta (el servidor responde ORDEN_NO_EDITABLE, a propósito); lo que sí puede el mesero, con el PIN
  //     de quien autoriza, es quitar un platillo: el total baja con el cobro abierto.
  await quitarPlatillo(mesero, mesa, segundo.nombre, 'Se equivocó', {
    entorno,
    persona: 'Gerente',
  });
  await alMapa(mesero);

  // 4 · la cajera toca «Cobrar»: el servidor rechaza, la pantalla se relee
  const rechazo = await tocarYEsperar(
    caja,
    cobro.getByRole('button', { name: /^Cobrar \$/ }),
    '/api/venta/cobrar',
  );
  process.stdout.write(
    `primer cobro: HTTP ${String(rechazo.estado)} ${rechazo.cuerpo.slice(0, 160)}\n`,
  );
  const nuevo = antes - segundo.precioCentavos;
  const fallas: string[] = [];
  if (rechazo.estado < 400) fallas.push('el servidor NO rechazó el cobro con el total viejo');
  await caja.waitForTimeout(1500);
  await caja.screenshot({ path: join(entorno.salida, 'h12-2-tras-el-aviso.png') });
  const aviso = await caja.locator('[data-sonner-toast]').allInnerTexts();
  if (!aviso.some((t) => /total cambi/i.test(t)))
    fallas.push(`no salió el aviso «El total cambió…» (avisos: ${aviso.join(' | ')})`);
  const despues = await totalEnPantalla(cobro).catch(() => -1);
  if (despues !== nuevo)
    fallas.push(`el total en pantalla es ${String(despues)} ¢ y debía pasar a ${String(nuevo)} ¢`);
  const tecleado = await cobro
    .getByPlaceholder('0.00')
    .inputValue()
    .catch(() => '');
  if (tecleado !== '') fallas.push(`lo tecleado no se limpió («${tecleado}»)`);

  // 5 · cobra de nuevo, por el total nuevo
  await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await cobro.getByPlaceholder('0.00').fill((nuevo / 100).toFixed(2));
  const cobrada = await tocarYEsperar(
    caja,
    cobro.getByRole('button', { name: /^Cobrar \$/ }),
    '/api/venta/cobrar',
  );
  const cuerpo = JSON.parse(cobrada.cuerpo) as { ok?: boolean; datos?: { totalCentavos?: string } };
  if (cobrada.estado !== 200 || cuerpo.ok !== true)
    fallas.push(`el segundo cobro falló: ${cobrada.cuerpo.slice(0, 200)}`);
  else if (Number(cuerpo.datos?.totalCentavos) !== nuevo)
    fallas.push(`se cobró ${String(cuerpo.datos?.totalCentavos)} y debía ser ${String(nuevo)}`);
  await caja.screenshot({ path: join(entorno.salida, 'h12-3-cobrada.png') });

  process.stdout.write(fallas.length === 0 ? 'H12-BIEN\n' : `H12-FALLA\n${fallas.join('\n')}\n`);
  codigoDeSalida = fallas.length === 0 ? 0 : 1;
} catch (error: unknown) {
  await paginaDelMesero
    ?.screenshot({ path: join(entorno.salida, 'h12-error-mesero.png') })
    .catch(() => undefined);
  await paginaDeLaCaja
    ?.screenshot({ path: join(entorno.salida, 'h12-error-caja.png') })
    .catch(() => undefined);
  process.stdout.write(`H12-ERROR ${String(error).slice(0, 800)}\n`);
  codigoDeSalida = 2;
} finally {
  await navegador.close();
}
process.exit(codigoDeSalida);
