import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie } from '@morphiqpos/ui/sistema';
import { Check, Flame, PartyPopper, Trash2, TriangleAlert } from 'lucide-react';

import { platillosPorPreparar } from '../restaurante/platillos-de-cocina.ts';
import {
  avisaCuentaCobrada,
  quienRecoge,
  rotuloDeLaComanda,
} from '../restaurante/rotulo-de-la-comanda.ts';

import { EsperaChip } from './EsperaChip';
import { RenglonDePlatillo } from './RenglonDePlatillo';
import { minutosTranscurridos, nivelDeEspera, type NivelDeEspera, type Umbrales } from './espera';
import { inicioDeLaEspera, type CuentaEnCocina } from './grupos';
import type { ComandaDeCocina, EstadoDeColumna, ItemDeCocina } from './tipos';

/**
 * DP-16 · 2.2 · LA TARJETA COMPACTA DE UNA CUENTA EN COCINA.
 *
 * Se lee de un vistazo, sin expandir nada: el rótulo grande («Mesa 4», «PARA LLEVAR · 3 · Don
 * Beto»), cuánto lleva esperando (con color y con palabras), las marcas que no se pueden pasar por
 * alto (alergia, celebración, cuenta cobrada) y TODOS los platillos con sus opciones y notas. Si la
 * cuenta pidió a dos estaciones, cada una trae su sub-bloque y su botón.
 */

const BORDE_DE_NIVEL: Readonly<Record<NivelDeEspera | 'neutro', string>> = {
  verde: 'border-exito',
  ambar: 'border-advertencia',
  rojo: 'border-peligro',
  neutro: 'border-borde',
};

export interface TarjetaDeCocinaProps {
  readonly cuenta: CuentaEnCocina;
  readonly estado: EstadoDeColumna;
  /** Milisegundos; 0 mientras el reloj de la pantalla no arranca. */
  readonly ahora: number;
  readonly umbrales: Umbrales;
  readonly compacto: boolean;
  readonly onIniciar: (comanda: ComandaDeCocina) => void;
  readonly onListo: (comanda: ComandaDeCocina) => void;
  readonly onPedirQuitar: (comanda: ComandaDeCocina) => void;
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

function masViejo(fechas: readonly (string | null | undefined)[]): string | null {
  let mejor: string | null = null;
  for (const f of fechas) {
    if (f === null || f === undefined || !Number.isFinite(Date.parse(f))) continue;
    if (mejor === null || Date.parse(f) < Date.parse(mejor)) mejor = f;
  }
  return mejor;
}

export function TarjetaDeCocina(props: TarjetaDeCocinaProps) {
  const { cuenta, estado, ahora, umbrales, compacto } = props;
  const primera = cuenta.comandas[0];
  if (primera === undefined) return null;

  const rotulo = rotuloDeLaComanda(primera);
  const enListo = estado === 'listo';
  const desde = enListo
    ? masViejo(cuenta.comandas.map((c) => c.fecha_listo ?? inicioDeLaEspera(c)))
    : masViejo(cuenta.comandas.map(inicioDeLaEspera));
  const minutos = ahora === 0 ? null : minutosTranscurridos(desde, ahora);
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
      className={`flex flex-col border-2 ${BORDE_DE_NIVEL[nivel]} ${compacto ? 'gap-1 p-(--espacio-2)' : 'gap-(--espacio-2) p-(--espacio-3) xl:p-(--espacio-4)'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-(--espacio-2) gap-y-1">
        <h3 id={titulo} className="text-xl font-black leading-tight xl:text-2xl">
          {rotulo}
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

      {cuenta.comandas.map((comanda) => (
        <BloqueDeComanda key={comanda.id} comanda={comanda} conEstacion={conEstacion} {...props} />
      ))}
    </Superficie>
  );
}

function BloqueDeComanda({
  comanda,
  estado,
  conEstacion,
  compacto,
  onIniciar,
  onListo,
  onPedirQuitar,
  onVerFicha,
}: TarjetaDeCocinaProps & { readonly comanda: ComandaDeCocina; readonly conEstacion: boolean }) {
  const platillos = platillosPorPreparar(comanda.items ?? []);
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
      {platillos.length > 0 ? (
        <ul className={`flex flex-col ${compacto ? 'gap-1' : 'gap-(--espacio-2)'}`}>
          {platillos.map((item, i) => (
            <RenglonDePlatillo
              key={item.id ?? `${comanda.id}-${String(i)}`}
              item={item}
              compacto={compacto}
              onVerFicha={onVerFicha}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-texto-sutil">Sin productos</p>
      )}
      {estado === 'nuevo' && (
        <Button
          size={compacto ? 'default' : 'lg'}
          className="w-full bg-advertencia font-bold text-advertencia-texto hover:bg-advertencia/90"
          onClick={() => {
            onIniciar(comanda);
          }}
        >
          <Flame /> Preparar
        </Button>
      )}
      {estado === 'en_preparacion' && (
        <Button
          size={compacto ? 'default' : 'lg'}
          variant="success"
          className="w-full font-bold"
          onClick={() => {
            onListo(comanda);
          }}
        >
          <Check /> Listo
        </Button>
      )}
      {estado === 'listo' && (
        // Cuando no caben en una fila (tableta a 768 px), el botón baja: no se encima (QA-D, H-05).
        <div className="flex flex-wrap items-center justify-between gap-(--espacio-2)">
          <p className="min-w-0 flex-1 basis-40 text-sm font-semibold text-texto-sutil">
            {quienRecoge(comanda)}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            title="Quitar de la lista (no afecta venta ni inventario)"
            onClick={() => {
              onPedirQuitar(comanda);
            }}
          >
            <Trash2 /> Quitar de la lista
          </Button>
        </div>
      )}
    </div>
  );
}
