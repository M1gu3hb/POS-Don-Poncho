import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-14 · ronda 2, bloqueante 1 · EL TICKET Y EL COBRO DICEN LO QUE SE COBRA.
 *
 * `PreCuentaTicket` es el papel de todo (la precuenta, el ticket final, la reimpresión de Ventas y
 * Registros, el de `/pos` y el de cada parte de una cuenta dividida) y el cobro de la Caja es lo
 * que ve el cajero antes de cobrar. Los dos sumaban los renglones en bruto. Ahora salen de
 * `totalesDelPapel` (probado aparte con sus números): el TOTAL es el del servidor y el papel suma.
 * Son pantallas heredadas: el contrato lee su texto (se valida mutándolo).
 */

const HEREDADO = join(__dirname, '..', '..', 'heredado');
const leer = (ruta: string) => readFileSync(join(HEREDADO, ruta), 'utf8');

describe('el ticket', () => {
  const ticket = () => leer('components/tickets/PreCuentaTicket.jsx');

  it('saca sus números de totalesDelPapel, no de la suma bruta de los renglones', () => {
    expect(ticket()).toMatch(/const papel = totalesDelPapel\(venta, detalles\);/);
    expect(ticket()).not.toMatch(/getVentaTotal/);
  });

  it('el TOTAL es el total del servidor más la propina', () => {
    expect(ticket()).toMatch(
      /<span>TOTAL<\/span>\s*<span>\{formatCurrency\(papel\.total \+ montoPropina\)\}<\/span>/,
    );
  });

  it('pinta el descuento y dice si el IVA se suma o va incluido', () => {
    const texto = ticket();
    expect(texto).toMatch(/papel\.descuento > 0 &&/);
    expect(texto).toMatch(/papel\.ivaSeSuma \? 'IVA' : 'IVA incluido'/);
  });
});

describe('el cobro de la Caja', () => {
  const caja = () => leer('pages/Caja.jsx');

  it('Subtotal en bruto, el descuento con quién lo autorizó y por qué, y el total del servidor', () => {
    const texto = caja();
    expect(texto).toMatch(
      /const papelDelCobro = useMemo\(\s*\(\) => totalesDelPapel\(ventaSeleccionada, detallesSeleccionados\)/,
    );
    expect(texto).toMatch(/formatCurrency\(papelDelCobro\.renglones\)/);
    expect(texto).toMatch(/Descuento[\s\S]{0,120}formatCurrency\(papelDelCobro\.descuento\)/);
    expect(texto).toMatch(/<DescuentoAutorizado ordenId=\{ventaSeleccionada\.id\} \/>/);
  });

  it('al aplicar o reemplazar el descuento, «Autorizó X · motivo» se relee con la cuenta', () => {
    expect(caja()).toMatch(
      /const releerLaCuentaDelCobro = async \(ordenId\) => \{[\s\S]{0,900}queryClient\.invalidateQueries\(\{ queryKey: \['descuento_autorizado', ordenId\] \}\);/,
    );
  });

  it('TOTAL A COBRAR = el total del servidor + la propina', () => {
    expect(caja()).toMatch(/const t = papelDelCobro\.total;/);
  });

  it('la cantidad de una línea por peso con el formateador único', () => {
    expect(caja()).toMatch(/cantidadParaMostrar\(d\)/);
  });
});

describe('Ventas', () => {
  it('lo cobrado y lo quitado dicen el peso con el formateador único («½ kg»)', () => {
    const texto = leer('pages/Ventas.jsx');
    expect(texto).toMatch(/\{d\.producto_nombre\} \{cantidadEnLaLista\(d\)\}/);
    expect(texto).toMatch(/\{q\.producto_nombre\} \{cantidadEnLaLista\(q\)\}/);
  });
});
