'use client';
import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/cliente';
import {
  getCurrentPackage,
  getPackageLabel,
  getPackageFeatures,
  canAccessModule as canAccessModuleHelper,
} from '@/lib/packageConfig';
import { LOGO_POR_OMISION, RUTA_DEL_LOGO_IMPRIMIBLE } from '~/marca/logo';
import {
  NOMBRE_DEL_NEGOCIO,
  NOMBRE_DEL_SISTEMA,
  marcaVisibleDePlataforma,
  nombreVisibleDelNegocio,
  nombreVisibleDelSistema,
} from '~/marca/nombre-visible';

// El logo de la casa por omisión (DP-3). Vive en un solo sitio: `apps/web/src/marca/logo.ts`.
export const MH_LOGO_URL = LOGO_POR_OMISION;

const DEFAULT_SYSTEM_NAME = NOMBRE_DEL_SISTEMA;

const DEFAULT_CONFIG = {
  nombre_negocio: NOMBRE_DEL_NEGOCIO,
  nombre_sistema: DEFAULT_SYSTEM_NAME,
  platform_brand: DEFAULT_SYSTEM_NAME,
  logo_url: MH_LOGO_URL,
  logo_ticket_url: RUTA_DEL_LOGO_IMPRIMIBLE,
  logo_pdf_url: RUTA_DEL_LOGO_IMPRIMIBLE,
  background_logo_url: '',
  background_image_url: '',
  background_fit: 'cover',
  background_opacity: 0.12,
  // Los del logo (DP-3): el dorado oscurecido del botón, el negro de las letras y el dorado
  // exacto del marco. Pintan los acentos del acceso; el resto sale de los tokens del estilo.
  color_primario: '#83653f',
  color_secundario: '#161614',
  color_acento: '#ac8a5f',
  moneda: 'MXN',
  simbolo_moneda: '$',
  iva_porcentaje: 0,
  usa_mesas: true,
  usa_cocina: true,
  usa_barra: true,
  permitir_venta_sin_stock: false,
  mostrar_costos_a_caja: false,
  mostrar_logo_ticket: true,
  mensaje_ticket: '¡Gracias por tu visita!',
  ticket_footer: '',
  pdf_footer: '',
  footer_text: '',
  descargar_pdf_corte_auto: true,
  formato_export_default: 'csv',
  colorear_importes_monetarios: true,
  // Mientras la configuración viaja, el menú se pinta con ESTO. Con
  // `restaurante_pro` la primera pintada le enseñaba a un abarrotes las
  // entradas de sala y luego se las quitaba: un parpadeo que ofrece lo que no
  // se contrató. La plantilla más restrictiva no parpadea hacia arriba.
  paquete_modo: 'tienda',
  modo_presentacion_activo: false,
  //  NO está aquí, y es a propósito: era una contraseña
  // por omisión escrita en el código de un repositorio público. La contraseña
  // vive hasheada en la base y la compara el servidor (E10-3, defecto D-19).
};

const ConfigContext = createContext({ config: DEFAULT_CONFIG, isLoading: false });

export function ConfigProvider({ children }) {
  // HOTFIX persistencia: sin initialData:[] para distinguir "primer fetch"
  // de "vacío real". placeholderData mantiene el valor previo durante refetch
  // (evita parpadeos de switches en cualquier pantalla que use useConfig).
  const { data, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.entidades.ConfiguracionNegocio.list(),
    placeholderData: (prev) => prev,
    staleTime: 3000,
  });

  const stored = Array.isArray(data) && data[0] ? data[0] : {};

  // Resolución de logos: si no hay específico, usar logo_url; y si tampoco, el de la casa
  // (el vector en pantalla, el PNG en lo que se imprime: html2canvas pinta igual un PNG).
  const logoPrincipal = stored.logo_url || MH_LOGO_URL;
  const logoImprimible = stored.logo_url || RUTA_DEL_LOGO_IMPRIMIBLE;

  const config = {
    ...DEFAULT_CONFIG,
    ...stored,
    // Lo que se IMPRIME de los tres nombres, no lo que se guarda: la base conserva el dato
    // tal cual (el formulario de Identidad edita el valor crudo) y aquí se le quita lo que
    // un cliente no debe leer — «Demo del acople · …» y la marca anterior de la plataforma.
    nombre_negocio: nombreVisibleDelNegocio(stored.nombre_negocio),
    nombre_sistema: nombreVisibleDelSistema(stored.nombre_sistema),
    platform_brand: marcaVisibleDePlataforma(stored.platform_brand),
    logo_url: logoPrincipal,
    logo_ticket_url: stored.logo_ticket_url || logoImprimible,
    logo_pdf_url: stored.logo_pdf_url || logoImprimible,
    // IMPORTANTE: NO usar logoPrincipal como fallback de background_logo_url.
    // Antes esto provocaba que el logo del negocio se mostrara como un
    // rectángulo flotante en medio de la pantalla aunque el usuario nunca
    // hubiera configurado un fondo. Si está vacío, debe quedar vacío.
    background_logo_url: stored.background_logo_url || '',
    background_image_url: stored.background_image_url || '',
  };

  // Helpers de paquete expuestos globalmente
  const paquete_modo = getCurrentPackage(config);
  const modo_presentacion_activo = !!config.modo_presentacion_activo;
  const canAccessModule = (moduleName) => canAccessModuleHelper(moduleName, paquete_modo);
  const packageLabel = getPackageLabel(paquete_modo);
  const packageFeatures = getPackageFeatures(paquete_modo);

  return (
    <ConfigContext.Provider
      value={{
        config,
        isLoading,
        paquete_modo,
        modo_presentacion_activo,
        canAccessModule,
        packageLabel,
        packageFeatures,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
