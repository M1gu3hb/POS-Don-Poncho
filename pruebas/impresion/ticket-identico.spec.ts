import { writeFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { emular } from '../../apps/web/src/impresion/termico/emulador.ts';
import {
  puntosDistintos,
  puntosNegros,
  type MapaDeBits,
} from '../../apps/web/src/impresion/termico/mapa.ts';
import { UMBRAL_POR_OMISION } from '../../apps/web/src/impresion/termico/monocromo.ts';
import { deBase64 } from '../../apps/web/src/impresion/termico/trabajo.ts';
import { leerArnes } from './empaquetar.ts';

/**
 * DP-20 · refuerzo §1.5 · EL TICKET QUE SALE ES EL QUE ENSEÑA EL POS, PUNTO POR PUNTO.
 *
 * Con un navegador de verdad y sin hardware: el componente del ticket se dibuja como en
 * producción (HTML → imagen de 1 bit), se codifica a ESC/POS y esos bytes se leen de vuelta con
 * la impresora falsa. Dos comprobaciones por caso:
 *
 *   1. PUNTO POR PUNTO: el papel que sale de los bytes es idéntico a la imagen que se dibujó.
 *      Cero puntos de diferencia.
 *   2. CONTRA LA PANTALLA: la captura del ticket en pantalla, al mismo ancho y con el mismo
 *      umbral, difiere del papel en una fracción mínima de puntos (el suavizado de los bordes),
 *      fuera del logo —que va tramado y por eso se compara sólo en la primera—.
 *
 * En 58 y 80 mm, con logo y sin logo, con una nota larga, acentos y ñ.
 */

interface MapaEnviado {
  readonly ancho: number;
  readonly alto: number;
  readonly base64: string;
}

interface Impreso {
  readonly base64: string;
  readonly puntos: number;
  readonly lineasAntesDelCorte: number;
  readonly avisos: readonly string[];
  readonly mapas: readonly MapaEnviado[];
}

interface Montado {
  readonly ancho: number;
  readonly alto: number;
  readonly anchoEnPantalla: number;
  readonly texto: string;
  readonly logos: readonly { x: number; y: number; ancho: number; alto: number }[];
}

interface Caso {
  readonly papelMm: 58 | 80;
  readonly conLogo: boolean;
  readonly franjaFilas?: number;
  readonly copias?: number;
  readonly desdeElNodo?: boolean;
  readonly reimpresion?: string;
  /** DP-21 · Bloque 12: los renglones del ticket que el dueño apagó. */
  readonly ocultos?: readonly string[];
}

/** El interlineado de fábrica: lo que avanza cada línea antes del corte. */
const PUNTOS_POR_LINEA = 30;
/**
 * Contra la captura de la pantalla. El suavizado de las letras no es idéntico en la captura y en el
 * dibujo (uno pasa por el compositor de la pantalla; el otro, por una imagen), así que al aplicar
 * el umbral algunos puntos del BORDE de cada letra caen de un lado u otro. Lo que NO puede pasar es
 * tinta fuera de lugar: un punto negro sin ningún punto negro vecino en la otra imagen sería una
 * letra corrida, un renglón de más o una raya que no existe.
 */
const PUNTOS_DE_BORDE_TOLERADOS = 0.008;
const TINTA_FUERA_DE_LUGAR_TOLERADA = 0.0005;

/** ¿Hay tinta en `mapa` a un punto de distancia de (x, y)? */
function hayTintaCerca(mapa: MapaDeBits, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= mapa.ancho || ny >= mapa.alto) continue;
      if (mapa.puntos[ny * mapa.ancho + nx] === 1) return true;
    }
  }
  return false;
}

const mapaDe = (enviado: MapaEnviado): MapaDeBits => ({
  ancho: enviado.ancho,
  alto: enviado.alto,
  puntos: deBase64(enviado.base64),
});

const recorte = (mapa: MapaDeBits, desde: number, alto: number): MapaDeBits => ({
  ancho: mapa.ancho,
  alto,
  puntos: mapa.puntos.slice(desde * mapa.ancho, (desde + alto) * mapa.ancho),
});

const guion = leerArnes();

