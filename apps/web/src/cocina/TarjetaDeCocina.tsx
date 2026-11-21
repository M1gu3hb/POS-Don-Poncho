import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie } from '@morphiqpos/ui/sistema';
import { Check, Flame, PartyPopper, Trash2, TriangleAlert } from 'lucide-react';

import { avisaCuentaCobrada, quienRecoge } from '../restaurante/rotulo-de-la-comanda.ts';

import { EsperaChip } from './EsperaChip';
import { RenglonDePlatillo } from './RenglonDePlatillo';
import { minutosTranscurridos, nivelDeEspera, type NivelDeEspera, type Umbrales } from './espera';
import { encabezadoDelBloque, type InfoDeLaCuenta } from './encabezado-del-bloque';
import {
  esperaDelBloque,
  type BloqueDeMesa,
  type PlatilloEnColumna,
} from './platillos-del-tablero';
import type { ComandaDeCocina, EstadoDeColumna, ItemDeCocina } from './tipos';

/**
 * DP-24 · 4.1 · EL BLOQUE DE UNA MESA DENTRO DE UNA COLUMNA DE COCINA.
 *
 * «Mesa 1 · Ana · 7:30 p. m.» o «PARA LLEVAR · 3 · Don Beto», con las marcas que no se pueden pasar
 * por alto (alergia, celebración, cuenta cobrada) y SOLO los platillos de esta columna: cada uno
 * con su botón («Preparar», «Listo») porque se mueven uno por uno. Un botón más mueve el bloque
 * completo. Si la mesa pidió a dos estaciones, cada una trae su subtítulo.
 */

const BORDE_DE_NIVEL: Readonly<Record<NivelDeEspera | 'neutro', string>> = {
  verde: 'border-exito',
  ambar: 'border-advertencia',
  rojo: 'border-peligro',
  neutro: 'border-borde',
};

export interface TarjetaDeCocinaProps {
  readonly cuenta: BloqueDeMesa;
  readonly estado: EstadoDeColumna;
  /** Milisegundos; 0 mientras el reloj de la pantalla no arranca. */
  readonly ahora: number;
  readonly umbrales: Umbrales;
  readonly compacto: boolean;
  /** Lo que se sabe de la cuenta (mesero y mesa principal), por `venta_id`. */
  readonly infoDeLasCuentas?: Readonly<Record<string, InfoDeLaCuenta>>;
  /** Un platillo, solo. */
  readonly onPlatillo: (platillo: PlatilloEnColumna, hacia: 'en_preparacion' | 'listo') => void;
  /** Todo el bloque a la vez: los platillos que siguen en esta columna. */
  readonly onBloque: (bloque: BloqueDeMesa, hacia: 'en_preparacion' | 'listo') => void;
  readonly onPedirQuitar: (bloque: BloqueDeMesa) => void;
  readonly onVerFicha: (item: ItemDeCocina) => void;
}

function unicos(textos: readonly (string | null | undefined)[]): readonly string[] {
  const vistos = new Set<string>();
  for (const t of textos) {
    const limpio = (t ?? '').trim();
    if (limpio !== '') vistos.add(limpio);
  }
  return [...vistos];
}

/** Los platillos del bloque agrupados por comanda (estación), en el orden en que llegaron. */
function porComanda(bloque: BloqueDeMesa): readonly {
  readonly comanda: ComandaDeCocina;
  readonly platillos: readonly PlatilloEnColumna[];
}[] {
  return bloque.comandas.map((comanda) => ({
    comanda,
    platillos: bloque.platillos.filter((p) => p.comanda.id === comanda.id),
  }));
}

