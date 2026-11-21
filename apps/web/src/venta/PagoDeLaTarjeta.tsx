'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { cn } from '@morphiqpos/ui/utilidades';
import { Banknote, Check, CreditCard, Layers, Plus, Smartphone, X } from 'lucide-react';
import { useId, type ComponentType, type ReactElement, type ReactNode } from 'react';

import {
  MAXIMO_DE_TARJETAS,
  agregarTarjeta,
  dividirEnTarjetas,
  elegirModo,
  escribir,
  quitarTarjeta,
  restoParaLaTarjeta,
  teclear,
  textoDe,
  textoDeCentavos,
  unaSolaTarjeta,
  type CampoDelCobro,
  type CobroEnPantalla,
} from './cobro-en-pantalla.ts';
import {
  enPesos,
  type CuentaDelCobro,
  type ModoDePago,
  type PagoAEnviar,
  type PropinaDelCobro,
} from './cuenta-del-cobro.ts';
import { aCentavos } from './importe-tecleado.ts';
import { esLaPropinaPuesta } from './propina-del-cobro.ts';
import { TecladoDeImportes } from './TecladoDeImportes';

/**
 * EL PAGO, EN LA TARJETA DE COBRO (DP-24): la propina, las formas de pago, lo recibido y el cambio.
 *
 * Todo en una vista y con el dedo: la propina se elige con botones (los porcentajes de la
 * Configuración, «Otro monto» y «Sin propina») y se puede cambiar hasta antes de cobrar; el efectivo
 * tiene sus atajos; la tarjeta se puede dividir en varias; y lo que no cuadra se dice en palabras,
 * junto al botón apagado. La cuenta la hace `cuenta-del-cobro.ts`; aquí sólo se pinta y se teclea.
 */

/** `elige`: la Caja la elige. `solo-lectura`: en este negocio no la elige. `apagadas`: no hay propinas. */
export type PropinasEnLaCaja = 'elige' | 'solo-lectura' | 'apagadas';

const CHIP =
  'flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-(--espacio-2) text-sm font-semibold touch-manipulation transition-colors disabled:pointer-events-none disabled:opacity-50';
const APAGADO = 'border-borde bg-superficie text-texto hover:bg-acento-suave';
const ENCENDIDO = 'border-primario bg-primario text-primario-texto';

const FORMAS: readonly {
  readonly modo: ModoDePago;
  readonly rotulo: string;
  readonly Icono: ComponentType<{ className?: string }>;
}[] = [
  { modo: 'efectivo', rotulo: 'Efectivo', Icono: Banknote },
  { modo: 'tarjeta', rotulo: 'Tarjeta', Icono: CreditCard },
  { modo: 'transferencia', rotulo: 'Transferencia', Icono: Smartphone },
  { modo: 'mixto', rotulo: 'Mixto', Icono: Layers },
];

/** Los billetes de siempre: lo que se toca ES lo recibido (no se suman). */
const BILLETES: readonly number[] = [10_000, 20_000, 50_000, 100_000];

const NOMBRE_DEL_CAMPO: Readonly<Record<string, string>> = {
  recibido: 'Recibido',
  transferencia: 'Transferencia',
  'otro-monto': 'Otro monto de propina',
};

function nombreDelCampo(campo: CampoDelCobro): string {
  return NOMBRE_DEL_CAMPO[campo] ?? `Tarjeta ${String(Number(campo.slice('tarjeta-'.length)) + 1)}`;
}

function Chip({
  encendido,
  children,
  ...props
}: {
  readonly encendido: boolean;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly className?: string;
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={encendido}
      {...props}
      className={cn(CHIP, encendido ? ENCENDIDO : APAGADO, props.className)}
    >
      {children}
    </button>
  );
}

