'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/api/cliente';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Settings,
  Users,
  UtensilsCrossed,
  Plus,
  Trash2,
  AlertTriangle,
  Save,
  Palette,
  Cloud,
  Sparkles,
  ShieldAlert,
  Database,
  Tablet,
  Volume2,
  Printer,
} from 'lucide-react';
import { ZONAS_MESA } from '@/lib/constants';
import MesaMapEditor from '@/components/mesas/MesaMapEditor';
import MesaListMobile from '@/components/mesas/MesaListMobile';
import MesaEditDialog from '@/components/mesas/MesaEditDialog';
import RepartirMesasDialog from '@/components/mesas/RepartirMesasDialog';
import { siguienteNumeroLibre } from '~/cliente/numero-de-mesa';
import ZonasDelSalonDialog from '@/components/mesas/ZonasDelSalonDialog';
import { esDeMando, puedeRepartirMesas } from '@/components/configuracion/puestos';
import { soloCamposEditablesMesa } from '@/utils/mesaConfigUtils';
import { claves } from '~/cliente/claves-de-consulta';
import { sufijoDelNombreDeLaMesa } from '~/restaurante/nombre-de-la-mesa';
import {
  mesasDelPlano,
  siguientePosicionLibre,
  soloMesasEnServicio,
  zonasDelNegocio,
} from '~/cliente/mesas-del-mapa';


/** DP-15 · Quien escribe zonas por el puente (la escritura genérica). */
const PUEDEN_EDITAR_ZONAS = ['dueno', 'administrador', 'gerente'];

const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
};

