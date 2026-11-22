'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/cliente';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChefHat, Layers, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CocinaProductoDialog from '@/components/cocina/CocinaProductoDialog';
import CocinaVozControl from '@/components/cocina/CocinaVozControl';
import { TableroDeCocina } from '~/cocina/TableroDeCocina';
import { PreguntaDelAnuncio } from '~/cocina/PreguntaDelAnuncio';
import { AvisoDeSilencio } from '~/cocina/AvisoDeSilencio';
import { usePuesto } from '@/components/configuracion/usePuesto';
import { ConectarTelefono } from '~/telefono-de-cocina/ConectarTelefono';
import { AgotadosDelDia } from '~/restaurante/AgotadosDelDia';
import CocinaNuevoPedidoWatcher from '@/components/cocina/CocinaNuevoPedidoWatcher';
import { usePOSAuth } from '@/lib/POSAuthContext';
import { useConfig } from '@/lib/ConfigContext';
import { COCINA_GENERAL_COLOR } from '@/utils/estacionUtils';
import { mantenerDespierta } from '~/espera/despertador';
import { sonar } from '~/sonidos/gestor';
import { alcanceDeLaCocina, comandasDelAlcance } from '~/restaurante/alcance-de-la-cocina';
import { conLaCuentaCobrada, sinPlatillosQuitados } from '~/restaurante/platos-de-la-estacion';
import { crearFilaPorClave, useToquesEnCamino } from '~/restaurante/toques-en-camino';
import { conLosToquesDePlatillos } from '~/cocina/platillos-del-tablero';

const ESTADOS = ['nuevo', 'en_preparacion', 'listo'];
// DP-16 · 2.2: cuántas comandas vivas y cuántas ventas se piden. Una cocina con diez mesas a la
// vez tiene unas veinte comandas; 300 es un tope holgado, no un volumen esperado.
const LIMITE_COMANDAS = 300;
// El puente acepta hasta 200 valores en un filtro de lista.
const LIMITE_VENTAS = 200;
// DP-25 · P4: los avisos de «listo» / «en preparación» de la cocina NO reciben toques. Cada toque
// sacaba el suyo y en el teléfono y la tableta se apilaban sobre las tarjetas: el toque siguiente
// caía sobre el aviso y no sobre el botón (el «Preparar» que se perdía). El toque lo atraviesa.
const AVISO_SIN_TOQUE = { style: { pointerEvents: 'none' } };

