/**
 * LOS NEGOCIOS QUE SE PUEDEN TOCAR, y los que no. Declarados UNA sola vez, por ID.
 *
 * ── Por qué este archivo existe ──────────────────────────────────────────────
 * Hasta la 2.4 la lista de negocios vivos estaba copiada en cuatro sitios —la
 * precondición de las pruebas, la siembra, el alta, el reinicio— y cada copia se
 * escribió cuando su autor sabía lo que sabía. Una lista copiada se queda atrás en
 * silencio: el día que se añade un cliente, tres de las cuatro guardas siguen
 * protegiendo a los de antes.
 *
 * ── Por qué por ID y no por nombre ni por prefijo ────────────────────────────
 * En la base compartida de la Fase A conviven con Don Poncho negocios ajenos, y tres de
 * ellos tienen un identificador que empieza por `demo-` aunque cobran de verdad. Una regla
 * de prefijo daría por buena una caja ajena. El nombre tampoco sirve: se cambia desde la
 * configuración. El ID no lo cambia nadie.
 *
 * ── Y la regla es POSITIVA ───────────────────────────────────────────────────
 * Una operación de prueba corre SÓLO si el negocio está en `NEGOCIOS_DE_PRUEBA`, que son
 * dos restaurantes que únicamente existen en bases desechables. No «si no está en los
 * reales»: un negocio que nadie declaró sería tocable desde el primer día.
 *
 * POS Don Poncho (DP-2) no tiene demostraciones. `NEGOCIOS_REALES` es Don Poncho y
 * `NEGOCIOS_AJENOS` son los que viven en la base compartida (los cuatro clientes y las
 * demostraciones del maestro): las dos listas sirven para los MENSAJES y para negarse a dar
 * de alta otra vez; nunca para decidir que algo se puede tocar.
 *
 * Este archivo lo importan el servidor (`resetear.ts`), los guiones (`scripts/*.mjs`,
 * por ruta), las pruebas (`pruebas/`, por ruta) y `@morphiqpos/testing`. No depende
 * de nada.
 */

export interface NegocioConocido {
  readonly id: string;
  readonly slug: string;
  readonly nombre: string;
}

/** Un restaurante de prueba: el giro va escrito, no se deduce del slug. */
export interface NegocioDePrueba extends NegocioConocido {
  readonly giro: 'restaurante';
}

/**
 * EL NEGOCIO DE ESTE SISTEMA. Su ID se fija aquí ANTES de darlo de alta: `db:alta-negocio`
 * lo crea con este ID sólo si ni el ID ni el slug existen, y si ya existe no lo toca (DP-4).
 * Así el mismo ID viaja a su proyecto propio (Fase B) y a su servidor (Fase C).
 */
export const NEGOCIO_DON_PONCHO: NegocioConocido = {
  id: '617ec3ad-cdc5-46d4-8d71-a1ed479c496b',
  slug: 'don-poncho',
  nombre: 'Don Poncho',
};

/** El que cobra. Nunca se prueba, nunca se resetea, nunca se siembra. */
export const NEGOCIOS_REALES: readonly NegocioConocido[] = [NEGOCIO_DON_PONCHO];

/**
 * LOS AJENOS: los que comparten la base de la Fase A con Don Poncho (proyecto MorphiqPOS).
 * Son de otros clientes o del maestro. Este sistema no los sirve, no los lee y no los toca;
 * van aquí para que ninguna herramienta los confunda con algo suyo.
 */
export const NEGOCIOS_AJENOS: readonly NegocioConocido[] = [
  { id: 'aefc918b-5303-4ae7-a1b1-7c8e03105852', slug: 'mh-restaurante', nombre: 'Restaurante MH' },
  {
    id: '10000000-0000-4000-8000-000000000001',
    slug: 'demo-abarrotes-don-chuy',
    nombre: 'Abarrotes Don Chuy',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    slug: 'demo-ferreteria-la-broca',
    nombre: 'Ferretería La Broca',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    slug: 'demo-cafe-jacaranda',
    nombre: 'Café Jacaranda',
  },
  {
    id: '1c20ddfe-535d-480c-88eb-f0d2efe3d750',
    slug: 'demo-acople-tienda',
    nombre: 'Demostración del maestro · tienda',
  },
  {
    id: 'c7fc2e42-c167-4180-9938-855f8c52896b',
    slug: 'demo-acople-cafeteria',
    nombre: 'Demostración del maestro · cafetería',
  },
  {
    id: '33dad5ff-ffea-44a5-abd4-cce8019098a7',
    slug: 'demo-acople-restaurante',
    nombre: 'Demostración del maestro · restaurante',
  },
  {
    id: '61d447a6-9633-4709-b850-871c00ae162f',
    slug: 'demo-acople-ferreteria',
    nombre: 'Demostración del maestro · ferretería',
  },
  {
    id: '1747ccf9-3474-4233-bd87-60e2e188fa8b',
    slug: 'demo-acople-estetica',
    nombre: 'Demostración del maestro · estética',
  },
];

/**
 * LOS RESTAURANTES DE PRUEBA. Los ÚNICOS sobre los que corre una prueba, una siembra o un
 * reseteo, y sólo existen en bases desechables: sus ID no están en la base compartida, y
 * las herramientas que los crean se niegan a correr contra un proyecto intocable.
 *
 * Dos, porque el aislamiento entre negocios se prueba pidiendo lo de uno desde el otro.
 */
