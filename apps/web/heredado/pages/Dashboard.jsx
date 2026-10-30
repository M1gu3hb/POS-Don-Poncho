'use client';
import React, { useMemo, useState } from 'react';
import { api } from '@/api/cliente';
import { useQuery } from '@tanstack/react-query';
import { useConfig } from '@/lib/ConfigContext';
import { canAccessModule } from '@/lib/packageConfig';
import { getStockStatus } from '@/utils/inventoryUtils';
import FinancialChart from '@/components/dashboard/FinancialChart';
import { useCajaAbierta } from '@/lib/useCajaAbierta';
import PropinasDashboardSection from '@/components/propinas/PropinasDashboardSection';
import { tipsEnabled } from '@/utils/tipsUtils';
import PrimerosPasosCard, { primerosPasosVigente } from '@/components/dashboard/PrimerosPasosCard';
import { AccesosDelDueno } from '~/restaurante/AccesosDelDueno';
import { RecetasPendientes } from '~/restaurante/RecetasPendientes';
import { claves } from '~/cliente/claves-de-consulta';
import { cifrasDelDia, metodosConVentas } from '~/tablero/cifras-del-dia';
import { progresoDePrimerosPasos } from '~/tablero/progreso-de-primeros-pasos';
import { EncabezadoDelTablero } from '~/tablero/EncabezadoDelTablero';
import { AvisoDeCaja } from '~/tablero/AvisoDeCaja';
import { FilaDeCifras, CifraDeInventarioCritico } from '~/tablero/FilaDeCifras';
import { DonaDeMetodosDePago } from '~/tablero/DonaDeMetodosDePago';
import { AlertasDeInventario } from '~/tablero/AlertasDeInventario';
import { CortesRecientes } from '~/tablero/CortesRecientes';

/**
 * Un negocio de mostrador: cobra en Caja, sin mesas de por medio. Se pregunta por el MÓDULO y
 * no por el nombre de la plantilla: enumerar nombres dejó este dashboard sin botón al
 * renombrarse los paquetes. Preguntando por `mesas`, las dos ramas son exhaustivas siempre.
 */
const isCajaDirecta = (modo) => !canAccessModule('mesas', modo);

/**
 * El TABLERO del dueño (DP-11.4): el cascarón que lee los datos, decide qué módulos del paquete
 * se ven y en qué orden. Lo que se ve vive en `src/tablero/`, sobre el sistema de diseño, y las
 * cifras salen de funciones puras con su prueba. Siguen heredados «Primeros pasos», la gráfica
 * financiera, las propinas y la lista de cortes, que traen sus propias consultas.
 */
