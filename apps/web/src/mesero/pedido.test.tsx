import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { crearAlmacenDelBorrador } from './almacen-del-borrador';
import { IndicacionesDeLaMesa, TituloDeLaMesa } from './CabeceraDeLaMesa';
import { PedidoDeLaMesa, type PedidoDeLaMesaProps } from './PedidoDeLaMesa';

/**
 * LA CUENTA DE LA MESA ABIERTA y la cabecera del diálogo.
 *
 * Lo que fija: «Enviar a Cocina» es el botón principal (halo y tacto) y dice su estado mientras
 * viaja; «Solicitar cuenta» sólo con cuenta, sin pedido nuevo y sin cuenta ya pedida; lo ya
 * enviado es una tabla con su total; los importes son `<Dinero>` y el total del pedido nuevo va
 * en centavos exactos. La cabecera lleva los dos avisos (celebración, alergia) como iconos.
 */

const arrachera = { id: 'p1', nombre: 'Arrachera', precio_venta: 329 };
const limonada = { id: 'p2', nombre: 'Limonada', precio_venta: 45.5 };

const comun: Omit<PedidoDeLaMesaProps, 'borrador'> = {
  yaEnviado: [],
  hayCuenta: true,
  estadoDeLaMesa: 'ocupada',
  ocupado: false,
  enviando: false,
  colorear: true,
  renderizarLinea: (linea) => <span data-linea={linea.id}>{linea.nombre}</span>,
  alEnviar: () => undefined,
  alPedirCuenta: () => undefined,
};

function pedido(
  cambios: Partial<PedidoDeLaMesaProps> = {},
  armar: (b: ReturnType<typeof crearAlmacenDelBorrador>) => void = () => undefined,
): string {
  const borrador = crearAlmacenDelBorrador();
  armar(borrador);
  return renderToStaticMarkup(<PedidoDeLaMesa borrador={borrador} {...comun} {...cambios} />);
}

const conPedido = (b: ReturnType<typeof crearAlmacenDelBorrador>): void => {
  b.agregarProducto(arrachera);
  b.agregarProducto(arrachera);
  b.agregarProducto(limonada);
};

