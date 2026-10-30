'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { ErrorDePantalla, EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { UtensilsCrossed } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * LO QUE EL SALÓN DICE CUANDO NO HAY MESAS QUE PINTAR: que está leyendo, que no pudo leer, o que
 * la zona está vacía. Los tres estados del sistema, una sola vez, para el plano y la rejilla.
 *
 * «No pudo leer» antes no existía: si la lectura de las mesas fallaba, el mapa decía «No hay mesas
 * en Interior», que es otra cosa y manda a la persona a Configuración a buscar lo que no se perdió.
 */

export function EsqueletoDelSalon(): ReactElement {
  return <EsqueletoDeLista filas={4} className="p-(--espacio-4)" />;
}

export function ErrorDelSalon({
  alReintentar,
}: {
  readonly alReintentar: () => void;
}): ReactElement {
  return (
    <ErrorDePantalla
      titulo="No se pudo leer el mapa de mesas."
      queHacer="Revisa la conexión y vuelve a intentarlo. Las mesas no se perdieron."
      reintentar={
        <Button type="button" size="sm" variant="outline" onClick={alReintentar}>
          Volver a intentar
        </Button>
      }
      className="m-(--espacio-4)"
    />
  );
}

export function VacioDelSalon({
  zona,
  conAyuda,
}: {
  /** El nombre de la zona, o `null` en la rejilla, que no la nombra. */
  readonly zona: string | null;
  /** Dónde se configuran las mesas. Sólo el plano lo dice. */
  readonly conAyuda: boolean;
}): ReactElement {
  return (
    <Vacio
      tamano="compacto"
      icono={<UtensilsCrossed />}
      titulo={zona === null ? 'No hay mesas en esta zona' : `No hay mesas en ${zona}.`}
      explicacion={conAyuda ? 'Configúralas en Configuración → Mapa de mesas.' : undefined}
    />
  );
}
