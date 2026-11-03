import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-13.2 y 13.4 (17) · EL ESCÁNER APAGA SU CÁMARA, Y SIN CÁMARA EL MESERO ELIGE LA MESA.
 *
 * `BarcodeScanner.jsx` es JavaScript heredado que un test de componentes no alcanza: el contrato
 * lee su texto. Cada arranque es una sesión; al detener se cambia de sesión, y lo que llega tarde
 * de una sesión vieja —el `getUserMedia` que resolvió después de cerrar, el siguiente cuadro del
 * ciclo— se apaga o se descarta. La prueba de navegador `escanear-qr-con-camara.spec.ts` lo ve con
 * una cámara simulada; esto fija dónde vive.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');
const ESCANER = leer('heredado/components/barcode/BarcodeScanner.jsx');
const entre = (desde: string, hasta: string): string =>
  ESCANER.slice(ESCANER.indexOf(desde), ESCANER.indexOf(hasta, ESCANER.indexOf(desde)));

describe('el escáner apaga su cámara (DP-13.4, 17)', () => {
  it('detener cambia de sesión', () => {
    expect(entre('const stopCamera', 'const processRaw')).toMatch(/sesionRef\.current \+= 1/);
  });

  it('el ciclo nativo no se reprograma con una sesión vieja', () => {
    const ciclo = entre('const scanLoopNative', '// Iniciar cámara');
    const programaciones = ciclo.match(/requestAnimationFrame\(/g) ?? [];
    const guardas = ciclo.match(/if \(sesion !== sesionRef\.current\) return;/g) ?? [];
    expect(programaciones.length).toBe(2);
    // Una al entrar, otra después de leer el cuadro y otra antes de volver a programar.
    expect(guardas.length).toBe(3);
  });

  it('la cámara que llega después de cerrar se apaga, en los dos motores', () => {
    const arranque = entre('const startCamera', 'const handleCameraError');
    expect(arranque).toMatch(
      /if \(!vigente\(\)\) \{ stream\.getTracks\(\)\.forEach\(t => t\.stop\(\)\); return; \}/,
    );
    expect(arranque).toMatch(/if \(!vigente\(\)\) \{\s+try \{ controls\.stop\(\); \}/);
  });
});

describe('sin cámara, el mesero elige la mesa (DP-13.2)', () => {
  it('el respaldo reemplaza al campo numérico de «Código de barras»', () => {
    expect(ESCANER).toMatch(/\{respaldo \? respaldo : \(<>/);
  });

  it('el mesero pasa la lista de mesas como respaldo y el globo ofrece «Pedido del portal»', () => {
    const mesero = leer('heredado/pages/Mesero.jsx');
    expect(mesero).toMatch(/respaldo=\{\s*<ElegirLaMesa/);
    expect(mesero).toMatch(/alVerPedido=\{portalActivo \?/);
  });
});