async function abrir(page: Page): Promise<void> {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.setContent('<!doctype html><html lang="es"><body style="margin:0"></body></html>');
  await page.addScriptTag({ content: guion });
}

const montar = (page: Page, caso: Caso): Promise<Montado> =>
  page.evaluate(
    (c) => (window as unknown as { arnes: { montar(c: Caso): Promise<Montado> } }).arnes.montar(c),
    caso,
  );

const imprimir = (page: Page, caso: Caso): Promise<Impreso> =>
  page.evaluate(
    (c) =>
      (window as unknown as { arnes: { imprimir(c: Caso): Promise<Impreso> } }).arnes.imprimir(c),
    caso,
  );

/**
 * DP-21 · Bloque 12 · «El ticket a tu gusto»: con renglones apagados el papel sigue siendo el mismo
 * dibujo en pantalla, en puntos y en los bytes ESC/POS (la imagen sale del mismo HTML).
 */
const CASOS_A_TU_GUSTO: readonly { readonly nombre: string; readonly caso: Caso }[] = [
  {
    nombre: '80 mm sin logo, dirección, teléfono ni mensaje',
    caso: {
      papelMm: 80,
      conLogo: true,
      ocultos: ['logo', 'direccion', 'telefono', 'mensaje'],
    },
  },
  {
    nombre: '58 mm sin folio, mesa, mesero, cajero ni fecha',
    caso: {
      papelMm: 58,
      conLogo: false,
      ocultos: ['folio', 'mesa', 'mesero', 'cajero', 'fecha'],
    },
  },
  {
    nombre: '80 mm sin opciones, notas, descuento, forma de pago, efectivo ni cambio',
    caso: {
      papelMm: 80,
      conLogo: false,
      ocultos: ['opciones', 'notas', 'descuento', 'forma_de_pago', 'efectivo_recibido', 'cambio'],
    },
  },
];

const CASOS: readonly { readonly nombre: string; readonly caso: Caso }[] = [
  ...([58, 80] as const).flatMap((papelMm) =>
    [true, false].map((conLogo) => ({
      nombre: `${String(papelMm)} mm ${conLogo ? 'con logo' : 'sin logo'}`,
      caso: { papelMm, conLogo },
    })),
  ),
  ...CASOS_A_TU_GUSTO,
];

