/**
 * EL CONTRATO DEL MODO COMPATIBLE (DP-20.1), sobre el CSS que llega a producción.
 *
 * Lo que tiene que cumplir la hoja que deja `next build`, la escriba quien la escriba:
 *
 *  1. toda mezcla `color-mix` vive en su `@supports` y delante tiene un respaldo CON transparencia
 *     (no el color sólido);
 *  2. toda regla con `translate`, `scale`, `rotate` o `transform` tiene, después, su `transform`
 *     compuesto dentro de `@supports not (translate: 0)`; y toda animación que mueve `transform`,
 *     su gemela ahí dentro;
 *  3. toda declaración con `dvh` / `svh` / `lvh` tiene, después, su respaldo en `vh`.
 *
 * Si una actualización de Tailwind o de Next cambia la forma del CSS, esto falla y lo dice.
 */
import { ES_BLOQUE_DE_MEZCLA, SIN_MEZCLA, tieneMezcla, valorSolido } from './colores.mjs';
import { esReinicio, SIN_SUELTAS } from './transformaciones.mjs';
import { SIN_DINAMICAS, tieneDinamicas } from './unidades.mjs';
import { compacto, dentroDeFotogramas, dentroDeSoporte, partirAlNivelCero } from './valores.mjs';

const SUELTAS = new Set(['translate', 'scale', 'rotate']);
const selectores = (regla) => partirAlNivelCero(regla.selector, ',').map(compacto);
const esSoporte = (nodo, condicion) =>
  nodo.type === 'atrule' && nodo.name === 'supports' && compacto(nodo.params) === condicion;
const corto = (texto) => (texto.length > 90 ? `${texto.slice(0, 90)}…` : texto);

/** Los hermanos de `nodo` hacia delante (o hacia atrás). */
function* hermanos(nodo, adelante) {
  for (
    let n = adelante ? nodo.next() : nodo.prev();
    n !== undefined;
    n = adelante ? n.next() : n.prev()
  )
    yield n;
}

/** ¿Algún `@supports <condicion>` posterior trae una regla para `selector` que cumpla `vale`? */
function tieneGemela(regla, condicion, selector, vale) {
  for (const hermano of hermanos(regla, true)) {
    if (!esSoporte(hermano, condicion)) continue;
    for (const dentro of hermano.nodes ?? []) {
      if (dentro.type === 'rule' && selectores(dentro).includes(selector) && vale(dentro))
        return true;
    }
  }
  return false;
}

const declara = (regla, prop, vale = () => true) =>
  regla.nodes.some((d) => d.type === 'decl' && d.prop === prop && vale(d));

function revisarMezclas(root, problemas) {
  let cuenta = 0;
  root.walkDecls((d) => {
    if (!tieneMezcla(d.value)) return;
    cuenta += 1;
    const regla = d.parent;
    const bloque = regla.parent;
    const enSuBloque =
      regla.type === 'rule' &&
      bloque.type === 'atrule' &&
      bloque.name === 'supports' &&
      ES_BLOQUE_DE_MEZCLA.test(compacto(bloque.params));
    if (!enSuBloque) {
      problemas.push(
        `color-mix fuera de su @supports: ${corto(`${regla.selector ?? ''} { ${d.prop} }`)}`,
      );
      return;
    }
    const solido = compacto(valorSolido(d.value) ?? '');
    for (const selector of selectores(regla)) {
      let respaldo;
      for (const hermano of hermanos(bloque, false)) {
        if (hermano.type !== 'rule' || !selectores(hermano).includes(selector)) continue;
        respaldo = hermano.nodes.findLast((x) => x.type === 'decl' && x.prop === d.prop);
        if (respaldo !== undefined) break;
      }
      const donde = corto(`${selector} { ${d.prop} }`);
      if (respaldo === undefined) problemas.push(`mezcla sin respaldo: ${donde}`);
      else if (tieneMezcla(respaldo.value)) problemas.push(`el respaldo también mezcla: ${donde}`);
      else if (compacto(respaldo.value) === solido) {
        // La única salida para un respaldo sólido: la opacidad del texto de ayuda.
        const conOpacidad = tieneGemela(bloque, SIN_MEZCLA, selector, (r) => declara(r, 'opacity'));
        if (!conOpacidad) problemas.push(`respaldo SÓLIDO, sin transparencia: ${donde}`);
      }
    }
  });
  return cuenta;
}

