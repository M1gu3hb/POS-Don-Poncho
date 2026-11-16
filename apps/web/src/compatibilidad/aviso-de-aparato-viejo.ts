/**
 * El guion que enseña el aviso de «aparato demasiado viejo» (DP-20.1). El porqué está en
 * `AvisoDeAparatoViejo.tsx`; aquí va lo que llega al navegador, para poder probarlo tal cual.
 */

export const ID_DEL_AVISO_DE_APARATO_VIEJO = 'aparato-demasiado-viejo';

/**
 * Le pregunta al motor si conoce las capas de CSS; si no, enseña el aviso. Texto fijo, sin nada que
 * venga de fuera, con sintaxis que entiende cualquier motor (va en línea, sin compilar).
 */
export const GUION_DEL_AVISO_DE_APARATO_VIEJO = `(function(){if(typeof CSSLayerBlockRule==='undefined'){var a=document.getElementById('${ID_DEL_AVISO_DE_APARATO_VIEJO}');if(a){a.style.display='block'}}})();`;
