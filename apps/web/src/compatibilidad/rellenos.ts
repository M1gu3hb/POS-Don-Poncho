/**
 * LOS RELLENOS DE JAVASCRIPT DEL MODO COMPATIBLE (DP-20.1).
 *
 * El POS usa un par de funciones que un motor viejo no trae —`toSorted` llegó en Chromium 110 y
 * `URL.canParse` en el 120— y ahí no «se ve feo»: la pantalla que las llama se cae (el mapa de
 * mesas ordena con `toSorted` las solicitudes que llegan por QR).
 *
 * Va como un guion en línea en el `<head>`, ANTES de todo el código del POS: es la única forma de
 * garantizar que ya esté puesto cuando haga falta, sin depender de en qué orden lleguen los demás
 * archivos. Son unos cientos de bytes y **sólo se instala lo que falta**: en un motor que ya trae
 * la función, no toca nada.
 *
 * Sólo lo que el POS usa de verdad. `verify:modo-compatible` revisa el JavaScript del build: si
 * aparece una función más nueva que Chromium 99 que no esté aquí, la CI lo dice.
 *
 * Es una cadena, no funciones de TypeScript: lo que se manda al navegador es exactamente este texto
 * (sin pasar por el compilador), escrito con sintaxis que entiende cualquier motor.
 */

/** Los nombres que cubre el guion. La prueba exige que cada uno funcione; el contrato los lee. */
export const RELLENOS_INSTALADOS = [
  'toSorted',
  'toReversed',
  'toSpliced',
  'with',
  'canParse',
] as const;

export const GUION_DE_RELLENOS = `(function(){
var P=Array.prototype;
function poner(o,n,f){if(typeof o[n]!=='function'){Object.defineProperty(o,n,{value:f,writable:true,configurable:true})}}
function copia(a){return P.slice.call(a)}
poner(P,'toSorted',function(c){if(c!==undefined&&typeof c!=='function'){throw new TypeError('La comparacion no es una funcion')}return copia(this).sort(c)});
poner(P,'toReversed',function(){return copia(this).reverse()});
poner(P,'toSpliced',function(){var c=copia(this);P.splice.apply(c,arguments);return c});
poner(P,'with',function(i,v){var c=copia(this),n=c.length,k=Math.trunc(Number(i))||0;if(k<0){k+=n}if(k<0||k>=n){throw new RangeError('Indice fuera del arreglo')}c[k]=v;return c});
if(typeof URL==='function'){poner(URL,'canParse',function(u,b){try{new URL(u,b);return true}catch(e){return false}})}
})();`;
