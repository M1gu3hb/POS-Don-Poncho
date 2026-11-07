import 'server-only';

import { leyendoConReintento, obtenerDb } from '@morphiqpos/data';

import { terminosDeLaOrganizacion } from '../configuracion/vocabulario.ts';
import { colorDePersona, etiquetaDeRol, etiquetaDeRolEnElGiro } from './roles.ts';

/**
 * `UsuarioPOS` — la entidad que son tres tablas.
 *
 * Su sistema guardaba usuario, rol y PIN en un solo registro. Aquí son
 * `personas` (quién es), `empleos` (qué hace y dónde) y `credenciales_pin`
 * (cómo entra). El identificador que ve su frontend es el del EMPLEO, porque
 * es lo que identifica «esta persona, en este negocio, con este rol».
 *
 * ── El PIN no sale. Nunca. ────────────────────────────────────────────────
 * Ni el PIN ni su hash ni los intentos fallidos. Esta consulta no toca
 * `credenciales_pin` más que para saber si HAY credencial, y eso viaja como un
 * booleano. Era el defecto D-01: su `POSLogin` descargaba los PIN de toda la
 * plantilla al navegador y los comparaba ahí.
 */

type Registro = Record<string, unknown>;

export async function listarUsuariosPOS(organizacionId: string): Promise<Registro[]> {
  // Las tres lecturas que el puente hace FUERA de `consultar` pasan por el mismo
  // reintento: son las que `ConfigContext` pide en cada carga de pantalla, y son
  // las que dejaban el `ECONNRESET` del pooler en el registro. El reintento sólo
  // vale para LEER; ninguna escritura lo lleva.
  const filas = await leyendoConReintento(() =>
    obtenerDb()
      .selectFrom('empleos')
      .innerJoin('personas', 'personas.id', 'empleos.persona_id')
      .leftJoin('identidades', 'identidades.persona_id', 'personas.id')
      // `leftJoin` y no `innerJoin`: un empleado sin PIN todavía TIENE que salir
      // en la lista. Con `innerJoin` desaparecería justo el que hay que dar de
      // alta, y la pantalla parecería estar completa.
      .leftJoin('credenciales_pin', 'credenciales_pin.identidad_id', 'identidades.id')
      .select([
        'empleos.id as id',
        'personas.nombre as nombre',
        'personas.telefono as telefono',
        'empleos.rol as rolBase',
        'empleos.color as colorGuardado',
        'empleos.estacion_preparacion_id as estacionId',
        'empleos.ve_todas_las_estaciones as veTodasLasEstaciones',
        'empleos.activo as activo',
        'empleos.created_at as createdAt',
        'empleos.updated_at as updatedAt',
        'credenciales_pin.id as credencialId',
      ])
      .where('empleos.organizacion_id', '=', organizacionId)
      .orderBy('personas.nombre')
      .limit(200)
      .execute(),
  );

  // La etiqueta del rol en el vocabulario del GIRO (A.8 de la 2.4): en el salón el rol
  // `mesero` es la estilista. La entrada ya la traducía; Configuración → Accesos no
  // (auditoría de la 2.4). Si el vocabulario no se puede leer, la genérica: es una
  // etiqueta, no un permiso.
  const terminos = await terminosDeLaOrganizacion(organizacionId).catch(() => null);
  const etiquetaDe = (rol: string): string =>
    terminos === null
      ? etiquetaDeRol(rol)
      : etiquetaDeRolEnElGiro(rol, terminos.giro, terminos.personalizado);

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    telefono: f.telefono,
    // DP-14 · El PUESTO REAL de la base (`dueno`, `administrador`, `gerente`, `cajero`, `mesero`,
    // `cocina`, `almacen`), no el de su vocabulario: con `rolMH` el dueño, el administrador y el
    // gerente salían los tres como «administrador», y el diálogo de Usuarios, al guardar, les
    // cambiaba el puesto. Lo que se traduce es lo que se DIBUJA (la sesión y la entrada siguen
    // con `rolMH`); lo que se muestra y se edita aquí es lo que la persona ES.
    rol: f.rolBase,
    etiqueta: etiquetaDe(f.rolBase),
    // El color que se PINTA: el guardado en el empleo y, si no tiene, uno estable derivado del id.
    color: f.colorGuardado ?? colorDePersona(f.id),
    // El color que la persona TIENE (o `null`): lo que el diálogo carga y compara. Si cargara el
    // calculado, cualquier edición —un renombre— lo guardaría como si lo hubieran elegido.
    color_guardado: f.colorGuardado,
    // La estación de la cocina: sin ella, desactivar o reactivar a un cocinero la borraba.
    estacion_preparacion_id: f.estacionId,
    puede_ver_todas_estaciones: f.veTodasLasEstaciones,
    activo: f.activo,
    tiene_pin: f.credencialId !== null,
    created_date: f.createdAt.toISOString(),
    updated_date: f.updatedAt.toISOString(),
  }));
}
