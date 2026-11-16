/**
 * MODO COMPATIBLE (DP-21 · Bloque 15) · los colores de espacios nuevos: `lab()`, `lch()`, `oklab()`,
 * `oklch()`.
 *
 * Existen desde Chromium 111. Tailwind 4 escribe su paleta de fábrica en ellos
 * (`--color-gray-100: lab(…)`). Para un motor sin ellos —el WebView del iMin, 99–103— el valor de la
 * variable es válido (una variable acepta cualquier cosa) pero INVÁLIDO al usarse: la propiedad que
 * la usa (`background-color: var(--color-gray-100)`) queda sin color, y un respaldo «declarado
 * antes» no sirve porque la declaración inválida en uso no cae a la anterior.
 *
 * El respaldo es el mismo valor en `rgb()`, en un bloque `@supports not (color: lab(0% 0 0))` justo
 * después de la regla. Un motor moderno no entra al bloque: no cambia un pixel. La conversión es
 * la de CSS Color 4 (lab/lch en D50 adaptados a D65 con Bradford; oklab/oklch por sus matrices).
 */
import {
  dentroDeFotogramas,
  dentroDeSoporte,
  llamadas,
  sustituirLlamadas,
  yaTieneGemela,
} from './valores.mjs';

export const SIN_COLORES_NUEVOS = 'not(color:lab(0%00))';
const CONDICION = 'not (color:lab(0% 0 0))';
const NOMBRES = ['oklch', 'oklab', 'lch', 'lab'];

const aGrados = (texto) => {
  const m = /^(-?\d*\.?\d+)(deg|grad|rad|turn)?$/.exec(texto);
  if (m === null) return null;
  const n = Number(m[1]);
  return { deg: n, grad: n * 0.9, rad: (n * 180) / Math.PI, turn: n * 360 }[m[2] ?? 'deg'];
};

/** Un componente: número, porcentaje (con su tope) o `none`. */
function componente(texto, tope) {
  if (texto === 'none') return 0;
  const m = /^(-?\d*\.?\d+)(%)?$/.exec(texto);
  if (m === null) return null;
  return m[2] === undefined ? Number(m[1]) : (Number(m[1]) * tope) / 100;
}

const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.abs(c) ** (1 / 2.4) - 0.055);
const canal = (c) => Math.min(255, Math.max(0, Math.round(gamma(c) * 255)));

function desdeLab(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const e = 216 / 24389;
  const k = 24389 / 27;
  const xr = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
  const yr = L > 8 ? fy ** 3 : L / k;
  const zr = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
  // Blanco D50 → XYZ D50 → D65 (Bradford) → sRGB lineal.
  const X = xr * 0.9642956764295677;
  const Y = yr;
  const Z = zr * 0.8251046025104602;
  const x = 0.9554734527042182 * X - 0.023098536874261423 * Y + 0.0632593086610217 * Z;
  const y = -0.028369706963208136 * X + 1.0099954580058226 * Y + 0.021041398966943008 * Z;
  const z = 0.012314001688319899 * X - 0.020507696433477912 * Y + 1.3303659366080753 * Z;
  return [
    3.2409699419045226 * x - 1.537383177570094 * y - 0.4986107602930034 * z,
    -0.9692436362808796 * x + 1.8759675015077202 * y + 0.04155505740717559 * z,
    0.05563007969699366 * x - 0.20397695888897652 * y + 1.0569715142428786 * z,
  ];
}

function desdeOklab(L, a, b) {
  const l = (L + 0.3963377773761749 * a + 0.2158037573099136 * b) ** 3;
  const m = (L - 0.1055613458156586 * a - 0.0638541728258133 * b) ** 3;
  const s = (L - 0.0894841775298119 * a - 1.2914855480194092 * b) ** 3;
  return [
    4.0767416360759583 * l - 3.3077115392580629 * m + 0.2309699031821043 * s,
    -1.2684379732850315 * l + 2.6097573492876887 * m - 0.3413193760026573 * s,
    -0.0041960761386756 * l - 0.7034186179359362 * m + 1.7076146940746117 * s,
  ];
}

