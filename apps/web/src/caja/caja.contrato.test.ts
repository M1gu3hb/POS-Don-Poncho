import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CONTRATO: `Caja.jsx` MONTA las piezas nuevas y no rompe lo que las pruebas de navegador buscan.
 *
 * La caja de Miguel conserva sus manejadores y recompone lo visible con `src/caja`. Las pruebas de
 * navegador (`dia-completo-restaurante`, `restaurante-concurrencia`, `restaurante-portal-qr`)
 * dependen del ORDEN de los campos del cobro y de unos nombres: `nth(0)`, `nth(1)`, `nth(3)` y
 * `nth(4)` de los campos del mixto, el placeholder `0.00` del único «Recibido» y el botón
 * `^Cobrar \$`. Cobrar con el dinero de un cliente no se puede recorrer en cada vuelta con un
 * navegador; este contrato lee el código y exige cada cosa en su lugar.
 */

const WEB = join(__dirname, '..', '..');
const CAJA = readFileSync(join(WEB, 'heredado', 'pages', 'Caja.jsx'), 'utf8');

/** El diálogo de cobro, de su título a su pie: lo único donde viven los campos de dinero. */
const DIALOGO_DE_COBRO = CAJA.slice(
  CAJA.indexOf('{/* COBRO DIALOG */}'),
  CAJA.indexOf('{/* TICKET FINAL DIALOG'),
);

describe('Caja.jsx monta las piezas recompuestas', () => {
  it('la cabecera, la lista de pendientes, las teselas, el resumen y lo recibido', () => {
    for (const pieza of [
      'CabeceraDeCaja',
      'CuentasPendientes',
      'TeselasDeMetodo',
      'ResumenDeCobro',
      'RecibidoDelCobro',
    ]) {
      expect(CAJA, `falta importar ${pieza}`).toContain(
        `import { ${pieza} } from '~/caja/${pieza}'`,
      );
      expect(CAJA, `falta pintar <${pieza}`).toMatch(new RegExp(`<${pieza}[\\s/>]`));
    }
  });

  it('el diálogo de cobro existe y empieza «Cobrar — Mesa N»', () => {
    expect(DIALOGO_DE_COBRO.length).toBeGreaterThan(500);
    expect(DIALOGO_DE_COBRO).toMatch(/Cobrar — Mesa \{ventaSeleccionada\?\.mesa_numero/);
  });

  it('lo recibido (con su teclado) sólo sale con efectivo', () => {
    expect(DIALOGO_DE_COBRO).toMatch(/\{metodoPago === 'efectivo' && \(\s*<RecibidoDelCobro/);
  });

  it('las teselas eligen el método con el mismo estado de siempre', () => {
    expect(DIALOGO_DE_COBRO).toMatch(
      /<TeselasDeMetodo metodo=\{metodoPago\} alElegir=\{setMetodoPago\}/,
    );
  });
});

describe('el botón «Cobrar»', () => {
  const desdeElManejador = DIALOGO_DE_COBRO.slice(
    DIALOGO_DE_COBRO.indexOf('onClick={handleCobrar}'),
  );
  const atributos = desdeElManejador.slice(0, desdeElManejador.indexOf('>\n'));

  it('es la acción principal del cobro y se hunde al apretar', () => {
    expect(atributos).toContain('data-principal');
    expect(atributos).toContain('data-tacto');
  });

  it('no trae su color a mano: lo pone el sistema', () => {
    expect(atributos).not.toMatch(/linear-gradient|style=/);
  });

  it('sigue diciendo «Cobrar $…», que es como lo buscan las pruebas', () => {
    expect(desdeElManejador).toContain('`Cobrar ${formatCurrency(totalACobrarVenta)}`');
  });
});

describe('los campos del cobro, en el orden que las pruebas esperan', () => {
  /** Los `NumericInput` que quedan en el diálogo, con su placeholder y su estado, en orden. */
  const campos = [
    ...DIALOGO_DE_COBRO.matchAll(
      /<NumericInput\s+value=\{(\w+)\}\s+onChange=\{[^}]*\}\s+placeholder="([^"]*)"/g,
    ),
  ].map((m) => `${m[2] ?? ''}:${m[1] ?? ''}`);

  it('el mixto trae seis campos «0»: la venta por método y luego la propina por método', () => {
    expect(campos).toEqual([
      '0:montoEfectivo',
      '0:montoTarjeta',
      '0:montoTransferencia',
      '0:propinaEfectivo',
      '0:propinaTarjeta',
      '0:propinaTransferencia',
    ]);
  });

  it('«Recibido» ya no es un campo de Caja.jsx: su placeholder «0.00» vive en la pieza, una vez', () => {
    expect(DIALOGO_DE_COBRO).not.toContain('placeholder="0.00"');
    const recibido = readFileSync(join(WEB, 'src', 'caja', 'RecibidoDelCobro.tsx'), 'utf8');
    expect(recibido.match(/placeholder="0\.00"/g)).toHaveLength(1);
  });

  it('el aviso «✓ La venta ($…) queda cubierta.» sigue en el mixto', () => {
    expect(DIALOGO_DE_COBRO).toContain('✓ La venta (${formatCurrency(venta)}) queda cubierta.');
  });

  it('el resumen del cobro va ANTES de los métodos, y lo recibido DESPUÉS', () => {
    const resumen = DIALOGO_DE_COBRO.indexOf('<ResumenDeCobro');
    const metodos = DIALOGO_DE_COBRO.indexOf('<TeselasDeMetodo');
    const recibido = DIALOGO_DE_COBRO.indexOf('<RecibidoDelCobro');
    const mixto = DIALOGO_DE_COBRO.indexOf("metodoPago === 'mixto'");
    expect(resumen).toBeGreaterThan(0);
    expect(metodos).toBeGreaterThan(resumen);
    expect(recibido).toBeGreaterThan(metodos);
    expect(mixto).toBeGreaterThan(recibido);
  });
});

describe('la lista de pendientes', () => {
  it('la pestaña sigue llamándose «Pendientes (n)» y trae sus tres estados', () => {
    expect(CAJA).toContain('Pendientes ({ventasPendientes.length})');
    expect(CAJA).toMatch(/cargando=\{!pendientesLeidas && ventasPendientes\.length === 0\}/);
    expect(CAJA).toMatch(/fallo=\{pendientesFallaron && ventasPendientes\.length === 0\}/);
  });

  it('cobrar y borrar un ticket en cero son los manejadores de siempre', () => {
    expect(CAJA).toMatch(/alCobrar=\{abrirVenta\}/);
    expect(CAJA).toMatch(/alBorrarEnCero=\{handleEliminarTicketCero\}/);
  });
});
