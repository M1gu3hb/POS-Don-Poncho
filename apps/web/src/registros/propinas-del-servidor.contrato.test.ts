import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * A23 · LAS PROPINAS DE REGISTROS SALEN DEL SERVIDOR: contrato sobre el texto de la pantalla.
 *
 * La pestaña bajaba las últimas ventas (el puente topa en 1 000) y agrupaba por mesero en el
 * navegador: pasado el tope, las propinas viejas desaparecían sin aviso. Ahora pide el rango a
 * `propinas.del_rango` y sólo pinta. Las pantallas heredadas no pasan por tipos: se ata su texto.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

/** Sin comentarios: lo que dicen no cuenta para el contrato. */
const sinComentarios = (texto: string): string =>
  texto
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const pestana = sinComentarios(leer('apps/web/heredado/components/propinas/PropinasRegistros.jsx'));
const dialogo = sinComentarios(
  leer('apps/web/heredado/components/propinas/LiquidarPropinasDialog.jsx'),
);

const matriz = JSON.parse(leer('pruebas/e2e/matriz-de-permisos.json')) as {
  readonly incluidas: readonly { readonly ruta: string; readonly roles: readonly string[] }[];
};

describe('la pestaña Propinas pide el rango al servidor', () => {
  it('lo lee de /api/propinas/del-rango con el rango, el estado y el mesero', () => {
    expect(pestana).toMatch(/const peticion = peticionDeLasPropinas\(range, estado, meseroId\)/);
    expect(pestana).toMatch(
      /invocarComando\('\/api\/propinas\/del-rango', peticion, \{ signal \}\)/,
    );
    expect(pestana).toMatch(/queryKey: \['registros_propinas', peticion\]/);
  });

  it('ya no baja ventas ni agrupa o suma propinas en el navegador', () => {
    expect(pestana).not.toMatch(/api\.entidades\.Venta/);
    expect(pestana).not.toMatch(/agruparPropinasPorMesero|sumarPropinas|propinaDerivada/);
    expect(pestana).not.toMatch(/filtrarVentasConPropina|filtrarVentasEnRango/);
    expect(pestana).not.toMatch(/\.reduce\(/);
  });

  it('las tarjetas y el desglose salen de lo que contestó el servidor', () => {
    expect(pestana).toMatch(/totalesDeLasPropinas\(propinas\)/);
    expect(pestana).toMatch(/desgloseDeLasPropinas\(propinas\)/);
  });

  it('el rango personalizado se lee en hora local, no con new Date(texto)', () => {
    expect(pestana).toMatch(/rangoDeLasPropinas\(rango, desde, hasta\)/);
    expect(pestana).not.toMatch(/new Date\(desde\)|new Date\(hasta\)/);
  });

  it('si la lista de detalle viene topada lo dice, y no corta en silencio con un slice', () => {
    expect(pestana).toMatch(/avisoDeLasPropinas\(propinas\)/);
    expect(pestana).not.toMatch(/\.slice\(0, 300\)/);
  });

  it('si el servidor no pudo contestar lo dice con su motivo y deja reintentar (no enseña ceros)', () => {
    expect(pestana).toMatch(/error\?\.message/);
    expect(pestana).toMatch(/Reintentar/);
  });

  it('el comando es de quien ve Registros: dueño, administrador y gerente', () => {
    const fila = matriz.incluidas.find((r) => r.ruta === '/api/propinas/del-rango');
    expect([...(fila?.roles ?? [])].sort()).toEqual(['administrador', 'dueno', 'gerente']);
  });
});

describe('al liquidar, la pestaña se vuelve a leer', () => {
  it('el diálogo invalida la lectura de Registros › Propinas', () => {
    expect(dialogo).toMatch(/invalidateQueries\(\{ queryKey: \['registros_propinas'\] \}\)/);
  });
});
