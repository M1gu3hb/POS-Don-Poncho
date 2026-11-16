import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AJUSTES_DE_TARJETAS, clavesDe, formularioDe, parcheDe } from './ajustes-de-tarjetas.ts';
import {
  ARCHIVOS_DE_LA_TARJETA,
  DESTINOS_POR_TEXTO,
  QUITADO,
  TARJETA_POR_ARCHIVO,
  TARJETA_POR_OMISION,
} from './inventario/destinos.ts';
import { escanear, sinComentarios } from './inventario/escanear.ts';
import {
  SECCIONES,
  TABS_DE_ANTES,
  TARJETAS,
  destinoDeLaUrl,
  laVe,
  seccionAMostrar,
  seccionesVisibles,
  tarjetasDe,
  type QuienMira,
} from './secciones.ts';

/**
 * DP-21 · Bloque 21 · LA MUDANZA DE LA CONFIGURACIÓN, COMPARADA CON LA DE ANTES.
 *
 * «Ordenarla, no quitar»: cada control que existía sigue existiendo en su lugar nuevo, con los
 * mismos datos guardados. Esta prueba parte de la fotografía de cómo era
 * (`docs/configuracion-inventario-antes.json`, que NO se regenera) y exige:
 *
 *   · cada control de antes tiene destino y su texto sigue en su tarjeta nueva (salvo lo quitado
 *     por pedido: «Integraciones», con su razón);
 *   · cada tarjeta del mapa está pintada por `Configuracion.jsx`, en su sección, y viceversa;
 *   · ninguna clave se guarda desde dos tarjetas, y cada tarjeta guarda sólo las suyas;
 *   · los `?tab=` de antes llevan a su sección, y los permisos por puesto no cambian.
 */

const RAIZ = fileURLToPath(new URL('../../../..', import.meta.url));
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

interface Antes {
  readonly controles: readonly {
    archivo: string;
    texto: string;
    fuente: string;
    clave: string | null;
  }[];
}
const ANTES = JSON.parse(leer('docs/configuracion-inventario-antes.json')) as Antes;

const PANTALLA = 'apps/web/heredado/pages/Configuracion.jsx';
const RAZON_DE_INTEGRACIONES =
  'Integraciones se quita completa, con su «Cola de sincronización» (Bloque 21, ya pedido por Miguel).';

function componenteDe(tarjeta: string): string {
  const t = TARJETAS.find((x) => x.id === tarjeta);
  if (t === undefined) throw new Error(`La tarjeta «${tarjeta}» no está en el mapa.`);
  return t.id;
}

function textosDe(ruta: string): { escaneados: ReadonlySet<string>; codigo: string } {
  const bruto = leer(ruta);
  return {
    escaneados: new Set(escanear(ruta, bruto).map((c) => c.texto)),
    codigo: sinComentarios(bruto),
  };
}

describe('cada control de antes sigue donde dice el mapa', () => {
  it('la fotografía de antes no está vacía (si lo estuviera, todo lo de abajo pasaría ciego)', () => {
    expect(ANTES.controles.length).toBeGreaterThan(150);
  });

  it('todo control de antes tiene destino, y su texto sigue en su tarjeta nueva', () => {
    const faltan: string[] = [];
    for (const c of ANTES.controles) {
      const propio = DESTINOS_POR_TEXTO.find((d) => d.archivo === c.archivo && d.texto === c.texto);
      const tarjeta =
        propio?.tarjeta ?? TARJETA_POR_ARCHIVO[c.archivo] ?? TARJETA_POR_OMISION[c.archivo];
      if (tarjeta === undefined) {
        faltan.push(`SIN DESTINO · ${c.archivo} · «${c.texto}»`);
        continue;
      }
      if (tarjeta === QUITADO) {
        if (c.archivo.endsWith('IntegracionesRespaldos.jsx') || propio?.razon !== undefined)
          continue;
        faltan.push(`QUITADO SIN RAZÓN · ${c.archivo} · «${c.texto}»`);
        continue;
      }
      componenteDe(tarjeta);
      const buscado = propio?.ahora ?? c.texto;
      // Lo que se movió a otra tarjeta se busca en SUS archivos; lo que se quedó entero, en el suyo.
      const archivos =
        propio === undefined ? [c.archivo] : (ARCHIVOS_DE_LA_TARJETA[tarjeta] ?? [c.archivo]);
      const esta = archivos.some((a) => {
        if (!existsSync(join(RAIZ, a))) return false;
        const { escaneados, codigo } = textosDe(a);
        // Un título que cambió de nombre se busca en el código; lo demás, como lo ve quien lo mira.
        return escaneados.has(buscado) || (propio?.ahora !== undefined && codigo.includes(buscado));
      });
      if (!esta) faltan.push(`YA NO ESTÁ · «${buscado}» (${tarjeta}) en ${archivos.join(' o ')}`);
    }
    expect(faltan).toEqual([]);
  });

  it('lo único quitado es «Integraciones», y su componente ya no se pinta', () => {
    const quitados = new Set(
      ANTES.controles
        .filter((c) => TARJETA_POR_ARCHIVO[c.archivo] === QUITADO)
        .map((c) => c.archivo),
    );
    expect([...quitados]).toEqual([
      'apps/web/heredado/components/configuracion/IntegracionesRespaldos.jsx',
    ]);
    expect(RAZON_DE_INTEGRACIONES).toMatch(/Integraciones/);
    expect(leer(PANTALLA)).not.toMatch(/Integraciones/);
    expect(
      existsSync(
        join(RAIZ, 'apps/web/heredado/components/configuracion/IntegracionesRespaldos.jsx'),
      ),
    ).toBe(false);
  });
});

