'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Check, Flame, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DialogoDelSonido } from '~/configuracion/DialogoDelSonido';
import { fraseNuevoPedidoCocina, speak, speakSample } from '@/lib/voiceAlert';
import { cantidadParaMostrar } from '~/restaurante/peso';
import { rotuloHablado } from '~/restaurante/rotulo-de-la-comanda';

import { CarruselDeComandas } from './CarruselDeComandas';
import {
  chipsDeLaTira,
  comandaALaVista,
  comandasDeLaPantalla,
  fraseDeLaLlegada,
  porAnunciarLasNuevas,
} from './carrusel-del-telefono';
import { TiraDeMesas } from './TiraDeMesas';
import {
  FalloDelTelefono,
  leerPantalla,
  moverDesdeElTelefono,
  datosDelRotulo,
  type ComandaDelTelefono,
} from './pantalla-del-telefono';
import { accionDeLaTecla, accionesPosibles, type AccionDelTelefono } from './telefono-de-cocina';
import { usePantallaEncendida } from './use-pantalla-encendida';

/** Cada cuánto pregunta: la cocina quiere enterarse al momento, sin Realtime. */
const SONDEO_MS = 2500;

function fraseDe(comanda: ComandaDelTelefono): string {
  return fraseNuevoPedidoCocina(
    // Sin mesa la voz dice «mostrador», como en la pantalla grande.
    comanda.mesaNumero ?? '',
    comanda.platillos.map((p) => ({
      // La voz no lee «0.5000»: lo que va por peso dice su peso junto al nombre.
      producto_nombre: p.porPeso
        ? `${p.nombre}, ${cantidadParaMostrar({ cantidad: p.cantidad, tipo_venta: 'variable_medida', unidad_variable: p.unidadVariable, cantidad_variable: p.cantidadVariable })}`
        : p.nombre,
      cantidad: p.porPeso ? 1 : p.cantidad,
      notas: p.notas,
    })),
    comanda.notas ?? '',
    {
      // DP-16 · «para llevar 3» o «mesa 4», del mismo rótulo que la pantalla.
      rotulo: rotuloHablado(datosDelRotulo(comanda)),
      notas_alergias: comanda.alergias,
      celebracion: comanda.celebracion,
      tipo_celebracion: comanda.tipoCelebracion,
    },
  );
}

/**
 * EL TELÉFONO DE UNA ESTACIÓN DE COCINA (DP-9.4, DP-16 · 2.3). Sin PIN: el token del QR. Arriba,
 * una tira de mesas/pedidos por estado; en medio, las comandas activas en un carrusel (la más
 * vieja primero); abajo, tres botones grandes —Repetir voz, Preparar, Listo— que actúan sobre la
 * comanda que se está viendo y que también responden a una botonera Bluetooth. Una comanda nueva
 * vibra y se anuncia con una frase corta SIN mover la vista de quien cocina. La pantalla no se
 * apaga mientras está abierta.
 */
