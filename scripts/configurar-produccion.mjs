#!/usr/bin/env node
/**
 * LA CONFIGURACIÓN DE ARRANQUE DE DON PONCHO (DP-22 · Parte 11), por los comandos de la aplicación.
 *
 *   node --conditions=react-server scripts/configurar-produccion.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" [--ensayo] [--primer-folio]
 *
 * Deja el negocio como va a abrir, con los MISMOS comandos que usan las pantallas de Configuración,
 * firmados por el dueño de `--persona` (cada uno deja su antes y su después en la auditoría) y sin
 * teclear ningún PIN:
 *   · IVA: «Sin IVA» (`configuracion.fijar_impuesto`, 0 puntos base);
 *   · el prefijo de folio «DP» (`configuracion.fijar_folios`; el primer folio no se toca aquí);
 *   · dos cajas a la vez, «Caja 1» y «Caja 2» (`caja.fijar_cajas_simultaneas`, `caja.nombrar_cajas`);
 *   · el «Almacén principal», si la sucursal no tiene almacén (`inventario.crear_almacen`);
 *   · quién elige la propina: comensales y Caja (`configuracion.fijar_quien_elige_la_propina`);
 *   · el ticket y la precuenta con todos sus renglones, lo de omisión (`caja.fijar_papel_a_tu_gusto`).
 * «Silenciar notificaciones del administrador» se queda encendido (DP-22): el guion lo COMPRUEBA y
 * avisa si no lo está; no lo escribe (ese ajuste se guarda desde su tarjeta).
 *
 * Es idempotente: lee cómo está cada cosa y sólo manda el comando de lo que difiere. Una segunda
 * corrida no escribe nada. `--ensayo` dice lo que haría y no escribe.
 *
 * `--primer-folio` es el paso de DESPUÉS de dejar en ceros: pone el primer folio en 1001 (cuentas)
 * y 101 (cortes). El comando sólo lo acepta con los folios en cero y antes del arranque real (H1).
 *
 * Termina con la verificación, leyendo: si algo no quedó como debe, sale con error.
 * En producción, por la conexión de sesión (5432), nunca por el pooler de transacción (DP-D92).
 */
import { argumento, cargarEntorno, huella } from './lib/guion.mjs';
import { exigirConexionDirecta } from './lib/lectura-segura.mjs';

const DESEADO = {
  impuesto: { puntosBase: 0, incluidoEnPrecio: true },
  prefijo: 'DP',
  cajas: 2,
  nombresDeCajas: ['Caja 1', 'Caja 2'],
  almacen: 'Almacén principal',
  quienEligeLaPropina: { comensales: true, mesero: false, caja: true },
  silenciarAvisosDelAdministrador: true,
  primerFolioDeCuentas: 1001,
  primerFolioDeCortes: 101,
};

cargarEntorno();
const slug = argumento('org');
const persona = argumento('persona');
const ensayo = process.argv.includes('--ensayo');
const conPrimerFolio = process.argv.includes('--primer-folio');
if (slug === null || persona === null) {
  console.error(
    'Uso: configurar-produccion.mjs --org <slug> --persona "<dueño>" [--ensayo] [--primer-folio]',
  );
  process.exit(2);
}
exigirConexionDirecta(process.env['DATABASE_URL']);

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb, cerrarDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { fijarImpuesto } = await import('../packages/app/src/configuracion/impuesto.ts');
const { impuestoEn } = await import('../packages/app/src/configuracion/impuesto-del-negocio.ts');
const { fijarFolios } = await import('../packages/app/src/configuracion/folios.ts');
const { foliosEn } = await import('../packages/app/src/configuracion/folios-del-negocio.ts');
const { fijarCajasSimultaneas } = await import('../packages/app/src/caja/cajas-a-la-vez.ts');
const { nombrarCajas, nombresDeCajasEn } = await import('../packages/app/src/caja/lugares.ts');
const { crearAlmacen } = await import('../packages/app/src/inventario/inventario.ts');
const { fijarQuienEligeLaPropina, casillasDeQuienElige } =
  await import('../packages/app/src/propinas/quien-elige.ts');
const { fijarPapelATuGusto, papelATuGustoEn } =
  await import('../packages/app/src/caja/papel-a-tu-gusto.ts');
const { PAPEL_POR_OMISION, papelIgual } =
  await import('../packages/domain/src/venta/campos-del-papel.ts');

