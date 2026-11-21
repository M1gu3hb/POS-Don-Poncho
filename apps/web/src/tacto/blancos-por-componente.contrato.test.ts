import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-22 · EL BARRIDO DE SERVICIO: los 44 px, DADOS POR COMPONENTE (DP-D145), leídos.
 *
 * El barrido táctil (`pruebas/e2e/qa-final/barrido-servicio.spec.ts`) halló tocables de 24 a 40 px en
 * la barra lateral, las pestañas, las fichas de zona y categoría, los botones de las cabeceras, los
 * campos y las cantidades de la cuenta. Cada uno recibe su clase (`any-pointer-coarse:min-h-(--altura-tactil)`
 * o `any-pointer-coarse:size-11`) DONDE se sabe que el contenido cabe: nunca un selector global sobre
 * `button` (la hoja de `blancos-tactiles.css` lo prohíbe).
 *
 * Cada fila ata la clase al USO: se buscan los textos entre comillas del archivo (sin comentarios) que
 * traen la clase que identifica al componente y se exige que ESE mismo texto traiga la del dedo. Quitar
 * la del dedo —o dársela a otro texto— hace fallar; reordenar clases no. Se valida mutando el código
 * real (el hueco declarado: no mide pixeles, sólo que la clase esté; lo mide el barrido).
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