export const NEGOCIOS_DE_PRUEBA: readonly NegocioDePrueba[] = [
  {
    id: 'eee9992f-8c71-4bb4-84a9-7682abb68f6d',
    slug: 'prueba-restaurante',
    nombre: 'Restaurante de prueba',
    giro: 'restaurante',
  },
  {
    id: 'be590cf6-f702-48bb-a0ea-7971de8d90e5',
    slug: 'prueba-restaurante-dos',
    nombre: 'Segundo restaurante de prueba',
    giro: 'restaurante',
  },
];

/**
 * El proyecto de Supabase donde vive la base compartida de la Fase A, y el de otro cliente
 * que esta base de código no toca ni para leer. Una URL de base que apunte a cualquiera de
 * los dos no es una base desechable.
 */
export const PROYECTOS_INTOCABLES: readonly string[] = [
  'wyqmzhliurwyxuyxznpb',
  'ivqcxdpqxwjxfohiswqb',
];

const normalizar = (valor: string): string => valor.trim().toLocaleLowerCase('en-US');

/** El restaurante de prueba con ese ID, o `null`. */
export function negocioDePruebaPorId(id: string | null | undefined): NegocioDePrueba | null {
  const buscado = normalizar(id ?? '');
  return NEGOCIOS_DE_PRUEBA.find((d) => d.id === buscado) ?? null;
}

/** El restaurante de prueba con ese slug, o `null`. */
export function negocioDePruebaPorSlug(slug: string | null | undefined): NegocioDePrueba | null {
  const buscado = normalizar(slug ?? '');
  return NEGOCIOS_DE_PRUEBA.find((d) => d.slug === buscado) ?? null;
}

/** Don Poncho o un ajeno, con ese ID o slug, o `null`. Sólo para decirlo y negarse. */
export function negocioReal(idOSlug: string | null | undefined): NegocioConocido | null {
  const buscado = normalizar(idOSlug ?? '');
  return (
    [...NEGOCIOS_REALES, ...NEGOCIOS_AJENOS].find((n) => n.id === buscado || n.slug === buscado) ??
    null
  );
}

/**
 * Un negocio AJENO —de otro cliente o del maestro— con ese ID o slug, o `null`. Las
 * herramientas de alta y de primer acceso se niegan con ellos sin abrir la base; con Don
 * Poncho proceden una sola vez (si ya existe, o ya tiene dueño con PIN, se niegan).
 */
export function negocioAjeno(idOSlug: string | null | undefined): NegocioConocido | null {
  const buscado = normalizar(idOSlug ?? '');
  return NEGOCIOS_AJENOS.find((n) => n.id === buscado || n.slug === buscado) ?? null;
}

/** El error de una operación de prueba sobre algo que no es un restaurante de prueba. */
export class NoEsUnNegocioDePrueba extends Error {
  override readonly name = 'NoEsUnNegocioDePrueba';
}

/**
 * LA guarda. Lanza si el negocio no es uno de los restaurantes de prueba.
 *
 * Con `id` decide por ID. Sin él —quien sólo tiene el slug de una respuesta pública—
 * decide por slug contra la misma lista. Si llegan los dos, tienen que ser del MISMO
 * negocio de prueba: un slug de prueba con el ID de un cliente es exactamente el error que
 * esta guarda existe para parar.
 */
export function exigirNegocioDePrueba(
  negocio: { readonly id?: string | null; readonly slug?: string | null },
  operacion: string,
): NegocioDePrueba {
  const porId =
    negocio.id === undefined || negocio.id === null ? null : negocioDePruebaPorId(negocio.id);
  const porSlug =
    negocio.slug === undefined || negocio.slug === null
      ? null
      : negocioDePruebaPorSlug(negocio.slug);
  const tieneId = negocio.id !== undefined && negocio.id !== null && negocio.id !== '';
  const tieneSlug = negocio.slug !== undefined && negocio.slug !== null && negocio.slug !== '';
  const prueba = tieneId ? porId : porSlug;
  const coinciden = !(tieneId && tieneSlug) || (porId !== null && porId === porSlug);

  if (prueba !== null && coinciden) return prueba;

  const quien = negocio.id ?? negocio.slug ?? '(sin negocio)';
  const real = negocioReal(negocio.id ?? negocio.slug);
  throw new NoEsUnNegocioDePrueba(
    [
      `ALTO: «${operacion}» sólo corre sobre un restaurante de prueba, y «${quien}» no lo es.`,
      real === null
        ? 'No está en la lista de negocios de prueba de packages/contracts/src/negocios.'
        : `Es ${real.nombre}: un negocio que NO es de prueba. Nunca se prueba ni se resetea.`,
      `Los de prueba: ${NEGOCIOS_DE_PRUEBA.map((d) => d.slug).join(', ')}.`,
    ].join('\n'),
  );
}

/** ¿Esta URL de Postgres (o de API) es de un proyecto intocable? */
export function esDeUnProyectoIntocable(url: string | null | undefined): boolean {
  const crudo = normalizar(url ?? '');
  // DECODIFICADA antes de buscar (auditoría de la 2.4): el driver de Postgres decodifica
  // el `%xx` del usuario, así que `postgres.%77yqmz…` se conecta al proyecto real y una
  // búsqueda sobre el texto crudo no lo veía. Una codificación rota no se puede leer,
  // y lo que no se puede leer se trata como intocable: falla cerrada.
  let texto: string;
  try {
    texto = decodeURIComponent(crudo).toLocaleLowerCase('en-US');
  } catch {
    return true;
  }
  return PROYECTOS_INTOCABLES.some((ref) => texto.includes(ref) || crudo.includes(ref));
}
