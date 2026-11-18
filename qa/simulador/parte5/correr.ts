/**
 * LA PARTE 5 POR PANTALLAS (DP-22), contra el libro independiente: vender por los canales, cancelar,
 * contar y mermar, comprar. Todo con el dedo (toques, `hasTouch`) y de verdad por las pantallas; sólo
 * el árbitro lee la base (sólo lectura). Cada punto compara lo que el LIBRO espera (receta × lo
 * vendido, de los datos del día 0) contra lo que el sistema hizo, al gramo y al centavo.
 *
 *   node --conditions=react-server qa/simulador/parte5/correr.ts --app … --base … --pines … --reloj … --salida …
 *     [--solo mesa,llevar,…]
 */
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { pedirLaCuenta, quitarPlatillo } from '../bots/mesero-cuenta.ts';
import {
  abrirMesa,
  agregarLinea,
  alMapa,
  enviarACocina,
  mesasEnPantalla,
} from '../bots/mesero-ui.ts';
import { leerCatalogo } from '../catalogo.ts';
import { ponerElDedo } from '../dedo.ts';
import { leerEntorno } from '../entorno.ts';
import { mundoVacio } from '../mundo.ts';
import type { LineaPlaneada } from '../pedido.ts';
import {
  abrirCaja,
  cobrar,
  decidirLaPropina,
  estadoDeLaCaja,
  irACaja,
  traerLaCaja,
} from '../pantallas/caja.ts';
import { dialogoCon } from '../pantallas/comun.ts';
import { ajustarStock, irAInventario } from '../pantallas/inventario.ts';
import { armarParaLlevar } from '../pantallas/para-llevar.ts';
import { abrirNavegador, sesionDe } from '../sesion.ts';
import {
  abrirInforme,
  cambio,
  captura,
  esperadoPorVentas,
  ahoraDeLaBase,
  fotoDeExistencias,
  importeDelKardex,
  lineaDe,
  type Informe,
} from './ayudas-p5.ts';

const entorno = leerEntorno();
const salida = join(entorno.salida, 'parte5');
const informe = abrirInforme(salida);
const solo = (process.argv[process.argv.indexOf('--solo') + 1] ?? '')
  .split(',')
  .filter((x) => x !== '');
const quiere = (paso: string): boolean => solo.length === 0 || solo.includes(paso);
const mundo = mundoVacio();
await leerCatalogo(mundo, entorno.baseUrl);
const catalogo = mundo.catalogo;

interface Puestos {
  readonly mesero: Page;
  readonly caja: Page;
  readonly cocina: Page;
  readonly dueno: Page;
}

/** Los pesos del diccionario del libro: lo que el sistema debe haber movido por lo vendido. */
async function compararConsumo(
  paso: string,
  punto: string,
  antes: ReturnType<typeof cambio>,
  lineas: readonly { producto: string; cantidad: number }[],
  pagina: Page,
): Promise<void> {
  const esperado = esperadoPorVentas(lineas);
  const claves = [...new Set([...esperado.keys(), ...antes.keys()])].sort();
  const e = Object.fromEntries(claves.map((k) => [k, esperado.get(k) ?? 0]));
  const o = Object.fromEntries(claves.map((k) => [k, antes.get(k) ?? 0]));
  const ruta = await captura(pagina, salida, `${paso}-${punto.replace(/\W+/g, '_')}`);
  informe.punto(paso, punto, e, o, ruta);
}

async function cajaLista(caja: Page): Promise<void> {
  await irACaja(caja, entorno.appUrl);
  const estado = await estadoDeLaCaja(caja);
  if (estado === 'cerrada') await abrirCaja(caja, 100_000);
  if (estado === 'en-otro-aparato') await traerLaCaja(caja);
}