describe('la cuenta, vacía', () => {
  it('flota (nivel 3), sólo de tableta para arriba, y dice qué hacer', () => {
    const html = pedido();
    expect(html).toContain('data-nivel="3"');
    expect(html).toMatch(/class="[^"]*\bhidden\b[^"]*\bmd:flex\b/);
    expect(html).toContain('NUEVO PEDIDO');
    expect(html).toContain('Selecciona productos');
  });

  it('con la mesa abierta ofrece «Solicitar cuenta» y no «Enviar a Cocina»', () => {
    const html = pedido();
    expect(html).toContain('Solicitar cuenta');
    expect(html).not.toContain('Enviar a Cocina');
  });

  it('sin cuenta abierta, ninguno de los dos botones', () => {
    const html = pedido({ hayCuenta: false });
    expect(html).not.toContain('Solicitar cuenta');
    expect(html).not.toContain('Enviar a Cocina');
  });

  it('con la cuenta ya pedida, tampoco se pide otra vez', () => {
    expect(pedido({ estadoDeLaMesa: 'cuenta_solicitada' })).not.toContain('Solicitar cuenta');
  });
});

describe('el pedido nuevo', () => {
  it('cada línea sale por `renderizarLinea`, en una lista, apiladas con desplazamiento alterno', () => {
    const html = pedido({}, conPedido);
    expect(html).toContain('data-linea="p1"');
    expect(html).toContain('data-linea="p2"');
    expect(html).toContain('NUEVO PEDIDO');
    expect(html).toMatch(/<li class="mr-\(--espacio-2\)"/);
    expect(html).toMatch(/<li class="ml-\(--espacio-2\)"/);
  });

  it('el total es exacto y en <Dinero>: 2 × $329.00 + $45.50 = $703.50', () => {
    const html = pedido({}, conPedido);
    expect(html).toContain('aria-label="703 pesos con 50 centavos"');
  });

  it('«Enviar a Cocina» es el botón principal: halo y tacto, con su icono', () => {
    const html = pedido({}, conPedido);
    const boton = /<button[^>]*data-principal=""[^>]*>/.exec(html)?.[0] ?? '';
    expect(boton).toContain('data-tacto=""');
    expect(boton).toContain('type="button"');
    expect(html).toMatch(/lucide-send[\s\S]*Enviar a Cocina/);
    expect(html).not.toContain('disabled=""');
  });

  it('con un pedido nuevo ya no ofrece pedir la cuenta', () => {
    expect(pedido({}, conPedido)).not.toContain('Solicitar cuenta');
  });

  it('la nota para cocina es el campo del borrador', () => {
    const html = pedido({}, (b) => {
      conPedido(b);
      b.ponerNota('sin picante');
    });
    expect(html).toContain('placeholder="Nota para cocina..."');
    expect(html).toContain('value="sin picante"');
  });

  it('el importe nuevo va en el color del estilo, o en el del texto', () => {
    expect(pedido({}, conPedido)).toMatch(/class="[^"]*text-primario[^"]*" aria-label="703 pesos/);
    expect(pedido({ colorear: false }, conPedido)).toMatch(
      /class="[^"]*text-texto[^"]*" aria-label="703 pesos/,
    );
  });
});

describe('mientras el envío viaja', () => {
  it('el botón lo dice («Enviando...»), se deshabilita y se anuncia ocupado', () => {
    const html = pedido({ enviando: true, ocupado: true }, conPedido);
    const boton = /<button[^>]*data-principal=""[^>]*>/.exec(html)?.[0] ?? '';
    expect(boton).toContain('disabled=""');
    expect(boton).toContain('aria-busy="true"');
    expect(html).toContain('Enviando...');
    expect(html).not.toContain('Enviar a Cocina');
  });

  it('ocupado por otra cosa (la cuenta en camino) también deshabilita «Solicitar cuenta»', () => {
    expect(pedido({ ocupado: true })).toMatch(
      /<button[^>]*disabled=""[^>]*>[\s\S]*Solicitar cuenta/,
    );
  });
});

describe('lo que la mesa ya mandó a cocina', () => {
  const yaEnviado = [
    { id: 'd1', producto_nombre: 'Arrachera', cantidad: 2, subtotal: 658 },
    { id: 'd2', producto_nombre: null, cantidad: 1, subtotal: 45.5 },
  ];

  it('es una tabla con su nombre, sus líneas «Nombre ×cantidad» y el total al pie', () => {
    const html = pedido({ yaEnviado });
    expect(html).toContain('PEDIDO ACTUAL');
    expect(html).toContain('AGREGAR AL PEDIDO');
    expect(html).toContain('aria-label="Pedido actual"');
    expect(html).toContain('Arrachera ×2');
    expect(html).toContain('— ×1');
    expect(html).toContain('Total:');
    expect(html).toContain('aria-label="703 pesos con 50 centavos"');
  });

  it('sin nada enviado no hay tabla ni «PEDIDO ACTUAL»', () => {
    const html = pedido();
    expect(html).not.toContain('PEDIDO ACTUAL');
    expect(html).not.toContain('<table');
  });
});

describe('la cabecera de la mesa', () => {
  const mesa = { numero: 5, estado: 'ocupada' };
  const titulo = (m: object, v: object | null): string =>
    renderToStaticMarkup(<TituloDeLaMesa mesa={m} venta={v} />);

  it('«Mesa 5» y su estado en una pastilla redonda con el color de su familia', () => {
    const html = titulo(mesa, null);
    expect(html).toContain('Mesa 5<span');
    expect(html).toMatch(
      /<span class="[^"]*\brounded-full\b[^"]*" style="background:#A41E2A;color:#FFFFFF">Ocupada<\/span>/,
    );
  });

  it('cuántos son y a nombre de quién', () => {
    const html = titulo(mesa, { personas: 4, cliente_nombre: 'Familia Pérez' });
    expect(html).toContain('lucide-users');
    expect(html).toContain('· Familia Pérez');
  });

  it('la celebración y la alergia son pastillas con icono —no emoji—, de la mesa o de la cuenta', () => {
    const html = titulo(
      { ...mesa, celebracion_especial: true, tipo_celebracion: 'Cumpleaños' },
      { notas_alergias: 'cacahuate' },
    );
    expect(html).toContain('lucide-party-popper');
    expect(html).toContain('Cumpleaños');
    expect(html).toContain('lucide-triangle-alert');
    expect(html).toContain('>Alergia<');
    expect(html).toContain('title="cacahuate"');
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('la celebración sin tipo se llama «Celebración»', () => {
    expect(titulo({ ...mesa, celebracion_especial: true }, null)).toContain('Celebración');
  });

  it('sin celebración ni alergia, ninguna de las dos', () => {
    const html = titulo(mesa, { personas: 2 });
    expect(html).not.toContain('party-popper');
    expect(html).not.toContain('triangle-alert');
  });

  it('el detalle de la alergia va aparte, debajo del título', () => {
    const html = renderToStaticMarkup(
      <IndicacionesDeLaMesa mesa={mesa} venta={{ notas_alergias: 'nuez' }} />,
    );
    expect(html).toContain('Alergia / indicaciones:');
    expect(html).toContain('nuez');
    expect(renderToStaticMarkup(<IndicacionesDeLaMesa mesa={mesa} venta={null} />)).toBe('');
  });
});
