/**
 * El PLAN de `ordenar-menu-produccion.mjs`: de cómo está el negocio (`leerElMenu`) a los comandos que
 * lo dejan como la hoja. Por ETAPAS, porque unas dependen de otras (no se ordena lo que aún no se
 * movió). Cada etapa devuelve sus pasos y, si algo no casa, sus `problemas` (el guion entonces no
 * escribe nada). Cada paso trae su `efecto`: `aplicarEtapa` lo proyecta sobre el estado, que es lo que
 * deja a `--ensayo` decir lo MISMO que haría la corrida de verdad.
 */
const catalogo = await import('../../packages/app/src/catalogo/index.ts');
const dominio = await import('../../packages/domain/src/catalogo/index.ts');
const { estacionDeLaCategoria } = await import('./leer-el-menu.mjs');

export const ETAPAS = [
  { id: 'categorias', titulo: 'Categorías (nombre, color, unir y mover)' },
  { id: 'extras', titulo: 'Los «(extra)» de Cerveza' },
  { id: 'grupos', titulo: 'Grupos de opciones nuevos' },
  { id: 'asignar', titulo: 'Opciones dentro de los productos' },
  { id: 'orden-categorias', titulo: 'Orden de las categorías' },
  { id: 'orden-productos', titulo: 'Orden de los platillos' },
];

const paso = (nombre, definicion, entrada, efecto) => ({ nombre, definicion, entrada, efecto });

/** Las categorías de la hoja y los productos, resueltos por NOMBRE EXACTO (o con sus problemas). */
function resolver(estado, { hoja, extras }) {
  const problemas = [];
  const activos = new Map();
  for (const p of estado.productos.filter((x) => x.activo)) {
    if (activos.has(p.nombre)) problemas.push(`Hay dos productos activos llamados «${p.nombre}».`);
    activos.set(p.nombre, p);
  }
  const categorias = new Map();
  for (const c of hoja) {
    const nombres = [c.nombre, ...c.antes];
    const candidatas = estado.categorias.filter((x) => x.activa && nombres.includes(x.nombre));
    if (candidatas.length === 0)
      problemas.push(
        `Falta la categoría «${c.nombre}» (o ${c.antes.map((a) => `«${a}»`).join(', ') || 'otro nombre'}).`,
      );
    else if (candidatas.length > 1)
      problemas.push(`Hay dos categorías activas para «${c.nombre}».`);
    else categorias.set(c.nombre, candidatas[0]);
  }
  for (const nombre of hoja.flatMap((c) => c.productos)) {
    if (!activos.has(nombre))
      problemas.push(`Falta el producto «${nombre}» (activo, con ese nombre exacto).`);
  }
  for (const nombre of extras) {
    if (!estado.productos.some((x) => x.nombre === nombre))
      problemas.push(`Falta el producto «${nombre}».`);
  }
  return { problemas, activos, categorias };
}

function etapaCategorias(estado, ayudantes, r) {
  const pasos = [];
  const problemas = [];
  const alVuelo = (categoriaOrigen, destino, que) => {
    const deOrigen = estacionDeLaCategoria(estado, categoriaOrigen.id);
    const deDestino = estacionDeLaCategoria(estado, destino.id);
    if (deOrigen !== deDestino) {
      problemas.push(
        `${que} de «${categoriaOrigen.nombre}» a «${destino.nombre}» cambiaría la estación de preparación.`,
      );
    }
  };
  for (const c of ayudantes.hoja) {
    const fila = r.categorias.get(c.nombre);
    if (fila === undefined) continue;
    const entrada = { categoriaId: fila.id };
    if (fila.nombre !== c.nombre) entrada.nombre = c.nombre;
    if (fila.color !== c.color) entrada.color = c.color;
    if (Object.keys(entrada).length > 1) {
      const que = `Categoría «${fila.nombre}»${entrada.nombre ? ` → «${c.nombre}»` : ''}${entrada.color ? ` · color ${c.color}` : ''}`;
      pasos.push(
        paso(que, catalogo.guardarCategoriaDelMenu, entrada, {
          tipo: 'categoria',
          id: fila.id,
          nombre: c.nombre,
          color: c.color,
        }),
      );
    }
  }
  const uniones = new Set();
  for (const c of ayudantes.hoja.filter((x) => x.unirCon)) {
    const destino = r.categorias.get(c.nombre);
    const origen = estado.categorias.find((x) => x.nombre === c.unirCon);
    if (destino === undefined || origen === undefined) continue;
    const quedan = estado.productos.some((p) => p.categoria_id === origen.id);
    if (!origen.activa && !quedan) continue;
    uniones.add(origen.id);
    alVuelo(origen, destino, 'Unir');
    pasos.push(
      paso(
        `Unir «${origen.nombre}» con «${c.nombre}»`,
        catalogo.unirCategoriasDelMenu,
        { categoriaQueSobraId: origen.id, categoriaQueRecibeId: destino.id },
        { tipo: 'unir', origenId: origen.id, destinoId: destino.id },
      ),
    );
  }
  const porDestino = new Map();
  for (const c of ayudantes.hoja) {
    const destino = r.categorias.get(c.nombre);
    for (const nombre of c.productos) {
      const p = r.activos.get(nombre);
      if (
        destino === undefined ||
        p === undefined ||
        p.categoria_id === destino.id ||
        uniones.has(p.categoria_id)
      )
        continue;
      porDestino.set(destino.id, [...(porDestino.get(destino.id) ?? []), p]);
    }
  }
  for (const [destinoId, productos] of porDestino) {
    const destino = estado.categorias.find((x) => x.id === destinoId);
    for (const p of productos)
      alVuelo(
        estado.categorias.find((x) => x.id === p.categoria_id) ?? destino,
        destino,
        `Mover «${p.nombre}»`,
      );
    pasos.push(
      paso(
        `Mover ${productos.map((p) => `«${p.nombre}»`).join(', ')} a «${destino.nombre}»`,
        catalogo.moverProductosACategoria,
        { productoIds: productos.map((p) => p.id), categoriaId: destinoId },
        { tipo: 'mover', ids: productos.map((p) => p.id), destinoId },
      ),
    );
  }
  return { pasos, problemas };
}

