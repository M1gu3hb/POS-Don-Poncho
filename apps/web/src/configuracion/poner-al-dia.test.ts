import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ponerAlDia, seToco } from './parche-de-la-seccion';

/**
 * DP-21 · Bloque 21 · GUARDAR UNA TARJETA NO BORRA LO QUE SE TECLEÓ EN LA DE AL LADO.
 *
 * Con la Configuración en tarjetas, cada una con su «Guardar», pasó esto en la primera corrida en
 * navegador: la dueña enciende el portal en una tarjeta, elige quién pide la cuenta en otra y
 * guarda la primera. Al guardar, la configuración se relee, TODAS las tarjetas se volvían a llenar
 * con lo del servidor, y lo elegido en la segunda desaparecía sin aviso (su «Guardar» quedaba
 * apagado, como si nada se hubiera tocado).
 *
 * La regla: al llegar una configuración nueva, lo que la persona cambió en ESTA tarjeta y todavía
 * no guarda se queda; lo demás se pone al día.
 */
describe('ponerAlDia', () => {
  const alLlenar = { activo: false, modo: 'mesero_dispara', mensaje: 'Hola' };

  it('lo que no se tocó toma lo nuevo del servidor', () => {
    const delServidor = { activo: true, modo: 'mesero_dispara', mensaje: 'Hola' };
    expect(ponerAlDia(alLlenar, alLlenar, delServidor)).toEqual(delServidor);
  });

  it('lo tecleado y sin guardar se queda, aunque otra tarjeta haya guardado', () => {
    const enPantalla = { ...alLlenar, modo: 'cliente_solicita' };
    const delServidor = { activo: true, modo: 'mesero_dispara', mensaje: 'Hola' };
    expect(ponerAlDia(enPantalla, alLlenar, delServidor)).toEqual({
      activo: true,
      modo: 'cliente_solicita',
      mensaje: 'Hola',
    });
  });

  it('lo que esta tarjeta acaba de guardar queda igual a lo del servidor', () => {
    const enPantalla = { ...alLlenar, activo: true };
    const delServidor = { activo: true, modo: 'mesero_dispara', mensaje: 'Hola' };
    expect(ponerAlDia(enPantalla, alLlenar, delServidor)).toEqual(delServidor);
  });

  it('compara por valor: una lista igual no cuenta como tocada', () => {
    const base = { porcentajes: [5, 10, 15] };
    expect(ponerAlDia({ porcentajes: [5, 10, 15] }, base, { porcentajes: [10, 15, 20] })).toEqual({
      porcentajes: [10, 15, 20],
    });
    expect(ponerAlDia({ porcentajes: [5, 12] }, base, { porcentajes: [10, 15, 20] })).toEqual({
      porcentajes: [5, 12],
    });
  });

  it('no inventa campos: sólo los que la tarjeta tiene al llenarse con lo nuevo', () => {
    expect(ponerAlDia({ a: 1, sobra: 'x' }, { a: 0, sobra: 'y' }, { a: 5 })).toEqual({ a: 1 });
  });

  it('la primera vez (sin base) es lo del servidor', () => {
    expect(ponerAlDia({ a: 9 }, null, { a: 5 })).toEqual({ a: 5 });
  });
});

/**
 * «CON CAMBIOS» ES LO QUE LA PERSONA TOCÓ, no «lo que difiere de lo guardado». Un ajuste que nunca
 * se guardó (el formulario enseña su valor por omisión) no es un cambio: si lo fuera, la tarjeta
 * nacería con «Guardar» encendido y la pantalla preguntaría «¿Salir sin guardar?» a quien no tocó
 * nada. Pasó en la primera corrida en navegador, con «Propinas».
 */
describe('seToco', () => {
  const alLlenar = { activas: true, porcentajes: '5,10,15,20' };

  it('recién llena, nadie tocó nada', () => {
    expect(seToco({ ...alLlenar }, alLlenar)).toBe(false);
  });

  it('un cambio de la persona sí cuenta', () => {
    expect(seToco({ ...alLlenar, porcentajes: '10,15' }, alLlenar)).toBe(true);
    expect(seToco({ ...alLlenar, activas: false }, alLlenar)).toBe(true);
  });

  it('volver al valor de antes ya no cuenta', () => {
    expect(seToco({ activas: true, porcentajes: '5,10,15,20' }, alLlenar)).toBe(false);
  });

  it('sin haberse llenado todavía, no hay cambios', () => {
    expect(seToco({ activas: false }, null)).toBe(false);
  });

  it('sólo mira los campos que la tarjeta enseña', () => {
    expect(seToco({ activas: true }, { activas: true, otra: 'x' })).toBe(false);
  });
});

/**
 * Y el contrato: toda tarjeta que se vuelve a llenar cuando cambia la configuración lo hace por
 * `ponerAlDia`. Una que haga `setForm(loDelServidor)` a secas vuelve a borrar lo tecleado.
 */
describe('las tarjetas de Configuración se ponen al día sin borrar lo tecleado', () => {
  const WEB = join(__dirname, '..', '..');
  const TARJETAS = [
    'src/configuracion/TarjetaDeAjustes.tsx',
    'heredado/components/portalqr/ConfiguracionQRTab.jsx',
    'heredado/components/configuracion/IdentidadNegocio.jsx',
    'heredado/components/configuracion/EstacionesDeCocina.jsx',
    'heredado/components/configuracion/AlertasDeEsperaDeCocina.jsx',
    'heredado/components/configuracion/ColoresSistemaSection.jsx',
  ];

  it.each(TARJETAS)('%s', (ruta) => {
    const codigo = readFileSync(join(WEB, ruta), 'utf8').replace(/\s+/g, '');
    expect(codigo).toContain('ponerAlDia(');
    // En `heredado` no hay lint ni tipos: una referencia sin declarar truena al abrir la pantalla.
    expect(codigo).toContain('constalLlenar=useRef');
    // Ninguna vuelve a llenar su formulario con lo del servidor sin pasar por ahí.
    expect(codigo).not.toMatch(
      /set(Form|Formulario|Minutos|Activas|Primario|Acento)\((desdeLaConfig|delServidor)[.)]/,
    );
    expect(codigo).not.toContain('setFormulario(formularioDe(ajustes,configuracion))');
  });

  // «Colores» no entra: su «Guardar» siempre está encendido y no avisa al salir (como antes).
  it.each(TARJETAS.filter((ruta) => !ruta.endsWith('ColoresSistemaSection.jsx')))(
    '%s: «con cambios» es lo que se tocó',
    (ruta) => {
      const codigo = readFileSync(join(WEB, ruta), 'utf8').replace(/\s+/g, '');
      expect(codigo).toContain('seToco(');
      // Nunca «difiere de lo guardado»: eso enciende «Guardar» en una tarjeta que nadie tocó.
      expect(codigo).not.toMatch(/constsucia=[^;]*hayCambios/);
    },
  );
});