function revisarSueltas(root, problemas) {
  let reglas = 0;
  root.walkRules((regla) => {
    if (dentroDeFotogramas(regla) || dentroDeSoporte(regla, SIN_SUELTAS) || esReinicio(regla))
      return;
    const toca = regla.nodes.some(
      (d) => d.type === 'decl' && (SUELTAS.has(d.prop) || d.prop === 'transform'),
    );
    if (!toca) return;
    reglas += 1;
    for (const selector of selectores(regla)) {
      const cubierta = tieneGemela(regla, SIN_SUELTAS, selector, (r) => declara(r, 'transform'));
      if (!cubierta) problemas.push(`sin transform de respaldo: ${corto(selector)}`);
    }
  });

  let animaciones = 0;
  root.walkAtRules(/keyframes$/i, (animacion) => {
    if (dentroDeSoporte(animacion, SIN_SUELTAS)) return;
    let mueve = false;
    animacion.walkDecls((d) => {
      if (d.prop === 'transform') mueve = true;
      if (SUELTAS.has(d.prop))
        problemas.push(
          `@keyframes ${animacion.params} anima «${d.prop}» suelta: no tiene respaldo`,
        );
    });
    if (!mueve) return;
    animaciones += 1;
    let gemela = false;
    for (const hermano of hermanos(animacion, true)) {
      if (!esSoporte(hermano, SIN_SUELTAS)) continue;
      hermano.walkAtRules(/keyframes$/i, (otra) => {
        if (otra.params === animacion.params) gemela = true;
      });
    }
    if (!gemela) problemas.push(`@keyframes ${animacion.params} sin su gemela de respaldo`);
  });
  return { reglas, animaciones };
}

function revisarDinamicas(root, problemas) {
  let cuenta = 0;
  root.walkDecls((d) => {
    if (!tieneDinamicas(d.value)) return;
    const regla = d.parent;
    if (regla.type !== 'rule' || dentroDeSoporte(regla, SIN_DINAMICAS)) return;
    cuenta += 1;
    for (const selector of selectores(regla)) {
      const cubierta = tieneGemela(regla, SIN_DINAMICAS, selector, (r) =>
        declara(r, d.prop, (x) => !tieneDinamicas(x.value)),
      );
      if (!cubierta) problemas.push(`${d.prop}: ${d.value} sin respaldo en vh: ${corto(selector)}`);
    }
  });
  return cuenta;
}

export const SELECTOR_DEL_AVISO = '#aparato-demasiado-viejo';

/**
 * Las dos reglas del aviso de «aparato demasiado viejo» (`app/globals.css`): la que lo enseña, sin
 * capa, y la que lo oculta, dentro de una. Si el build pierde una, o se lo enseña a todos o a nadie.
 */
function revisarAviso(root) {
  const aviso = { ensena: false, oculta: false };
  root.walkRules((regla) => {
    if (!selectores(regla).includes(SELECTOR_DEL_AVISO)) return;
    const d = regla.nodes.findLast((x) => x.type === 'decl' && x.prop === 'display');
    if (d === undefined || d.important !== true) return;
    let enCapa = false;
    for (let p = regla.parent; p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule' && p.name === 'layer') enCapa = true;
    }
    if (!enCapa && d.value === 'block') aviso.ensena = true;
    if (enCapa && d.value === 'none') aviso.oculta = true;
  });
  return aviso;
}

/**
 * Revisa una hoja ya analizada por PostCSS.
 * @returns {{
 *   problemas: string[],
 *   cuentas: { mezclas: number, sueltas: number, animaciones: number, dinamicas: number },
 *   aviso: { ensena: boolean, oculta: boolean },
 * }}
 */
export function revisar(root) {
  const problemas = [];
  const mezclas = revisarMezclas(root, problemas);
  const { reglas, animaciones } = revisarSueltas(root, problemas);
  const dinamicas = revisarDinamicas(root, problemas);
  return {
    problemas,
    cuentas: { mezclas, sueltas: reglas, animaciones, dinamicas },
    aviso: revisarAviso(root),
  };
}
