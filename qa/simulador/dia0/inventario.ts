/**
 * DÍA 0 · INVENTARIO: los insumos entran por COMPRAS (Compras → Registrar compra) y cada uno sufre
 * una merma de prueba (Inventario → Ajustar). Todo queda en el libro del día 0 con su cantidad en
 * unidad base, que es contra lo que el árbitro compara el inventario al gramo.
 */
import { llamar } from '../api-app.ts';
import { BASE_POR_COMPRA, INSUMOS } from './datos.ts';
import { ir, type Dia0 } from './contexto.ts';
import {
  ajustarStock,
  existeElInsumo,
  irACompras,
  irAInventario,
  registrarCompra,
} from '../pantallas/inventario.ts';

/**
 * Una sucursal sin almacén no puede recibir compras y NINGUNA pantalla lo crea: el dueño sólo ve
 * «Esta sucursal no tiene un almacén donde recibir la compra». Se registra el incidente con la
 * respuesta real de la pantalla y se crea el almacén por la API (como la hizo el QA-1) para seguir.
 */
async function asegurarAlmacen(d: Dia0, primero: (typeof INSUMOS)[number]): Promise<void> {
  const resumen = await llamar(d.pagina, '/api/inventario/resumen');
  const almacenes = Array.isArray(resumen.datos['almacenes'])
    ? (resumen.datos['almacenes'] as unknown[])
    : [];
  if (almacenes.length > 0) return;
  await irACompras(d.pagina, d.entorno.appUrl);
  const respuesta = d.pagina.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/compras/registrar',
  );
  const intento = registrarCompra(d.pagina, {
    nombre: primero.nombre,
    cantidad: primero.compra,
    unidadDeCompra: primero.unidadDeCompra,
    costoTotalPesos: primero.costoTotalPesos,
    base: primero.base,
    pago: 'Transferencia',
  });
  const r = await respuesta;
  const cuerpo = await r.text();
  await intento.catch(() => undefined);
  if (r.status() === 200) return;
  await d.incidente({
    pantalla: 'Compras → Registrar compra',
    hizo: `Registré la primera compra de un insumo nuevo (${primero.nombre}) en un negocio sin almacén`,
    esperaba: 'La compra se guarda, o la pantalla ofrece crear el almacén',
    paso: `POST /api/compras/registrar → ${String(r.status())}: ${cuerpo.slice(0, 200)}`,
    evidencia: { correlationId: r.headers()['x-correlation-id'] ?? '' },
    gravedad: 'alto',
    clase: 'ux',
  });
  await d.pagina.keyboard.press('Escape');
  const creado = await llamar(d.pagina, '/api/inventario/almacenes/crear', {
    nombre: 'Almacén general',
  });
  if (!creado.ok)
    throw new Error(`No se pudo crear el almacén: ${String(creado.estado)} ${creado.mensaje}`);
  d.nota(
    'inventario',
    'sin almacén: creado «Almacén general» por la API (ninguna pantalla lo crea)',
  );
}

export async function pasoInventario(d: Dia0): Promise<void> {
  const { pagina } = d;
  await irAInventario(pagina, d.entorno.appUrl);
  const faltan = [];
  for (const i of INSUMOS) {
    if (await existeElInsumo(pagina, i.nombre)) d.nota('inventario', `${i.nombre} ya estaba`);
    else faltan.push(i);
  }
  if (faltan[0] !== undefined) await asegurarAlmacen(d, faltan[0]);
  for (const i of faltan) {
    await irACompras(pagina, d.entorno.appUrl);
    await registrarCompra(pagina, {
      nombre: i.nombre,
      cantidad: i.compra,
      unidadDeCompra: i.unidadDeCompra,
      costoTotalPesos: i.costoTotalPesos,
      base: i.base,
      // Por transferencia: una compra en efectivo sale del cajón abierto y desbarata el corte.
      pago: 'Transferencia',
    });
    d.anotar({
      tipo: 'compra',
      insumo: i.nombre,
      cantidad: i.compra * BASE_POR_COMPRA[i.unidadDeCompra],
      unidad: i.base,
      costoCentavos: Math.round(i.costoTotalPesos * 100),
    });
    d.nota('inventario', `compra de ${String(i.compra)} ${i.unidadDeCompra} de ${i.nombre}`);
  }
  if (faltan.length > 0) {
    await ir(d, '/inventario');
    await irAInventario(pagina, d.entorno.appUrl);
  }
  for (const i of faltan) {
    await ajustarStock(pagina, i.nombre, {
      tipo: 'Merma / producto perdido',
      metodo: 'diferencia',
      signo: 'restar',
      cantidad: i.mermaBase,
      unidad: i.base,
      motivo: 'Merma de prueba del día 0',
    });
    d.anotar({ tipo: 'merma', insumo: i.nombre, cantidad: i.mermaBase, unidad: i.base });
    d.nota('inventario', `merma de ${String(i.mermaBase)} ${i.base} de ${i.nombre}`);
  }
  await d.foto('inventario');
}
