import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { revisar } from './contrato.mjs';
import modoCompatible from './plugin.mjs';

/**
 * DP-20.1 · EL CONTRATO DEL MODO COMPATIBLE. Se valida como los demás contratos del repo: la hoja
 * buena pasa, y cada respaldo que se le quita (lo que haría una actualización de Tailwind o del
 * minificador) tiene que hacerlo fallar con un mensaje que diga dónde.
 */

const MEZCLA = '@supports (color:color-mix(in lab, red, red))';

const SIN_RESPALDAR =
  '@layer utilities{' +
  `.bg-card,.bg-card\\/95{background-color:hsl(var(--card))}${MEZCLA}{.bg-card\\/95{background-color:color-mix(in oklab, hsl(var(--card)) 95%, transparent)}}` +
  `.t{color:hsl(var(--t))}${MEZCLA}{.t{color:color-mix(in oklab, hsl(var(--t)) 60%, transparent)}}` +
  `::placeholder{color:currentColor}${MEZCLA}{::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}` +
  '.-translate-y-1\\/2{--tw-translate-y:-50%;translate:var(--tw-translate-x) var(--tw-translate-y)}' +
  '.rotate-180{rotate:180deg}.h-dvh{height:100dvh}' +
  '}@keyframes ventana-entra{0%{transform:scale(.97)}to{transform:scale(1)}}' +
  '@media print{[data-ruta]{transform:none!important;translate:var(--sin-traslado,none)!important}}';

async function respaldada(): Promise<string> {
  return (await postcss([modoCompatible()]).process(SIN_RESPALDAR, { from: undefined })).css;
}

const problemasDe = (css: string): string[] => revisar(postcss.parse(css)).problemas;

/** Quita de la hoja el primer nodo que cumpla, y exige que existiera (si no, la prueba no prueba). */
function sin(css: string, cumple: (nodo: postcss.ChildNode) => boolean): string {
  const root = postcss.parse(css);
  let quitado = false;
  root.walk((nodo) => {
    if (quitado || !cumple(nodo)) return;
    nodo.remove();
    quitado = true;
  });
  expect(quitado).toBe(true);
  return root.toString();
}

const esBloque = (nodo: postcss.ChildNode, condicion: RegExp, dentro: RegExp): boolean =>
  nodo.type === 'atrule' &&
  nodo.name === 'supports' &&
  condicion.test(nodo.params) &&
  dentro.test(nodo.toString());

describe('el contrato sobre la hoja de producción', () => {
  it('la hoja que deja el plugin pasa, y cuenta lo que revisó', async () => {
    const { problemas, cuentas } = revisar(postcss.parse(await respaldada()));
    expect(problemas).toEqual([]);
    expect(cuentas).toEqual({ mezclas: 3, sueltas: 2, animaciones: 1, dinamicas: 1 });
  });

  it('la hoja sin el plugin falla en cada frente', () => {
    expect(problemasDe(SIN_RESPALDAR)).toEqual([
      'respaldo SÓLIDO, sin transparencia: .bg-card\\/95 { background-color }',
      'respaldo SÓLIDO, sin transparencia: .t { color }',
      'respaldo SÓLIDO, sin transparencia: ::placeholder { color }',
      'sin transform de respaldo: .-translate-y-1\\/2',
      'sin transform de respaldo: .rotate-180',
      '@keyframes ventana-entra sin su gemela de respaldo',
      'height: 100dvh sin respaldo en vh: .h-dvh',
    ]);
  });

  it('una mezcla suelta, fuera de su `@supports`, no pasa', () => {
    expect(problemasDe('.x{color:color-mix(in oklab, red 50%, transparent)}')).toEqual([
      'color-mix fuera de su @supports: .x { color }',
    ]);
  });

  it('una mezcla sin ningún respaldo delante no pasa', () => {
    expect(
      problemasDe(`${MEZCLA}{.x{color:color-mix(in oklab, hsl(var(--x)) 50%, transparent)}}`),
    ).toEqual(['mezcla sin respaldo: .x { color }']);
  });

  it('si se pierde el transform de una regla, lo dice', async () => {
    const hoja = sin(await respaldada(), (n) => esBloque(n, /^not \(translate/, /rotate-180/));
    expect(problemasDe(hoja)).toEqual(['sin transform de respaldo: .rotate-180']);
  });

  it('si se pierde la gemela de una animación, lo dice', async () => {
    const hoja = sin(await respaldada(), (n) => esBloque(n, /^not \(translate/, /@keyframes/));
    expect(problemasDe(hoja)).toEqual(['@keyframes ventana-entra sin su gemela de respaldo']);
  });

  it('si se pierde el vh de una altura dinámica, lo dice', async () => {
    const hoja = sin(await respaldada(), (n) => esBloque(n, /^not \(height/, /h-dvh/));
    expect(problemasDe(hoja)).toEqual(['height: 100dvh sin respaldo en vh: .h-dvh']);
  });

  it('si se pierde la opacidad del texto de ayuda, lo dice', async () => {
    const hoja = sin(await respaldada(), (n) => esBloque(n, /^not \(color/, /placeholder/));
    expect(problemasDe(hoja)).toEqual([
      'respaldo SÓLIDO, sin transparencia: ::placeholder { color }',
    ]);
  });

  it('una animación que mueve la propiedad suelta no tiene respaldo, y lo dice', () => {
    expect(problemasDe('@keyframes gira{to{rotate:360deg}}')).toEqual([
      '@keyframes gira anima «rotate» suelta: no tiene respaldo',
    ]);
  });

  it('el reinicio de impresión (`transform: none !important`) no pide gemela', () => {
    expect(problemasDe('@media print{.x{transform:none!important;translate:none}}')).toEqual([]);
  });

  it('reconoce las dos reglas del aviso de «aparato demasiado viejo», cada una en su sitio', () => {
    const ensena = '#aparato-demasiado-viejo{display:block!important}';
    const oculta = '@layer base{#aparato-demasiado-viejo{display:none!important}}';
    const avisoDe = (css: string): object => revisar(postcss.parse(css)).aviso;
    expect(avisoDe(ensena + oculta)).toEqual({ ensena: true, oculta: true });
    expect(avisoDe(ensena)).toEqual({ ensena: true, oculta: false });
    expect(avisoDe(oculta)).toEqual({ ensena: false, oculta: true });
    // Sin `!important` la capa no le gana a lo de fuera, y dentro de una capa no «enseña».
    expect(avisoDe('@layer base{#aparato-demasiado-viejo{display:none}}')).toEqual({
      ensena: false,
      oculta: false,
    });
    expect(avisoDe('@layer base{#aparato-demasiado-viejo{display:block!important}}')).toEqual({
      ensena: false,
      oculta: false,
    });
  });

  it('acepta que el minificador funda varias reglas en un mismo bloque de respaldo', () => {
    const hoja =
      '.a{rotate:45deg}.b{rotate:90deg}' +
      '@supports not (translate:0){.a{transform:rotate(45deg)}.b,.c{transform:rotate(90deg)}}';
    expect(problemasDe(hoja)).toEqual([]);
  });
});