/** Una cuenta de mesa completa: el mesero pide, envía y pide la cuenta; la cajera la cobra con efectivo. */
async function ventaDeMesa(
  p: Puestos,
  paso: string,
  lineas: readonly LineaPlaneada[],
  alEnviar?: () => Promise<void>,
): Promise<{ mesa: number; total: number }> {
  const libre = (await mesasEnPantalla(p.mesero)).find((m) => m.estado === 'Libre');
  if (libre === undefined) throw new Error('No hay una mesa libre.');
  const mesa = libre.numero;
  await abrirMesa(p.mesero, mesa, 2, { celebracion: false, alergia: '' });
  for (const l of lineas) await agregarLinea(p.mesero, mesa, l);
  await enviarACocina(p.mesero, '');
  if (alEnviar !== undefined) await alEnviar();
  await pedirLaCuenta(p.mesero, mesa, 'sin');
  await alMapa(p.mesero);
  await irACaja(p.caja, entorno.appUrl);
  await p.caja.getByRole('tab', { name: /^Pendientes/ }).click();
  await p.caja
    .getByText(`Mesa ${String(mesa)}`, { exact: true })
    .first()
    .click();
  const cobro = dialogoCon(p.caja, `Cobrar — Mesa ${String(mesa)}`);
  await decidirLaPropina(p.caja, cobro, 'Sin propina');
  const total = lineas.reduce((s, l) => s + l.importeCentavos, 0);
  const cobrado = await cobrar(p.caja, cobro, {
    metodo: 'Efectivo',
    recibidoCentavos: total + 10_000,
  });
  informe.punto(
    paso,
    `total cobrado de la mesa ${String(mesa)} (centavos)`,
    total,
    cobrado.totalCentavos,
  );
  return { mesa, total };
}

async function pasoMesa(p: Puestos): Promise<void> {
  // 1 · Mesa por pieza, con opciones: 3 tacos y una hamburguesa con queso y tocino.
  const lineas = [
    lineaDe(catalogo, 'Taco de prueba', 3),
    lineaDe(catalogo, 'Hamburguesa de prueba', 1, [
      { grupo: 'Extras', opcion: 'Queso' },
      { grupo: 'Extras', opcion: 'Tocino' },
    ]),
  ];
  let alEnviar: ReturnType<typeof cambio> | undefined;
  const antes = await fotoDeExistencias(entorno.baseUrl);
  const enLaCocina = async (): Promise<void> => {
    alEnviar = cambio(antes, await fotoDeExistencias(entorno.baseUrl));
  };
  await ventaDeMesa(p, 'mesa', lineas, enLaCocina);
  informe.punto(
    'mesa',
    'al ENVIAR a cocina el almacén no se mueve (la receta baja al cobrar)',
    {},
    Object.fromEntries(alEnviar ?? []),
  );
  const despues = await fotoDeExistencias(entorno.baseUrl);
  await compararConsumo(
    'mesa',
    'tras cobrar: lo que bajó cada insumo',
    cambio(antes, despues),
    lineas.map((l) => ({ producto: l.producto.nombre, cantidad: l.cantidad })),
    p.caja,
  );
}

async function pasoPeso(p: Puestos): Promise<void> {
  // Barbacoa por kilo (½ kg), costillar sólo en presentaciones (1 kg) y arrachera libre (0.35 kg).
  const lineas = [
    lineaDe(catalogo, 'Barbacoa por kilo de prueba', 0.5),
    lineaDe(catalogo, 'Costillar de prueba', 1),
    lineaDe(catalogo, 'Arrachera por peso de prueba', 0.35),
  ];
  const antes = await fotoDeExistencias(entorno.baseUrl);
  await ventaDeMesa(p, 'peso', lineas);
  const despues = await fotoDeExistencias(entorno.baseUrl);
  await compararConsumo(
    'peso',
    'tras cobrar: gramos de carne por peso',
    cambio(antes, despues),
    lineas.map((l) => ({ producto: l.producto.nombre, cantidad: l.cantidad })),
    p.caja,
  );
}

async function pasoLlevar(p: Puestos): Promise<void> {
  const renglones = [
    { producto: 'Taco de prueba', veces: 4 },
    { producto: 'Flan de prueba', veces: 2 },
  ];
  const antes = await fotoDeExistencias(entorno.baseUrl);
  await irACaja(p.caja, entorno.appUrl);
  const { cobro } = await armarParaLlevar(p.caja, 'Rosa', renglones);
  await decidirLaPropina(p.caja, cobro, 'Sin propina').catch(() => undefined);
  const total = 4 * 3500 + 2 * 5500;
  const cobrado = await cobrar(p.caja, cobro, {
    metodo: 'Efectivo',
    recibidoCentavos: total + 5_000,
  });
  informe.punto('llevar', 'total cobrado del para llevar (centavos)', total, cobrado.totalCentavos);
  const despues = await fotoDeExistencias(entorno.baseUrl);
  await compararConsumo(
    'llevar',
    'tras cobrar: lo que bajó cada insumo',
    cambio(antes, despues),
    renglones.map((r) => ({ producto: r.producto, cantidad: r.veces })),
    p.caja,
  );
}

