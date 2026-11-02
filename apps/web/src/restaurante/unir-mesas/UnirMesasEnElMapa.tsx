'use client';

import {
  atraer,
  formaDeLaUnion,
  grupoDe,
  revisarUnion,
  vecinaQueLlama,
  type FormaDeLaUnion,
  type MesaEnPlano,
} from '@morphiqpos/domain/sala';
import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { Combine, Split } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { consultarPuente, invocarComando } from '~/cliente/api';
import { centavosDe } from '~/cliente/dinero-del-puente';

import { AvisoDeMesasOcupadas, type MesaOcupada } from './AvisoDeMesasOcupadas';
import { EligeElNumero } from './EligeElNumero';
import { MesaQueTiembla, type Desplazamiento } from './MesaQueTiembla';
import { SepararMesasDialog } from './SepararMesasDialog';
import {
  cajaDeLaUnion,
  conGente,
  enLimpieza,
  escalaDelPlano,
  juntarAlGrupo,
  mesasEnPlano,
  sinAbsorbidas,
  type MesaDelPlanoDeUnion,
} from './plano-de-union';
import { useArrastreDeMesas } from './use-arrastre-de-mesas';
import { useUnionDeLaMesa } from './use-union-de-la-mesa';

/**
 * «UNIR MESAS» EN EL MAPA (DP-9.6, rehecho en DP-12.3).
 *
 * Las mesas NO cambian al entrar: la misma forma, tamaño, color, número, estado y mesero que en el
 * mapa (las dibuja la pantalla con `pintarMesa`). Tiemblan para decir «me puedes mover» y se
 * arrastran con el dedo o el ratón, 1:1. El imán es la VECINA, que se inclina hacia la que llevas;
 * al soltar cerca, se pegan y el grupo se ve fundido en la forma que le toca (cápsula, rectángulo,
 * cuadrado). También con toques, para quien no puede arrastrar. Con gente, se pregunta antes de
 * unir; en limpieza, no se puede. Al separar, cada mesa sale de la unida y vuelve a su lugar.
 */

/** El alto del mapa del mesero, en puntos del plano. */
const ALTO_DEL_PLANO = 600;
/** Lo que dura la animación de separar antes de volver al mapa. */
const MS_DE_SEPARAR = 650;

interface Separacion {
  readonly desde: { readonly x: number; readonly y: number };
  readonly mesas: readonly string[];
  readonly fase: 'antes' | 'despues';
}

