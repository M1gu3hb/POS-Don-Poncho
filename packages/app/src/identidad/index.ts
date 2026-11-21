export {
  esperaTrasFallo,
  FORMA_PIN,
  hashearPin,
  INTENTOS_ANTES_DE_BLOQUEAR,
  verificarPin,
} from './pin.ts';

export { topeDelAutorizador, type TopeDelAutorizador } from './tope-del-autorizador.ts';
export { hashearDispositivo, VIGENCIA_DISPOSITIVO_SEGUNDOS } from './dispositivo.ts';

export {
  empleadosParaEntrar,
  entrarConPin,
  organizacionDeQuienEntra,
  organizacionDelDispositivo,
  type PeticionEntrar,
  type ResultadoEntrar,
} from './entrar.ts';

export { entradaEstablecerPin, establecerPin } from './comandos.ts';
// DP-25 · Parte 7 · El dueño ve el PIN de su gente (copia cifrada, con su propio PIN, auditado).
export {
  entradaPinesVisibles,
  entradaVerElPin,
  pinesVisibles,
  verElPin,
  type PinVisto,
  type PinesVisibles,
} from './ver-el-pin.ts';

export { leerEstacionDeLaSesion, type EstacionDeLaSesion } from './estacion-de-la-sesion.ts';

export {
  empleadosConAcceso,
  terminalesDeGestion,
  type EmpleadoConAcceso,
  type TerminalDeGestion,
} from './consultas.ts';

export {
  guardarEmpleado,
  entradaGuardarEmpleado,
  type ResultadoGuardarEmpleado,
} from './empleados.ts';

export {
  autorizarConPin,
  leerAutorizacion,
  ROLES_QUE_AUTORIZAN,
  VIGENCIA_AUTORIZACION_SEGUNDOS,
  type PeticionDeSupervisor,
  type ResultadoDeSupervisor,
} from './supervisor.ts';

// DP-20 · La contraseña del proveedor: sólo su hash en el despliegue, y un permiso firmado de 30 minutos.
export {
  comprobarClaveDelProveedor,
  dejarRastroDelBloqueo,
  dejarRastroDelProveedor,
  firmarPermisoDelProveedor,
  VARIABLE_DEL_HASH_DEL_PROVEEDOR,
  VIGENCIA_DEL_PERMISO_SEGUNDOS,
  vigenciaDelPermiso,
  type ClaveComprobada,
} from './proveedor.ts';
