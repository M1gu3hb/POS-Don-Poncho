/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access --
   el plan es un .mjs sin tipos y su estado es un documento libre: el fixture lo arma a mano. */
import { describe, expect, it } from 'vitest';

// @ts-expect-error el plan es un módulo .mjs sin tipos (como el resto de `scripts/lib`).
import { aplicarEtapa, ETAPAS, planDeEtapa } from './plan-del-menu.mjs';

/**
 * DP-24 · 3.3 · El plan del guion que deja el menú como la hoja de papel: sus etapas, su
 * idempotencia, y lo que lo detiene (sin escribir nada).
 */

interface Paso {
  readonly nombre: string;
  readonly definicion: { readonly nombre: string };
  readonly entrada: Record<string, unknown>;
}
type Estado = Record<string, any>;
interface Etapa {
  readonly id: string;
  readonly titulo: string;
}
const etapas = ETAPAS as readonly Etapa[];
const plan = planDeEtapa as (
  e: Etapa,
  s: Estado,
  a: Estado,
) => { pasos: Paso[]; problemas: string[] };
const aplicar = aplicarEtapa as (s: Estado, p: Paso[]) => Estado;

const COCINA = 'est-cocina';
const CANTINA = 'est-cantina';

const hoja = [
  {
    nombre: 'Para empezar',
    antes: ['Pa’ empezar'],
    color: 'cat-6',
    productos: ['Quesadilla', 'Guacamole'],
  },
  { nombre: 'Bebidas', antes: ['Para enfriar'], color: 'cat-10', productos: ['Coca cola', 'Jugo'] },
  {
    nombre: 'Ron y Brandy',
    antes: ['Ron'],
    unirCon: 'Brandy',
    color: 'cat-16',
    productos: ['Bacardí', 'Torres'],
  },
];
const ayudantes = {
  hoja,
  extras: ['Michelado (extra)'],
  grupos: [
    {
      nombre: 'Prepárala',
      tipo: 'unica',
      obligatorio: false,
      opciones: [
        { nombre: 'Michelado', precio: '15' },
        { nombre: 'Cubano', precio: '20' },
      ],
      productos: ['Coca cola'],
    },
  ],
};

const categoria = (id: string, nombre: string, orden: number, estacion: string, activa = true) => ({
  id,
  nombre,
  color: null,
  activa,
  orden,
  estacion_preparacion_id: estacion,
});
const producto = (id: string, nombre: string, categoria_id: string, area = 'cocina') => ({
  id,
  nombre,
  categoria_id,
  activo: true,
  area_preparacion: area,
  orden_en_categoria: null,
});

function negocio(): Estado {
  return {
    organizacionId: 'org',
    categorias: [
      categoria('c1', 'Pa’ empezar', 2, COCINA),
      categoria('c2', 'Para enfriar', 1, CANTINA),
      categoria('c3', 'Ron', 0, CANTINA),
      categoria('c4', 'Brandy', 3, CANTINA),
    ],
    productos: [
      producto('p1', 'Guacamole', 'c1'),
      producto('p2', 'Quesadilla', 'c1'),
      producto('p3', 'Jugo', 'c2', 'barra'),
      producto('p4', 'Coca cola', 'c2', 'barra'),
      producto('p5', 'Torres', 'c4', 'barra'),
      producto('p6', 'Bacardí', 'c3', 'barra'),
      producto('p7', 'Michelado (extra)', 'c2', 'barra'),
    ],
    estaciones: [
      { id: COCINA, nombre: 'Cocina', color: '#000', esGeneral: true },
      { id: CANTINA, nombre: 'Cantina', color: '#111', esGeneral: false },
    ],
    grupos: [],
    asignaciones: [],
    enCuentasAbiertas: new Map(),
  };
}

/** Corre todas las etapas sobre el estado proyectado y devuelve los pasos de cada una. */
function correrTodo(estado: Estado, a: Estado = ayudantes) {
  const porEtapa: Record<string, Paso[]> = {};
  let actual = estado;
  for (const etapa of etapas) {
    const { pasos, problemas } = plan(etapa, actual, a);
    expect(problemas).toEqual([]);
    porEtapa[etapa.id] = pasos;
    actual = aplicar(actual, pasos);
  }
  return { porEtapa, final: actual };
}

