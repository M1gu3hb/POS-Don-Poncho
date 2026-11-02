/**
 * EL NOMBRE DE UNA MESA, sin repetir lo que el número ya dice (DP-12.6).
 *
 * Al dar de alta una mesa se guarda `nombre: "Mesa N"`, y las pantallas anteponían «Mesa {numero}
 * · {nombre}»: salía «Mesa 2 · Mesa 2» en el portal del comensal, en Portal QR, en el diálogo
 * de quitar una mesa… El nombre sólo se agrega cuando DICE ALGO MÁS («Terraza», «Barra»). Vive
 * aquí, y no en cada pantalla, para que ninguna vuelva a repetirlo.
 */

export interface MesaConNombre {
  readonly numero?: number | string | null | undefined;
  readonly nombre?: string | null | undefined;
}

const PALABRA_DE_LA_MESA = 'Mesa';

/** Para comparar: sin mayúsculas y con los espacios en uno. */
function comparable(texto: string): string {
  return texto.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Las formas en que un nombre repite el número: «Mesa 2», «2», «#2», «Mesa #2». */
function repiteElNumero(nombre: string, numero: number | string): boolean {
  const n = comparable(String(numero));
  const dicho = comparable(nombre);
  return [`mesa ${n}`, `mesa #${n}`, n, `#${n}`].includes(dicho);
}

/**
 * Lo que el nombre agrega al número: el nombre recortado, o vacío si no hay nombre o sólo repite
 * «Mesa {numero}». Sin número no hay con qué comparar y el nombre se conserva.
 */
export function nombreDistintivoDeLaMesa(mesa: MesaConNombre | null | undefined): string {
  const nombre = mesa?.nombre?.trim() ?? '';
  if (nombre === '') return '';
  const numero = mesa?.numero;
  if (numero === undefined || numero === null || String(numero).trim() === '') return nombre;
  return repiteElNumero(nombre, numero) ? '' : nombre;
}

/** « · Terraza» para pegar detrás del número, o vacío si el nombre no agrega nada. */
export function sufijoDelNombreDeLaMesa(mesa: MesaConNombre | null | undefined): string {
  const distintivo = nombreDistintivoDeLaMesa(mesa);
  return distintivo === '' ? '' : ` · ${distintivo}`;
}

/** «Mesa 2» o «Mesa 2 · Terraza». Sin número, el guion largo que ya ponen las pantallas. */
export function rotuloDeLaMesa(
  mesa: MesaConNombre | null | undefined,
  palabra: string = PALABRA_DE_LA_MESA,
): string {
  const numero = mesa?.numero;
  const dicho = numero === undefined || numero === null || String(numero) === '' ? '—' : numero;
  return `${palabra} ${String(dicho)}${sufijoDelNombreDeLaMesa(mesa)}`;
}