describe('el mapa y la pantalla dicen lo mismo', () => {
  const pantalla = sinComentarios(leer(PANTALLA));
  /** El cuerpo de la función de cada tarjeta dentro de `CONTENIDO`. */
  const cuerpos = new Map<string, string>();
  const entradas = [...pantalla.matchAll(/\n {4}(?:'([a-z-]+)'|([a-z]+)): \(\) =>/g)];
  entradas.forEach((m, i) => {
    const id = m[1] ?? m[2] ?? '';
    const fin = entradas[i + 1]?.index ?? pantalla.indexOf('const seccion = SECCIONES');
    cuerpos.set(id, pantalla.slice(m.index, fin));
  });

  it('cada tarjeta del mapa la pinta Configuracion.jsx, con su componente y su grupo', () => {
    const mal: string[] = [];
    for (const t of TARJETAS) {
      const cuerpo = cuerpos.get(t.id);
      if (cuerpo === undefined) {
        mal.push(`${t.id}: no está en CONTENIDO`);
        continue;
      }
      if (!cuerpo.includes(`<${t.componente}`)) mal.push(`${t.id}: no pinta <${t.componente}>`);
      if (t.grupo !== undefined && !cuerpo.includes(`"${t.grupo}"`)) {
        mal.push(`${t.id}: no le pasa el grupo «${t.grupo}»`);
      }
    }
    expect(mal).toEqual([]);
  });

  it('y ninguna tarjeta pintada falta en el mapa', () => {
    const delMapa = new Set(TARJETAS.map((t) => t.id));
    expect([...cuerpos.keys()].filter((id) => !delMapa.has(id))).toEqual([]);
  });

  it('el formulario único se acabó: ninguna escritura propia ni «Guardar configuración»', () => {
    expect(pantalla).not.toMatch(/saveBiz|bizForm|Guardar configuración/);
    expect(pantalla).not.toMatch(/ConfiguracionNegocio\.update/);
  });

  it('dieciséis secciones, cada una con al menos una tarjeta y una línea de para qué sirve', () => {
    expect(SECCIONES).toHaveLength(16);
    for (const s of SECCIONES) {
      expect(
        TARJETAS.some((t) => t.seccion === s.id),
        s.id,
      ).toBe(true);
      expect(s.paraQue.length, s.id).toBeGreaterThan(10);
    }
    expect(SECCIONES.map((s) => s.nombre)).toEqual([
      'El negocio',
      'Apariencia',
      'Ventas y cobro',
      'Ticket y folios',
      'Caja',
      'Salón',
      'Cocina',
      'Portal de comensales',
      'Productos e inventario',
      'Personas y seguridad',
      'Sonidos y avisos',
      'Datos',
      'Este aparato',
      'Laboratorio del proveedor',
      'Mantenimiento',
      'Avanzado',
    ]);
  });

  it('lo de Avanzado dice qué era, y los ids de las tarjetas no se repiten', () => {
    for (const t of TARJETAS.filter((x) => x.seccion === 'avanzado')) {
      expect(t.queEra?.length ?? 0, t.id).toBeGreaterThan(20);
    }
    expect(new Set(TARJETAS.map((t) => t.id)).size).toBe(TARJETAS.length);
  });
});

