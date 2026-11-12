'use client';

import { MenuALaCarta } from '~/portal/menu-digital/MenuALaCarta';
import { MenuDigital } from '~/portal/menu-digital/MenuDigital';
import type { CategoriaDelMenu } from '~/portal/menu-digital/menu-digital';

import { atributosDelTema, type TemaDelPortal } from '../menu-qr/tema-del-portal';
import type { PlatilloDelEditor } from './use-personalizar-menu';

/**
 * DP-18 · 1.3 · LA VISTA PREVIA EN VIVO: el menú digital tal como lo verá el comensal en su teléfono,
 * con lo que se está editando encima de lo guardado (la foto, la descripción, el fondo, el orden de
 * las secciones, el mensaje y el estilo). Son los mismos menús del portal (el digital, o «A la carta»
 * si así está el negocio), sin poder pedir.
 */
export function VistaDelTelefono({
  platillos,
  secciones,
  tema,
  nombreDelNegocio,
  logo,
  mensaje,
  aLaCarta,
}: {
  readonly platillos: readonly PlatilloDelEditor[];
  readonly secciones: readonly CategoriaDelMenu[];
  readonly tema: TemaDelPortal;
  readonly nombreDelNegocio: string;
  readonly logo: string | null;
  readonly mensaje: string;
  /** El negocio enseña «A la carta» (o «A la carta y páginas»): se ve ése, no el digital. */
  readonly aLaCarta: boolean;
}) {
  const visibles = platillos.filter((p) => p.visible_en_menu_digital !== false);
  return (
    <figure className="flex flex-col items-center gap-(--espacio-2)">
      <div
        {...atributosDelTema(tema)}
        role="region"
        aria-label="Vista previa del menú en el teléfono"
        className="w-[360px] max-w-full overflow-hidden rounded-[2.25rem] border-8 border-texto/80 bg-fondo shadow-xl"
      >
        <div className="h-[640px] overflow-y-auto overscroll-contain px-(--espacio-3) pb-(--espacio-6)">
          <header className="flex flex-col items-center gap-(--espacio-1) py-(--espacio-4) text-center">
            {logo === null ? null : (
              <img src={logo} alt="" className="h-14 w-auto object-contain" />
            )}
            <p className="text-lg font-black text-texto">{nombreDelNegocio}</p>
            {mensaje.trim() === '' ? null : (
              <p className="text-sm text-texto-sutil" data-mensaje-de-bienvenida>
                {mensaje}
              </p>
            )}
          </header>
          {aLaCarta ? (
            <MenuALaCarta
              productos={visibles}
              categorias={secciones}
              mostrarPrecios
              mostrarSinImagen
              puedePedir={false}
              alTocar={() => undefined}
            />
          ) : (
            <MenuDigital
              productos={visibles}
              categorias={secciones}
              mostrarPrecios
              puedePedir={false}
              comoEnElTelefono
              alTocar={() => undefined}
            />
          )}
        </div>
      </div>
      <figcaption className="text-xs text-texto-sutil">Así lo ve el comensal (360 px).</figcaption>
    </figure>
  );
}
