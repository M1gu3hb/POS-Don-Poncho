/**
 * DP-21 · Bloque 21 · EL INVENTARIO DE LA CONFIGURACIÓN: qué controles hay en un archivo.
 *
 * Lee el CÓDIGO de una pantalla (sin comentarios) y saca lo que una persona ve y toca: etiquetas,
 * títulos de tarjeta, subtítulos, textos de botones, opciones de las listas, `aria-label` y las
 * etiquetas que se pasan como propiedad (`label=`, `titulo=`). A cada una le pega, si lo encuentra
 * cerca, la clave del formulario que guarda. No ejecuta nada: es lo bastante tonto como para que
 * dé lo mismo antes y después de mover un componente, y lo bastante fino para que un control que
 * desaparece o cambia de nombre se note.
 *
 * Lo usan `scripts/inventariar-configuracion.mjs` (que escribe la fotografía de «antes») y la
 * prueba de la mudanza (`mudanza.contrato.test.ts`), que busca cada control en su sitio nuevo.
 */

export type FuenteDelTexto =
  'etiqueta' | 'tarjeta' | 'subtitulo' | 'boton' | 'opcion' | 'aria' | 'propiedad';

export interface ControlInventariado {
  readonly archivo: string;
  readonly texto: string;
  readonly fuente: FuenteDelTexto;
  /** La clave del formulario (`bizForm.x`, `form.x`, `field="x"`) que sale justo después, o `null`. */
  readonly clave: string | null;
}

/** El código sin comentarios de bloque, de línea ni de JSX (`{/* … *\/}`). */
export function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/** Quita lo que no se lee: etiquetas, llaves de JSX y espacios de más. */
export function textoVisible(crudo: string): string {
  return crudo
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PATRONES: readonly { readonly fuente: FuenteDelTexto; readonly er: RegExp }[] = [
  { fuente: 'etiqueta', er: /<Label\b[^>]*>([\s\S]*?)<\/Label>/g },
  { fuente: 'etiqueta', er: /<label\b[^>]*>([\s\S]*?)<\/label>/g },
  { fuente: 'tarjeta', er: /<CardTitle\b[^>]*>([\s\S]*?)<\/CardTitle>/g },
  { fuente: 'tarjeta', er: /<h3\b[^>]*>([\s\S]*?)<\/h3>/g },
  {
    fuente: 'subtitulo',
    er: /<p className="text-sm font-(?:semibold|bold)[^"]*">([^<{]+)<\/p>/g,
  },
  { fuente: 'boton', er: /<Button\b[^>]*>([^<{]*(?:<[A-Z][A-Za-z]* [^>]*\/>[^<{]*)?)<\/Button>/g },
  { fuente: 'opcion', er: /<SelectItem\b[^>]*>([^<]+)<\/SelectItem>/g },
  { fuente: 'opcion', er: /<option\b[^>]*>([^<]+)<\/option>/g },
  { fuente: 'aria', er: /\baria-label="([^"]+)"/g },
  { fuente: 'propiedad', er: /\b(?:label|titulo)="([^"]+)"/g },
  { fuente: 'propiedad', er: /\b(?:etiqueta|titulo|nombre): '([^']+)'/g },
  { fuente: 'propiedad', er: /\b(?:etiqueta|titulo|nombre): "([^"]+)"/g },
];

const CLAVE_CERCA = /(?:bizForm|form)\.([a-z_0-9]+)|field="([a-z_0-9]+)"|clave: '([a-z_0-9]+)'/;

/** Todo lo que el archivo enseña, con su clave si la hay, sin repetidos y en orden de aparición. */
export function escanear(archivo: string, codigo: string): ControlInventariado[] {
  const limpio = sinComentarios(codigo);
  const hallazgos: { indice: number; texto: string; fuente: FuenteDelTexto }[] = [];
  for (const { fuente, er } of PATRONES) {
    for (const m of limpio.matchAll(er)) {
      const texto = textoVisible(m[1] ?? '');
      if (texto.length < 2 || !/[A-Za-zÁ-ú]/.test(texto)) continue;
      hallazgos.push({ indice: m.index, texto, fuente });
    }
  }
  hallazgos.sort((a, b) => a.indice - b.indice);
  const vistos = new Set<string>();
  const salida: ControlInventariado[] = [];
  for (const h of hallazgos) {
    const llave = `${h.fuente}|${h.texto}`;
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    const cerca = CLAVE_CERCA.exec(limpio.slice(h.indice, h.indice + 420));
    const clave = cerca?.[1] ?? cerca?.[2] ?? cerca?.[3] ?? null;
    salida.push({ archivo, texto: h.texto, fuente: h.fuente, clave });
  }
  return salida;
}

/** Los textos de un archivo, para preguntar «¿sigue diciendo esto?» sin importar su forma. */
export function textosDe(codigo: string): ReadonlySet<string> {
  return new Set(escanear('', codigo).map((c) => c.texto));
}
