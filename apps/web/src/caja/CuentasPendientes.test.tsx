import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { aplanar } from '../teclados/lectura-de-elementos.ts';
import { CuentasPendientes, type CuentasPendientesProps } from './CuentasPendientes.tsx';
import type { VentaPendiente } from './cuentas-pendientes.ts';

/**
 * LA PESTAÑA «PENDIENTES», pintada: lo que el navegador de pruebas y el lector de pantalla leen.
 *
 * La tesela se busca por su nombre —`^Mesa N Cuenta`—, así que el ORDEN del marcado es contrato:
 * la mesa, luego el folio (si lo hay) y luego la insignia, cada uno en su bloque para que el
 * nombre accesible los separe con espacio. Y los tres estados de la lista no se confunden: la
 * primera lectura no es un vacío.
 */

function pintar(parcial: Partial<CuentasPendientesProps> = {}): string {
  return renderToStaticMarkup(
    <CuentasPendientes
      ventas={[]}
      cargando={false}
      fallo={false}
      alReintentar={() => undefined}
      colorearImportes
      propinaDeLaVenta={() => 0}
      alCobrar={() => undefined}
      alBorrarEnCero={() => undefined}
      {...parcial}
    />,
  );
}

/** Lo que dice el marcado sin sus etiquetas. `<Dinero>` junta su importe: «$350.00». */
function plano(marcado: string): string {
  return marcado.replace(/<[^>]+>/g, '');
}

const mesa5: VentaPendiente = { id: 'v5', mesa_numero: 5, total: 350 };

describe('la tesela de una cuenta', () => {
  it('se llama «Mesa N», su folio y «Cuenta», en ese orden', () => {
    const dicho = plano(pintar({ ventas: [{ ...mesa5, folio: 'F-0012' }] }));
    const mesa = dicho.indexOf('Mesa 5');
    const folio = dicho.indexOf('F-0012');
    const insignia = dicho.indexOf('Cuenta');
    expect(mesa).toBe(0);
    expect(folio).toBeGreaterThan(mesa);
    expect(insignia).toBeGreaterThan(folio);
  });

  it('cada parte va en su bloque: así el nombre accesible las separa con espacio', () => {
    expect(pintar({ ventas: [mesa5] })).toMatch(
      /<span class="block[^"]*">Mesa 5<\/span><span class="block[^"]*"><\/span><\/span><span data-slot="badge"[^>]*>Cuenta<\/span>/,
    );
  });

  it('es un botón de tipo button dentro de una lista', () => {
    expect(pintar({ ventas: [mesa5] })).toMatch(/^<ul[^>]*><li><button[^>]*type="button"/);
  });

  it('el total se lee de pesos del puente: 1234.5 es $1,234.50', () => {
    expect(plano(pintar({ ventas: [{ id: 'v9', mesa_numero: 9, total: 1234.5 }] }))).toContain(
      '$1,234.50',
    );
  });

  it('un ticket en cero lo dice con palabras, no sólo con color', () => {
    const dicho = plano(pintar({ ventas: [{ id: 'v0', mesa_numero: 3, total: 0 }] }));
    expect(dicho).toMatch(/^Mesa 3En cero\$0\.00/);
    expect(dicho).toContain('Borrar ticket en cero');
    expect(dicho).not.toContain('Toca para cobrar');
  });

  it('el total va grande y en el color del acento: el color no le quita el tamaño', () => {
    expect(pintar({ ventas: [mesa5] })).toMatch(
      /class="[^"]*\btext-3xl\b[^"]*\btext-primario\b[^"]*"/,
    );
    expect(pintar({ ventas: [mesa5], colorearImportes: false })).toMatch(
      /class="[^"]*\btext-3xl\b[^"]*\btext-texto\b[^"]*"/,
    );
  });

  it('una cuenta con total invita a cobrar', () => {
    expect(plano(pintar({ ventas: [mesa5] }))).toContain('Toca para cobrar');
  });

  it('la insignia del QR lleva su importe en <Dinero>', () => {
    const venta: VentaPendiente = {
      ...mesa5,
      propina_origen: 'portal_qr',
      propina_tipo: 'porcentaje',
      propina_porcentaje: 10,
    };
    expect(plano(pintar({ ventas: [venta], propinaDeLaVenta: () => 35 }))).toContain(
      'QR: propina 10% ($35.00)',
    );
  });

  it('el código y las personas, cuando la cuenta los trae', () => {
    const venta: VentaPendiente = {
      ...mesa5,
      codigo_caja: 'M05-1234',
      personas: 4,
      cliente_nombre: 'Lupe',
    };
    const dicho = plano(pintar({ ventas: [venta] }));
    expect(dicho).toContain('Código: M05-1234');
    expect(dicho).toContain('4 personas · Lupe');
  });
});

describe('al tocar una tesela', () => {
  it('una cuenta con total va a cobrarse; una en cero, a borrarse', () => {
    const alCobrar = vi.fn();
    const alBorrarEnCero = vi.fn();
    const cero: VentaPendiente = { id: 'v0', mesa_numero: 3, total: 0 };
    const arbol = CuentasPendientes({
      ventas: [mesa5, cero],
      cargando: false,
      fallo: false,
      alReintentar: () => undefined,
      colorearImportes: true,
      propinaDeLaVenta: () => 0,
      alCobrar,
      alBorrarEnCero,
    });
    // Cada tesela es un componente (aún sin pintar): se pulsa el `alElegir` que lleva.
    const teselas = aplanar(arbol).filter((el) => typeof el.props['alElegir'] === 'function');
    expect(teselas).toHaveLength(2);
    for (const tesela of teselas) (tesela.props['alElegir'] as () => void)();
    expect(alCobrar).toHaveBeenCalledExactlyOnceWith(mesa5);
    expect(alBorrarEnCero).toHaveBeenCalledExactlyOnceWith(cero);
  });
});

describe('los tres estados de la lista', () => {
  it('la primera lectura es un esqueleto, nunca «Sin cobros pendientes»', () => {
    const marcado = pintar({ cargando: true });
    expect(plano(marcado)).not.toContain('Sin cobros pendientes');
    expect(marcado).toContain('aria-busy="true"');
  });

  it('el fallo sin lista anterior se dice, con su botón para releer', () => {
    const dicho = plano(pintar({ fallo: true }));
    expect(dicho).toContain('No se pudo leer los cobros pendientes');
    expect(dicho).toContain('Volver a intentar');
    expect(dicho).not.toContain('Sin cobros pendientes');
  });

  it('el vacío de verdad es una buena noticia', () => {
    expect(plano(pintar())).toContain('Sin cobros pendientes');
  });

  it('con cuentas no hay vacío ni error', () => {
    const dicho = plano(pintar({ ventas: [mesa5] }));
    expect(dicho).not.toContain('Sin cobros pendientes');
    expect(dicho).not.toContain('No se pudo leer');
  });
});