export function UnirMesasEnElMapa({
  mesas,
  anclaInicial = null,
  separarAlEntrar = false,
  alTerminar,
  alReleer,
  pintarMesa,
}: {
  readonly mesas: readonly MesaDelPlanoDeUnion[];
  readonly anclaInicial?: string | null;
  /** DP-12.3: se entró para separar una unión (el globo de la mesa o la mesa libre). */
  readonly separarAlEntrar?: boolean;
  readonly alTerminar: (unidas: boolean) => void;
  /** DP-12.3: relee las mesas (separar se anima con las posiciones nuevas). */
  readonly alReleer?: () => void;
  readonly pintarMesa: (mesa: MesaDelPlanoDeUnion, caja: FormaDeLaUnion | null) => ReactNode;
}) {
  // Sólo se guarda lo que el mesero MOVIÓ; el resto sale de las mesas que llegan.
  const [movidas, setMovidas] = useState<ReadonlyMap<string, { x: number; y: number }>>(
    () => new Map(),
  );
  const visibles = sinAbsorbidas(mesas);
  const cajas = new Map(visibles.map((m) => [m.id, cajaDeLaUnion(m, mesas)] as const));
  const plano: MesaEnPlano[] = mesasEnPlano(visibles).map((m) => {
    const caja = cajas.get(m.id) ?? null;
    const base =
      caja === null ? m : { ...m, x: caja.x, y: caja.y, ancho: caja.ancho, alto: caja.alto };
    const movida = movidas.get(m.id);
    return movida === undefined ? base : { ...base, ...movida };
  });
  const [ancla, setAncla] = useState<string | null>(anclaInicial);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [ocupadas, setOcupadas] = useState<readonly MesaOcupada[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [ancho, setAncho] = useState(1000);
  const [separando, setSeparando] = useState(separarAlEntrar);
  const [asentando, setAsentando] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [separacion, setSeparacion] = useState<Separacion | null>(null);
  const contenedor = useRef<HTMLElement>(null);

  useEffect(() => {
    const nodo = contenedor.current;
    if (nodo === null) return undefined;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada !== undefined) setAncho(entrada.contentRect.width);
    });
    observador.observe(nodo);
    return () => {
      observador.disconnect();
    };
  }, []);
  // La mesa soltada se asienta: un cuadro en donde la dejó el dedo, y luego a donde la pegó el imán.
  useEffect(() => {
    if (asentando === null) return undefined;
    const cuadro = requestAnimationFrame(() => {
      setAsentando(null);
    });
    return () => {
      cancelAnimationFrame(cuadro);
    };
  }, [asentando]);
  // Separar: las que estaban unidas salen de la principal y vuelven a su lugar; luego, al mapa.
  const terminarLaSeparacion = useEffectEvent(() => {
    alTerminar(true);
  });
  const llegaron = separacion?.mesas.every((id) => visibles.some((m) => m.id === id)) ?? false;
  useEffect(() => {
    if (separacion?.fase !== 'antes' || !llegaron) return undefined;
    const cuadro = requestAnimationFrame(() => {
      setSeparacion({ ...separacion, fase: 'despues' });
    });
    return () => {
      cancelAnimationFrame(cuadro);
    };
  }, [separacion, llegaron]);
  useEffect(() => {
    if (separacion?.fase !== 'despues') return undefined;
    const fin = setTimeout(() => {
      terminarLaSeparacion();
    }, MS_DE_SEPARAR);
    return () => {
      clearTimeout(fin);
    };
  }, [separacion]);

  const escala = escalaDelPlano(ancho, plano);
  const numeroDe = (id: string) => mesas.find((m) => m.id === id)?.numero ?? 0;
  const formaDe = (id: string) => mesas.find((m) => m.id === id)?.forma ?? 'redonda';
  const esUnionViva = (id: string) => (cajas.get(id) ?? null) !== null;
  const mover = (id: string, x: number, y: number) => {
    setMovidas((actual) => new Map(actual).set(id, { x, y }));
  };

  const tocar = (id: string) => {
    if (ancla === null || ancla === id || esUnionViva(id) || esUnionViva(ancla)) {
      setAncla(ancla === id ? null : id);
      return;
    }
    if (grupo.includes(id)) return;
    const destino = juntarAlGrupo(id, grupo, plano);
    mover(id, destino.x, destino.y);
  };
  const soltar = (id: string, x: number, y: number) => {
    const m = plano.find((p) => p.id === id);
    if (m === undefined) return;
    const suelta = { ...m, x, y };
    const final = vecinaQueLlama(suelta, plano)?.seFunden === true ? atraer(suelta, plano) : suelta;
    mover(id, final.x, final.y);
    setAsentando({ id, dx: x - final.x, dy: y - final.y });
    if (ancla === null) setAncla(id);
  };
  const { arrastre, manejadoresDe } = useArrastreDeMesas({
    escala,
    anchoDelPlano: ancho / escala,
    altoDelPlano: ALTO_DEL_PLANO,
    alSoltar: soltar,
    alTocar: tocar,
  });

  const vivo = plano.map((m) =>
    arrastre?.id === m.id ? { ...m, x: arrastre.x, y: arrastre.y } : m,
  );
  const arrastrada = arrastre === null ? undefined : vivo.find((m) => m.id === arrastre.id);
  const llamado = arrastrada === undefined ? null : vecinaQueLlama(arrastrada, vivo);
  const grupo =
    ancla === null || esUnionViva(ancla) ? (ancla === null ? [] : [ancla]) : grupoDe(ancla, vivo);
  const delGrupo = vivo.filter((m) => grupo.includes(m.id));
  const fundida =
    grupo.length < 2 ? null : formaDeLaUnion(delGrupo.map((m) => ({ ...m, forma: formaDe(m.id) })));
  const limpieza = enLimpieza(grupo, mesas);
  const problema =
    grupo.length < 2
      ? null
      : limpieza !== null
        ? `La Mesa ${String(limpieza.numero)} está en limpieza: márcala libre primero.`
        : revisarUnion(delGrupo);
  const unionDelAncla =
    useUnionDeLaMesa(ancla !== null && esUnionViva(ancla) ? ancla : null, 0)?.unionId ?? null;

  const desplazamientoDe = (m: MesaEnPlano): Desplazamiento | null => {
    if (asentando?.id === m.id)
      return { dx: asentando.dx, dy: asentando.dy, estiron: 1, suave: false };
    if (llamado?.id === m.id)
      return { dx: llamado.dx, dy: llamado.dy, estiron: llamado.estiron, suave: true };
    if (separacion?.fase === 'antes' && separacion.mesas.includes(m.id)) {
      return {
        dx: separacion.desde.x - m.x,
        dy: separacion.desde.y - m.y,
        estiron: 0.6,
        suave: false,
      };
    }
    return null;
  };

  const pedirElNumero = async () => {
    // La mesa desde la que se entró (la suya, ya abierta) no se avisa: eso ya lo sabe quien une.
    const conCuenta = conGente(grupo, mesas).filter((m) => m.id !== anclaInicial);
    if (conCuenta.length === 0) {
      setPrincipal(ancla);
      return;
    }
    const conTotales = await Promise.all(
      conCuenta.map(async (m): Promise<MesaOcupada> => {
        const id = m.venta_activa_id ?? null;
        if (id === null) return { numero: m.numero, totalCentavos: null };
        try {
          const venta = await consultarPuente<{ total?: number | null }>('Venta', {
            filtro: { id },
            limite: 1,
          });
          return { numero: m.numero, totalCentavos: centavosDe('Venta', 'total', venta[0]?.total) };
        } catch (error: unknown) {
          // Sin el importe (el rol no lo lee, o no se pudo) el aviso se dice igual, sin él: lo que
          // no puede pasar es unir una mesa con gente sin preguntar.
          console.warn('No se pudo leer el total de la mesa con gente', error);
          return { numero: m.numero, totalCentavos: null };
        }
      }),
    );
    setOcupadas(conTotales);
  };

  const unir = async () => {
    if (principal === null) return;
    setEnviando(true);
    setFallo(null);
    try {
      await invocarComando('/api/restaurante/unir-mesas', {
        mesaPrincipalId: principal,
        mesaIds: grupo.filter((id) => id !== principal),
        posiciones: delGrupo.map((m) => ({ mesaId: m.id, x: Math.round(m.x), y: Math.round(m.y) })),
      });
      toast.success(`Mesas unidas: queda la ${String(numeroDe(principal))}.`);
      alTerminar(true);
    } catch (error: unknown) {
      setPrincipal(null);
      setFallo(error instanceof Error ? error.message : 'No se pudieron unir las mesas.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section aria-label="Unir mesas" className="flex flex-col gap-(--espacio-3)">
      <Aviso
        tono="info"
        titulo="Arrastra las mesas para juntarlas, o toca una y luego las que se le unen."
      >
        La vecina se acerca cuando la llevas cerca; al soltarla, se funden. Nada se guarda hasta
        «Unir». Toca una mesa unida para separarla.
      </Aviso>
      <Superficie
        ref={contenedor}
        nivel={0}
        relleno={0}
        className="relative w-full touch-pan-y overflow-hidden bg-fondo-sutil"
        style={{ height: ALTO_DEL_PLANO * escala }}
      >
        {fundida === null ? null : (
          <div
            aria-hidden="true"
            data-forma-de-la-union={fundida.figura}
            className="pointer-events-none absolute bg-primario/15 ring-2 ring-primario/60 transition-opacity duration-(--duracion-normal)"
            style={{
              left: (fundida.x - 6) * escala,
              top: (fundida.y - 6) * escala,
              width: (fundida.ancho + 12) * escala,
              height: (fundida.alto + 12) * escala,
              borderRadius: (fundida.radio + 6) * escala,
            }}
          />
        )}
        {vivo.map((m, indice) => {
          const original = mesas.find((x) => x.id === m.id);
          if (original === undefined) return null;
          return (
            <MesaQueTiembla
              key={m.id}
              mesa={m}
              numero={original.numero}
              indice={indice}
              escala={escala}
              enElGrupo={grupo.includes(m.id)}
              arrastrando={arrastre?.id === m.id}
              desplazamiento={desplazamientoDe(m)}
              manejadores={manejadoresDe(m, esUnionViva(m.id))}
              alTeclear={() => {
                tocar(m.id);
              }}
            >
              {pintarMesa(original, cajas.get(m.id) ?? null)}
            </MesaQueTiembla>
          );
        })}
      </Superficie>
      {problema === null ? null : <Aviso tono="atencion" titulo={problema} />}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
      <div className="flex flex-wrap justify-end gap-(--espacio-2)">
        <Button
          variant="outline"
          onClick={() => {
            alTerminar(false);
          }}
        >
          Cancelar
        </Button>
        {unionDelAncla === null ? null : (
          <Button
            variant="outline"
            className="gap-(--espacio-2)"
            onClick={() => {
              setSeparando(true);
            }}
          >
            <Split className="size-4" aria-hidden="true" />
            Separar mesas
          </Button>
        )}
        <Button
          className="gap-(--espacio-2)"
          disabled={grupo.length < 2 || problema !== null || enviando}
          onClick={() => void pedirElNumero()}
        >
          <Combine className="size-4" aria-hidden="true" />
          {grupo.length < 2 ? 'Unir mesas' : `Unir ${String(grupo.length)} mesas`}
        </Button>
      </div>
      <AvisoDeMesasOcupadas
        ocupadas={ocupadas}
        alCancelar={() => {
          setOcupadas(null);
        }}
        alUnir={() => {
          setOcupadas(null);
          setPrincipal(ancla);
        }}
      />
      <EligeElNumero
        abierto={principal !== null}
        opciones={grupo.map((id) => ({ id, numero: numeroDe(id) }))}
        elegida={principal}
        enviando={enviando}
        alElegir={setPrincipal}
        alCerrar={() => {
          setPrincipal(null);
        }}
        alUnir={() => void unir()}
      />
      {unionDelAncla === null || !separando ? null : (
        <SepararMesasDialog
          unionId={unionDelAncla}
          alCerrar={() => {
            setSeparando(false);
            if (separarAlEntrar) alTerminar(false);
          }}
          alHecho={() => {
            toast.success('Mesas separadas: cada una volvió a su lugar.');
            const caja = ancla === null ? null : (cajas.get(ancla) ?? null);
            const absorbidas = mesas.filter((m) => m.unida_a_mesa_id === ancla).map((m) => m.id);
            setSeparando(false);
            if (caja === null || alReleer === undefined) {
              alTerminar(true);
              return;
            }
            setSeparacion({ desde: { x: caja.x, y: caja.y }, mesas: absorbidas, fase: 'antes' });
            alReleer();
          }}
        />
      )}
    </section>
  );
}