/** Toca el botón de la tarjeta de la cocina que dice «Mesa N» (la nuestra entre las demás). */
async function tocarEnLaCocina(
  cocina: Page,
  boton: 'Preparar' | 'Listo',
  mesa: number,
): Promise<void> {
  const limite = Date.now() + 90_000;
  let primera = true;
  while (Date.now() < limite) {
    if (primera)
      await cocina
        .goto(`${entorno.appUrl}/cocina`, { waitUntil: 'domcontentloaded' })
        .catch(() => undefined);
    primera = false;
    const botones = cocina.getByRole('button', { name: boton, exact: true });
    const n = await botones.count();
    for (let i = 0; i < n; i += 1) {
      const tarjeta = botones
        .nth(i)
        .locator(
          'xpath=ancestor::*[contains(normalize-space(.), "Mesa") or contains(normalize-space(.), "PARA LLEVAR")][1]',
        );
      const texto = await tarjeta.innerText();
      if (new RegExp(`Mesa ${String(mesa)}(?!\d)`).test(texto)) {
        const r = cocina.waitForResponse(
          (x) => new URL(x.url()).pathname === '/api/restaurante/transicionar-pedido',
          { timeout: 45_000 },
        );
        await botones.nth(i).click();
        if ((await r).status() !== 200) throw new Error(`transicionar-pedido rechazó «${boton}»`);
        return;
      }
    }
    await cocina.waitForTimeout(2_000);
  }
  await captura(cocina, salida, `cocina-sin-${boton}-mesa-${String(mesa)}`);
  throw new Error(
    `La cocina no muestra «${boton}» para la mesa ${String(mesa)} (captura cocina-sin-…).`,
  );
}

async function pasoCancelar(p: Puestos): Promise<void> {
  const desde = await ahoraDeLaBase(entorno.baseUrl);
  const antes = await fotoDeExistencias(entorno.baseUrl);
  const libre = (await mesasEnPantalla(p.mesero)).find((m) => m.estado === 'Libre');
  if (libre === undefined) throw new Error('No hay una mesa libre.');
  const mesa = libre.numero;
  await abrirMesa(p.mesero, mesa, 2, { celebracion: false, alergia: '' });
  await agregarLinea(p.mesero, mesa, lineaDe(catalogo, 'Taco de prueba', 2));
  await agregarLinea(p.mesero, mesa, lineaDe(catalogo, 'Flan de prueba', 1));
  await enviarACocina(p.mesero, '');
  // 1 · Lo NO preparado: se quita el flan (cocina no lo tocó) y el almacén no se mueve.
  await quitarPlatillo(p.mesero, mesa, 'Flan de prueba', 'Se equivocó', null);
  await alMapa(p.mesero);
  await compararConsumo(
    'cancelar',
    'lo NO preparado que se quita no mueve el almacén',
    cambio(antes, await fotoDeExistencias(entorno.baseUrl)),
    [],
    p.mesero,
  );
  informe.punto(
    'cancelar',
    'merma por cancelación tras quitar lo no preparado (centavos)',
    0,
    Math.abs(await importeDelKardex(entorno.baseUrl, 'merma', desde)),
  );
  // 2 · Lo YA preparado: la cocina lo deja listo y al quitarlo sale del almacén como merma «Por cancelación».
  await tocarEnLaCocina(p.cocina, 'Preparar', mesa);
  await tocarEnLaCocina(p.cocina, 'Listo', mesa);
  await quitarPlatillo(p.mesero, mesa, 'Taco de prueba', 'Se equivocó', {
    entorno,
    persona: 'Gerente',
  });
  await alMapa(p.mesero);
  const despues = await fotoDeExistencias(entorno.baseUrl);
  // El libro: 2 tacos preparados que se pierden = su receta completa sale como merma (no es una venta).
  const esperado = esperadoPorVentas([{ producto: 'Taco de prueba', cantidad: 2 }]);
  const real = cambio(antes, despues);
  informe.punto(
    'cancelar',
    'lo YA preparado que se quita sale como merma (tortillas y carne)',
    Object.fromEntries([...esperado].sort()),
    Object.fromEntries([...real].sort()),
    await captura(p.mesero, salida, 'cancelar-preparado'),
  );
  // 2 tacos = 4 tortillas a 150 ¢ + 120 g de carne a 18 ¢ = 600 + 2160 ¢.
  informe.punto(
    'cancelar',
    'importe de la merma «Por cancelación» en el kardex (centavos)',
    2760,
    Math.abs(await importeDelKardex(entorno.baseUrl, 'merma', desde)),
  );
}

