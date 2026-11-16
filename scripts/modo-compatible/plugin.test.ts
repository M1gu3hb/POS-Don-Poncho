import postcss, { type Root } from 'postcss';
import { describe, expect, it } from 'vitest';

import modoCompatible from './plugin.mjs';

/**
 * DP-20.1 · EL MODO COMPATIBLE: los respaldos para un motor sin `color-mix`, sin `translate`
 * suelto y sin `dvh`, y la regla de oro —en un motor moderno no cambia nada—.
 *
 * Las hojas de aquí tienen la forma que deja Tailwind 4 en producción (aplanada y minificada) y,
 * donde importa, la de desarrollo (anidada).
 */

const MEZCLA = '@supports (color:color-mix(in lab, red, red))';
const SIN_SUELTAS = '@supports not (translate:0)';
const SIN_DVH = '@supports not (height:1dvh)';
const SIN_MEZCLA = '@supports not (color:color-mix(in lab,red,red))';
const PREFIJO =
  'translate(var(--tw-translate-x,0),var(--tw-translate-y,0)) rotate(var(--mc-rotate,0deg)) scale(var(--tw-scale-x,1),var(--tw-scale-y,1))';

const compacto = (css: string): string => css.replace(/\s+/g, '');

async function pasar(css: string): Promise<{ css: string; avisos: string[] }> {
  const resultado = await postcss([modoCompatible()]).process(css, { from: undefined });
  return { css: resultado.css, avisos: resultado.warnings().map((a) => a.text) };
}

/**
 * Lo que ve un motor MODERNO: sin los bloques `@supports not (…)` del plugin, sin el registro del
 * giro y sin el respaldo que cada bloque de mezcla reemplaza justo después.
 */