function Campo({
  campo,
  rotulo,
  estado,
  alCambiar,
  deshabilitado,
  children,
}: {
  readonly campo: CampoDelCobro;
  readonly rotulo: string;
  readonly estado: CobroEnPantalla;
  readonly alCambiar: (estado: CobroEnPantalla) => void;
  readonly deshabilitado: boolean;
  /** Los botones de su renglón («Resto», «Quitar»…). */
  readonly children?: ReactNode;
}): ReactElement {
  const id = useId();
  const activo = estado.campoActivo === campo;
  return (
    <div className="flex items-end gap-(--espacio-1)">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="text-xs text-texto-sutil">
          {rotulo}
        </Label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-(--espacio-2) -translate-y-1/2 text-texto-sutil"
          >
            $
          </span>
          <Input
            id={id}
            type="text"
            // El teclado del sistema taparía la tarjeta: aquí se teclea con el de la tarjeta.
            inputMode="none"
            autoComplete="off"
            placeholder="0.00"
            disabled={deshabilitado}
            value={textoDe(estado, campo)}
            data-campo={campo}
            onChange={(evento) => {
              alCambiar(escribir({ ...estado, campoActivo: campo }, campo, evento.target.value));
            }}
            onFocus={() => {
              if (!activo) alCambiar({ ...estado, campoActivo: campo });
            }}
            className={cn(
              'h-11 pl-(--espacio-5) text-right font-numeros text-lg tabular-nums md:text-lg',
              activo && 'border-primario ring-2 ring-anillo/50',
            )}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

function Propina({
  propina,
  porcentajes,
  propinas,
  guardando,
  estado,
  alCambiar,
  alElegir,
}: {
  readonly propina: PropinaDelCobro;
  readonly porcentajes: readonly number[];
  readonly propinas: PropinasEnLaCaja;
  readonly guardando: boolean;
  readonly estado: CobroEnPantalla;
  readonly alCambiar: (estado: CobroEnPantalla) => void;
  readonly alElegir: (propina: PropinaDelCobro) => void;
}): ReactElement {
  const sinTocar = propinas !== 'elige' || guardando;
  const elegir = (opcion: PropinaDelCobro): void => {
    // Elegir otra propina deshace «dejar el cambio»: el cambio era con la de antes.
    alCambiar({ ...estado, cambioComoPropina: false, otroMontoAbierto: false });
    alElegir(opcion);
  };
  return (
    <fieldset className="min-w-0" aria-busy={guardando}>
      <legend className="mb-1 text-xs font-semibold text-texto-sutil">
        Propina
        {propinas === 'solo-lectura' && ' · en este negocio la Caja no la elige'}
        {propina.tipo === 'sin_elegir' && propinas === 'elige' && ' · sin elegir'}
      </legend>
      <div className="grid grid-cols-3 gap-(--espacio-1) sm:grid-cols-6">
        <Chip
          encendido={esLaPropinaPuesta(propina, { tipo: 'sin_propina' })}
          disabled={sinTocar}
          onClick={() => {
            elegir({ tipo: 'sin_propina' });
          }}
        >
          Sin propina
        </Chip>
        {porcentajes.map((porcentaje) => {
          const opcion = { tipo: 'porcentaje', puntosBase: Math.round(porcentaje * 100) } as const;
          return (
            <Chip
              key={porcentaje}
              encendido={esLaPropinaPuesta(propina, opcion)}
              disabled={sinTocar}
              onClick={() => {
                elegir(opcion);
              }}
            >
              {`${String(porcentaje)}%`}
            </Chip>
          );
        })}
        <Chip
          encendido={propina.tipo === 'monto' || estado.otroMontoAbierto}
          disabled={sinTocar}
          onClick={() => {
            alCambiar({
              ...estado,
              otroMontoAbierto: true,
              otroMonto: propina.tipo === 'monto' ? textoDeCentavos(propina.centavos) : '',
              campoActivo: 'otro-monto',
            });
          }}
        >
          Otro monto
        </Chip>
      </div>
    </fieldset>
  );
}

function OtroMonto({
  estado,
  alCambiar,
  alElegir,
  guardando,
}: {
  readonly estado: CobroEnPantalla;
  readonly alCambiar: (estado: CobroEnPantalla) => void;
  readonly alElegir: (propina: PropinaDelCobro) => void;
  readonly guardando: boolean;
}): ReactElement {
  const centavos = aCentavos(estado.otroMonto);
  const cerrar = (): CobroEnPantalla => ({
    ...estado,
    otroMontoAbierto: false,
    cambioComoPropina: false,
    campoActivo: estado.modo === 'efectivo' ? 'recibido' : null,
  });
  return (
    <div className="rounded-md border border-primario/40 bg-acento-suave/40 p-(--espacio-2)">
      <Campo
        campo="otro-monto"
        rotulo="Otro monto de propina"
        estado={estado}
        alCambiar={alCambiar}
        deshabilitado={guardando}
      >
        <Button
          type="button"
          className="h-11"
          disabled={guardando || centavos === null}
          onClick={() => {
            alCambiar(cerrar());
            alElegir(
              centavos === null || centavos === 0
                ? { tipo: 'sin_propina' }
                : { tipo: 'monto', centavos },
            );
          }}
        >
          Poner
        </Button>
      </Campo>
      {centavos === null && (
        <p className="mt-1 text-xs text-peligro">Ese importe no se entiende.</p>
      )}
    </div>
  );
}

function Tarjetas({
  estado,
  cuenta,
  alCambiar,
  deshabilitado,
}: {
  readonly estado: CobroEnPantalla;
  readonly cuenta: CuentaDelCobro;
  readonly alCambiar: (estado: CobroEnPantalla) => void;
  readonly deshabilitado: boolean;
}): ReactElement {
  return (
    <>
      {estado.tarjetas.map((_, indice) => {
        const campo: CampoDelCobro = `tarjeta-${String(indice)}`;
        const numero = String(indice + 1);
        return (
          <Campo
            // El orden es la identidad: «Tarjeta 2» es la segunda.
            key={campo}
            campo={campo}
            rotulo={`Tarjeta ${numero}`}
            estado={estado}
            alCambiar={alCambiar}
            deshabilitado={deshabilitado}
          >
            <Button
              type="button"
              variant="outline"
              className="h-11 px-(--espacio-2)"
              disabled={deshabilitado}
              aria-label={`Poner el resto en la tarjeta ${numero}`}
              onClick={() => {
                const resto = restoParaLaTarjeta(estado, indice, cuenta.aCobrarCentavos);
                alCambiar(
                  escribir({ ...estado, campoActivo: campo }, campo, textoDeCentavos(resto)),
                );
              }}
            >
              Resto
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              disabled={deshabilitado}
              aria-label={`Quitar la tarjeta ${numero}`}
              onClick={() => {
                alCambiar(quitarTarjeta(estado, indice));
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </Campo>
        );
      })}
      {estado.tarjetas.length < MAXIMO_DE_TARJETAS && (
        <Button
          type="button"
          variant="outline"
          className="h-11 justify-start"
          disabled={deshabilitado}
          onClick={() => {
            alCambiar(agregarTarjeta(estado));
          }}
        >
          <Plus aria-hidden="true" /> Agregar tarjeta
        </Button>
      )}
    </>
  );
}

function CamposDelModo({
  estado,
  cuenta,
  alCambiar,
  deshabilitado,
}: {
  readonly estado: CobroEnPantalla;
  readonly cuenta: CuentaDelCobro;
  readonly alCambiar: (estado: CobroEnPantalla) => void;
  readonly deshabilitado: boolean;
}): ReactElement {
  const recibido = (
    <>
      <Campo
        campo="recibido"
        rotulo={estado.modo === 'mixto' ? 'Recibido en efectivo' : 'Recibido'}
        estado={estado}
        alCambiar={alCambiar}
        deshabilitado={deshabilitado}
      />
      <div
        className="grid grid-cols-3 gap-(--espacio-1)"
        role="group"
        aria-label="Atajos de lo recibido"
      >
        <Chip
          encendido={false}
          disabled={deshabilitado}
          onClick={() => {
            alCambiar(
              escribir(
                { ...estado, campoActivo: 'recibido' },
                'recibido',
                textoDeCentavos(cuenta.efectivoCentavos),
              ),
            );
          }}
        >
          Exacto
        </Chip>
        {BILLETES.map((billete) => (
          <Chip
            key={billete}
            encendido={false}
            disabled={deshabilitado}
            onClick={() => {
              alCambiar(
                escribir(
                  { ...estado, campoActivo: 'recibido' },
                  'recibido',
                  textoDeCentavos(billete),
                ),
              );
            }}
          >
            {enPesos(billete).replace('.00', '')}
          </Chip>
        ))}
      </div>
    </>
  );

  if (estado.modo === 'efectivo') return recibido;
  if (estado.modo === 'transferencia') {
    return (
      <p className="rounded-md border border-borde bg-fondo-sutil p-(--espacio-3) text-sm">
        Todo por transferencia: <strong>{enPesos(cuenta.aCobrarCentavos)}</strong>
      </p>
    );
  }
  if (estado.modo === 'tarjeta' && !estado.dividida) {
    return (
      <>
        <p className="rounded-md border border-borde bg-fondo-sutil p-(--espacio-3) text-sm">
          Una tarjeta con todo: <strong>{enPesos(cuenta.aCobrarCentavos)}</strong>
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={deshabilitado}
          onClick={() => {
            alCambiar(dividirEnTarjetas(estado));
          }}
        >
          <CreditCard aria-hidden="true" /> Dividir en tarjetas
        </Button>
      </>
    );
  }
  if (estado.modo === 'tarjeta') {
    return (
      <>
        <Tarjetas
          estado={estado}
          cuenta={cuenta}
          alCambiar={alCambiar}
          deshabilitado={deshabilitado}
        />
        <Button
          type="button"
          variant="ghost"
          className="h-11 justify-start"
          disabled={deshabilitado}
          onClick={() => {
            alCambiar(unaSolaTarjeta(estado));
          }}
        >
          Una sola tarjeta
        </Button>
      </>
    );
  }
  return (
    <>
      <Tarjetas
        estado={estado}
        cuenta={cuenta}
        alCambiar={alCambiar}
        deshabilitado={deshabilitado}
      />
      <Campo
        campo="transferencia"
        rotulo="Transferencia"
        estado={estado}
        alCambiar={alCambiar}
        deshabilitado={deshabilitado}
      />
      <p className="text-sm font-semibold" data-resto-en-efectivo>
        El resto, en efectivo: {enPesos(cuenta.efectivoCentavos)}
      </p>
      {cuenta.efectivoCentavos > 0 && recibido}
    </>
  );
}

const PROPINA_CON: readonly { readonly metodo: PagoAEnviar['metodo']; readonly rotulo: string }[] =
  [
    { metodo: 'efectivo', rotulo: 'Propina en efectivo' },
    { metodo: 'tarjeta', rotulo: 'Propina con tarjeta' },
    { metodo: 'transferencia', rotulo: 'Propina por transferencia' },
  ];

function Resultado({
  estado,
  cuenta,
  propinas,
  alCambiar,
  deshabilitado,
}: {
  readonly estado: CobroEnPantalla;
  readonly cuenta: CuentaDelCobro;
  readonly propinas: PropinasEnLaCaja;
  readonly alCambiar: (estado: CobroEnPantalla) => void;
  readonly deshabilitado: boolean;
}): ReactElement {
  const importes: Readonly<Record<PagoAEnviar['metodo'], number>> = {
    efectivo: cuenta.efectivoCentavos,
    tarjeta: cuenta.tarjetaCentavos,
    transferencia: cuenta.transferenciaCentavos,
  };
  const conImporte = PROPINA_CON.filter((opcion) => importes[opcion.metodo] > 0);
  const dondeVa =
    cuenta.pagos.find((pago) => (pago.propinaCentavos ?? 0) > 0)?.metodo ?? estado.propinaCon;
  const hayRecibido = estado.recibido.trim() !== '' && cuenta.efectivoCentavos > 0;
  return (
    <div className="flex flex-col gap-(--espacio-1)" aria-live="polite">
      {cuenta.tropiezo === null && hayRecibido && (
        <p className="flex items-baseline justify-between text-lg font-bold text-exito" data-cambio>
          <span>Cambio</span>
          <span className="font-numeros tabular-nums">{enPesos(cuenta.cambioCentavos)}</span>
        </p>
      )}
      {cuenta.tropiezo === null && cuenta.cambioOfrecidoCentavos > 0 && propinas === 'elige' && (
        <button
          type="button"
          aria-pressed={estado.cambioComoPropina}
          disabled={deshabilitado}
          onClick={() => {
            alCambiar({ ...estado, cambioComoPropina: !estado.cambioComoPropina });
          }}
          className={cn(
            CHIP,
            'justify-start text-left',
            estado.cambioComoPropina ? ENCENDIDO : APAGADO,
          )}
        >
          {estado.cambioComoPropina && <Check aria-hidden="true" className="size-4 shrink-0" />}
          {`Dejar los ${enPesos(cuenta.cambioOfrecidoCentavos)} de cambio como propina`}
        </button>
      )}
      {cuenta.tropiezo === null && cuenta.propinaCentavos > 0 && conImporte.length > 1 && (
        <div
          role="group"
          aria-label="Con qué se pagó la propina"
          className="flex flex-wrap gap-(--espacio-1)"
        >
          {conImporte.map((opcion) => (
            <Chip
              key={opcion.metodo}
              encendido={dondeVa === opcion.metodo}
              disabled={deshabilitado}
              className="flex-1 text-xs"
              onClick={() => {
                alCambiar({ ...estado, propinaCon: opcion.metodo });
              }}
            >
              {opcion.rotulo}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

export function PagoDeLaTarjeta({
  estado,
  alCambiar,
  cuenta,
  propina,
  porcentajes,
  propinas,
  guardandoPropina,
  procesando,
  alElegirPropina,
}: {
  readonly estado: CobroEnPantalla;
  readonly alCambiar: (estado: CobroEnPantalla) => void;
  readonly cuenta: CuentaDelCobro;
  readonly propina: PropinaDelCobro;
  readonly porcentajes: readonly number[];
  readonly propinas: PropinasEnLaCaja;
  readonly guardandoPropina: boolean;
  readonly procesando: boolean;
  readonly alElegirPropina: (propina: PropinaDelCobro) => void;
}): ReactElement {
  const campo = estado.campoActivo;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-(--espacio-2)">
      {propinas !== 'apagadas' && (
        <Propina
          propina={propina}
          porcentajes={porcentajes}
          propinas={propinas}
          guardando={guardandoPropina || procesando}
          estado={estado}
          alCambiar={alCambiar}
          alElegir={alElegirPropina}
        />
      )}
      <fieldset className="min-w-0">
        <legend className="mb-1 text-xs font-semibold text-texto-sutil">Forma de pago</legend>
        <div className="grid grid-cols-2 gap-(--espacio-1) sm:grid-cols-4">
          {FORMAS.map(({ modo, rotulo, Icono }) => (
            <Chip
              key={modo}
              encendido={estado.modo === modo}
              disabled={procesando}
              onClick={() => {
                alCambiar(elegirModo(estado, modo));
              }}
            >
              <Icono className="size-4 shrink-0" />
              {rotulo}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="grid min-h-0 flex-1 gap-(--espacio-2) sm:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-(--espacio-2) overflow-y-auto overscroll-contain pr-0.5">
          {estado.otroMontoAbierto && propinas === 'elige' && (
            <OtroMonto
              estado={estado}
              alCambiar={alCambiar}
              alElegir={alElegirPropina}
              guardando={guardandoPropina || procesando}
            />
          )}
          <CamposDelModo
            estado={estado}
            cuenta={cuenta}
            alCambiar={alCambiar}
            deshabilitado={procesando}
          />
        </div>
        {campo !== null && (
          <TecladoDeImportes
            rotulo={nombreDelCampo(campo)}
            deshabilitado={procesando}
            alTeclear={(tecla) => {
              alCambiar(teclear(estado, tecla));
            }}
          />
        )}
      </div>
      {/* El cambio y lo que se decide con él, SIEMPRE a la vista: con varias tarjetas los campos se
          desplazan, y esto no. */}
      <Resultado
        estado={estado}
        cuenta={cuenta}
        propinas={propinas}
        alCambiar={alCambiar}
        deshabilitado={procesando}
      />
    </div>
  );
}