export default function Dashboard() {
  const { config, paquete_modo } = useConfig();
  const showCostos = canAccessModule('costos_basicos', paquete_modo);
  const showInventario = canAccessModule('inventario', paquete_modo);
  const showFinancialChart = canAccessModule('reportes_financieros_avanzados', paquete_modo);
  const showCompras = canAccessModule('compras', paquete_modo);
  const { cajaAbierta, hayCaja, isLoading: cajaLoading } = useCajaAbierta();
  // `colorear_importes_monetarios`: si está apagado, los importes van sin tinte.
  const colorearImportes = config?.colorear_importes_monetarios !== false;

  // No usar initialData:[] — queremos distinguir "primer fetch" de "vacío real"
  // para no mostrar ceros falsos mientras carga la primera vez.
  const {
    data: ventas,
    isPending: ventasLoading,
    isError: ventasFallo,
    refetch: releerVentas,
  } = useQuery({
    queryKey: ['ventas_hoy'],
    queryFn: () => api.entidades.Venta.filter({ estado: 'pagada' }),
    placeholderData: (prev) => prev,
    staleTime: 5000,
  });
  const {
    data: ingredientes,
    isPending: ingredientesLoading,
    isError: ingredientesFallo,
    refetch: releerIngredientes,
  } = useQuery({
    queryKey: ['ingredientes_all'],
    queryFn: () => api.entidades.Ingrediente.filter({ activo: true }),
    placeholderData: (prev) => prev,
    staleTime: 5000,
  });
  const {
    data: gastos,
    isPending: gastosLoading,
    isError: gastosFallo,
    refetch: releerGastos,
  } = useQuery({
    queryKey: claves.gastos.recientes(),
    queryFn: () => api.entidades.GastoOperativo.list(),
    placeholderData: (prev) => prev,
    staleTime: 5000,
  });

  // Datos ligeros SOLO para la card de "Primeros pasos". Claves UNICAS (prefijo `onboarding_`)
  // para no contaminar el caché de Productos, Mesero, Portal QR, Inventario y Configuración.
  // SIN initialData:[] — hay que saber cuándo terminó el primer fetch para no pintar la card
  // con datos vacíos falsos (el flash).
  //
  // SÓLO se piden mientras la card puede aparecer: una vez cerrada con la X, o con los ocho pasos
  // hechos (`mh_primeros_pasos_dismissed` y `_completed`), no vuelve, y estas cinco lecturas
  // —entre ellas las 500 mesas— salían en CADA visita para nada. Usuarios y mesas comparten
  // clave con las pantallas que piden EXACTAMENTE lo mismo (`claves-de-consulta.ts`).
  const [onboardingVigente] = useState(primerosPasosVigente);
  const { data: usuarios, isFetched: usuariosFetched } = useQuery({
    queryKey: claves.usuarios.activos(),
    queryFn: () => api.entidades.UsuarioPOS.filter({ activo: true }),
    enabled: onboardingVigente,
  });
  const { data: mesasAll, isFetched: mesasFetched } = useQuery({
    queryKey: claves.mesas.todas(),
    queryFn: () => api.entidades.Mesa.list('-created_date', 500),
    enabled: onboardingVigente,
  });
  const { data: categoriasProd, isFetched: categoriasFetched } = useQuery({
    queryKey: ['onboarding_categorias'],
    queryFn: () => api.entidades.CategoriaProducto.filter({ activo: true }),
    enabled: onboardingVigente,
  });
  const { data: productosAll, isFetched: productosFetched } = useQuery({
    queryKey: ['onboarding_productos'],
    queryFn: () => api.entidades.ProductoTerminado.filter({ activo: true }),
    enabled: onboardingVigente,
  });
  const { data: cortesAll, isFetched: cortesFetched } = useQuery({
    queryKey: ['onboarding_cortes'],
    queryFn: () => api.entidades.CorteCaja.list('-created_date', 5),
    enabled: onboardingVigente,
  });
  // El onboarding solo está "listo" cuando TODOS los queries terminaron su
  // primer fetch. Hasta ese momento, la card no se renderiza.
  const onboardingReady =
    onboardingVigente &&
    !!config &&
    !cajaLoading &&
    usuariosFetched &&
    mesasFetched &&
    categoriasFetched &&
    productosFetched &&
    cortesFetched;

  const safeIngredientes = Array.isArray(ingredientes) ? ingredientes : [];
  // Sincronización de carga: dashboard "cargando" si caja, ventas o gastos
  // aún no han hecho su primer fetch. Evita ceros y "caja cerrada" falsos.
  const dashboardCargando = cajaLoading || (ventasLoading && !ventas) || (gastosLoading && !gastos);
  // La lectura FALLÓ y no hay ningún dato anterior: se dice, en vez de pintar ceros que no son.
  const cifrasConFallo = (ventasFallo && !ventas) || (gastosFallo && !gastos);
  const releerCifras = () => {
    releerVentas();
    releerGastos();
  };

  // KPIs operativos basados en la caja abierta actual (el cálculo, en centavos, vive en
  // `cifras-del-dia.ts` con su prueba).
  const cifras = useMemo(
    () => cifrasDelDia({ ventas, gastos, cajaAbierta }),
    [ventas, gastos, cajaAbierta],
  );

  const alertIngredients = useMemo(() => {
    return safeIngredientes
      .map((i) => ({ ...i, stockStatus: getStockStatus(i) }))
      .filter((i) => ['critico', 'agotado', 'bajo'].includes(i.stockStatus))
      .sort((a, b) => {
        const order = { agotado: 0, critico: 1, bajo: 2 };
        return (order[a.stockStatus] || 3) - (order[b.stockStatus] || 3);
      });
  }, [safeIngredientes]);

  // Progreso de onboarding — flags simples basados en lo que YA existe en BD. Es solo
  // informativo y no bloquea nada (la regla vive en `progreso-de-primeros-pasos.ts`).
  const progresoOnboarding = useMemo(
    () =>
      progresoDePrimerosPasos({
        config,
        usuarios,
        mesas: mesasAll,
        categorias: categoriasProd,
        ingredientes: safeIngredientes,
        productos: productosAll,
        hayCaja,
        cortes: cortesAll,
      }),
    [config, usuarios, mesasAll, categoriasProd, safeIngredientes, productosAll, hayCaja, cortesAll],
  );

  return (
    <div className="space-y-5">
      <EncabezadoDelTablero
        descripcion={`${config.nombre_negocio} · ${new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
        accionPrincipal={isCajaDirecta(paquete_modo) ? 'caja' : 'venta'}
        conCompras={showCompras}
      />

      <AccesosDelDueno />
      <RecetasPendientes />

      {/* Card informativa de Primeros pasos — solo aparece si quedan pasos
          pendientes, el admin no la ha ocultado y los queries terminaron su
          primer fetch (ready). Sin `ready` la card no se renderiza nunca,
          evitando el flash "pendiente → completado" al cargar Dashboard. */}
      <PrimerosPasosCard progreso={progresoOnboarding} ready={onboardingReady} />

      {/* Mientras carga la caja real, NO afirmamos "no hay caja abierta".
          Esto evita el bug donde el dashboard decía "cerrada" antes del primer fetch. */}
      <AvisoDeCaja cargando={cajaLoading} hayCaja={hayCaja} />

      {/* Las cifras del día. Mientras llegan su lugar queda RESERVADO (esqueletos): sin esto la
          pantalla crecía dos filas de golpe al terminar la lectura. */}
      <FilaDeCifras
        cifras={cifras}
        conCostos={showCostos}
        colorearImportes={colorearImportes}
        cargando={dashboardCargando}
        hayCaja={hayCaja}
        fallo={cifrasConFallo}
        alReintentar={releerCifras}
      />

      {/* Inventario crítico (compacto en su propia card) */}
      {showInventario && alertIngredients.length > 0 && (
        <CifraDeInventarioCritico
          cantidad={alertIngredients.length}
          colorearImportes={colorearImportes}
        />
      )}

      {/* Análisis financiero — gráfica con filtros de período (solo Restaurante Pro) */}
      {showFinancialChart && <FinancialChart ventas={ventas} gastos={gastos} />}

      {/* Propinas — solo si están activadas y existen propinas registradas */}
      {tipsEnabled(config) && <PropinasDashboardSection />}

      {/* Métodos de pago y alertas de inventario */}
      <div className={`grid ${showInventario ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-5`}>
        <DonaDeMetodosDePago
          metodos={metodosConVentas(cifras)}
          cargando={dashboardCargando}
          fallo={cifrasConFallo}
          alReintentar={releerCifras}
        />
        {showInventario && (
          <AlertasDeInventario
            ingredientes={alertIngredients}
            cargando={ingredientesLoading && !ingredientes}
            fallo={ingredientesFallo && !ingredientes}
            alReintentar={() => releerIngredientes()}
          />
        )}
      </div>

      {/* Cortes de caja — el tablero muestra solo los 7 más recientes.
          El historial completo sigue disponible en Registros > Cortes. */}
      <CortesRecientes />
    </div>
  );
}