for (const { nombre, caso } of CASOS) {
  const papelMm = caso.papelMm;

  test(`${nombre}: los bytes ESC/POS devuelven la imagen dibujada, punto por punto`, async ({
    page,
  }) => {
    await abrir(page);
    const montado = await montar(page, caso);
    const impreso = await imprimir(page, caso);
    expect(impreso.avisos).toEqual([]);
    expect(impreso.puntos).toBe(papelMm === 58 ? 384 : 576);

    const dibujado = mapaDe(impreso.mapas[0] ?? { ancho: 0, alto: 0, base64: '' });
    expect(dibujado.ancho).toBe(impreso.puntos);
    expect(dibujado.alto).toBe(montado.alto);
    // Un ticket en blanco también «coincidiría»: tiene que haber tinta, y no ser todo negro.
    const tinta = puntosNegros(dibujado) / dibujado.puntos.length;
    expect(tinta).toBeGreaterThan(0.03);
    expect(tinta).toBeLessThan(0.5);

    const papel = emular(deBase64(impreso.base64), impreso.puntos);
    expect(papel.alto).toBe(dibujado.alto + impreso.lineasAntesDelCorte * PUNTOS_POR_LINEA);
    expect(puntosDistintos(recorte(papel, 0, dibujado.alto), dibujado)).toBe(0);
    expect(puntosNegros(recorte(papel, dibujado.alto, papel.alto - dibujado.alto))).toBe(0);
    expect(papel.cortes).toEqual([{ fila: papel.alto, parcial: true }]);
    expect(papel.pulsos).toEqual([]);
  });

  test(`${nombre}: el papel es el ticket de la pantalla`, async ({ page }) => {
    await abrir(page);
    const montado = await montar(page, caso);
    // En pantalla mide su tamaño real: 8 puntos por milímetro.
    expect(montado.anchoEnPantalla).toBeCloseTo((montado.ancho / 8) * (96 / 25.4), 0);

    const impreso = await imprimir(page, caso);
    const dibujado = mapaDe(impreso.mapas[0] ?? { ancho: 0, alto: 0, base64: '' });
    const captura = await page
      .locator('#en-puntos [data-lienzo-termico]')
      .screenshot({ scale: 'css' });
    const enUnBit = mapaDe(
      await page.evaluate(
        ([png, umbral]) =>
          (
            window as unknown as {
              arnes: { capturaEnUnBit(png: string, umbral: number): Promise<MapaEnviado> };
            }
          ).arnes.capturaEnUnBit(png, umbral),
        [captura.toString('base64'), UMBRAL_POR_OMISION] as const,
      ),
    );
    expect([enUnBit.ancho, enUnBit.alto]).toEqual([dibujado.ancho, dibujado.alto]);

    // Fuera del logo (que va tramado): punto por punto contra la captura.
    const fueraDelLogo = (x: number, y: number): boolean =>
      !montado.logos.some(
        (logo) =>
          x >= logo.x - 1 &&
          x <= logo.x + logo.ancho + 1 &&
          y >= logo.y - 1 &&
          y <= logo.y + logo.alto + 1,
      );
    let comparados = 0;
    let distintos = 0;
    let fueraDeLugar = 0;
    for (let y = 0; y < dibujado.alto; y += 1) {
      for (let x = 0; x < dibujado.ancho; x += 1) {
        if (!fueraDelLogo(x, y)) continue;
        comparados += 1;
        const i = y * dibujado.ancho + x;
        if (dibujado.puntos[i] === enUnBit.puntos[i]) continue;
        distintos += 1;
        const conTinta = dibujado.puntos[i] === 1 ? enUnBit : dibujado;
        if (!hayTintaCerca(conTinta, x, y)) fueraDeLugar += 1;
      }
    }
    test.info().annotations.push({
      type: 'contra la pantalla',
      description: `${String(distintos)} puntos de borde y ${String(fueraDeLugar)} fuera de lugar, de ${String(comparados)}`,
    });
    expect(comparados).toBeGreaterThan(0);
    expect(distintos / comparados).toBeLessThan(PUNTOS_DE_BORDE_TOLERADOS);
    expect(fueraDeLugar / comparados).toBeLessThan(TINTA_FUERA_DE_LUGAR_TOLERADA);
  });
}

test('a tu gusto: lo apagado no sale ni en pantalla ni en el papel, y lo que nunca se quita sí', async ({
  page,
}) => {
  await abrir(page);
  const completo = await montar(page, { papelMm: 80, conLogo: false });
  const apagado = await montar(page, {
    papelMm: 80,
    conLogo: false,
    ocultos: ['direccion', 'telefono', 'folio', 'mesero', 'cajero', 'fecha', 'descuento', 'cambio'],
  });
  for (const rotulo of ['Carr. a Sta. Cecilia', 'Tel:', 'Folio:', 'Mesero:', 'Cajero:', 'Fecha:']) {
    expect(completo.texto, rotulo).toContain(rotulo);
    expect(apagado.texto, rotulo).not.toContain(rotulo);
  }
  expect(completo.texto).toContain('Descuento:');
  expect(apagado.texto).not.toContain('Descuento:');
  expect(apagado.texto).not.toContain('Cambio:');
  // Lo que nunca se quita.
  for (const siempre of ['Barbacoa de borrego', 'Subtotal:', 'TOTAL', 'Don Poncho']) {
    expect(apagado.texto, siempre).toContain(siempre);
  }
  expect(apagado.alto).toBeLessThan(completo.alto);
});

test('lado a lado: el ticket de la pantalla y el papel que sale de los bytes (para verlo)', async ({
  page,
}, info) => {
  const caso: Caso = { papelMm: 80, conLogo: true };
  await abrir(page);
  await montar(page, caso);
  const impreso = await imprimir(page, caso);
  const papel = emular(deBase64(impreso.base64), impreso.puntos);
  await page.evaluate(
    (p) => {
      (window as unknown as { arnes: { ponerElPapel(p: MapaEnviado): void } }).arnes.ponerElPapel(
        p,
      );
    },
    { ancho: papel.ancho, alto: papel.alto, base64: Buffer.from(papel.puntos).toString('base64') },
  );
  const imagen = await page.screenshot({ fullPage: true });
  await info.attach('pantalla-y-papel-80mm.png', { body: imagen, contentType: 'image/png' });
  const destino = process.env['MORPHIQPOS_LADO_A_LADO'];
  if (destino !== undefined && destino !== '') writeFileSync(destino, imagen);
  expect(imagen.length).toBeGreaterThan(10_000);
});

