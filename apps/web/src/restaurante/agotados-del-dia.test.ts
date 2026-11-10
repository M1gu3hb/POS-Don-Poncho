import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ordenarParaAgotar } from './agotados-orden.ts';

/**
 * DP-15 · «Agotados del día» en las pantallas.
 *
 * El servidor ya niega lo agotado en todos los caminos (`catalogo/agotado.integracion.test.ts`).
 * Aquí: la lista del diálogo pone lo agotado arriba y busca sin acentos de más, y las pantallas que
 * venden lo respetan antes de mandar nada (el mesero avisa y no lo agrega; el portal avisa y no abre
 * el platillo), y la cocina y Productos tienen el botón.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
/** El código sin comentarios ni espacios: un comentario o un cambio de formato no cuentan. */
const sinEspacios = (ruta: string) =>
  readFileSync(join(RAIZ_WEB, ruta), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

describe('DP-15 · la lista de «Agotados del día»', () => {
  const platillos = [
    { id: '1', nombre: 'Taco de barbacoa' },
    { id: '2', nombre: 'Barbacoa de horno', agotado_hoy: true },
    { id: '3', nombre: 'Agua de jamaica', agotado_hoy: false },
  ];

  it('lo agotado primero y después por nombre', () => {
    expect(ordenarParaAgotar(platillos, '').map((p) => p.id)).toEqual(['2', '3', '1']);
  });

  it('busca por parte del nombre, sin importar mayúsculas', () => {
    expect(ordenarParaAgotar(platillos, 'BARBACOA').map((p) => p.id)).toEqual(['2', '1']);
    expect(ordenarParaAgotar(platillos, 'pulque')).toEqual([]);
  });
});

describe('DP-15 · las pantallas respetan lo agotado', () => {
  it('el mesero no agrega un platillo agotado y lo enseña «Agotado hoy»', () => {
    const c = sinEspacios('heredado/pages/Mesero.jsx');
    expect(c).toContain(
      'constagregarAlCarrito=async(productoTocado)=>{if(productoTocado?.agotado_hoy===true){toast.error(',
    );
    expect(c).toContain('Agotadohoy');
  });

  it('el portal no abre un platillo agotado y lo enseña «Agotado hoy»', () => {
    const c = sinEspacios('heredado/pages/PortalCliente.jsx');
    expect(c).toContain('if(!pedidosQRActivos)return;if(producto?.agotado===true){toast.info(');
    // DP-16 · Las tarjetas del portal viven en los dos menús del comensal: cada uno lo marca y no lo
    // deja tocar (la tarjeta digital sale como `div`, el renglón de «a la carta» sin botón).
    const digital = sinEspacios('src/portal/menu-digital/MenuDigital.tsx');
    expect(digital).toContain('constagotado=producto.agotado===true;');
    expect(digital).toContain('Agotadohoy</span>');
    expect(digital).toContain('if(!puedePedir||agotado){');
    const carta = sinEspacios('src/portal/menu-digital/MenuALaCarta.tsx');
    expect(carta).toContain('constactivo=puedePedir&&!agotado;');
    expect(carta).toContain('Agotadohoy</span>');
  });

  it('el menú del portal en lista también lo enseña «Agotado hoy» y apaga «Agregar» (QA, J-H2)', () => {
    // El menú por páginas (`PaginaConBotones`) pinta cada platillo con este renglón; sólo la tarjeta
    // con imagen lo marcaba, y el comensal se enteraba hasta tocarlo.
    const c = sinEspacios('src/restaurante/PlatilloParaPedir.tsx');
    expect(c).toContain('constagotado=platillo.agotado===true;');
    expect(c).toContain(
      '{agotado?<spanclassName="text-xsfont-semiboldtext-peligro">Agotadohoy</span>:null}',
    );
    expect(c).toContain('disabled={agotado}');
  });

  it('la cocina y Productos tienen el botón', () => {
    expect(sinEspacios('heredado/pages/Cocina.jsx')).toContain('<AgotadosDelDia/>');
    expect(sinEspacios('heredado/pages/Productos.jsx')).toContain(
      'PUEDEN_AGOTAR.includes(miPuesto)&&<AgotadosDelDia/>',
    );
  });
});
