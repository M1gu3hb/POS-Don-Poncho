/**
 * EL EQUIPO DE LOS RESTAURANTES DE PRUEBA: una persona por cada rol que opera de verdad.
 *
 * ── Por qué vive aquí y no en el servidor ─────────────────────────────────────
 * La siembra del restaurante de prueba (`packages/app/src/negocio-de-prueba`) es `server-only`, y
 * las pruebas de extremo a extremo entran con el ROL que toca a cada paso —la cajera cobra,
 * el mesero comanda, la cocina marca listo—. Para eso necesitan saber quién es quién y con
 * qué PIN, y una segunda copia se quedaría atrás en silencio. Aquí la leen las dos.
 *
 * ── Los PIN, y por qué están aquí escritos ───────────────────────────────────
 * Son de PRUEBA y abren sólo los restaurantes de prueba, que existen únicamente en bases
 * desechables (la siembra se niega por ID fuera de `NEGOCIOS_DE_PRUEBA` y se niega a correr
 * contra un proyecto intocable). Ningún PIN de Don Poncho vive en este repositorio: se
 * entregan fuera de él.
 *
 * No depende de nada, igual que el resto de este directorio.
 */

/** El único giro con negocio de prueba: POS Don Poncho sirve a un restaurante (DP-2). */
export type GiroDePrueba = 'restaurante';

export interface EmpleadoDePrueba {
  readonly nombre: string;
  readonly apellidos: string;
  /** Uno de los siete roles del servidor. */
  readonly rol: string;
  readonly pin: string;
  readonly color: string;
}

/**
 * El dueño de un restaurante de prueba: lo crea `db:bootstrap` cuando nace el negocio y el
 * reseteo le repone este PIN.
 */
export const DUENO_DE_PRUEBA = { nombre: 'Dueña de prueba', rol: 'dueno', pin: '1234' } as const;

/** El PIN de cada rol. Distintos para que se distingan al revisar. */
const PIN = {
  gerente: '2345',
  cajero: '3456',
  atiende: '4567',
  prepara: '5678',
  almacen: '6789',
} as const;

const RESTAURANTE: readonly EmpleadoDePrueba[] = [
  { nombre: 'Beatriz', apellidos: 'Salgado', rol: 'gerente', pin: PIN.gerente, color: '#be123c' },
  { nombre: 'Rosa', apellidos: 'Miranda', rol: 'cajero', pin: PIN.cajero, color: '#16a34a' },
  { nombre: 'Lupita', apellidos: 'Ramírez', rol: 'mesero', pin: PIN.atiende, color: '#7c3aed' },
  { nombre: 'Toño', apellidos: 'Barrera', rol: 'cocina', pin: PIN.prepara, color: '#d97706' },
  { nombre: 'Nacho', apellidos: 'Peralta', rol: 'almacen', pin: PIN.almacen, color: '#0f766e' },
];

/** El equipo sembrado de cada giro de prueba. Sin el dueño: ése es `DUENO_DE_PRUEBA`. */
export const EQUIPO_DE_PRUEBA: Readonly<Record<GiroDePrueba, readonly EmpleadoDePrueba[]>> = {
  restaurante: RESTAURANTE,
};

/** ¿Este giro tiene equipo de prueba? */
export function esGiroDePrueba(giro: string): giro is GiroDePrueba {
  return giro === 'restaurante';
}

/** El equipo de un giro de prueba. Fuera del restaurante no hay equipo que sembrar. */
export function equipoDePrueba(giro: string): readonly EmpleadoDePrueba[] {
  return esGiroDePrueba(giro) ? EQUIPO_DE_PRUEBA[giro] : [];
}