export default function Cocina() {
  const queryClient = useQueryClient();
  // La ficha interna de un platillo (al tocarlo) y la comanda lista que se pide quitar.
  const [fichaItem, setFichaItem] = useState(null);
  const [porQuitar, setPorQuitar] = useState(null);
  const { posUser, verificada } = usePOSAuth();
  // El puesto REAL: `posUser.rol` junta dueño, administrador y gerente en «administrador».
  const miPuesto = usePuesto();
  const { config } = useConfig();
  const estacionesActivas = config?.estaciones_preparacion_activas === true;

  // === Qué ve cada quien (DP-10.1, `~/restaurante/alcance-de-la-cocina`) ===
  // Dueño, gerente y administrador ven todo; el cocinero, su estación (o todas si se lo
  // marcaron); el cocinero sin estación, un aviso. La estación sale de la sesión del SERVIDOR:
  // mientras no la confirma, lo guardado de la pestaña no decide nada (podría ser de antes).
  const userScope = useMemo(
    () => alcanceDeLaCocina(posUser, estacionesActivas),
    [posUser, estacionesActivas],
  );

  // === Carga de pedidos ===
  // - Modo estaciones activas: trae TODOS los pedidos activos y filtra en memoria.
  //   No usamos filter({estacion_preparacion_id: ...}) en BD porque los pedidos
  //   legacy sin ese campo desaparecerían — y el requisito es que NO desaparezcan.
  // - Modo legacy (estaciones apagadas): también TODOS, cocina y barra. Filtraba
  //   por area:'cocina' de cuando la barra tenía pantalla propia; hoy `Barra.jsx`
  //   no tiene ruta («la barra es una estación de la cocina», `lib/constants.js`),
  //   así que las bebidas que el mesero comandaba no las veía nadie: la comanda de
  //   la barra se quedaba en «nuevo» para siempre y la mesa, «En preparación»
  //   aunque la cocina ya hubiera entregado todo (restaurante, 20-10-2026).
  // F3.1: refetchInterval bajado de 6000 → 3000ms para sensación más viva.
  // HOTFIX 6A.3: bajado a 2000ms para que cocina quite los entregados rápido
  // cuando Mesero marca "Entregado" en su lado. Las acciones manuales
  // además usan optimistic update + refetch inmediato, así que esto es un seguro.
  const { data: pedidos, isPending: pedidosLoading, isError: pedidosConError } = useQuery({
    queryKey: ['pedidos_cocina', estacionesActivas ? 'all' : 'legacy'],
    // DP-16 · 2.2: SÓLO las comandas vivas, y sólo sus items. Antes se bajaban las últimas 500
    // —con las entregadas de días anteriores— y el tope de 1000 items del puente se llenaba con
    // lo viejo: en un día de mucho volumen a las comandas nuevas les faltaban platillos.
    queryFn: () =>
      api.entidades.PedidoPreparacion.filter({ estado: ESTADOS }, '-created_date', LIMITE_COMANDAS),
    placeholderData: (prev) => prev,
    staleTime: 1000,
    refetchInterval: 2000,
  });
  const cargandoPedidos = pedidosLoading && !pedidos;
  // DP-7: lo que la cocina ya tocó y el servidor todavía no contesta se pinta ENCIMA de lo
  // leído, no dentro: una lectura que salió antes de otro toque lo traía viejo y regresaba la
  // comanda a «Nuevos» (`~/restaurante/toques-en-camino`).
  const { toques, poner: ponerToque, soltar: soltarToque } = useToquesEnCamino();
  // DP-24: los toques son por PLATILLO (id del renglón de la comanda), no por comanda.
  const pedidosVistos = useMemo(
    () => conLosToquesDePlatillos(Array.isArray(pedidos) ? pedidos : [], toques),
    [pedidos, toques],
  );
  // Y los de una misma comanda salen en fila: «Listo» espera a que conteste su «Preparar».
  const [fila] = React.useState(crearFilaPorClave);

  // DP-16 · 2.2: de las ventas sólo las de las comandas que se ven (para marcar «Cuenta
  // cobrada»), no las últimas 500 cada 10 s; y la lista de todas las mesas, que nadie leía, se fue.
  const idsDeVentas = useMemo(
    () =>
      [
        ...new Set(
          (Array.isArray(pedidos) ? pedidos : []).map((p) => p?.venta_id).filter(Boolean),
        ),
      ]
        .sort()
        .slice(0, LIMITE_VENTAS),
    [pedidos],
  );
  const { data: ventas } = useQuery({
    queryKey: ['ventas_para_cocina', idsDeVentas.join(',')],
    queryFn: () =>
      api.entidades.Venta.filter({ id: idsDeVentas }, '-created_date', idsDeVentas.length),
    enabled: idsDeVentas.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const ventasMap = useMemo(() => {
    const m = {};
    (Array.isArray(ventas) ? ventas : []).forEach((v) => {
      if (v?.id) m[v.id] = v;
    });
    return m;
  }, [ventas]);

  // DP-24: el título de cada bloque dice la mesa de la CUENTA (la principal si hay unión) y su mesero.
  const infoDeLasCuentas = useMemo(() => {
    const info = {};
    Object.values(ventasMap).forEach((v) => {
      info[v.id] = { mesero: v.usuario_mesero_nombre || null, mesaNumero: v.mesa_numero ?? null };
    });
    return info;
  }, [ventasMap]);

  // Conocer si la estación del usuario es "Cocina general" (es_general:true).
  // Si lo es, también debe ver pedidos legacy sin estacion_preparacion_id
  // y pedidos que cayeron a fallback (sin id pero etiquetados Cocina general).
  const { data: estacionesAll = [] } = useQuery({
    queryKey: ['estaciones_preparacion_activas'],
    queryFn: () => api.entidades.EstacionPreparacion.filter({ activo: true }),
    initialData: [],
    enabled: estacionesActivas,
  });
  const userEsCocinaGeneral = useMemo(() => {
    if (userScope.mode !== 'station') return false;
    const est = (Array.isArray(estacionesAll) ? estacionesAll : []).find(
      (e) => e?.id === userScope.stationId,
    );
    return est?.es_general === true;
  }, [userScope, estacionesAll]);

  // === F3: Filtrado por estación del usuario ===
  // Lo que nació sin estación (el portal, antes de DP-10.1) lo ve sólo la general.
  // DP-15 · F1: el platillo quitado no se pinta, y la comanda de una cuenta ya cobrada con comida
  // por preparar se marca «cuenta cobrada» (no se cierra sola: podría ser comida que se va a servir).
  const pedidosFiltrados = useMemo(
    () =>
      verificada
        ? conLaCuentaCobrada(
            sinPlatillosQuitados(comandasDelAlcance(pedidosVistos, userScope, userEsCocinaGeneral)),
            ventasMap,
          )
        : [],
    [verificada, pedidosVistos, userScope, userEsCocinaGeneral, ventasMap],
  );

  const activos = useMemo(
    () =>
      (Array.isArray(pedidosFiltrados) ? pedidosFiltrados : []).filter(
        (p) => !['entregado', 'cancelado'].includes(p?.estado),
      ),
    [pedidosFiltrados],
  );

  const byEstado = useMemo(
    () =>
      ESTADOS.reduce((acc, s) => {
        acc[s] = activos.filter((p) => p?.estado === s);
        return acc;
      }, {}),
    [activos],
  );

  // DP-11.2: con comandas por preparar en MI estación, el modo espera no entra (y al salir de
  // Cocina deja de contar).
  const porPreparar = (byEstado.nuevo?.length ?? 0) + (byEstado.en_preparacion?.length ?? 0);
  useEffect(() => {
    mantenerDespierta('cocina', porPreparar > 0);
    return () => mantenerDespierta('cocina', false);
  }, [porPreparar]);

  /**
   * DP-24 · LA COCINA POR PLATILLO. Cada platillo se mueve solo (`transicionar_pedido` con
   * `comandaItemId`) y el bloque de una mesa se mueve de un jalón (`mover_platillos`, que sólo
   * toca los que siguen en la columna). La comanda y la mesa se derivan de sus platillos en el
   * SERVIDOR, dentro de la misma transacción: aquí no se decide ni una.
   *
   * Lo pintado en camino (DP-7) es por platillo: se ve ya en su columna nueva sin esperar al
   * servidor, y se suelta cuando contestó y ya se releyó. Los toques salen en fila: el «Listo»
   * de un platillo espera a que conteste su «Preparar».
   */
  const refrescarLoQueDependeDeCocina = () => {
    queryClient.invalidateQueries({ queryKey: ['mesas'] });
    // El mesero se entera de lo que salió: su tarjeta de la mesa, el aviso y las nubecitas del mapa.
    queryClient.invalidateQueries({ queryKey: ['pedidos_listos_mesero'] });
    queryClient.invalidateQueries({ queryKey: ['avisos_de_listo'] });
    queryClient.invalidateQueries({ queryKey: ['pedidos_del_mapa'] });
  };

  const enviarToques = async (platillos, parche, enviar) => {
    const puestos = platillos
      .map((p) => p?.item?.id)
      .filter(Boolean)
      .map((id) => ({ id, toque: ponerToque(id, parche) }));
    // DP-25 · P4: la fila es POR CUENTA. Con una sola fila para toda la cocina, cada toque esperaba
    // a todos los de las demás mesas (y con la pantalla cargada el último «Listo» llegaba al
    // servidor segundos después de verse hecho). El servidor ya serializa por cuenta; lo que
    // importa es que los toques de UNA cuenta salgan en orden, y las demás no se esperen.
    const cuenta = platillos.find((p) => p?.comanda?.venta_id)?.comanda?.venta_id ?? 'cocina';
    try {
      await fila.encolar(cuenta, enviar);
      await queryClient.invalidateQueries({ queryKey: ['pedidos_cocina'] });
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: ['pedidos_cocina'] });
      throw e;
    } finally {
      puestos.forEach(({ id, toque }) => soltarToque(id, toque));
    }
  };

  const sellosDelToque = (hacia) =>
    hacia === 'listo'
      ? { fecha_listo: new Date().toISOString() }
      : { fecha_inicio: new Date().toISOString() };

  const moverPlatillo = async (platillo, hacia) => {
    const comandaItemId = platillo?.item?.id;
    if (!comandaItemId) return;
    try {
      await enviarToques([platillo], { estado: hacia, ...sellosDelToque(hacia) }, () =>
        api.comandos.ejecutar('/api/restaurante/transicionar-pedido', {
          comandaId: platillo.comanda.id,
          comandaItemId,
          estado: hacia,
        }),
      );
      refrescarLoQueDependeDeCocina();
      if (hacia === 'listo') {
        toast.success('¡Platillo listo!', AVISO_SIN_TOQUE);
        sonar('comandaLista');
      } else {
        toast.success('Platillo en preparación', AVISO_SIN_TOQUE);
      }
    } catch (e) {
      toast.error('No se pudo mover el platillo: ' + (e?.message || ''));
    }
  };

  const moverBloque = async (bloque, hacia) => {
    const ids = bloque.platillos.map((p) => p?.item?.id).filter(Boolean);
    if (ids.length === 0) return;
    try {
      await enviarToques(bloque.platillos, { estado: hacia, ...sellosDelToque(hacia) }, () =>
        api.comandos.ejecutar('/api/restaurante/mover-platillos', {
          platilloIds: ids,
          desde: bloque.estado,
          estado: hacia,
        }),
      );
      refrescarLoQueDependeDeCocina();
      if (hacia === 'listo') {
        toast.success('¡Pedido listo!', AVISO_SIN_TOQUE);
        sonar('comandaLista');
      } else {
        toast.success('Pedido en preparación', AVISO_SIN_TOQUE);
      }
    } catch (e) {
      toast.error('No se pudo mover el pedido: ' + (e?.message || ''));
    }
  };

  // Quitar un pedido de "Listos" como emergencia (mesero se olvidó de dar
  // "Entregado"). NO borra venta, NO toca inventario, NO afecta caja.
  const quitarBloqueListo = async (bloque) => {
    const ordenId = bloque?.comandas?.[0]?.venta_id;
    if (!ordenId) return;
    try {
      await enviarToques(bloque.platillos, { estado: 'entregado' }, () =>
        api.comandos.ejecutar('/api/restaurante/entregar-pedidos', {
          ordenId,
          comandaIds: bloque.comandas.map((c) => c.id),
        }),
      );
      refrescarLoQueDependeDeCocina();
      toast.success('Pedido quitado de la lista', AVISO_SIN_TOQUE);
    } catch (e) {
      toast.error('No se pudo quitar el pedido: ' + (e?.message || ''));
    }
  };

  // === F3: Pantalla especial si el usuario es cocina sin estación asignada ===
  if (verificada && userScope.mode === 'unassigned') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #E68A33 0%, #B8651F 100%)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <ChefHat className="w-5 h-5 text-primario-texto" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-heading font-bold">Cocina</h1>
            <p className="text-xs text-muted-foreground">Sin estación asignada</p>
          </div>
        </div>
        <div className="rounded-2xl border-2 border-advertencia/30 bg-advertencia/10 p-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-advertencia" />
          <p className="font-bold text-base text-advertencia mb-1">
            Tu usuario no tiene estación asignada; pide al administrador que te asigne una.
          </p>
          <p className="text-sm text-advertencia">
            Se asigna en
            <strong> Configuración → Personas y seguridad → Usuarios POS</strong>, o ahí mismo se le marca «Todas las
            estaciones».
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, #E68A33 0%, #B8651F 100%)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <ChefHat className="w-5 h-5 text-primario-texto" />
        </div>
        {/* DP-12.6: `basis-48` (12 rem) en vez de `flex-1`: con base cero el título se dejaba
            apretar hasta una columna de letras y «Conectar teléfono» se le montaba encima; ahora,
            si no caben, los botones pasan al renglón de abajo. */}
        <div className="grow basis-48 min-w-0">
          <h1 className="text-xl font-heading font-bold leading-tight">
            Cocina
            {userScope.mode === 'station' && userScope.label && (
              <span
                className="inline-flex items-center gap-1 ml-2 text-xs font-semibold px-2 py-0.5 rounded-full border align-middle"
                style={{
                  borderColor: (userScope.color || COCINA_GENERAL_COLOR) + '66',
                  color: userScope.color || COCINA_GENERAL_COLOR,
                  background: (userScope.color || COCINA_GENERAL_COLOR) + '15',
                }}
              >
                <Layers className="w-3 h-3" />
                {userScope.label}
              </span>
            )}
            {userScope.mode === 'all' && userScope.label && estacionesActivas && (
              <span className="inline-flex items-center gap-1 ml-2 text-xs font-semibold px-2 py-0.5 rounded-full border align-middle bg-primary/10 text-primary border-primary/30">
                <Layers className="w-3 h-3" />
                {userScope.label}
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">{activos.length} pedido(s) activos</p>
        </div>
        {/* DP-9.4: el QR del teléfono de UNA estación; un cocinero con estación fija, la suya. */}
        <ConectarTelefono
          estacionFijaId={
            userScope.mode === 'station' ? (posUser?.estacion_preparacion_id ?? null) : null
          }
        />
        {/* DP-15 · Lo que se acabó hoy: ni el mesero ni el QR lo pueden pedir hasta mañana. */}
        <AgotadosDelDia />
        <CocinaVozControl />
      </div>

      {/* DP-22 · La primera vez que la cocina abre esta pantalla sin haber elegido, se le pregunta
          (una vez, sin tapar nada) si esta pantalla anuncia las comandas. */}
      <PreguntaDelAnuncio puesto={miPuesto} />
      <AvisoDeSilencio puesto={miPuesto} />

      {/* Watcher local: reproduce voz/sonido SOLO para pedidos NUEVOS, nunca para "listo". */}
      {/* DP-10.1: por estación. La `key` lo vuelve a montar si cambia lo que se ve: lo que ya
          estaba en la pantalla nueva se toma como visto, no se anuncia de golpe. */}
      <CocinaNuevoPedidoWatcher
        key={userScope.mode === 'station' ? userScope.stationId : userScope.mode}
        pedidos={pedidosFiltrados}
        cargando={cargandoPedidos || !verificada}
      />

      {/* DP-16 · 2.2: el tablero (resumen de producción, tarjetas por cuenta, tiempo con color,
          columnas con su propio desplazamiento y modo compacto) vive en `~/cocina`; esta pantalla
          sigue siendo dueña de las lecturas, los toques en camino, la voz y el alcance. */}
      <TableroDeCocina
        comandas={activos}
        config={config}
        cargando={cargandoPedidos || !verificada}
        error={pedidosConError ? 'No se pudo leer los pedidos de la cocina.' : null}
        infoDeLasCuentas={infoDeLasCuentas}
        onPlatillo={moverPlatillo}
        onBloque={moverBloque}
        onPedirQuitar={setPorQuitar}
        onVerFicha={setFichaItem}
      />

      <CocinaProductoDialog
        open={!!fichaItem}
        item={fichaItem}
        onClose={() => setFichaItem(null)}
      />

      <AlertDialog open={!!porQuitar} onOpenChange={(abierto) => !abierto && setPorQuitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar este pedido de la lista de cocina?</AlertDialogTitle>
            <AlertDialogDescription>
              No se eliminará la venta ni los registros financieros. Solo se quita del tablero de
              cocina.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                quitarBloqueListo(porQuitar);
                setPorQuitar(null);
              }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
