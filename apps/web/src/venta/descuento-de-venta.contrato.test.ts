import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-14 ronda 2 (medio 5) · EL DIÁLOGO DEL DESCUENTO, atado al uso.
 *
 * Contratos estáticos sobre el código SIN comentarios y recortado a la función que importa. Cada uno
 * se validó mutando el archivo real (ver la entrega): quitar la guarda, el borrado de la
 * autorización, el tope o el aviso del reemplazo los hace fallar.
 */

function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
const leer = (...ruta: string[]) =>
  sinComentarios(readFileSync(join(__dirname, '..', ...ruta), 'utf8'));

const descuento = leer('venta', 'DescuentoDeVenta.tsx');
const pin = leer('venta', 'PinDeSupervisor.tsx');
const ajustes = leer('restaurante', 'AjustesDeLaCuenta.tsx');

/** El cuerpo de `async function aplicar` del formulario, hasta el `return (` del componente. */
const aplicar = descuento.slice(
  descuento.indexOf('async function aplicar()'),
  descuento.indexOf('return (\n    <form'),
);

describe('aplicar el descuento', () => {
  it('hay UN solo envío en vuelo: la guarda síncrona se arma antes de esperar y se suelta al final', () => {
    expect(aplicar).toMatch(
      /if \(!listo \|\| enviandoRef\.current\) return;\s*enviandoRef\.current = true;/,
    );
    expect(aplicar.indexOf('enviandoRef.current = true')).toBeLessThan(
      aplicar.indexOf('await onAplicar'),
    );
    expect(aplicar).toMatch(/finally \{\s*enviandoRef\.current = false;/);
  });

  it('si el servidor rechaza la autorización, la borra y dice por qué', () => {
    expect(aplicar).toMatch(
      /catch \(error: unknown\) \{\s*if \(autorizacionInservible\(error\)\) setAutorizacion\(null\);\s*setFalloAlAplicar\(/,
    );
  });

  it('no se aplica si el tope de ese PIN no cubre el descuento, ni con un envío en vuelo', () => {
    expect(descuento).toMatch(
      /const cubre =\s*autorizacion\?\.tope === undefined \|\| elTopeCubre\(centavos, base, autorizacion\.tope\);/,
    );
    expect(descuento).toMatch(
      /const listo =\s*valido && motivo\.trim\(\)\.length >= 4 && autorizacion !== null && cubre && !enviando;/,
    );
    expect(descuento).toMatch(/<Button type="submit" disabled=\{!listo\}/);
  });

  it('el envío del formulario pasa por la misma función guardada', () => {
    expect(descuento).toMatch(
      /onSubmit=\{\(evento\) => \{\s*evento\.preventDefault\(\);\s*void aplicar\(\);/,
    );
  });
});

describe('lo que dice el diálogo', () => {
  it('si la cuenta ya tenía descuento: «Reemplaza el descuento de $X»', () => {
    expect(descuento).toMatch(
      /previo === null \? null : \(\s*<Aviso[^>]*>\s*Reemplaza el descuento de <Dinero centavos=\{previo\} \/>/,
    );
  });

  it('lee el descuento previo de la cuenta del servidor', () => {
    expect(descuento).toMatch(/'\/api\/venta\/estado',\s*\{ ordenId \}/);
  });

  it('al autorizar enseña hasta cuánto llega ese PIN', () => {
    expect(descuento).toMatch(/<AutorizacionDelDescuento[\s\S]*?cubre=\{cubre\}/);
    expect(pin).toMatch(
      /respuesta\.topeCentavos === undefined \|\| respuesta\.topeBp === undefined/,
    );
  });
});

describe('el cobro de la cuenta con descuento', () => {
  it('el error del servidor sube al formulario: la cuenta no lo atrapa', () => {
    const cuerpo = ajustes.slice(
      ajustes.indexOf('async function aplicar(elegido'),
      ajustes.indexOf('if (permitidos !== true)'),
    );
    expect(cuerpo).not.toMatch(/catch/);
    expect(ajustes).toMatch(/onAplicar=\{aplicar\}/);
  });
});