describe('el plan del menú de la hoja', () => {
  it('renombra, une, mueve, apaga los extras, asigna opciones y ordena, en ese orden', () => {
    const { porEtapa } = correrTodo(negocio());
    const nombres = (id: string) => (porEtapa[id] ?? []).map((p) => p.definicion.nombre);
    expect(nombres('categorias')).toEqual([
      'catalogo.guardar_categoria',
      'catalogo.guardar_categoria',
      'catalogo.guardar_categoria',
      'catalogo.unir_categorias',
    ]);
    expect(nombres('extras')).toEqual(['catalogo.archivar_producto']);
    expect(nombres('grupos')).toEqual(['catalogo.guardar_grupo_de_opciones']);
    expect(nombres('asignar')).toEqual(['catalogo.asignar_grupos_de_opciones']);
    expect(nombres('orden-categorias')).toEqual(['catalogo.ordenar_categorias']);
    // Sólo «Para empezar» cambia: las otras dos ya estaban por nombre como la hoja.
    expect(nombres('orden-productos')).toHaveLength(1);
  });

  it('el orden de los platillos es el de la hoja, y lo que no viene va al final por nombre', () => {
    const estado = negocio();
    estado['productos'].push(
      producto('p8', 'Zacahuil', 'c1'),
      producto('p9', 'Agua de horchata', 'c1'),
    );
    const { porEtapa } = correrTodo(estado);
    const empezar = (porEtapa['orden-productos'] ?? []).find(
      (p) => p.entrada['categoriaId'] === 'c1',
    );
    expect(empezar?.entrada['productoIds']).toEqual(['p2', 'p1', 'p9', 'p8']);
  });

  it('es idempotente: tras aplicar todo, ninguna etapa tiene nada que mandar', () => {
    const { final } = correrTodo(negocio());
    for (const etapa of etapas) {
      expect(plan(etapa, final, ayudantes)).toEqual({ pasos: [], problemas: [] });
    }
  });

  it('se detiene, sin pasos, si un producto de la hoja no existe', () => {
    const estado = negocio();
    estado['productos'] = estado['productos'].filter(
      (p: { nombre: string }) => p.nombre !== 'Jugo',
    );
    const r = plan(etapas[0]!, estado, ayudantes);
    expect(r.pasos).toEqual([]);
    expect(r.problemas).toEqual(['Falta el producto «Jugo» (activo, con ese nombre exacto).']);
  });

  it('se detiene si falta una categoría de la hoja', () => {
    const estado = negocio();
    estado['categorias'] = estado['categorias'].filter((c: { id: string }) => c.id !== 'c1');
    const r = plan(etapas[0]!, estado, ayudantes);
    expect(r.problemas.join(' ')).toContain('Falta la categoría «Para empezar»');
  });

  it('no apaga un «(extra)» que trae una cuenta abierta', () => {
    const estado = negocio();
    estado['enCuentasAbiertas'] = new Map([['p7', 2]]);
    const r = plan(etapas[1]!, estado, ayudantes);
    expect(r.pasos).toEqual([]);
    expect(r.problemas[0]).toContain('2 renglón(es) de cuentas abiertas');
  });

  it('se detiene si unir o mover cambiaría la estación de un platillo', () => {
    const estado = negocio();
    estado['categorias'] = estado['categorias'].map((c: { id: string }) =>
      c.id === 'c4' ? { ...c, estacion_preparacion_id: COCINA } : c,
    );
    const r = plan(etapas[0]!, estado, ayudantes);
    expect(r.problemas.join(' ')).toContain('cambiaría la estación de preparación');
  });

  it('un grupo que ya existe pero es distinto no se pisa', () => {
    const estado = negocio();
    estado['grupos'] = [
      {
        id: 'g1',
        nombre: 'Prepárala',
        tipo: 'unica',
        obligatorio: true,
        activo: true,
        opciones: [],
      },
    ];
    const r = plan(etapas[2]!, estado, ayudantes);
    expect(r.pasos).toEqual([]);
    expect(r.problemas[0]).toContain('ya existe y es distinto');
  });

  it('las opciones de un producto no pisan las que ya traía: se suman al final', () => {
    const estado = negocio();
    estado['grupos'] = [
      {
        id: 'g1',
        nombre: 'Prepárala',
        tipo: 'unica',
        obligatorio: false,
        activo: true,
        opciones: [
          { nombre: 'Michelado', activa: true, centavos: 1500 },
          { nombre: 'Cubano', activa: true, centavos: 2000 },
        ],
      },
    ];
    estado['asignaciones'] = [{ producto_id: 'p4', modificador_id: 'g-viejo', orden: 0 }];
    const r = plan(etapas[3]!, estado, ayudantes);
    expect(r.pasos[0]?.entrada).toEqual({ productoId: 'p4', grupoIds: ['g-viejo', 'g1'] });
  });
});
