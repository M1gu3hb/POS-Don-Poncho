/**
 * DÍA 0 · OPCIONES CON PRECIO: en los productos de prueba (opción única obligatoria, opción múltiple
 * con mínimo y máximo y precios + y −) y en productos REALES: los tarros de la cerveza.
 * Platillos → «Opciones». Un grupo se crea una vez y se reutiliza en los demás productos.
 */
import { consultar } from '../api-app.ts';
import {
  abrirOpciones,
  agregarGrupoExistente,
  crearGrupo,
  guardarOpciones,
  irAPlatillos,
  tieneElGrupo,
} from '../pantallas/opciones.ts';
import type { Dia0 } from './contexto.ts';
import { OPCIONES_EN_REALES, PRODUCTOS_DE_PRUEBA, type GrupoDePrueba } from './datos.ts';

async function conGrupo(
  d: Dia0,
  platillo: string,
  g: GrupoDePrueba,
  creado: Set<string>,
): Promise<void> {
  const { pagina } = d;
  await irAPlatillos(pagina, d.entorno.appUrl);
  await abrirOpciones(pagina, platillo);
  if (await tieneElGrupo(pagina, platillo, g.nombre)) {
    d.nota('opciones', `${platillo} ya tenía «${g.nombre}»`);
    await pagina.keyboard.press('Escape');
    return;
  }
  if (creado.has(g.nombre)) await agregarGrupoExistente(pagina, platillo, g.nombre);
  else await crearGrupo(pagina, platillo, g);
  await guardarOpciones(pagina, platillo);
  creado.add(g.nombre);
  d.nota('opciones', `${platillo}: grupo «${g.nombre}» con ${String(g.opciones.length)} opciones`);
}

export async function pasoOpciones(d: Dia0): Promise<void> {
  const creados = new Set<string>();
  for (const p of PRODUCTOS_DE_PRUEBA) {
    for (const g of p.grupos) await conGrupo(d, p.nombre, g, creados);
  }
  const categorias = await consultar<{ id: string; nombre: string }>(d.pagina, 'CategoriaProducto');
  const productos = await consultar<{ nombre: string; categoria_id: string }>(
    d.pagina,
    'ProductoTerminado',
  );
  for (const { categoria, grupo } of OPCIONES_EN_REALES) {
    const id = categorias.find((c) => c.nombre === categoria)?.id;
    const reales = productos
      .filter((p) => p.categoria_id === id)
      .map((p) => p.nombre)
      .sort();
    d.nota('opciones', `${String(reales.length)} productos reales en «${categoria}»`);
    // Una cerveza crea el grupo; las demás lo reutilizan (se usa en varios productos).
    for (const nombre of reales.slice(0, 6)) await conGrupo(d, nombre, grupo, creados);
  }
  await d.foto('opciones');
}