export function TelefonoDeCocina({ token }: { readonly token: string }) {
  const clienteDeConsultas = useQueryClient();
  const [sonidoActivo, setSonidoActivo] = useState(false);
  // DP-14.6-8 · El volumen de ESTE aparato, a la mano también aquí (no hay menú que lo traiga).
  const [ajusteDelSonido, setAjusteDelSonido] = useState(false);
  const [enCurso, setEnCurso] = useState<AccionDelTelefono | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const anunciadas = useRef<ReadonlySet<string> | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  usePantallaEncendida(sonidoActivo);

  const pantalla = useQuery({
    queryKey: ['telefono-de-cocina', token],
    queryFn: () => leerPantalla(token),
    refetchInterval: (consulta) =>
      consulta.state.error instanceof FalloDelTelefono && consulta.state.error.codigoInvalido
        ? false
        : SONDEO_MS,
    retry: false,
  });
  const comandas = useMemo(
    () => (pantalla.data === undefined ? [] : comandasDeLaPantalla(pantalla.data)),
    [pantalla.data],
  );
  const chips = useMemo(
    () => chipsDeLaTira(pantalla.data?.mesas ?? [], comandas),
    [pantalla.data, comandas],
  );
  // La comanda a la vista se recuerda por id: si llegan nuevas al final, la vista no se mueve.
  // Si la que se miraba se fue (la dejaron lista), queda la que ocupa su lugar.
  const [vista, setVista] = useState<{ id: string | null; indice: number }>({
    id: null,
    indice: 0,
  });
  const comanda = comandaALaVista(comandas, vista.id, vista.indice);
  const [aviso, setAviso] = useState('');

  const verIndice = useCallback(
    (indice: number): void => {
      const elegida = comandas[indice];
      if (elegida !== undefined) setVista({ id: elegida.id, indice });
    },
    [comandas],
  );
  const alVer = useCallback(
    (id: string): void => {
      setVista({
        id,
        indice: Math.max(
          0,
          comandas.findIndex((c) => c.id === id),
        ),
      });
    },
    [comandas],
  );

  useEffect(() => {
    const reloj = setInterval(() => {
      setAhora(Date.now());
    }, 30_000);
    return () => {
      clearInterval(reloj);
    };
  }, []);

  // Lo nuevo: vibra y dice una frase corta. La primera lectura no anuncia lo que ya estaba.
  useEffect(() => {
    if (pantalla.data === undefined) return;
    const nuevas = porAnunciarLasNuevas(comandas, anunciadas.current);
    anunciadas.current = new Set([...(anunciadas.current ?? []), ...comandas.map((c) => c.id)]);
    if (nuevas.length === 0 || !sonidoActivo) return;
    const frases = nuevas.map(fraseDeLaLlegada).join('. ');
    setAviso(frases);
    if (typeof navigator.vibrate === 'function') navigator.vibrate([250, 120, 250]);
    speak(frases, { cocina: true });
  }, [pantalla.data, comandas, sonidoActivo]);

  const hacer = useCallback(
    async (accion: AccionDelTelefono): Promise<void> => {
      if (comanda === null || enCurso !== null || !accionesPosibles(comanda.estado).has(accion))
        return;
      if (accion === 'repetir') {
        speakSample(fraseDe(comanda));
        return;
      }
      setEnCurso(accion);
      setFallo(null);
      try {
        await moverDesdeElTelefono(
          token,
          comanda.id,
          accion === 'preparar' ? 'en_preparacion' : 'listo',
        );
      } catch (error: unknown) {
        setFallo(error instanceof Error ? error.message : 'No se pudo.');
      } finally {
        setEnCurso(null);
        await clienteDeConsultas.invalidateQueries({ queryKey: ['telefono-de-cocina', token] });
      }
    },
    [comanda, enCurso, token, clienteDeConsultas],
  );

  // La botonera física llega como teclas.
  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent): void => {
      if (evento.repeat || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      const accion = accionDeLaTecla(evento.key);
      if (accion === null) return;
      evento.preventDefault();
      void hacer(accion);
    };
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('keydown', alTeclear);
    };
  }, [hacer]);

  if (!sonidoActivo) {
    return (
      <Button
        type="button"
        className="h-dvh w-full flex-col gap-(--espacio-3) rounded-none text-2xl"
        onClick={() => {
          speakSample('Sonido activado');
          setSonidoActivo(true);
        }}
      >
        <Volume2 aria-hidden className="size-[calc(var(--altura-control)*1.1)]" />
        Toca para activar el sonido
      </Button>
    );
  }
  if (pantalla.error instanceof FalloDelTelefono && pantalla.error.codigoInvalido) {
    return (
      <Vacio
        icono={<ChefHat aria-hidden />}
        titulo="Este código ya no sirve"
        explicacion="Pide uno nuevo en la pantalla de Cocina: «Conectar teléfono»."
        nivelDeTitulo={2}
      />
    );
  }
  if (pantalla.data === undefined) return <EsqueletoDeLista filas={4} />;

  const posibles = accionesPosibles(comanda?.estado ?? null);
  return (
    <main className="flex min-h-dvh flex-col gap-(--espacio-3) p-(--espacio-3)">
      <div className="flex items-center justify-between gap-(--espacio-2)">
        <p className="text-lg font-semibold">{pantalla.data.estacion.nombre}</p>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Sonido de este aparato"
          onClick={() => {
            setAjusteDelSonido(true);
          }}
        >
          <Volume2 aria-hidden />
        </Button>
      </div>
      <DialogoDelSonido abierto={ajusteDelSonido} alCambiar={setAjusteDelSonido} />
      {pantalla.error === null ? null : <Aviso tono="atencion" titulo={pantalla.error.message} />}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
      <TiraDeMesas chips={chips} vistaId={comanda?.id ?? null} alElegir={verIndice} />
      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>
      {comanda === null ? (
        <Vacio
          icono={<ChefHat aria-hidden />}
          titulo="Sin comandas pendientes"
          explicacion="Cuando llegue una, se lee en voz y aparece aquí."
          nivelDeTitulo={2}
        />
      ) : (
        <CarruselDeComandas
          comandas={comandas}
          vistaId={comanda.id}
          ahora={ahora}
          alVer={alVer}
          alElegir={verIndice}
        />
      )}
      <nav
        aria-label="Acciones de la comanda"
        className="sticky bottom-0 mt-auto grid grid-cols-3 gap-(--espacio-2) bg-fondo py-(--espacio-2)"
      >
        <Button
          type="button"
          size="lg"
          className="min-h-[calc(var(--altura-control)*1.3)] flex-col gap-(--espacio-1) px-(--espacio-1) text-base"
          variant="outline"
          disabled={!posibles.has('repetir')}
          onClick={() => void hacer('repetir')}
        >
          <Volume2 aria-hidden /> Repetir voz
        </Button>
        <Button
          type="button"
          size="lg"
          className="min-h-[calc(var(--altura-control)*1.3)] flex-col gap-(--espacio-1) px-(--espacio-1) text-base"
          variant="secondary"
          disabled={!posibles.has('preparar')}
          cargando={enCurso === 'preparar'}
          onClick={() => void hacer('preparar')}
        >
          <Flame aria-hidden /> Preparar
        </Button>
        <Button
          type="button"
          size="lg"
          className="min-h-[calc(var(--altura-control)*1.3)] flex-col gap-(--espacio-1) px-(--espacio-1) text-base"
          variant="success"
          disabled={!posibles.has('listo')}
          cargando={enCurso === 'listo'}
          onClick={() => void hacer('listo')}
        >
          <Check aria-hidden /> Listo
        </Button>
      </nav>
    </main>
  );
}