async function pasoInventario(p: Puestos): Promise<void> {
  const desde = await ahoraDeLaBase(entorno.baseUrl);
  const antes = await fotoDeExistencias(entorno.baseUrl);
  await irAInventario(p.dueno, entorno.appUrl);
  // Merma de 2 kg de carne (a 18 ¢ el gramo: $7,200 los 40 kg del día 0).
  await ajustarStock(p.dueno, 'Carne de prueba', {
    tipo: 'Merma / producto perdido',
    metodo: 'diferencia',
    signo: 'restar',
    cantidad: 2000,
    unidad: 'g',
    motivo: 'Parte 5: merma de 2 kg',
  });
  const trasMerma = await fotoDeExistencias(entorno.baseUrl);
  informe.punto(
    'inventario',
    'merma manual de 2 000 g de carne baja 2 000 g',
    { 'Carne de prueba': -2000 },
    Object.fromEntries(cambio(antes, trasMerma)),
    await captura(p.dueno, salida, 'inventario-merma'),
  );
  // HALLAZGO: «Merma / producto perdido» de Inventario → Ajustar se anota como `ajuste` con motivo
  // `ajuste_conteo`, no como `merma`: el corte (sólo mira `merma` y `salida_consumo_interno`) no la cuenta.
  informe.punto(
    'inventario',
    'la merma de la pantalla vale lo que cuesta en el kardex como ajuste (2 000 g × 18 ¢, centavos)',
    36000,
    Math.abs(await importeDelKardex(entorno.baseUrl, 'ajuste', desde)),
  );
  informe.punto(
    'inventario',
    'la merma de la pantalla queda como movimiento «merma» (el corte la cuenta) — importe en centavos',
    36000,
    Math.abs(await importeDelKardex(entorno.baseUrl, 'merma', desde)),
  );
  // Conteo físico: el pan se cuenta en 70 piezas (corrección de conteo, stock final).
  await irAInventario(p.dueno, entorno.appUrl);
  await ajustarStock(p.dueno, 'Pan de prueba', {
    tipo: 'Corrección de conteo',
    metodo: 'final',
    cantidad: 70,
    unidad: 'pieza',
    motivo: 'Parte 5: conteo físico',
  });
  const trasConteo = await fotoDeExistencias(entorno.baseUrl);
  informe.punto(
    'inventario',
    'tras el conteo físico el pan queda en 70',
    70,
    trasConteo.get('Pan de prueba'),
    await captura(p.dueno, salida, 'inventario-conteo'),
  );
}

const PASOS: readonly {
  readonly nombre: string;
  readonly correr: (p: Puestos) => Promise<void>;
}[] = [
  { nombre: 'mesa', correr: pasoMesa },
  { nombre: 'peso', correr: pasoPeso },
  { nombre: 'llevar', correr: pasoLlevar },
  { nombre: 'cancelar', correr: pasoCancelar },
  { nombre: 'inventario', correr: pasoInventario },
];

const navegador = await abrirNavegador();
let salidaDelProceso = 0;
try {
  const mesero = (await sesionDe(navegador, entorno, 'Mesero 1', 'android-412')).pagina;
  const caja = (await sesionDe(navegador, entorno, 'Caja', 'tableta-1024')).pagina;
  const cocina = (await sesionDe(navegador, entorno, 'Cocina', 'tableta-1024')).pagina;
  const dueno = (await sesionDe(navegador, entorno, 'Dueño Don Poncho', 'tableta-1024')).pagina;
  ponerElDedo(dueno);
  ponerElDedo(mesero);
  ponerElDedo(caja);
  ponerElDedo(cocina);
  await cajaLista(caja);
  for (const paso of PASOS) {
    if (!quiere(paso.nombre)) continue;
    try {
      await paso.correr({ mesero, caja, cocina, dueno });
    } catch (error: unknown) {
      salidaDelProceso = 1;
      informe.nota(paso.nombre, `PASO ROTO: ${String(error).slice(0, 500)}`);
      await captura(caja, salida, `${paso.nombre}-roto-caja`);
      await captura(mesero, salida, `${paso.nombre}-roto-mesero`);
    }
  }
} finally {
  await navegador.close();
}
const todos = informe.puntos();
process.stdout.write(
  `PARTE5 ${String(todos.filter((x) => x.cuadra).length)}/${String(todos.length)} puntos cuadran\n`,
);
process.exit(salidaDelProceso);