const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const db = obtenerDb();
try {
  const org = await db
    .selectFrom('organizaciones')
    .select(['id', 'nombre'])
    .where('id', '=', permitido.id)
    .where('slug', '=', slug)
    .executeTakeFirst();
  const sucursal =
    org &&
    (await db
      .selectFrom('sucursales')
      .select('id')
      .where('organizacion_id', '=', org.id)
      .orderBy('created_at', 'asc')
      .executeTakeFirst());
  const actor =
    org &&
    (await db
      .selectFrom('empleos')
      .innerJoin('personas', 'personas.id', 'empleos.persona_id')
      .innerJoin('identidades', 'identidades.persona_id', 'personas.id')
      .select(['empleos.id as empleoId', 'identidades.id as identidadId'])
      .where('empleos.organizacion_id', '=', org.id)
      .where('empleos.rol', '=', 'dueno')
      .where('empleos.activo', '=', true)
      .where('personas.nombre', '=', persona)
      .executeTakeFirst());
  if (!org || !sucursal || !actor) {
    console.error(`✗ «${slug}» sin alta, sin sucursal o sin «${persona}» como dueño activo.`);
    process.exit(1);
  }
  const ambito = {
    organizacionId: org.id,
    sucursalId: sucursal.id,
    terminalId: null,
    identidadId: actor.identidadId,
    empleoId: actor.empleoId,
    rol: 'dueno',
  };

  /** Cómo está el negocio AHORA, leído de la base (lo mismo que leen los comandos). */
  const leer = async () => {
    const configuracion = await db
      .selectFrom('configuracion')
      .select('valores')
      .where('organizacion_id', '=', org.id)
      .executeTakeFirst();
    const valores = configuracion?.valores ?? {};
    const laSucursal = await db
      .selectFrom('sucursales')
      .select('cajas_simultaneas')
      .where('id', '=', sucursal.id)
      .executeTakeFirstOrThrow();
    const almacenes = await db
      .selectFrom('almacenes')
      .select(['nombre', 'principal'])
      .where('sucursal_id', '=', sucursal.id)
      .execute();
    const folios = foliosEn(valores);
    return {
      impuesto: impuestoEn(valores),
      folios,
      cajas: laSucursal.cajas_simultaneas,
      nombresDeCajas: nombresDeCajasEn(valores).slice(0, DESEADO.cajas),
      almacenes,
      quienEligeLaPropina: casillasDeQuienElige(valores),
      papel: papelATuGustoEn(valores),
      silenciarAvisosDelAdministrador: valores['silenciar_notificaciones_admin'] !== false,
    };
  };

  /** Los pasos: qué falta, y el comando que lo deja como debe. */
  const pasosPara = (hoy) => {
    const pasos = [];
    const paso = (nombre, falta, definicion, entrada) =>
      pasos.push({ nombre, falta, definicion, entrada });
    paso('IVA: Sin IVA', hoy.impuesto.puntosBase !== 0, fijarImpuesto, DESEADO.impuesto);
    paso('Prefijo de folio «DP»', hoy.folios.prefijo !== DESEADO.prefijo, fijarFolios, {
      ...hoy.folios,
      prefijo: DESEADO.prefijo,
    });
    paso('Dos cajas a la vez', hoy.cajas !== DESEADO.cajas, fijarCajasSimultaneas, {
      cajas: DESEADO.cajas,
    });
    paso(
      'Las cajas se llaman «Caja 1» y «Caja 2»',
      !iguales(hoy.nombresDeCajas, DESEADO.nombresDeCajas),
      nombrarCajas,
      { nombres: DESEADO.nombresDeCajas },
    );
    paso('El «Almacén principal»', hoy.almacenes.length === 0, crearAlmacen, {
      nombre: DESEADO.almacen,
    });
    paso(
      'La propina la eligen comensales y Caja',
      !iguales(hoy.quienEligeLaPropina, DESEADO.quienEligeLaPropina),
      fijarQuienEligeLaPropina,
      DESEADO.quienEligeLaPropina,
    );
    paso(
      'El ticket y la precuenta, con todos sus renglones',
      !papelIgual(hoy.papel, PAPEL_POR_OMISION),
      fijarPapelATuGusto,
      PAPEL_POR_OMISION,
    );
    if (conPrimerFolio) {
      const conPrimeros = {
        prefijo: DESEADO.prefijo,
        primerFolioDeCuentas: DESEADO.primerFolioDeCuentas,
        primerFolioDeCortes: DESEADO.primerFolioDeCortes,
      };
      paso('Primer folio: 1001 y 101', !iguales(hoy.folios, conPrimeros), fijarFolios, conPrimeros);
    }
    return pasos;
  };

  const antes = await leer();
  const pasos = pasosPara(antes);
  console.log(`«${org.nombre}»:`);
  for (const { nombre, falta } of pasos)
    console.log(`  ${falta ? '◦ falta' : '✓ ya está'} · ${nombre}`);
  if (!antes.silenciarAvisosDelAdministrador) {
    console.log(
      '  ! «Silenciar notificaciones del administrador» está APAGADO: se enciende en Configuración → Sonidos y avisos.',
    );
  }
  if (ensayo) {
    const faltan = pasos.filter(({ falta }) => falta).length;
    console.log(`◦ Ensayo: mandaría ${String(faltan)} comando(s). No se escribe nada.`);
    process.exit(0);
  }

  for (const { nombre, falta, definicion, entrada } of pasos) {
    if (!falta) continue;
    const resultado = await comando(definicion, {
      ambito,
      entrada,
      idempotencyKey: `configurar-produccion:${definicion.nombre}:${huella(entrada)}`,
    });
    if (!resultado.ok) {
      // Lo anterior ya quedó guardado (cada comando es su transacción); una corrida nueva sigue aquí.
      console.error(`✗ ${nombre}: ${resultado.error.codigo} · ${resultado.error.mensaje}`);
      process.exit(1);
    }
    console.log(`✓ ${nombre} (${definicion.nombre})`);
  }

  // La verificación: se vuelve a leer y no puede faltar nada.
  const despues = await leer();
  const pendientes = pasosPara(despues).filter(({ falta }) => falta);
  if (pendientes.length > 0 || !despues.silenciarAvisosDelAdministrador) {
    for (const { nombre } of pendientes) console.error(`✗ No quedó: ${nombre}`);
    if (!despues.silenciarAvisosDelAdministrador) {
      console.error('✗ «Silenciar notificaciones del administrador» sigue apagado.');
    }
    process.exit(1);
  }
  console.log(
    `✓ Configurado «${slug}»: sin IVA, prefijo ${String(despues.folios.prefijo)}, ` +
      `${String(despues.cajas)} cajas (${despues.nombresDeCajas.join(', ')}), ` +
      `almacén «${despues.almacenes.find((a) => a.principal)?.nombre ?? '—'}», ` +
      `primer folio ${String(despues.folios.primerFolioDeCuentas)} y ${String(despues.folios.primerFolioDeCortes)}.`,
  );
} finally {
  await cerrarDb();
}