describe('cada ajuste vive en un solo lugar, y cada tarjeta guarda sólo lo suyo', () => {
  it('ninguna clave se guarda desde dos tarjetas', () => {
    const dueña = new Map<string, string>();
    const repetidas: string[] = [];
    for (const t of TARJETAS) {
      for (const clave of t.guarda) {
        const otra = dueña.get(clave);
        if (otra !== undefined) repetidas.push(`${clave}: ${otra} y ${t.id}`);
        dueña.set(clave, t.id);
      }
    }
    expect(repetidas).toEqual([]);
  });

  it('las tarjetas de ajustes sencillos guardan exactamente lo que dice el mapa', () => {
    for (const t of TARJETAS.filter((x) => x.componente === 'TarjetaDeAjustes')) {
      const ajustes = AJUSTES_DE_TARJETAS[t.grupo ?? ''];
      expect(ajustes, t.id).toBeDefined();
      if (ajustes === undefined) continue;
      expect([...clavesDe(ajustes)].sort(), t.id).toEqual([...t.guarda].sort());
    }
  });

  it('cambiar un campo de una tarjeta sencilla manda ÚNICAMENTE ese campo', () => {
    for (const [id, ajustes] of Object.entries(AJUSTES_DE_TARJETAS)) {
      const guardado = Object.fromEntries(
        ajustes.campos.map((c) => [c.clave, formularioDe(ajustes, null)[c.clave]]),
      );
      for (const campo of ajustes.campos) {
        const base = formularioDe(ajustes, guardado);
        const cambiado =
          campo.tipo === 'interruptor'
            ? !(base[campo.clave] === true)
            : campo.tipo === 'seleccion'
              ? (campo.opciones.find((o) => o.valor !== base[campo.clave])?.valor ?? 0)
              : `${String(base[campo.clave])}x`;
        const parche = parcheDe(ajustes, { ...base, [campo.clave]: cambiado }, guardado);
        expect(Object.keys(parche), `${id} · ${campo.clave}`).toEqual([campo.clave]);
        // Y sin tocar nada no viaja nada: guardar una tarjeta no reescribe las demás.
        expect(parcheDe(ajustes, base, guardado), id).toEqual({});
      }
    }
  });

  it('IdentidadNegocio y ConfiguracionQRTab reparten sus claves como dice el mapa', () => {
    const grupos = (ruta: string, constante: string): Record<string, string[]> => {
      const codigo = sinComentarios(leer(ruta));
      const bloque =
        new RegExp(`const ${constante} = \\{([\\s\\S]*?)\\n\\};`).exec(codigo)?.[1] ?? '';
      const salida: Record<string, string[]> = {};
      for (const m of bloque.matchAll(/(?:'([a-z-]+)'|([a-z]+)): \[([^\]]*)\]/g)) {
        salida[m[1] ?? m[2] ?? ''] = [...(m[3] ?? '').matchAll(/'([a-z_0-9]+)'/g)].map(
          (x) => x[1] ?? '',
        );
      }
      return salida;
    };
    const identidad = grupos(
      'apps/web/heredado/components/configuracion/IdentidadNegocio.jsx',
      'CLAVES_DEL_GRUPO',
    );
    const portal = grupos(
      'apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx',
      'CLAVES_DEL_PORTAL',
    );
    for (const t of TARJETAS.filter((x) => x.componente === 'IdentidadNegocio')) {
      expect([...(identidad[t.grupo ?? ''] ?? [])].sort(), t.id).toEqual([...t.guarda].sort());
    }
    for (const t of TARJETAS.filter((x) => x.componente === 'ConfiguracionQRTab')) {
      expect([...(portal[t.grupo ?? ''] ?? [])].sort(), t.id).toEqual([...t.guarda].sort());
    }
  });
});

