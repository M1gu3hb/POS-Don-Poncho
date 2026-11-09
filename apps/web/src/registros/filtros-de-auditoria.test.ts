import { describe, expect, it } from 'vitest';

import { entradaDeLaAuditoria, paginaAnterior, paginaSiguiente } from './filtros-de-auditoria.ts';

describe('DP-15.1 · lo que la pantalla le pide al servidor', () => {
  it('sin filtros pide la primera página de todo', () => {
    expect(entradaDeLaAuditoria({ grupo: '', fecha: '', pagina: 0 })).toEqual({ pagina: 0 });
  });

  it('manda el grupo y el día sólo cuando se eligieron', () => {
    expect(entradaDeLaAuditoria({ grupo: 'pin_y_usuarios', fecha: '', pagina: 0 })).toEqual({
      grupo: 'pin_y_usuarios',
      pagina: 0,
    });
    expect(entradaDeLaAuditoria({ grupo: '', fecha: '2026-11-10', pagina: 2 })).toEqual({
      fecha: '2026-11-10',
      pagina: 2,
    });
  });

  it('un grupo desconocido o una fecha a medio escribir no viajan', () => {
    expect(entradaDeLaAuditoria({ grupo: 'todo', fecha: '2026-11-', pagina: 0 })).toEqual({
      pagina: 0,
    });
  });

  it('anterior no baja de cero y siguiente sólo avanza si hay más', () => {
    expect(paginaAnterior(0)).toBe(0);
    expect(paginaAnterior(3)).toBe(2);
    expect(paginaSiguiente(1, true)).toBe(2);
    expect(paginaSiguiente(1, false)).toBe(1);
  });
});