function leer(ruta: string): string {
  return readFileSync(join(RAIZ, ruta), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Todos los textos entre comillas (simples, dobles o de plantilla) del archivo. */
function textos(codigo: string): string[] {
  return [...codigo.matchAll(/(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((m) => m[2] ?? '');
}

const TACTIL_ALTO = 'any-pointer-coarse:min-h-(--altura-tactil)';
const TACTIL_LADO = 'any-pointer-coarse:size-11';

interface Fila {
  readonly archivo: string;
  readonly componente: string;
  /** Las clases que, juntas, identifican al componente (en el mismo texto entre comillas). */
  readonly identifica: readonly string[];
  readonly clase: string;
}

const FILAS: readonly Fila[] = [
  ...(
    ['h-9 px-4 py-2', 'h-8 rounded-md px-3 text-xs', 'h-10 rounded-md px-8', 'h-9 w-9'] as const
  ).map((tam): Fila => ({
    archivo: 'heredado/components/ui/button.jsx',
    componente: `Button ${tam}`,
    identifica: tam.split(' '),
    clase: TACTIL_ALTO,
  })),
  {
    archivo: 'heredado/components/ui/input.jsx',
    componente: 'Input',
    identifica: ['border-input', 'h-9'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/ui/tabs.jsx',
    componente: 'TabsTrigger',
    identifica: ['whitespace-nowrap', 'px-3', 'py-1'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/ui/tabs.jsx',
    componente: 'TabsList (crece con sus pestañas)',
    identifica: ['bg-muted', 'h-9', 'p-1'],
    clase: 'any-pointer-coarse:h-auto',
  },
  {
    archivo: 'heredado/components/ui/dialog.jsx',
    componente: 'cerrar del diálogo',
    identifica: ['absolute', 'right-4', 'top-4'],
    clase: TACTIL_LADO,
  },
  {
    archivo: 'heredado/components/common/Sidebar.jsx',
    componente: 'enlaces de la barra',
    identifica: ['relative', 'gap-3', 'px-3', 'py-2.5'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/common/Sidebar.jsx',
    componente: 'sonido de este aparato',
    identifica: ['hover:text-sidebar-foreground', 'p-1'],
    clase: TACTIL_LADO,
  },
  {
    archivo: 'heredado/components/common/Sidebar.jsx',
    componente: 'salir',
    identifica: ['hover:text-peligro', 'p-1'],
    clase: TACTIL_LADO,
  },
  {
    archivo: 'heredado/components/common/ThemeToggle.jsx',
    componente: 'modo oscuro (barra)',
    identifica: ['w-full', 'gap-3', 'py-2.5'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/common/ThemeToggle.jsx',
    componente: 'modo oscuro (píldora)',
    identifica: ['rounded-full', 'h-9', 'text-xs'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/pages/Mesero.jsx',
    componente: 'fichas de categoría del diálogo de la mesa',
    identifica: ['shrink-0', 'px-3', 'py-1', 'rounded-full'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/mesero/ProductoFichaExpandible.jsx',
    componente: 'nombre del renglón del pedido (abre la ficha)',
    identifica: ['flex', 'items-center', 'gap-1', 'text-left', 'w-full'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/cocina/CocinaKanbanCard.jsx',
    componente: 'renglón de la comanda (Kanban) que abre la ficha',
    identifica: ['w-full', 'flex', 'items-start', 'text-left', 'group'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/cocina/CocinaPedidoCardPremium.jsx',
    componente: 'renglón de la comanda (tarjeta) que abre la ficha',
    identifica: ['w-full', 'flex', 'items-start', 'text-left', 'group'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/cocina/CocinaVozControl.jsx',
    componente: 'botones de la voz de Cocina (ancho)',
    identifica: ['h-8', 'gap-1.5'],
    clase: 'any-pointer-coarse:min-w-(--altura-tactil)',
  },
  {
    archivo: 'src/cocina/RenglonDePlatillo.tsx',
    componente: 'renglón de platillo de la comanda (abre la ficha)',
    identifica: ['grid', 'items-baseline', 'text-left', 'rounded-md'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/pages/Mesero.jsx',
    componente: 'fichas de zona del mesero',
    identifica: ['shrink-0', 'px-3', 'py-1.5', 'rounded-lg'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/mesero/MesaActivaView.jsx',
    componente: 'fichas de categoría de la cuenta',
    identifica: ['shrink-0', 'px-3', 'py-1', 'rounded-full'],
    clase: TACTIL_ALTO,
  },
  {
    archivo: 'heredado/components/mesero/MesaActivaView.jsx',
    componente: 'cantidad de la cuenta (− y +)',
    identifica: ['w-6', 'h-6', 'rounded-full'],
    clase: TACTIL_LADO,
  },
  {
    archivo: 'heredado/components/mesero/ProductoFichaExpandible.jsx',
    componente: 'cantidad de la ficha (− y +)',
    identifica: ['w-6', 'h-6', 'rounded-full'],
    clase: TACTIL_LADO,
  },
  {
    archivo: 'heredado/components/pedido/CatalogoDelPedido.jsx',
    componente: 'fichas de categoría de Para llevar',
    identifica: ['shrink-0', 'min-h-9', 'rounded-full'],
    clase: TACTIL_ALTO,
  },
];

describe('los 44 px por componente (DP-22 · barrido de servicio)', () => {
  for (const fila of FILAS) {
    it(`${fila.componente} lleva ${fila.clase}`, () => {
      const candidatos = textos(leer(fila.archivo)).filter((t) => {
        const clases = new Set(t.split(/\s+/));
        return fila.identifica.every((c) => clases.has(c));
      });
      expect(
        candidatos.length,
        `no encuentro «${fila.componente}» en ${fila.archivo}`,
      ).toBeGreaterThan(0);
      for (const texto of candidatos) {
        expect(new Set(texto.split(/\s+/)).has(fila.clase), texto).toBe(true);
      }
    });
  }

  for (const [archivo, texto] of [
    ['src/telefono-de-cocina/ConectarTelefono.tsx', 'Conectar teléfono'],
    ['src/restaurante/AgotadosDelDia.tsx', '<Ban aria-hidden />'],
    ['src/cocina/ResumenDeProduccion.tsx', 'Modo compacto'],
  ] as const) {
    it(`el botón «${texto}» lleva ${TACTIL_ALTO}`, () => {
      const codigo = leer(archivo);
      const fin = codigo.indexOf(texto);
      expect(fin, `«${texto}» no está en ${archivo}`).toBeGreaterThan(-1);
      const boton = codigo.slice(codigo.lastIndexOf('<Button', fin), fin);
      expect(boton).toContain(`className="${TACTIL_ALTO}"`);
    });
  }

  it('el botón de cerrar de los avisos gana su área de 44 px (pseudo-elemento, sin cambiar tamaños; +2 px por el redondeo de la caja del botón)', () => {
    const css = leer('src/tacto/blancos-tactiles.css');
    const regla = /\[data-sonner-toast\] \[data-close-button\]::after \{([^}]*)\}/.exec(css);
    expect(regla, 'falta la regla del botón de cerrar').not.toBeNull();
    expect(regla?.[1]).toContain('width: calc(var(--altura-tactil) + 2px);');
    expect(regla?.[1]).toContain('height: calc(var(--altura-tactil) + 2px);');
  });

  it('lo que no tenía nombre ni etiqueta lo tiene', () => {
    const entrada = leer('heredado/pages/POSLogin.jsx');
    const borrar = entrada.slice(entrada.indexOf('onClick={() => setPin((p) => p.slice(0, -1))}'));
    expect(borrar.slice(0, 200)).toContain('aria-label="Borrar un dígito"');
    const caja = leer('heredado/pages/Caja.jsx');
    const buscar = caja.slice(caja.indexOf('onClick={buscarVenta} className="h-12 px-4"'));
    expect(buscar.slice(0, 120)).toContain('aria-label="Buscar"');
    const mesa = leer('heredado/components/mesero/AbrirMesaDialog.jsx');
    expect(mesa).toContain('htmlFor="abrir-mesa-personas"');
    expect(mesa).toContain('id="abrir-mesa-personas"');
    expect(mesa).toContain('aria-label="Cumpleaños o celebración especial"');
    const historial = leer('heredado/components/cortes/CorteHistorialList.jsx');
    expect(historial).toContain('aria-label="Desde"');
    expect(historial).toContain('aria-label="Hasta"');
    const resumen = leer('heredado/components/caja/ResumenDelDia.jsx');
    expect(resumen).toContain('aria-label="Métodos de pago (se desplaza de lado)"');
    expect(resumen).toContain('tabIndex={0}');
    // DP-24 · «Cerrar» y «Cobrar $…» viven en la tarjeta de cobro, con su alto táctil propio.
    const cajaCobro = leer('src/venta/TarjetaDeCobro.tsx');
    expect(cajaCobro).toContain(
      'className="h-[calc(var(--altura-tactil)+var(--espacio-3))] px-(--espacio-4)"',
    );
    expect(cajaCobro).toContain(
      'className="h-[calc(var(--altura-tactil)+var(--espacio-3))] flex-1 text-xl font-black"',
    );
  });

  it('el contraste: la cuenta de la zona sobre el primario y los avisos en texto oscuro', () => {
    expect(leer('heredado/pages/Mesero.jsx')).toContain(
      '<span className="opacity-90">({count})</span>',
    );
    expect(leer('heredado/components/caja/CorteTurnoDialog.jsx')).toContain(
      'border-advertencia/30 text-xs text-texto',
    );
    expect(leer('heredado/components/caja/CierreDiarioDialog.jsx')).toContain(
      'text-sm text-texto flex',
    );
  });
});
