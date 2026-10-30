import { Button } from '@morphiqpos/ui/primitivas/button';
import { Delete } from 'lucide-react';
import type { ReactElement } from 'react';

const DIGITOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * EL TECLADO DE PIN, UNO SOLO.
 *
 * Estaba copiado en el acceso por PIN y en el PIN del despertar, y cada copia tenía su
 * variante. Aquí viven las dos sin que la pantalla de arriba sepa cómo se pinta una tecla:
 *
 *   · `amplio` (el acceso, de pie frente al comedor) o `normal` (la capa del despertar);
 *   · «Entrar» sólo si la pantalla da `alEntrar` (el despertar manda el PIN al cuarto dígito);
 *   · `deshabilitado` es de verdad (`disabled`), salvo en modo `suave`: ahí las teclas dicen
 *     `aria-disabled` y ignoran el toque, porque un botón deshabilitado suelta el foco y el
 *     teclado físico dejaría de llegar a la capa del despertar mientras comprueba.
 *
 * El nombre accesible de cada tecla es el dígito EXACTO —las pruebas de navegador las buscan
 * así—, y «Borrar» se llama «Borrar» se vea o no su texto.
 *
 * `data-sonido="tecla"` va en el contenedor: el oyente único de sonidos mira la cadena de padres
 * y suena a teclado en cada tecla. «Entrar» no es una tecla, es un botón: lleva su `toque`.
 * `data-tacto` va en cada tecla: el relieve que se hunde al apretar lo pone el sistema.
 */

export interface TecladoNumericoProps {
  /** Un dígito, «0» a «9». */
  readonly alDigito: (digito: string) => void;
  readonly alBorrar: () => void;
  /** Con esto se pinta «Entrar»; sin esto, el teclado termina en el cero. */
  readonly alEntrar?: (() => void) | undefined;
  /** Nada se puede teclear ahora: está enviando, comprobando o esperando un bloqueo. */
  readonly deshabilitado?: boolean | undefined;
  /** El modo del despertar: `aria-disabled` en vez de `disabled`, para no soltar el foco. */
  readonly suave?: boolean | undefined;
  /** No hay dígitos tecleados: «Borrar» se apaga sola. */
  readonly nadaQueBorrar?: boolean | undefined;
  /** Todavía faltan dígitos: «Entrar» se apaga sola. */
  readonly incompleto?: boolean | undefined;
  /** «Entrar» está mandando el PIN. */
  readonly entrando?: boolean | undefined;
  readonly tamano?: 'amplio' | 'normal' | undefined;
  /** «Borrar» con su texto además del icono (el acceso); sin él, sólo el icono (el despertar). */
  readonly textoEnBorrar?: boolean | undefined;
}

const CLASES_DE_TAMANO = {
  amplio: { rejilla: 'gap-(--espacio-3)', tecla: 'h-20 md:h-24' },
  normal: { rejilla: 'gap-(--espacio-2)', tecla: '' },
} as const;

export function TecladoNumerico({
  alDigito,
  alBorrar,
  alEntrar,
  deshabilitado = false,
  suave = false,
  nadaQueBorrar = false,
  incompleto = false,
  entrando = false,
  tamano = 'amplio',
  textoEnBorrar = false,
}: TecladoNumericoProps): ReactElement {
  const clases = CLASES_DE_TAMANO[tamano];
  const tallaDelBoton = tamano === 'normal' ? 'lg' : 'default';

  /** `disabled`, o `aria-disabled` si el foco no se puede soltar. */
  function bloqueo(propia: boolean) {
    const apagada = deshabilitado || propia;
    return suave ? { 'aria-disabled': apagada } : { disabled: apagada };
  }

  /** Lo que hace el toque: en modo suave, una tecla apagada no hace nada. */
  function alPulsar(propia: boolean, accion: () => void): () => void {
    return () => {
      if (suave && (deshabilitado || propia)) return;
      accion();
    };
  }

  return (
    <div data-sonido="tecla" className={`grid grid-cols-3 ${clases.rejilla}`}>
      {DIGITOS.map((digito) => (
        <Button
          key={digito}
          type="button"
          variant="outline"
          size={tallaDelBoton}
          data-tacto
          {...bloqueo(false)}
          className={`${clases.tecla} font-numeros text-2xl font-semibold`}
          onClick={alPulsar(false, () => {
            alDigito(digito);
          })}
        >
          {digito}
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size={tallaDelBoton}
        data-tacto
        {...bloqueo(nadaQueBorrar)}
        aria-label="Borrar"
        className={`${clases.tecla} text-base`}
        onClick={alPulsar(nadaQueBorrar, alBorrar)}
      >
        <Delete aria-hidden />
        {textoEnBorrar ? 'Borrar' : null}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={tallaDelBoton}
        data-tacto
        {...bloqueo(false)}
        className={`${clases.tecla} font-numeros text-2xl font-semibold`}
        onClick={alPulsar(false, () => {
          alDigito('0');
        })}
      >
        0
      </Button>
      {alEntrar === undefined ? null : (
        <Button
          type="button"
          variant="default"
          size={tallaDelBoton}
          data-tacto
          data-sonido="toque"
          {...bloqueo(incompleto)}
          cargando={entrando}
          className={`${clases.tecla} text-base`}
          onClick={alPulsar(incompleto, alEntrar)}
        >
          Entrar
        </Button>
      )}
    </div>
  );
}