function etapaExtras(estado, ayudantes) {
  const pasos = [];
  const problemas = [];
  for (const nombre of ayudantes.extras) {
    const p = estado.productos.find((x) => x.nombre === nombre && x.activo);
    if (p === undefined) continue;
    const abiertas = estado.enCuentasAbiertas.get(p.id) ?? 0;
    if (abiertas > 0)
      problemas.push(
        `«${nombre}» está en ${String(abiertas)} renglón(es) de cuentas abiertas: no se apaga.`,
      );
    else
      pasos.push(
        paso(
          `Apagar «${nombre}»`,
          catalogo.archivarProducto,
          { productoId: p.id },
          { tipo: 'archivar', id: p.id },
        ),
      );
  }
  return { pasos, problemas };
}

function igualAlDeseado(grupo, deseado) {
  return (
    grupo.tipo === deseado.tipo &&
    grupo.obligatorio === deseado.obligatorio &&
    grupo.activo &&
    grupo.opciones.length === deseado.opciones.length &&
    grupo.opciones.every(
      (o, i) =>
        o.nombre === deseado.opciones[i].nombre &&
        o.activa &&
        o.centavos === Math.round(Number(deseado.opciones[i].precio) * 100),
    )
  );
}

function etapaGrupos(estado, ayudantes) {
  const pasos = [];
  const problemas = [];
  for (const g of ayudantes.grupos) {
    const existente = estado.grupos.find((x) => x.nombre === g.nombre);
    if (existente === undefined) {
      const entrada = {
        nombre: g.nombre,
        tipo: g.tipo,
        obligatorio: g.obligatorio,
        activo: true,
        opciones: g.opciones,
      };
      pasos.push(
        paso(
          `Grupo «${g.nombre}» (${g.opciones.map((o) => o.nombre).join(', ')})`,
          catalogo.guardarGrupoDeOpciones,
          entrada,
          { tipo: 'grupo', grupo: g },
        ),
      );
    } else if (!igualAlDeseado(existente, g)) {
      problemas.push(
        `El grupo «${g.nombre}» ya existe y es distinto del de la hoja: no se pisa. Revísalo en Productos → Opciones.`,
      );
    }
  }
  return { pasos, problemas };
}

function etapaAsignar(estado, ayudantes, r) {
  const pasos = [];
  for (const g of ayudantes.grupos) {
    const grupo = estado.grupos.find((x) => x.nombre === g.nombre);
    if (grupo === undefined) continue;
    for (const nombre of g.productos) {
      const p = r.activos.get(nombre);
      if (p === undefined) continue;
      const suyos = estado.asignaciones
        .filter((a) => a.producto_id === p.id)
        .map((a) => a.modificador_id);
      if (suyos.includes(grupo.id)) continue;
      pasos.push(
        paso(
          `«${g.nombre}» en «${nombre}»`,
          catalogo.asignarGruposAlProducto,
          { productoId: p.id, grupoIds: [...suyos, grupo.id] },
          { tipo: 'asignar', productoId: p.id, grupoId: grupo.id },
        ),
      );
    }
  }
  return { pasos, problemas: [] };
}

function categoriasActivasEnOrden(estado) {
  return dominio.ordenarCategorias(estado.categorias.filter((c) => c.activa)).map((c) => c.id);
}