export function TarjetaDeCocina(props: TarjetaDeCocinaProps) {
  const { cuenta, estado, ahora, umbrales, compacto, infoDeLasCuentas } = props;
  const primera = cuenta.comandas[0];
  if (primera === undefined) return null;

  const encabezado = encabezadoDelBloque(cuenta, infoDeLasCuentas?.[cuenta.clave]);
  const enListo = estado === 'listo';
  const minutos = ahora === 0 ? null : minutosTranscurridos(esperaDelBloque(cuenta), ahora);
  const nivel = enListo ? 'neutro' : nivelDeEspera(minutos, umbrales);

  const alergias = unicos(cuenta.comandas.map((c) => c.notas_alergias));
  const celebraciones = cuenta.comandas.filter((c) => c.celebracion_especial === true);
  const notasDeLaMesa = unicos(cuenta.comandas.map((c) => c.notas));
  const cobrada = cuenta.comandas.some(avisaCuentaCobrada);
  const conEstacion = cuenta.comandas.length > 1;
  const titulo = `cuenta-${cuenta.clave}-${estado}`;

  return (
    <Superficie
      como="li"
      nivel={enListo ? 0 : 1}
      radio="md"
      relleno={0}
      aria-labelledby={titulo}
      data-nivel={nivel}
      data-bloque={cuenta.clave}
      className={`flex flex-col border-2 ${BORDE_DE_NIVEL[nivel]} ${compacto ? 'gap-1 p-(--espacio-2)' : 'gap-(--espacio-2) p-(--espacio-3) xl:p-(--espacio-4)'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-(--espacio-2) gap-y-1">
        <h3 id={titulo} className="text-xl font-black leading-tight xl:text-2xl">
          {encabezado.principal}
          {encabezado.detalle !== '' && (
            <span className="block text-sm font-semibold text-texto-sutil xl:text-base">
              {encabezado.detalle}
            </span>
          )}
        </h3>
        <EsperaChip
          minutos={minutos}
          nivel={nivel}
          {...(enListo ? { prefijo: 'Listo hace' } : {})}
        />
      </div>

      {cobrada && (
        <Superficie
          como="p"
          nivel={0}
          radio="md"
          relleno={0}
          className="flex items-center gap-1.5 rounded-md bg-advertencia px-(--espacio-2) py-1 text-sm font-bold text-advertencia-texto"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          Cuenta cobrada
        </Superficie>
      )}
      {alergias.map((texto) => (
        <Superficie
          como="p"
          nivel={0}
          radio="md"
          relleno={0}
          key={texto}
          className="flex items-start gap-1.5 rounded-md border-2 border-peligro bg-peligro/15 px-(--espacio-2) py-1 text-sm font-black xl:text-base"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-peligro" />
          <span>ALERGIAS / INDICACIONES: {texto}</span>
        </Superficie>
      ))}
      {celebraciones.slice(0, 1).map((c) => (
        <Superficie
          como="p"
          nivel={0}
          radio="md"
          relleno={0}
          key="celebracion"
          className="flex items-center gap-1.5 rounded-md bg-acento-suave px-(--espacio-2) py-1 text-sm font-bold text-acento-suave-texto"
        >
          <PartyPopper aria-hidden="true" className="size-4 shrink-0" />
          {c.tipo_celebracion ? `Celebración: ${c.tipo_celebracion}` : 'Celebración especial'}
        </Superficie>
      ))}
      {notasDeLaMesa.map((texto) => (
        <Superficie
          como="p"
          nivel={0}
          radio="md"
          relleno={0}
          key={texto}
          className="rounded-md border-2 border-dashed border-advertencia bg-advertencia/10 px-(--espacio-2) py-1 text-sm font-semibold"
        >
          <span className="font-black">Pedido: </span>
          {texto}
        </Superficie>
      ))}

      {porComanda(cuenta).map(({ comanda, platillos }) => (
        <PlatillosDeLaEstacion
          key={comanda.id}
          comanda={comanda}
          platillos={platillos}
          conEstacion={conEstacion}
          {...props}
        />
      ))}

      <PieDelBloque {...props} />
    </Superficie>
  );
}

function PlatillosDeLaEstacion({
  comanda,
  platillos,
  conEstacion,
  estado,
  compacto,
  onPlatillo,
  onVerFicha,
}: TarjetaDeCocinaProps & {
  readonly comanda: ComandaDeCocina;
  readonly platillos: readonly PlatilloEnColumna[];
  readonly conEstacion: boolean;
}) {
  const color = comanda.estacion_preparacion_color ?? undefined;
  return (
    <div className={`flex flex-col ${compacto ? 'gap-1' : 'gap-(--espacio-2)'}`}>
      {conEstacion && (
        <p className="flex items-center gap-1.5 border-t pt-1 text-sm font-bold uppercase tracking-wide text-texto-sutil">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-texto-sutil"
            style={color === undefined ? undefined : { backgroundColor: color }}
          />
          {comanda.estacion_preparacion_nombre ?? 'Cocina general'}
        </p>
      )}
      <ul className={`flex flex-col ${compacto ? 'gap-1' : 'gap-(--espacio-2)'}`}>
        {platillos.map((platillo, i) => (
          <RenglonDePlatillo
            key={platillo.item.id ?? `${comanda.id}-${String(i)}`}
            item={platillo.item}
            compacto={compacto}
            onVerFicha={onVerFicha}
            accion={botonDelPlatillo(platillo, estado, compacto, onPlatillo)}
          />
        ))}
      </ul>
    </div>
  );
}

function botonDelPlatillo(
  platillo: PlatilloEnColumna,
  estado: EstadoDeColumna,
  compacto: boolean,
  onPlatillo: TarjetaDeCocinaProps['onPlatillo'],
) {
  const nombre = platillo.item.producto_nombre ?? 'platillo';
  if (estado === 'nuevo') {
    return (
      <Button
        size={compacto ? 'default' : 'lg'}
        className="w-full bg-advertencia font-bold text-advertencia-texto hover:bg-advertencia/90"
        title={`Preparar ${nombre}`}
        onClick={() => {
          onPlatillo(platillo, 'en_preparacion');
        }}
      >
        <Flame /> Preparar
      </Button>
    );
  }
  if (estado === 'en_preparacion') {
    return (
      <Button
        size={compacto ? 'default' : 'lg'}
        variant="success"
        className="w-full font-bold"
        title={`Listo ${nombre}`}
        onClick={() => {
          onPlatillo(platillo, 'listo');
        }}
      >
        <Check /> Listo
      </Button>
    );
  }
  return null;
}

/** El botón del bloque completo, o en «Listos» quién lo recoge y la salida de emergencia. */
function PieDelBloque({ cuenta, estado, compacto, onBloque, onPedirQuitar }: TarjetaDeCocinaProps) {
  const varios = cuenta.platillos.length > 1;
  if (estado === 'nuevo' && varios) {
    return (
      <Button
        size={compacto ? 'default' : 'lg'}
        variant="outline"
        className="w-full border-advertencia font-bold"
        onClick={() => {
          onBloque(cuenta, 'en_preparacion');
        }}
      >
        <Flame /> Preparar todo
      </Button>
    );
  }
  if (estado === 'en_preparacion' && varios) {
    return (
      <Button
        size={compacto ? 'default' : 'lg'}
        variant="outline"
        className="w-full border-exito font-bold"
        onClick={() => {
          onBloque(cuenta, 'listo');
        }}
      >
        <Check /> Todo listo
      </Button>
    );
  }
  if (estado !== 'listo') return null;
  const primera = cuenta.comandas[0];
  return (
    // Cuando no caben en una fila (tableta a 768 px), el botón baja: no se encima (QA-D, H-05).
    <div className="flex flex-wrap items-center justify-between gap-(--espacio-2)">
      <p className="min-w-0 flex-1 basis-40 text-sm font-semibold text-texto-sutil">
        {primera === undefined ? '' : quienRecoge(primera)}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        title="Quitar de la lista (no afecta venta ni inventario)"
        onClick={() => {
          onPedirQuitar(cuenta);
        }}
      >
        <Trash2 /> Quitar de la lista
      </Button>
    </div>
  );
}
