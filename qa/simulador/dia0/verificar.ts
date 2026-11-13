/**
 * EL RESULTADO DEL DÍA 0, VERIFICADO EN SÓLO LECTURA: lo que el dueño dejó por pantallas contra lo
 * que prometía `datos.ts`: personas, estaciones, mesas con QR, los 10 productos de prueba por tipo,
 * opciones con precio, insumos al gramo y la configuración.
 *
 *   node qa/simulador/dia0/verificar.ts --app … --base … --pines … --salida …
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { carpetaDelDia } from '../arbitro/salida.ts';
import { crearComparador, leerSql, num, ORGANIZACION } from '../arbitro/base.ts';
import { leerEntorno } from '../entorno.ts';
import {
  ESTACIONES_NUEVAS,
  INSUMOS,
  BASE_POR_COMPRA,
  MESAS_EN_TOTAL,
  PRODUCTOS_DE_PRUEBA,
  USUARIOS,
  CONFIGURACION,
} from './datos.ts';
import { SALIDA_DIA0 } from './contexto.ts';

const TIPO_DE_BASE = {
  pieza: 'precio_fijo',
  peso_con_presentaciones: 'variable_medida',
  peso_libre: 'variable_medida',
  solo_presentaciones: 'variable_medida',
  porcion: 'porcion_contenedor',
  opcion_unica: 'precio_fijo',
  opcion_multiple: 'precio_fijo',
  con_foto: 'precio_fijo',
  sin_foto_con_fondo: 'precio_fijo',
  sin_opciones: 'precio_fijo',
} as const;

export async function verificarElDia0(
  baseUrl: string,
): Promise<ReturnType<ReturnType<typeof crearComparador>['resultado']>> {
  const c = crearComparador();
  const q = <T extends Record<string, unknown>>(sql: string, valores: readonly unknown[] = []) =>
    leerSql<T>(baseUrl, sql, valores);
  const roles = await q<{ rol: string; n: string }>(
    `select rol, count(*)::text as n from empleos where organizacion_id = ${ORGANIZACION} and activo group by rol`,
  );
  const n = (rol: string) => num(roles.find((r) => r.rol === rol)?.n);
  c.comparar('día 0 · personas', 'meseros', 6, n('mesero'));
  c.comparar('día 0 · personas', 'cajeras', 3, n('cajero'));
  c.comparar('día 0 · personas', 'gerente', 1, n('gerente'));
  c.comparar('día 0 · personas', 'almacén', 1, n('almacen'));
  c.comparar(
    'día 0 · personas',
    'cocineros (Cocina, Bebidas y uno por estación nueva)',
    2 + USUARIOS.filter((u) => u.puesto === 'Cocina').length,
    n('cocina'),
  );
  const estaciones = (
    await q<{ nombre: string }>(
      `select nombre from estaciones_preparacion where organizacion_id = ${ORGANIZACION} and activa`,
    )
  ).map((e) => e.nombre);
  for (const e of ['Cocina', 'Bebidas', ...ESTACIONES_NUEVAS])
    c.comparar('día 0 · estaciones', e, 'existe', estaciones.includes(e) ? 'existe' : 'falta');
  const [mesas] = await q<{ total: string; con_qr: string }>(
    `select count(*)::text as total, count(*) filter (where qr_token is not null and qr_activa)::text as con_qr from mesas where organizacion_id = ${ORGANIZACION} and activa`,
  );
  c.comparar('día 0 · mesas', 'mesas activas', MESAS_EN_TOTAL, num(mesas?.total));
  c.comparar('día 0 · mesas', 'mesas con QR activo', MESAS_EN_TOTAL, num(mesas?.con_qr));
  const productos = await q<{
    nombre: string;
    tipo_venta: string;
    imagen_url: string | null;
    nombre_grupo: string | null;
  }>(
    `select p.nombre, p.tipo_venta, p.imagen_url, m.nombre as nombre_grupo from productos p
       left join producto_modificadores pm on pm.producto_id = p.id left join modificadores m on m.id = pm.modificador_id
      where p.organizacion_id = ${ORGANIZACION} and p.nombre = any($1::text[])`,
    [PRODUCTOS_DE_PRUEBA.map((p) => p.nombre)],
  );
  for (const p of PRODUCTOS_DE_PRUEBA) {
    const filas = productos.filter((x) => x.nombre === p.nombre);
    c.comparar(
      'día 0 · productos',
      `${p.nombre}: tipo de venta (${p.tipo})`,
      TIPO_DE_BASE[p.tipo],
      filas[0]?.tipo_venta ?? 'no existe',
    );
    if (p.conFoto === true)
      c.comparar(
        'día 0 · productos',
        `${p.nombre}: tiene foto`,
        'sí',
        (filas[0]?.imagen_url ?? '') !== '' ? 'sí' : 'no',
      );
    for (const g of p.grupos)
      c.comparar(
        'día 0 · opciones',
        `${p.nombre}: grupo «${g.nombre}»`,
        'sí',
        filas.some((f) => f.nombre_grupo === g.nombre) ? 'sí' : 'no',
      );
  }
  const tarros = await q<{ n: string }>(
    `select count(*)::text as n from producto_modificadores pm join modificadores m on m.id = pm.modificador_id where m.nombre = 'Tarro' and pm.organizacion_id = ${ORGANIZACION}`,
  );
  c.comparar(
    'día 0 · opciones',
    'el grupo «Tarro» está en cervezas reales (al menos una)',
    'sí',
    num(tarros[0]?.n) > 0 ? 'sí' : 'no',
  );
  const existencias = await q<{ nombre: string; cantidad: string }>(
    `select i.nombre, coalesce(sum(e.cantidad), 0)::text as cantidad from insumos i left join existencias e on e.insumo_id = i.id where i.organizacion_id = ${ORGANIZACION} and i.nombre = any($1::text[]) group by i.nombre`,
    [INSUMOS.map((i) => i.nombre)],
  );
  for (const i of INSUMOS) {
    const esperado = i.compra * BASE_POR_COMPRA[i.unidadDeCompra] - i.mermaBase;
    c.comparar(
      'día 0 · inventario',
      `${i.nombre}: existencia (${i.base}) = compra − merma`,
      esperado,
      num(existencias.find((x) => x.nombre === i.nombre)?.cantidad),
      'inventario',
      'alto',
    );
  }
  const [cfg] = await q<{ valores: Record<string, unknown> }>(
    `select valores from configuracion where organizacion_id = ${ORGANIZACION}`,
  );
  const texto = JSON.stringify(cfg?.valores ?? {});
  c.comparar(
    'día 0 · configuración',
    'alerta ámbar guardada',
    'sí',
    texto.includes(String(CONFIGURACION.alertaAmbarMinutos)) ? 'sí' : 'no',
    'ux',
    'medio',
  );
  c.comparar(
    'día 0 · configuración',
    'alerta roja guardada',
    'sí',
    texto.includes(String(CONFIGURACION.alertaRojoMinutos)) ? 'sí' : 'no',
    'ux',
    'medio',
  );
  c.comparar(
    'día 0 · configuración',
    `PIN en retiros arriba de $${String(CONFIGURACION.retiroConPinArribaDePesos)}`,
    'sí',
    texto.includes(String(CONFIGURACION.retiroConPinArribaDePesos * 100)) ||
      texto.includes(String(CONFIGURACION.retiroConPinArribaDePesos))
      ? 'sí'
      : 'no',
    'ux',
    'medio',
  );
  return c.resultado(0);
}

if (import.meta.main) {
  const entorno = leerEntorno();
  const r = await verificarElDia0(entorno.baseUrl);
  writeFileSync(join(SALIDA_DIA0, 'verificacion.json'), JSON.stringify(r, null, 2));
  // El informe del día 0 (`DIA-0.md`) lee el mismo `arbitro.json` que los demás días.
  writeFileSync(join(carpetaDelDia(entorno.salida, 0), 'arbitro.json'), JSON.stringify(r, null, 2));
  process.stdout.write(
    `Día 0: ${String(r.comparaciones)} comprobaciones, ${String(r.diferencias.length)} diferencias\n`,
  );
  for (const d of r.diferencias)
    process.stdout.write(
      `  · [${d.fuente}] ${d.concepto}: esperado ${d.esperado}, real ${d.real}\n`,
    );
}