function etapaOrdenCategorias(estado, ayudantes, r) {
  const actuales = categoriasActivasEnOrden(estado);
  const deLaHoja = ayudantes.hoja.flatMap((c) =>
    r.categorias.has(c.nombre) ? [r.categorias.get(c.nombre).id] : [],
  );
  const deseado = [...deLaHoja, ...actuales.filter((id) => !deLaHoja.includes(id))];
  if (dominio.mismoOrden(actuales, deseado)) return { pasos: [], problemas: [] };
  return {
    pasos: [
      paso(
        'Ordenar las categorías como la hoja',
        catalogo.ordenarCategoriasDelMenu,
        { categoriaIds: deseado, antes: actuales },
        { tipo: 'orden-categorias', ids: deseado },
      ),
    ],
    problemas: [],
  };
}

function etapaOrdenProductos(estado, ayudantes, r) {
  const pasos = [];
  for (const c of ayudantes.hoja) {
    const fila = r.categorias.get(c.nombre);
    if (fila === undefined) continue;
    const suyos = estado.productos.filter((p) => p.activo && p.categoria_id === fila.id);
    const actuales = dominio.ordenarMenu(suyos, [{ id: fila.id, orden: 0 }]).map((p) => p.id);
    const deLaHoja = c.productos.flatMap((n) => (r.activos.has(n) ? [r.activos.get(n).id] : []));
    const resto = suyos
      .filter((p) => !deLaHoja.includes(p.id))
      .map((p) => ({ ...p, orden_en_categoria: null }));
    const deseado = [
      ...deLaHoja.filter((id) => suyos.some((p) => p.id === id)),
      ...dominio.ordenarMenu(resto, [{ id: fila.id, orden: 0 }]).map((p) => p.id),
    ];
    if (dominio.mismoOrden(actuales, deseado)) continue;
    pasos.push(
      paso(
        `Ordenar los platillos de «${fila.nombre}»`,
        catalogo.ordenarProductosDeLaCategoria,
        { categoriaId: fila.id, productoIds: deseado, antes: actuales },
        { tipo: 'orden-productos', categoriaId: fila.id, ids: deseado },
      ),
    );
  }
  return { pasos, problemas: [] };
}

const POR_ETAPA = {
  categorias: etapaCategorias,
  extras: (estado, ayudantes) => etapaExtras(estado, ayudantes),
  grupos: (estado, ayudantes) => etapaGrupos(estado, ayudantes),
  asignar: etapaAsignar,
  'orden-categorias': etapaOrdenCategorias,
  'orden-productos': etapaOrdenProductos,
};

/** Los pasos de la etapa y los problemas que impiden escribir. */
export function planDeEtapa(etapa, estado, ayudantes) {
  const r = resolver(estado, ayudantes);
  if (r.problemas.length > 0) return { pasos: [], problemas: r.problemas };
  return POR_ETAPA[etapa.id](estado, ayudantes, r);
}

/** El estado como quedaría después de esos pasos (sin tocar el que llega). */
export function aplicarEtapa(estado, pasos) {
  const e = {
    ...estado,
    categorias: estado.categorias.map((c) => ({ ...c })),
    productos: estado.productos.map((p) => ({ ...p })),
    grupos: [...estado.grupos],
    asignaciones: [...estado.asignaciones],
  };
  const productoPorId = () => new Map(e.productos.map((p) => [p.id, p]));
  for (const { efecto: f } of pasos) {
    if (f.tipo === 'categoria')
      Object.assign(
        e.categorias.find((c) => c.id === f.id),
        { nombre: f.nombre, color: f.color },
      );
    if (f.tipo === 'unir') {
      e.categorias.find((c) => c.id === f.origenId).activa = false;
      for (const p of e.productos.filter((x) => x.categoria_id === f.origenId))
        Object.assign(p, { categoria_id: f.destinoId, orden_en_categoria: null });
    }
    if (f.tipo === 'mover')
      for (const id of f.ids)
        Object.assign(productoPorId().get(id), {
          categoria_id: f.destinoId,
          orden_en_categoria: null,
        });
    if (f.tipo === 'archivar') productoPorId().get(f.id).activo = false;
    if (f.tipo === 'grupo')
      e.grupos.push({
        id: `(nuevo) ${f.grupo.nombre}`,
        nombre: f.grupo.nombre,
        tipo: f.grupo.tipo,
        obligatorio: f.grupo.obligatorio,
        activo: true,
        opciones: f.grupo.opciones.map((o) => ({
          nombre: o.nombre,
          activa: true,
          centavos: Math.round(Number(o.precio) * 100),
        })),
      });
    if (f.tipo === 'asignar')
      e.asignaciones.push({ producto_id: f.productoId, modificador_id: f.grupoId, orden: 99 });
    if (f.tipo === 'orden-categorias')
      f.ids.forEach((id, i) => {
        e.categorias.find((c) => c.id === id).orden = i + 1;
      });
    if (f.tipo === 'orden-productos')
      f.ids.forEach((id, i) => {
        productoPorId().get(id).orden_en_categoria = i + 1;
      });
  }
  return e;
}