describe('los enlaces viejos siguen sirviendo', () => {
  const CASOS: readonly (readonly [string, string, string | null])[] = [
    ['identidad', 'el-negocio', null],
    ['apariencia', 'apariencia', null],
    ['aparato', 'este-aparato', null],
    ['impresion', 'este-aparato', 'impresora-y-cajon'],
    ['sonidos', 'sonidos', null],
    ['negocio', 'ventas-y-cobro', null],
    ['usuarios', 'personas', 'usuarios-pos'],
    ['caja', 'caja', null],
    ['descuentos', 'ventas-y-cobro', 'descuentos'],
    ['mesas', 'salon', 'mapa-de-mesas'],
    ['datos', 'datos', null],
    ['integraciones', 'datos', null],
    ['mantenimiento', 'mantenimiento', null],
  ];

  it.each(CASOS)('?tab=%s lleva a «%s»', (tab, seccion, ancla) => {
    expect(destinoDeLaUrl(`?tab=${tab}`)).toEqual({ seccion, ancla });
  });

  it('son los trece de antes, ninguno sobra y ninguno falta', () => {
    expect(Object.keys(TABS_DE_ANTES).sort()).toEqual(CASOS.map(([t]) => t).sort());
  });

  it('la dirección nueva manda; sin nada o con algo que no existe, la primera sección', () => {
    expect(destinoDeLaUrl('?seccion=portal').seccion).toBe('portal');
    expect(destinoDeLaUrl('?seccion=portal&tab=caja').seccion).toBe('portal');
    expect(destinoDeLaUrl('').seccion).toBe('el-negocio');
    expect(destinoDeLaUrl('?tab=nadie').seccion).toBe('el-negocio');
    expect(destinoDeLaUrl('?seccion=nadie').seccion).toBe('el-negocio');
  });

  it('un enlace a algo que ese puesto no veía no abre nada nuevo: cae en lo primero que ve', () => {
    const cajero: QuienMira = {
      puesto: 'cajero',
      tieneMesas: true,
      rolAdministrador: false,
      esPlataforma: false,
    };
    const visibles = seccionesVisibles(cajero);
    expect(seccionAMostrar(destinoDeLaUrl('?tab=mantenimiento'), visibles)).toBe(visibles[0]?.id);
    expect(seccionAMostrar(destinoDeLaUrl('?tab=mesas'), visibles)).toBe('salon');
  });
});

describe('los permisos no cambian', () => {
  const quien = (parte: Partial<QuienMira>): QuienMira => ({
    puesto: 'dueno',
    tieneMesas: true,
    rolAdministrador: true,
    esPlataforma: false,
    ...parte,
  });
  const ids = (q: QuienMira): string[] => TARJETAS.filter((t) => laVe(t, q)).map((t) => t.id);

  it('lo que antes era sólo del dueño y del administrador, el cajero, el mesero y el gerente no lo ven', () => {
    const deMando = [
      'las-cajas',
      'pin-en-retiros',
      'candado-de-mando',
      'descuentos',
      'exportar',
      'importar',
    ];
    for (const puesto of ['gerente', 'cajero', 'mesero', 'cocina', 'almacen']) {
      const veo = ids(quien({ puesto, rolAdministrador: false }));
      for (const id of deMando) expect(veo, `${puesto} no debe ver ${id}`).not.toContain(id);
    }
    for (const puesto of ['dueno', 'administrador']) {
      const veo = ids(quien({ puesto }));
      for (const id of deMando) expect(veo, `${puesto} debe ver ${id}`).toContain(id);
    }
  });

  it('el mapa de mesas sólo con el módulo de mesas; el portal sólo para el administrador; Mantenimiento sólo con plataforma', () => {
    expect(ids(quien({ tieneMesas: false }))).not.toContain('mapa-de-mesas');
    expect(ids(quien({ tieneMesas: true }))).toContain('mapa-de-mesas');
    expect(ids(quien({ rolAdministrador: false }))).not.toContain('portal-activacion');
    expect(ids(quien({ rolAdministrador: true }))).toContain('portal-activacion');
    expect(ids(quien({ esPlataforma: false }))).not.toContain('reiniciar-sistema');
    expect(ids(quien({ rolAdministrador: false, esPlataforma: true }))).not.toContain(
      'reiniciar-sistema',
    );
    expect(ids(quien({ esPlataforma: true }))).toContain('reiniciar-sistema');
  });

  it('una sección sin tarjetas visibles no aparece en la lista', () => {
    const sinPlataforma = seccionesVisibles(quien({ esPlataforma: false })).map((s) => s.id);
    expect(sinPlataforma).not.toContain('mantenimiento');
    const sinMesas = tarjetasDe('salon', quien({ tieneMesas: false })).map((t) => t.id);
    expect(sinMesas).toEqual(['asignacion-de-mesas']);
  });
});
