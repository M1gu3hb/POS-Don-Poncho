import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-13.3 · El cableado de las pantallas del portal, como contrato de texto: lo que no tiene una
 * prueba de componente (el gancho del carrito, el diálogo de abrir la mesa, el panel del mesero) se
 * comprueba leyendo el código real, y cada línea de aquí se valida MUTÁNDOLA (el banco de
 * mutaciones de la entrega). Lo que SÍ se ve se prueba en el navegador: `portal-dp13.spec.ts`.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

const PORTAL = leer('heredado/pages/PortalCliente.jsx');
const GANCHO = leer('src/portal/carrito-compartido/use-carrito-de-la-mesa.ts');
const CARRITO = leer('src/portal/carrito-compartido/CarritoDeLaMesa.tsx');
const API_DEL_COMENSAL = leer('src/portal/carrito-compartido/api-del-carrito.ts');
const PANEL = leer('src/restaurante/portal-mesero/CarritoDelPortalParaElMesero.tsx');
const API_DEL_MESERO = leer('src/restaurante/portal-mesero/api-del-carrito-del-mesero.ts');

describe('«Abrir la mesa y enviar» es UN comando (punto 13)', () => {
  it('el diálogo confirma y la pantalla envía el carrito con los datos de la apertura', () => {
    expect(PORTAL).toMatch(
      /await carritoMesa\.enviar\(\{[^}]*confirmado: true[^}]*apertura: aperturaDeLaMesa\(datos\)/s,
    );
  });

  it('ya no abre la mesa con una llamada aparte', () => {
    expect(PORTAL).not.toContain('abrirMesaDesdeQR');
  });

  it('la nota para cocina del carrito viaja hasta el envío', () => {
    expect(PORTAL).toMatch(/setNotaAlAbrir\(notaGeneral \|\| ''\)/);
    expect(PORTAL).toMatch(/notaGeneral: notaAlAbrir/);
    expect(CARRITO).toMatch(/alAbrirLaMesa\?\.\(\{ notaGeneral: nota \}\)/);
  });

  it('con dos o más teléfonos, «¿Ya pidieron todos?» va antes del diálogo y abre, no envía', () => {
    expect(CARRITO).toMatch(
      /else if \(estado\.esperarATodos\) setConfirmando\(true\);\s*else if \(boton\.accion === 'abrir'\) abrirLaMesa\(\)/,
    );
    expect(CARRITO).toMatch(
      /if \(boton\.accion === 'abrir'\) abrirLaMesa\(\);\s*else void mandar\(true\)/,
    );
  });

  it('el envío viaja con la apertura, sólo si la hay', () => {
    expect(API_DEL_COMENSAL).toMatch(/\.\.\.\(apertura === undefined \? \{\} : \{ apertura \}\)/);
  });
});

describe('el id del teléfono lo emite el servidor (punto 11)', () => {
  it('guarda el que trae el sondeo y manda de ahí en adelante', () => {
    expect(GANCHO).toMatch(
      /estado\?\.dispositivoEmitido !== undefined\)\s*recordarDispositivo\(estado\.dispositivoEmitido\)/,
    );
    expect(API_DEL_COMENSAL).toMatch(/dispositivo === '' \? \{\} : \{ dispositivo \}/);
  });

  it('si el servidor no lo reconoce, lo olvida, pide otro y repite una vez', () => {
    expect(GANCHO).toMatch(/reglaDelError\(error\) !== 'QR_TELEFONO_NO_RECONOCIDO'\) throw error/);
    expect(GANCHO).toMatch(
      /olvidarDispositivo\(\);\s*return accion\(await telefonoListo\(token\)\)/,
    );
  });

  it('todas las acciones del comensal pasan por el teléfono con id', () => {
    for (const accion of [
      'llamarAlMesero',
      'agregarAlCarrito',
      'quitarDelCarrito',
      'enviarElCarrito',
    ]) {
      expect(GANCHO).toMatch(new RegExp(`conTelefono\\(token, \\(d\\) => ${accion}\\(token, d`));
    }
  });
});

describe('el comensal se entera de lo que le pasó a su pedido (puntos 12 y 15)', () => {
  it('el aviso del vaciado se dice una vez y con las palabras de siempre', () => {
    expect(GANCHO).toMatch(/vaciadoNuevo\(vaciadoVisto\.current, estado\)/);
    expect(GANCHO).toMatch(/vaciadoVisto\.current = vaciado;\s*toast\.info\(AVISO_DEL_VACIADO\)/);
  });

  it('la cuenta ya pedida es un mensaje, no un error', () => {
    expect(CARRITO).toMatch(/regla === 'QR_CUENTA_PEDIDA'\) \{[^}]*toast\.info\(/s);
    expect(PORTAL).toMatch(/\{pedidosQRActivos && \(\s*<CarritoDeLaMesa/);
    expect(PORTAL).not.toMatch(/!cuentaYaSolicitada && \(\s*<CarritoDeLaMesa/);
  });
});

describe('el mesero con la cuenta ya pedida (punto 15)', () => {
  it('pregunta antes de reabrir y manda `reabrirCuenta` sólo si lo confirmó', () => {
    expect(PANEL).toMatch(
      /if \(mesa\.cuentaPedida\) setReabriendo\(true\);\s*else void enviar\(\)/,
    );
    expect(PANEL).toMatch(/void enviar\(true\)/);
    expect(PANEL).toMatch(/enviarACocina\(mesa\.id, '', reabrirCuenta\)/);
    expect(API_DEL_MESERO).toMatch(/\.\.\.\(reabrirCuenta \? \{ reabrirCuenta: true \} : \{\}\)/);
  });

  it('le dice que la cuenta ya se pidió', () => {
    expect(PANEL).toMatch(/\{mesa\.cuentaPedida \? \(\s*<Aviso/);
  });
});
