import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GRUPOS_DE_AUDITORIA } from '@morphiqpos/domain/auditoria';

import { describirAccion } from './describir-accion.ts';

describe('DP-15 · la auditoría en palabras', () => {
  it('el renombre de una caja, con el antes y el después', () => {
    expect(describirAccion('caja.nombrar_terminal', { antes: 'Caja 1', despues: 'Barra' })).toBe(
      'Cambió el nombre de una caja: «Caja 1» → «Barra»',
    );
  });

  it('el agotado y su vuelta, el PIN y los descuentos', () => {
    expect(describirAccion('catalogo.marcar_agotado', { nombre: 'Barbacoa', agotado: true })).toBe(
      'Marcó «Barbacoa» agotado por hoy',
    );
    expect(describirAccion('catalogo.marcar_agotado', { nombre: 'Barbacoa', agotado: false })).toBe(
      'Volvió a ofrecer «Barbacoa»',
    );
    expect(describirAccion('identidad.establecer_pin', { nombre: 'Mesero 1' })).toBe(
      'Cambió el PIN de Mesero 1',
    );
    expect(describirAccion('configuracion.permitir_descuentos', { permitir: false })).toBe(
      'Apagó los descuentos',
    );
  });

  it('lo desconocido sale en palabras, por su familia, y nunca con el nombre crudo del comando', () => {
    expect(describirAccion('venta.cobrar', { total: 10 })).toBe('Movimiento de venta');
    expect(describirAccion('inventario.ajustar', {})).toBe('Cambio de inventario');
    expect(describirAccion('algo.nuevo', {})).toBe('Otro cambio registrado');
    expect(describirAccion('', {})).toBe('Otro cambio registrado');
    // Un nombre que es propiedad de todo objeto no debe leerse como una acción conocida.
    expect(describirAccion('constructor', {})).toBe('Otro cambio registrado');
    expect(describirAccion('toString.x', {})).toBe('Otro cambio registrado');
    expect(describirAccion('caja.nombrar_terminal', null)).toBe(
      'Cambió el nombre de una caja: «» → «»',
    );
  });
});

describe('DP-15.1 · un intento que el servidor negó no se lee como hecho', () => {
  it('el rechazo lleva su marca y su causa', () => {
    expect(
      describirAccion('identidad.establecer_pin', {
        nombre: 'Mesero 1',
        resultado: 'denegado',
        codigo: 'PERMISO_DENEGADO',
      }),
    ).toBe('Intento rechazado (sin permiso): Cambió el PIN de Mesero 1');
    expect(
      describirAccion('caja.movimiento', { resultado: 'conflicto', codigo: 'CAJA_CERRADA' }),
    ).toMatch(/^Intento rechazado \(conflicto\): /);
    expect(describirAccion('caja.movimiento', { resultado: 'error' })).toMatch(
      /^Intento rechazado \(error\): /,
    );
  });

  it('lo que sí se hizo no lleva la marca', () => {
    expect(describirAccion('identidad.establecer_pin', { nombre: 'Mesero 1' })).not.toMatch(
      /rechazado/,
    );
  });
});

describe('DP-15.1 · cada acción de los grupos se dice en palabras', () => {
  const payloads: Record<string, Record<string, unknown>> = {
    'caja.movimiento': { tipo: 'retiro', montoCentavos: '150000', motivo: 'Pago a proveedor' },
    'caja.entrada_cambio': { montoCentavos: '50000', origen: 'banco' },
    'venta.aplicar_descuento': { descuentoCentavos: '2500', motivo: 'Cortesía' },
    'restaurante.descontar_cuenta': { descuentoCentavos: '2500', motivo: 'Cortesía' },
    'restaurante.cancelar_orden': { motivo: 'Cliente se fue' },
    'restaurante.anular_linea': { motivo: 'Error al tomar', importeAnuladoCentavos: '9000' },
    'venta.devolver_venta': { montoCentavos: '9000', metodo: 'efectivo', motivo: 'Frío' },
    'configuracion.fijar_modulo': { modulo: 'propinas', activo: true },
    'configuracion.guardar': { impuestoPuntosBase: 800 },
    'caja.fijar_cajas_simultaneas': { antes: 1, despues: 2 },
  };

  it('ninguna sale como su nombre de comando ni vacía, aun con un payload vacío', () => {
    for (const grupo of Object.values(GRUPOS_DE_AUDITORIA)) {
      for (const accion of grupo.acciones) {
        for (const payload of [payloads[accion] ?? {}, {}, null]) {
          const dicho = describirAccion(accion, payload);
          expect(dicho, accion).not.toBe(accion);
          expect(dicho, accion).not.toMatch(/^[a-z_]+\.[a-z_]+$/);
          expect(dicho.trim().length, accion).toBeGreaterThan(5);
        }
      }
    }
  });

  it('cuenta lo que importa: cuánto, por qué y qué', () => {
    expect(describirAccion('caja.movimiento', payloads['caja.movimiento'])).toBe(
      'Retiro de efectivo de $1,500.00: Pago a proveedor',
    );
    expect(describirAccion('caja.entrada_cambio', payloads['caja.entrada_cambio'])).toBe(
      'Entró cambio a la caja: $500.00 (del banco)',
    );
    expect(describirAccion('venta.aplicar_descuento', payloads['venta.aplicar_descuento'])).toBe(
      'Descuento de $25.00 en una venta: Cortesía',
    );
    expect(
      describirAccion('restaurante.cancelar_orden', payloads['restaurante.cancelar_orden']),
    ).toBe('Canceló una cuenta: Cliente se fue');
    expect(
      describirAccion('configuracion.fijar_modulo', payloads['configuracion.fijar_modulo']),
    ).toBe('Encendió el módulo «propinas»');
    expect(
      describirAccion('caja.fijar_cajas_simultaneas', payloads['caja.fijar_cajas_simultaneas']),
    ).toBe('Cajas abiertas a la vez: 1 → 2');
  });
});

describe('DP-15 · la pestaña «Auditoría» de Registros', () => {
  it('existe sólo para quien manda y lee del comando de la auditoría', () => {
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const registros = readFileSync(
      join(raiz, 'heredado', 'pages', 'Registros.jsx'),
      'utf8',
    ).replace(/\s+/g, '');
    expect(registros).toContain('{esDeMando(miPuesto)&&(<TabsTriggervalue="auditoria"');
    expect(registros).toContain(
      '{esDeMando(miPuesto)&&(<TabsContentvalue="auditoria"className="mt-4"><AuditoriaReciente/>',
    );
    const pestana = readFileSync(join(raiz, 'src', 'registros', 'AuditoriaReciente.tsx'), 'utf8');
    expect(pestana).toContain("'/api/reportes/auditoria-reciente'");
    expect(pestana).toContain('describirAccion(r.accion, r.payload)');
  });

  it('DP-15.1 · el filtro y las páginas van al servidor: la pantalla no filtra en el navegador', () => {
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const pestana = readFileSync(join(raiz, 'src', 'registros', 'AuditoriaReciente.tsx'), 'utf8');
    const sinEspacios = pestana.replace(/\s+/g, '');
    expect(sinEspacios).toContain("queryKey:['auditoria-reciente',entrada]");
    expect(sinEspacios).toContain(
      "invocarComando<RespuestaDeAuditoria>('/api/reportes/auditoria-reciente',entrada)",
    );
    expect(pestana).toContain('entradaDeLaAuditoria(filtros)');
    // Ni el texto escrito ni el grupo se aplican sobre lo que llegó.
    expect(pestana).not.toMatch(/\.filter\(/);
    expect(pestana).not.toContain('limite:');
  });
});