/**
 * Un color de espacio nuevo, en sRGB.
 * @returns {{ rgb: [number, number, number], alfa: number } | null} `alfa` de 0 a 100; `null` si no
 *   es uno de estos colores o no se puede calcular (una `var()` dentro, por ejemplo).
 */
export function aRgb(texto) {
  const m = /^\s*(lab|lch|oklab|oklch)\(\s*(.*?)\s*\)\s*$/i.exec(texto);
  if (m === null) return null;
  const nombre = m[1].toLowerCase();
  const [color, alfaTexto] = m[2].split('/').map((p) => p.trim());
  const partes = color.split(/\s+/);
  if (partes.length !== 3) return null;
  const ok = nombre.startsWith('ok');
  const polar = nombre.endsWith('ch');
  const L = componente(partes[0], ok ? 1 : 100);
  const segundo = componente(partes[1], polar ? (ok ? 0.4 : 150) : ok ? 0.4 : 125);
  const tercero = polar
    ? partes[2] === 'none'
      ? 0
      : aGrados(partes[2])
    : componente(partes[2], ok ? 0.4 : 125);
  if (L === null || segundo === null || tercero === null) return null;
  const [a, b] = polar
    ? [segundo * Math.cos((tercero * Math.PI) / 180), segundo * Math.sin((tercero * Math.PI) / 180)]
    : [segundo, tercero];
  const lineal = ok ? desdeOklab(L, a, b) : desdeLab(L, a, b);
  let alfa = 100;
  if (alfaTexto !== undefined) {
    const n = componente(alfaTexto, 1);
    if (n === null) return null;
    alfa = Math.min(100, Math.max(0, Math.round(n * 1000) / 10));
  }
  return { rgb: lineal.map(canal), alfa };
}

const escribir = ({ rgb, alfa }) =>
  `rgb(${rgb.join(' ')}${alfa < 100 ? ` / ${String(alfa)}%` : ''})`;

/** El valor con cada color de espacio nuevo convertido; `null` si alguno no se puede calcular. */
export function valorSinColoresNuevos(valor) {
  let salida = valor;
  for (const nombre of NOMBRES) {
    salida = sustituirLlamadas(salida, nombre, (dentro) => {
      const color = aRgb(`${nombre}(${dentro})`);
      return color === null ? null : escribir(color);
    });
    if (salida === null) return null;
  }
  return salida;
}

export const tieneColoresNuevos = (valor) =>
  NOMBRES.some((nombre) => llamadas(valor, nombre).length > 0);

/**
 * Deja cada color de espacio nuevo con su respaldo en `rgb()`.
 * @returns {{ reglas: number, sinRespaldo: { selector: string, prop: string, valor: string }[] }}
 */
export function respaldarColoresNuevos(root, ayudas) {
  const pendientes = [];
  const informe = { reglas: 0, sinRespaldo: [] };
  root.walkRules((regla) => {
    if (
      dentroDeFotogramas(regla) ||
      dentroDeSoporte(regla, CONDICION.replace(/\s+/g, '').toLowerCase())
    )
      return;
    if (yaTieneGemela(regla, SIN_COLORES_NUEVOS)) return;
    const propias = regla.nodes.filter((d) => d.type === 'decl' && tieneColoresNuevos(d.value));
    if (propias.length === 0) return;
    const nodos = [];
    for (const d of propias) {
      const nuevo = valorSinColoresNuevos(d.value);
      if (nuevo === null)
        informe.sinRespaldo.push({ selector: regla.selector, prop: d.prop, valor: d.value });
      else nodos.push(d.clone({ value: nuevo }));
    }
    if (nodos.length > 0) pendientes.push([regla, nodos]);
  });
  for (const [regla, nodos] of pendientes) {
    regla.after(
      ayudas.atRule({
        name: 'supports',
        params: CONDICION,
        nodes: [regla.clone({ nodes: nodos })],
      }),
    );
    informe.reglas += 1;
  }
  return informe;
}