function vistaModerna(css: string): string {
  const root: Root = postcss.parse(css);
  root.walkAtRules('supports', (bloque) => {
    if (/^not\s*\(/.test(bloque.params)) bloque.remove();
  });
  root.walkAtRules('property', (regla) => {
    if (regla.params === '--mc-rotate') regla.remove();
  });
  root.walkAtRules('supports', (bloque) => {
    if (!bloque.params.includes('color-mix')) return;
    bloque.walkDecls((mezcla) => {
      const selector = mezcla.parent?.type === 'rule' ? mezcla.parent.selector : null;
      for (let previo = bloque.prev(); previo !== undefined; previo = previo.prev()) {
        if (selector === null && previo.type === 'decl' && previo.prop === mezcla.prop)
          previo.remove();
        if (previo.type !== 'rule' || previo.selector !== selector) continue;
        previo.walkDecls(mezcla.prop, (d) => void d.remove());
        if (previo.nodes.length === 0) previo.remove();
      }
    });
  });
  return compacto(root.toString());
}

describe('las opacidades: el respaldo deja de ser sólido', () => {
  it('un token del sistema pasa a `hsl(var(--token) / N%)` y la mezcla no se toca', async () => {
    const mezcla = `${MEZCLA}{.bg-acento\\/10{background-color:color-mix(in oklab, hsl(var(--acento)) 10%, transparent)}}`;
    const { css, avisos } = await pasar(
      `.bg-acento\\/10{background-color:hsl(var(--acento))}${mezcla}`,
    );
    expect(css).toBe(`.bg-acento\\/10{background-color:hsl(var(--acento) / 10%)}${mezcla}`);
    expect(avisos).toEqual([]);
  });

  it('el porcentaje pegado al paréntesis (minificado) también se lee', async () => {
    const { css } = await pasar(
      `.a{color:hsl(var(--x))}${MEZCLA}{.a{color:color-mix(in oklab,hsl(var(--x))50%,transparent)}}`,
    );
    expect(css).toContain('.a{color:hsl(var(--x) / 50%)}');
  });

  it('si el minificador fundió el respaldo con otra clase, la suya gana su propia regla', async () => {
    const { css } = await pasar(
      `.bg-card,.bg-card\\/95{background-color:hsl(var(--card))}${MEZCLA}{.bg-card\\/95{background-color:color-mix(in oklab, hsl(var(--card)) 95%, transparent)}}`,
    );
    // `.bg-card` sigue sólida; la del 95 % queda después, y antes del bloque que la reemplaza.
    expect(css).toContain(
      `.bg-card,.bg-card\\/95{background-color:hsl(var(--card))}.bg-card\\/95{background-color:hsl(var(--card) / 95%)}${MEZCLA}`,
    );
  });

  it('un respaldo que ya trae transparencia no se toca', async () => {
    const hoja = `.bg-white\\/5{background-color:#ffffff0d}${MEZCLA}{.bg-white\\/5{background-color:color-mix(in oklab, var(--color-white) 5%, transparent)}}`;
    expect((await pasar(hoja)).css).toBe(hoja);
  });

  it('los colores fijos se calculan, y `!important` se conserva', async () => {
    const { css } = await pasar(
      `:root{--color-white:#fff}.t{color:var(--color-white)!important}${MEZCLA}{.t{color:color-mix(in oklab, var(--color-white) 20%, transparent)!important}}`,
    );
    expect(css).toContain('.t{color:rgb(255 255 255 / 20%)!important}');
  });

  it('las variables de degradado y de anillo también reciben su alfa', async () => {
    const { css } = await pasar(
      `.from-exito\\/10{--tw-gradient-from:hsl(var(--exito))}${MEZCLA}{.from-exito\\/10{--tw-gradient-from:color-mix(in oklab, hsl(var(--exito)) 10%, transparent)}}`,
    );
    expect(css).toContain('--tw-gradient-from:hsl(var(--exito) / 10%)');
  });

  it('en la forma anidada (desarrollo) corrige la declaración de la propia regla', async () => {
    const { css } = await pasar(
      `.a{color:hsl(var(--x));${MEZCLA}{color:color-mix(in oklab, hsl(var(--x)) 40%, transparent)}}`,
    );
    expect(compacto(css)).toContain('.a{color:hsl(var(--x)/40%);@supports');
  });

  it('el texto de ayuda («el color actual al 50 %») se consigue con opacidad', async () => {
    const { css, avisos } = await pasar(
      `::placeholder{color:currentColor}${MEZCLA}{::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}` +
        `.placeholder\\:text-sutil::placeholder{color:hsl(var(--sutil))}`,
    );
    expect(avisos).toEqual([]);
    expect(compacto(css)).toContain(compacto(`${SIN_MEZCLA}{::placeholder{opacity:0.5}}`));
    // El que trae color propio no se atenúa dos veces.
    expect(compacto(css)).toContain(
      compacto(`${SIN_MEZCLA}{.placeholder\\:text-sutil::placeholder{opacity:1}}`),
    );
  });

  it('otro `currentcolor` no tiene respaldo automático: avisa y no inventa', async () => {
    const hoja = `.b{border-color:currentColor}${MEZCLA}{.b{border-color:color-mix(in oklab, currentcolor 20%, transparent)}}`;
    const { css, avisos } = await pasar(hoja);
    expect(css).toBe(hoja);
    expect(avisos).toEqual(['modo compatible: sin respaldo con alfa para border-color en .b']);
  });
});

describe('translate, scale y rotate sueltos: un transform compuesto en `@supports not`', () => {
  it('el traslado de Tailwind', async () => {
    const regla =
      '.translate-x-\\[-50\\%\\]{--tw-translate-x:-50%;translate:var(--tw-translate-x) var(--tw-translate-y)}';
    const { css } = await pasar(regla);
    expect(compacto(css)).toBe(
      compacto(
        `${regla}${SIN_SUELTAS}{.translate-x-\\[-50\\%\\]{transform:${PREFIJO}}}@property --mc-rotate{syntax:"*";inherits:false}`,
      ),
    );
  });

  it('la escala en porcentaje pasa a número (`scale()` no los admitía)', async () => {
    const { css } = await pasar(
      '.active\\:scale-95:active{--tw-scale-x:95%;--tw-scale-y:95%;--tw-scale-z:95%;scale:var(--tw-scale-x) var(--tw-scale-y)}',
    );
    expect(compacto(css)).toContain(
      compacto(
        `${SIN_SUELTAS}{.active\\:scale-95:active{--tw-scale-x:0.95;--tw-scale-y:0.95;transform:${PREFIJO}}}`,
      ),
    );
  });

  it('la escala y el giro literales van a sus variables', async () => {
    const { css } = await pasar('.a:active{scale:.97}.rotate-45{rotate:45deg}');
    expect(compacto(css)).toContain(
      compacto(`${SIN_SUELTAS}{.a:active{--tw-scale-x:.97;--tw-scale-y:.97;transform:${PREFIJO}}}`),
    );
    expect(compacto(css)).toContain(
      compacto(`${SIN_SUELTAS}{.rotate-45{--mc-rotate:45deg;transform:${PREFIJO}}}`),
    );
  });

  it('un `transform` propio se compone DESPUÉS del prefijo, y dentro de su `@media`', async () => {
    const { css } = await pasar(
      '@media (hover:hover){.transform{transform:var(--tw-rotate-x,) var(--tw-skew-x,)}}',
    );
    expect(compacto(css)).toContain(
      compacto(
        `@media (hover:hover){.transform{transform:var(--tw-rotate-x,) var(--tw-skew-x,)}${SIN_SUELTAS}{.transform{transform:${PREFIJO} var(--tw-rotate-x,) var(--tw-skew-x,)}}}`,
      ),
    );
  });

  it('`transform: none !important` es un reinicio a propósito y se deja como está', async () => {
    const hoja =
      '@media print{[data-ruta]{transform:none!important;translate:var(--sin-traslado,none)!important}}';
    expect((await pasar(hoja)).css).toBe(hoja);
  });

  it('las animaciones que mueven `transform` reciben el prefijo en cada fotograma', async () => {
    const { css } = await pasar(
      '@keyframes ventana-entra{0%{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}@keyframes funde{0%{opacity:0}}',
    );
    expect(compacto(css)).toContain(
      compacto(
        `${SIN_SUELTAS}{@keyframes ventana-entra{0%{opacity:0;transform:${PREFIJO} scale(.97)}to{opacity:1;transform:${PREFIJO} scale(1)}}}`,
      ),
    );
    // La que no mueve nada no se duplica.
    expect(css.match(/@keyframes funde/g)).toHaveLength(1);
  });

  it('lo que no sabe componer lo avisa, sin romper el build', async () => {
    const { css, avisos } = await pasar(
      '.x{scale:var(--mi-escala)}@keyframes gira{to{rotate:360deg}}',
    );
    expect(css).not.toContain('@supports');
    expect(avisos).toEqual([
      'modo compatible: sin transform de respaldo para scale: var(--mi-escala) en .x',
      'modo compatible: sin transform de respaldo para propiedad suelta en @keyframes gira',
    ]);
  });
});

describe('dvh, svh y lvh: su `vh` en `@supports not`', () => {
  it('cada regla recibe su respaldo, con `calc()` y con `!important`', async () => {
    const { css } = await pasar(
      '.h-dvh{height:100dvh}.m{min-height:calc(100svh - 1rem)!important;width:100dvw;color:red}',
    );
    expect(compacto(css)).toBe(
      compacto(
        `.h-dvh{height:100dvh}${SIN_DVH}{.h-dvh{height:100vh}}` +
          `.m{min-height:calc(100svh - 1rem)!important;width:100dvw;color:red}${SIN_DVH}{.m{min-height:calc(100vh - 1rem)!important;width:100vw}}`,
      ),
    );
  });
});

describe('los degradados: la dirección sin «in oklab» en `@supports not`', () => {
  const SIN_OKLAB = '@supports not (background-image:linear-gradient(in lab, red, red))';

  it('la utilidad heredada (`bg-gradient-to-*`) recibe su dirección de siempre', async () => {
    const regla =
      '.bg-gradient-to-br{--tw-gradient-position:to bottom right in oklab;background-image:linear-gradient(var(--tw-gradient-stops))}';
    const { css } = await pasar(regla);
    expect(compacto(css)).toBe(
      compacto(`${regla}${SIN_OKLAB}{.bg-gradient-to-br{--tw-gradient-position:to bottom right}}`),
    );
  });

  it('también con matiz (`in oklch longer hue`), y la que ya separa Tailwind no se toca', async () => {
    const { css } = await pasar('.a{--tw-gradient-position:to right in oklch longer hue}');
    expect(compacto(css)).toContain(compacto(`${SIN_OKLAB}{.a{--tw-gradient-position:to right}}`));
    const separada =
      '.b{--tw-gradient-position:to right}@supports (background-image:linear-gradient(in lab, red, red)){.b{--tw-gradient-position:to right in oklab}}';
    expect((await pasar(separada)).css).toBe(separada);
  });
});

describe('la regla de oro: un motor moderno ve lo mismo que antes', () => {
  const HOJA =
    '@layer utilities{' +
    `.bg-card,.bg-card\\/95{background-color:hsl(var(--card))}${MEZCLA}{.bg-card\\/95{background-color:color-mix(in oklab, hsl(var(--card)) 95%, transparent)}}` +
    `.t{color:hsl(var(--t))}${MEZCLA}{.t{color:color-mix(in oklab, hsl(var(--t)) 60%, transparent)}}` +
    '.-translate-y-1\\/2{--tw-translate-y:calc(calc(1 / 2 * 100%) * -1);translate:var(--tw-translate-x) var(--tw-translate-y)}' +
    '.rotate-180{rotate:180deg}.h-dvh{height:100dvh}' +
    '.bg-gradient-to-r{--tw-gradient-position:to right in oklab}' +
    `::placeholder{color:currentColor}${MEZCLA}{::placeholder{color:color-mix(in oklab, currentcolor 50%, transparent)}}` +
    '}@keyframes spin{to{transform:rotate(360deg)}}';

  it('quitando lo que sólo usa el motor viejo, queda la hoja original', async () => {
    const { css } = await pasar(HOJA);
    expect(css).not.toBe(HOJA);
    expect(vistaModerna(css)).toBe(vistaModerna(HOJA));
  });

  it('pasar dos veces no duplica nada', async () => {
    const una = (await pasar(HOJA)).css;
    expect((await pasar(una)).css).toBe(una);
  });

  it('una hoja sin nada que respaldar sale idéntica', async () => {
    const hoja = '.a{color:red}@media (min-width:40rem){.b{transform:none!important}}';
    expect((await pasar(hoja)).css).toBe(hoja);
  });
});