test('el logo sale tramado: hay puntos negros y blancos mezclados donde iba el gris', async ({
  page,
}) => {
  const caso: Caso = { papelMm: 80, conLogo: true };
  await abrir(page);
  const montado = await montar(page, caso);
  const dibujado = mapaDe(
    (await imprimir(page, caso)).mapas[0] ?? { ancho: 0, alto: 0, base64: '' },
  );
  const logo = montado.logos[0];
  expect(logo).toBeDefined();
  if (logo === undefined) return;
  let negros = 0;
  let total = 0;
  for (let y = Math.ceil(logo.y); y < Math.floor(logo.y + logo.alto); y += 1) {
    for (let x = Math.ceil(logo.x); x < Math.floor(logo.x + logo.ancho); x += 1) {
      negros += dibujado.puntos[y * dibujado.ancho + x] ?? 0;
      total += 1;
    }
  }
  // Un degradado de negro a blanco, tramado, deja cerca de la mitad de los puntos quemados.
  expect(negros / total).toBeGreaterThan(0.3);
  expect(negros / total).toBeLessThan(0.7);
});

test('franjas chicas (búfer viejo): el mismo papel con franjas de 16 filas', async ({ page }) => {
  await abrir(page);
  await montar(page, { papelMm: 58, conLogo: false });
  const normal = await imprimir(page, { papelMm: 58, conLogo: false });
  const chicas = await imprimir(page, { papelMm: 58, conLogo: false, franjaFilas: 16 });
  expect(chicas.base64).not.toBe(normal.base64);
  const a = emular(deBase64(normal.base64), 384);
  const b = emular(deBase64(chicas.base64), 384);
  expect(puntosDistintos(a, b)).toBe(0);
});

test('como `printDocument`: dos copias del nodo en pantalla, cada una con su pie y su corte', async ({
  page,
}) => {
  const caso: Caso = { papelMm: 80, conLogo: false, copias: 2, desdeElNodo: true };
  await abrir(page);
  const montado = await montar(page, caso);
  const impreso = await imprimir(page, caso);
  expect(impreso.mapas).toHaveLength(2);
  const [original, copia] = impreso.mapas.map(mapaDe);
  // El pie agrega renglones: cada copia es más alta que el ticket sin pie, y son distintas entre sí.
  expect(original?.alto).toBeGreaterThan(montado.alto);
  expect(copia?.alto).toBe(original?.alto);
  expect(
    original !== undefined && copia !== undefined ? puntosDistintos(original, copia) : 0,
  ).toBeGreaterThan(0);
  const papel = emular(deBase64(impreso.base64), 576);
  expect(papel.cortes).toHaveLength(2);
});

test('la reimpresión lleva su marca arriba: el papel crece y empieza distinto', async ({
  page,
}) => {
  await abrir(page);
  await montar(page, { papelMm: 80, conLogo: false });
  const original = await imprimir(page, { papelMm: 80, conLogo: false, desdeElNodo: true });
  const reimpresa = await imprimir(page, {
    papelMm: 80,
    conLogo: false,
    desdeElNodo: true,
    reimpresion: '14 nov 2026 · 20:15',
  });
  const a = mapaDe(original.mapas[0] ?? { ancho: 0, alto: 0, base64: '' });
  const b = mapaDe(reimpresa.mapas[0] ?? { ancho: 0, alto: 0, base64: '' });
  expect(b.alto).toBeGreaterThan(a.alto + 40);
  // El recuadro de la marca: su primera fila con tinta es una raya casi de lado a lado.
  const primeraConTinta = Array.from({ length: 30 }, (_, y) => puntosNegros(recorte(b, y, 1))).find(
    (n) => n > 0,
  );
  expect(primeraConTinta).toBeGreaterThan(500);
});