export default function MapaDeMesasDeConfiguracion({ miPuesto, cfg, puedeEliminarMesas }) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [showRepartir, setShowRepartir] = useState(false);
  const [showEliminarMesas, setShowEliminarMesas] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [zonaFiltro, setZonaFiltro] = useState('Interior');
  const [editingMesa, setEditingMesa] = useState(null);
  const [showMesaDialog, setShowMesaDialog] = useState(false);
  const [showZonas, setShowZonas] = useState(false);

  // TODAS las mesas, también las dadas de baja (el editor ofrece «Reactivar»). Su clave lo dice:
  // la del mapa del mesero es otra (`claves.mesas.activas()`).
  //
  // Sin `initialData: []`: con él, el editor se pintaba como «No hay mesas configuradas» —y con
  // el botón «Crear primera mesa»— durante toda la lectura, que con red lenta se lee como si
  // el negocio hubiera perdido su mapa. `cargandoMesas` distingue la primera lectura del vacío.
  const { data: mesasLeidas, isPending: cargandoMesas } = useQuery({
    queryKey: claves.mesas.todas(),
    queryFn: () => api.entidades.Mesa.list('-created_date', 500),
  });
  const mesas = useMemo(() => (Array.isArray(mesasLeidas) ? mesasLeidas : []), [mesasLeidas]);
  // Las zonas dadas de alta (DP-5): son las que el editor ofrece y en las que nace una mesa.
  const { data: zonasLeidas = [] } = useQuery({
    queryKey: ['zonas'],
    queryFn: () => api.entidades.Zona.list(),
  });

  const handleSaveMesa = async (data) => {
    if (!data?.numero) {
      toast.error('El número de mesa es obligatorio');
      return;
    }
    // Crear, renombrar y mover una mesa siguen siendo escrituras directas del
    // puente. Pero el diálogo reenvía LA FILA ENTERA (`{ ...empty, ...mesa }`),
    // y esa fila trae de vuelta todo lo que la lectura añadió.
    //
    // ── Por qué una lista BLANCA y no una negra ─────────────────────────────
    // Aquí hubo una lista negra de los ocho campos de ocupación, y no bastaba:
    // el puente rechaza TODO campo que no sepa escribir, y lo hace lanzando, no
    // ignorando. Además de los ocho, la fila leída trae los cinco DERIVADOS
    // —`zona`, `mesero_asignado_nombre`, `mesero_asignado_color`,
    // `atendido_por_nombre`, `atendido_por_color`, que salen de un left join— y
    // las dos fechas de sólo lectura. Con la lista negra, guardar una mesa
    // fallaba SIEMPRE con «"zona" se calcula al leer y no se guarda».
    //
    // Una lista blanca no tiene ese problema: lo que el servidor añada mañana
    // simplemente no viaja. Son los doce campos que el mapa del puente declara
    // escribibles para Mesa.
    // Abrir, ocupar, pedir la cuenta y liberar son TRANSICIONES con su comando:
    // que no quepan aquí es lo que impide «mesa libre con venta viva».

    try {
      // La zona se elige por nombre y se guarda por `zona_id` (ver `soloCamposEditablesMesa`).
      const zonas = await api.entidades.Zona.list();
      const { id, ...rest } = data;
      const campos = soloCamposEditablesMesa(rest, zonas);
      if (data.zona && !campos.zona_id) {
        toast.error(`No se pudo guardar la mesa: la zona «${data.zona}» no existe en este negocio.`);
        return;
      }
      if (id) {
        await api.entidades.Mesa.update(id, campos);
        toast.success(`Mesa ${data.numero} actualizada`);
      } else {
        await api.entidades.Mesa.create(campos);
        toast.success(`Mesa ${data.numero} creada`);
      }
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
      setShowMesaDialog(false);
      setEditingMesa(null);
    } catch (e) {
      toast.error('No se pudo guardar la mesa: ' + (e?.message || ''));
    }
  };

  const handleDeleteMesa = async (id) => {
    try {
      // Validación defensiva en backend: revisar si tiene venta activa
      const mesa = mesas.find((m) => m.id === id);
      const ESTADOS_OCUPADA = [
        'esperando_orden',
        'pedido_enviado',
        'en_preparacion',
        'en_espera_entrega',
        'ocupada',
        'cuenta_solicitada',
      ];
      if (mesa && (mesa.venta_activa_id || ESTADOS_OCUPADA.includes(mesa.estado))) {
        toast.error(
          'No se puede eliminar una mesa con venta o pedido activo. Libera la mesa primero.',
        );
        return;
      }
      // El puente la DESACTIVA (borrado suave): su historial de ventas se conserva y puede
      // volver. Antes decía «Mesa eliminada» y la mesa seguía en el mapa, igual que antes.
      await api.entidades.Mesa.delete(id);
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
      toast.success(
        `Mesa ${mesa?.numero ?? ''} quitada del mapa. Su historial se conserva; puedes reactivarla en «Mesas desactivadas».`,
      );
      setShowMesaDialog(false);
      setEditingMesa(null);
    } catch (e) {
      toast.error('Error al eliminar la mesa: ' + (e?.message || ''));
    }
  };

  const handlePositionChange = async (id, x, y) => {
    await api.entidades.Mesa.update(id, { posicion_x: x, posicion_y: y });
    queryClient.invalidateQueries({ queryKey: ['mesas'] });
  };

  const handleReorder = async (id, nuevoOrden) => {
    await api.entidades.Mesa.update(id, { orden: nuevoOrden });
    queryClient.invalidateQueries({ queryKey: ['mesas'] });
  };

  const openNew = () => {
    // Crear mesa en la zona activa (no mezclar zonas), en el primer hueco libre del lienzo: la
    // posición ya no sale de CUÁNTAS mesas hay, sino de DÓNDE están (`siguientePosicionLibre`).
    const posicion = siguientePosicionLibre(mesasDelPlano(mesas, zonaFiltro));
    setEditingMesa({
      // DP-15 · El menor número que ninguna mesa ACTIVA usa (reusa el de una mesa quitada).
      numero: siguienteNumeroLibre(mesas),
      nombre: '',
      zona: zonaFiltro,
      capacidad: 4,
      forma: 'redonda',
      tamano: 'mediana',
      posicion_x: posicion.x,
      posicion_y: posicion.y,
      activo: true,
      estado: 'libre',
    });
    setShowMesaDialog(true);
  };

  // El mapa y la lista son de las mesas ACTIVAS de la zona que se mira; las desactivadas van
  // aparte, con «Reactivar». Comparten coordenadas con las activas: nunca al mismo lienzo.
  const mesasActivas = soloMesasEnServicio(mesas);
  const mesasDesactivadas = mesas.filter((m) => m.activo === false);
  const mesasFiltradas = mesasDelPlano(mesas, zonaFiltro);
  const zonasDelEditor = zonasDelNegocio(zonasLeidas, mesasActivas, ZONAS_MESA);
  // Si la zona que se mira no es del negocio («Interior» en Don Poncho), la primera que sí.
  const primeraZona = zonasDelEditor[0];
  const zonaAjena = !zonasDelEditor.includes(zonaFiltro);
  useEffect(() => {
    if (primeraZona && zonaAjena) setZonaFiltro(primeraZona);
  }, [primeraZona, zonaAjena]);

  const reactivarMesa = async (mesa) => {
    try {
      await api.entidades.Mesa.update(mesa.id, { activo: true });
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
      toast.success(`Mesa ${mesa.numero} reactivada: vuelve al mapa y a los meseros.`);
    } catch (e) {
      // El servidor dice por qué —por ejemplo, otra mesa activa ya tiene ese número—.
      toast.error('No se pudo reactivar la mesa: ' + (e?.message || ''));
    }
  };

  const eliminarMesasDemo = async () => {
    setEliminando(true);
    try {
      // Ya no manda `rol`: lo decide la sesión en el servidor. Y ya no borra
      // físicamente hasta 500 mesas sin mirar si tienen venta abierta — ahora
      // es borrado suave y el comando SE NIEGA si alguna está ocupada, así que
      // deja de producir ventas huérfanas.
      const res = await api.comandos.ejecutar('/api/mantenimiento/vaciar-mesas', {});
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
      const cuantas = res?.borrado?.mesas ?? 0;
      toast.success(`${cuantas} mesas retiradas. Ahora puedes crear tu mapa desde cero.`);
      setShowEliminarMesas(false);
    } catch (e) {
      // El error llega con su mensaje de dominio: si hay mesas con venta
      // abierta, dice cuáles. Antes esto era un `ok:false` que la pantalla
      // resumía como «Error al eliminar mesas».
      toast.error(e?.message || 'No se pudieron retirar las mesas.');
    }
    setEliminando(false);
  };


  return (
    <>
            <Card>
              <CardHeader className="flex flex-col gap-3">
                <div className="flex flex-row items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base font-heading">Mapa de mesas</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Arrastra cada mesa para colocarla. Click para editar.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {puedeEliminarMesas && mesas.length > 0 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setShowEliminarMesas(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Eliminar todas
                      </Button>
                    )}
                    {puedeRepartirMesas(miPuesto) && mesasActivas.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setShowRepartir(true)}>
                        <Users className="w-4 h-4 mr-1" />
                        Repartir mesas
                      </Button>
                    )}
                    {/* DP-15 · Dar de alta y renombrar zonas (antes no había pantalla). */}
                    {PUEDEN_EDITAR_ZONAS.includes(miPuesto) && (
                      <Button size="sm" variant="outline" onClick={() => setShowZonas(true)}>
                        Zonas
                      </Button>
                    )}
                    <Button size="sm" onClick={openNew}>
                      <Plus className="w-4 h-4 mr-1" />
                      Nueva mesa
                    </Button>
                  </div>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {zonasDelEditor.map((z) => (
                    <button
                      key={z}
                      onClick={() => setZonaFiltro(z)}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${zonaFiltro === z ? 'bg-primary text-primario-texto' : 'bg-superficie border text-muted-foreground'}`}
                    >
                      {z}{' '}
                      <span className="opacity-60">
                        ({cargandoMesas ? '…' : mesasDelPlano(mesasActivas, z).length})
                      </span>
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {isMobile ? (
                  <>
                    <MesaListMobile
                      mesas={mesasFiltradas}
                      cargando={cargandoMesas}
                      onEdit={(m) => {
                        setEditingMesa(m);
                        setShowMesaDialog(true);
                      }}
                      onReorder={handleReorder}
                    />
                    <p className="text-xs text-muted-foreground mt-3">
                      En móvil puedes editar y reordenar las mesas. Para usar el mapa libre con drag
                      & drop, abre la app en computadora o tablet.
                    </p>
                  </>
                ) : (
                  <>
                    <MesaMapEditor
                      mesas={mesasFiltradas}
                      cargando={cargandoMesas}
                      selectedId={editingMesa?.id}
                      onMesaClick={(m) => {
                        setEditingMesa(m);
                        setShowMesaDialog(true);
                      }}
                      onPositionChange={handlePositionChange}
                      onCreateFirst={openNew}
                    />
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <Save className="w-3 h-3" />
                      Las posiciones se guardan automáticamente al soltar.
                    </p>
                  </>
                )}
                {mesasDesactivadas.length > 0 && (
                  <div className="mt-4 rounded-lg border p-3" aria-label="Mesas desactivadas">
                    <p className="text-sm font-semibold">
                      Mesas desactivadas ({mesasDesactivadas.length})
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      No aparecen en el mapa ni con los meseros. Su historial se conserva.
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {mesasDesactivadas.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                          <span>
                            Mesa {m.numero}
                            {sufijoDelNombreDeLaMesa(m)} · {m.zona || 'Interior'}
                          </span>
                          <Button size="sm" variant="outline" onClick={() => reactivarMesa(m)}>
                            Reactivar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

      <RepartirMesasDialog
        open={showRepartir}
        mesas={mesasActivas}
        asignacionActiva={cfg?.asignacion_mesas_activa === true}
        onClose={() => setShowRepartir(false)}
      />

      {/* Eliminar mesas demo Dialog */}
      <Dialog open={showEliminarMesas} onOpenChange={setShowEliminarMesas}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Eliminar mesas demo
            </DialogTitle>
          </DialogHeader>
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
            <p className="font-semibold mb-2">
              Esto eliminará las mesas actuales para que puedas crear el mapa desde cero. ¿Seguro?
            </p>
            <p className="text-xs text-muted-foreground">
              No se borrarán: ventas, productos, recetas, inventario, usuarios ni configuración.
              Solo las mesas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEliminarMesas(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={eliminando} onClick={eliminarMesasDemo}>
              {eliminando ? 'Eliminando...' : 'Sí, eliminar todas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mesa Edit Dialog (crear/editar) */}
      <ZonasDelSalonDialog
        open={showZonas}
        onOpenChange={setShowZonas}
        zonas={zonasLeidas}
        alRenombrar={(antes, despues) => {
          if (zonaFiltro === antes) setZonaFiltro(despues);
        }}
      />
      <MesaEditDialog
        open={showMesaDialog}
        mesa={editingMesa}
        zonas={zonasDelEditor}
        onClose={() => {
          setShowMesaDialog(false);
          setEditingMesa(null);
        }}
        onSave={handleSaveMesa}
        onDelete={handleDeleteMesa}
      />
    </>
  );
}
