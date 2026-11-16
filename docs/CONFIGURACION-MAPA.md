# Configuración, ordenada: el mapa (DP-21 · Bloque 21)

Sólo lectura de `.work\dp20` (rama `dp-21-a`, con los Bloques 1 a 8). Nada de código tocado. Donde el encargo DP-21 dice «Configuración → Operación» o nombra una pestaña vieja, gana este mapa.

Hoy hay **13 pestañas** (no 14): `identidad`, `apariencia`, `aparato`, `impresion`, `sonidos`, `negocio` (rotulada «Operación»), `usuarios`, `caja`, `descuentos`, `mesas`, `datos`, `integraciones`, `mantenimiento`. Todo vive en `apps/web/heredado/pages/Configuracion.jsx` (1051 líneas) más `apps/web/src/configuracion/`, `heredado/components/configuracion/` y `src/impresion/pantallas/`.

## 1. Las secciones nuevas, en orden

**Del negocio** (lo cambian dueño o administrador, como hoy; donde una tarjeta es más estricta, lo dice):

| # | Sección | Para qué sirve |
|---|---|---|
| 1 | El negocio | Quién es: nombre, logo, dirección, teléfono, correo y la marca del sistema. |
| 2 | Apariencia | Cómo se ve el sistema para todo el negocio: estilo, colores, fondo, importes en color y Morfi. |
| 3 | Ventas y cobro | Con qué se cobra: IVA, propinas (activar, porcentajes, quién la elige) y descuentos. |
| 4 | Ticket y folios | Lo que sale en el papel: mensaje, ancho, pies, logo del ticket y del PDF, prefijo y primer folio, copias. |
| 5 | Caja | Las cajas y sus nombres, el PIN en retiros, el corte de la caja (costos al cajero y comisión de la terminal) y el PDF del corte al cerrar. |
| 6 | Salón | Mapa de mesas, zonas, reparto de mesas y asignación a meseros. |
| 7 | Cocina | Estaciones de preparación, alertas de espera y la prueba de la voz de comandas. |
| 8 | Portal de comensales | Todos los ajustes del portal en un solo lugar (hoy partidos con Operación). |
| 9 | Productos e inventario | Categorías, unidades de medida, proveedores y vender sin existencia. |
| 10 | Personas y seguridad | Usuarios POS, «Pedir PIN al despertar» y el candado de los puestos de mando. |
| 11 | Sonidos y avisos | Qué suena en cada momento y el silencio de los avisos del administrador. |
| 12 | Datos | Exportar e importar (el «respaldo» de hoy). Sin Integraciones. |

**Sólo este aparato** (etiqueta fija «Sólo este aparato»; se guarda en el navegador o en este aparato, no en el negocio):

| # | Sección | Para qué sirve |
|---|---|---|
| 13 | Este aparato | Nombre del aparato, impresora y cajón, sonido, modo espera, voz, «Esta pantalla anuncia las comandas» y barra lateral. |

**Al final y discreto:**

| # | Sección | Para qué sirve |
|---|---|---|
| 14 | Laboratorio del proveedor | Entrada al laboratorio de impresión (clave del proveedor, sólo plataforma). |
| 15 | Mantenimiento | Reiniciar pruebas y reiniciar todo (sólo plataforma, como hoy). |
| 16 | Avanzado (plegado) | Lo que el Bloque 20 marque sin propósito para el restaurante y Miguel no haya decidido quitar, cada uno con su línea «qué era». |

Total: **16 entradas de navegación** (12 + 1 + 2 + 1). Orden de la lista, en tableta y PC: columna izquierda con los grupos y contenido a la derecha; en teléfono, lista de grupos y luego su página. Buscador «Buscar un ajuste» sobre la lista si alcanza el tiempo (se alimenta del mismo manifiesto de la prueba, §5).

Lo que hoy decide qué se ve y se conserva igual: `esDeMando` (dueño y administrador) para Caja, Descuentos, Datos, Integraciones; el módulo `mesas` para Mesas (`canAccessModule('mesas', paquete_modo)`); `administrador` + usuario de plataforma para Mantenimiento; `dueño` para el selector de estilo y los folios. Identidad, Apariencia (Morfi), Este aparato, Impresión, Sonidos y Usuarios se ven con el acceso a `/configuracion` (`ver_configuracion`, `permissions.js:102`) y cada tarjeta ya sabe si puede cambiar.

## 2. De dónde viene → a dónde va (cada tarjeta y control de hoy)

Convenciones: «Identidad» = `heredado/components/configuracion/IdentidadNegocio.jsx` (IdN), «Cfg» = `heredado/pages/Configuracion.jsx`. «Hoy» es el `?tab=`. Líneas de Cfg de la rama `dp-21-a`.

| # | Hoy (`?tab=`) | Tarjeta de hoy | Control | Archivo | → Sección | → Tarjeta nueva |
|---|---|---|---|---|---|---|
| 1 | identidad | Identidad del negocio | Nombre del negocio | IdN:254 | 1 El negocio | Datos del negocio |
| 2 | identidad | Identidad del negocio | Nombre del sistema | IdN:262 | 1 El negocio | Logo y marca |
| 3 | identidad | Identidad del negocio | Plataforma (marca) | IdN:270 | 1 El negocio | Logo y marca |
| 4 | identidad | Identidad del negocio | Logo del negocio | IdN:284 | 1 El negocio | Logo y marca |
| 5 | identidad | Identidad del negocio | Logo en tickets | IdN:290 | 4 Ticket y folios | Ticket |
| 6 | identidad | Identidad del negocio | Logo en PDFs | IdN:296 | 4 Ticket y folios | PDF del corte y reportes |
| 7 | identidad | Identidad del negocio | Fondo del sistema (imagen) | IdN:~310 | 2 Apariencia | Fondo |
| 8 | identidad | Identidad del negocio | Logo de fondo (marca de agua) | IdN:321 | 2 Apariencia | Fondo |
| 9 | identidad | Identidad del negocio | Opacidad del fondo | IdN:330 | 2 Apariencia | Fondo |
| 10 | identidad | Identidad del negocio | Ajuste del fondo | IdN:347 | 2 Apariencia | Fondo |
| 11 | identidad | Colores del sistema (`ColoresSistemaSection`, dentro de Identidad) | Color primario | ColoresSistemaSection.jsx | 2 Apariencia | Colores |
| 12 | identidad | Colores del sistema | Color de acento | ColoresSistemaSection.jsx:135 | 2 Apariencia | Colores |
| 13 | identidad | Colores del sistema | Restablecer colores | ColoresSistemaSection.jsx:85 | 2 Apariencia | Colores |
| 14 | identidad | Identidad del negocio | Pie del ticket térmico | IdN:378 | 4 Ticket y folios | Ticket |
| 15 | identidad | Identidad del negocio | Pie de los PDFs | IdN:386 | 4 Ticket y folios | PDF del corte y reportes |
| 16 | identidad | Identidad del negocio | Texto legal o pie general | IdN:394 | 4 Ticket y folios | PDF del corte y reportes |
| 17 | identidad | Identidad del negocio | Colorear importes monetarios | IdN:409 | 2 Apariencia | Importes en color |
| 18 | apariencia | Estilo del negocio | Estilo, densidad, redondeo, elevación, movimiento (+ Guardar) | `src/configuracion/SelectorDeApariencia.tsx` | 2 Apariencia | Estilo |
| 19 | apariencia | Experiencia del negocio | Mascota Morfi | `ExperienciaDelNegocio.tsx:100` | 2 Apariencia | Morfi |
| 20 | apariencia | Experiencia del negocio | Pedir PIN al despertar | `ExperienciaDelNegocio.tsx:110` | 10 Personas y seguridad | Pedir PIN al despertar |
| 21 | apariencia | Voz del dispositivo | Voz automática / voces / Escuchar | `ConfiguracionDeVoz.jsx:323-341` | 13 Este aparato | Voz de este aparato |
| 22 | apariencia | Voz del dispositivo | Velocidad de la voz | `ConfiguracionDeVoz.jsx:368` | 13 Este aparato | Voz de este aparato |
| 23 | apariencia | Voz del dispositivo | Probar voz | `ConfiguracionDeVoz.jsx:389` | 13 Este aparato | Voz de este aparato |
| 24 | aparato | Nombre de este aparato (Bloque 5) | Nombre del aparato | `TerminalesDeLaSucursal.tsx` (`AparatosDeLaSucursal`) | 13 Este aparato | Nombre de este aparato |
| 25 | aparato | Modo espera | Activar / minutos | `ModoEsperaDelAparato.tsx:74` | 13 Este aparato | Modo espera |
| 26 | aparato | Sonido de este aparato | Apagado / Suave / Normal, volumen | `SonidoDelAparato.tsx:92` | 13 Este aparato | Sonido de este aparato |
| 27 | aparato | Anuncio de comandas (Bloque 8) | Esta pantalla anuncia las comandas | `AnuncioDeComandasDelAparato.tsx` | 13 Este aparato | Esta pantalla anuncia las comandas |
| 28 | impresion | Impresión de este aparato | Estado de la app, impresora, perfil | `ImpresionDelAparato.tsx` / `ImpresoraLista` | 13 Este aparato | Impresora y cajón |
| 29 | impresion | Impresión de este aparato | Probar impresión | `ImpresionDelAparato.tsx` / `BotonDePrueba.tsx` | 13 Este aparato | Impresora y cajón |
| 30 | impresion | Impresión de este aparato | Abrir el cajón (prueba del cajón, Bloque 7) | `BotonAbrirCajon` / `LabProbarCajon.tsx` | 13 Este aparato | Impresora y cajón |
| 31 | impresion | Ajustes de la app | Ajustes de la app de POS (sólo dentro de la app) | `AjustesDeLaApp.tsx:204` | 13 Este aparato | Impresora y cajón |
| 32 | sonidos | Sonidos de cada momento | Mapa momento → sonido + «Oír» | `SonidosDelNegocio.tsx:~100` | 11 Sonidos y avisos | Sonidos de cada momento |
| 33 | sonidos | Teclado y portal | Sonido del teclado (`tecla`) | `SonidosDelNegocio.tsx:120` | 11 Sonidos y avisos | Sonidos de cada momento |
| 34 | sonidos | Teclado y portal | Sonidos en el portal del comensal | `SonidosDelNegocio.tsx:162` | 11 Sonidos y avisos | Sonidos de cada momento |
| 35 | sonidos | Voz de las comandas | Probar la voz de las comandas | `PruebaDeLaVozDeComandas.tsx` | 7 Cocina | Voz de las comandas (prueba) |
| 36 | negocio | Datos del negocio | Dirección | Cfg:571 | 1 El negocio | Datos del negocio |
| 37 | negocio | Datos del negocio | Teléfono | Cfg:579 | 1 El negocio | Datos del negocio |
| 38 | negocio | Datos del negocio | Correo | Cfg:586 | 1 El negocio | Datos del negocio |
| 39 | negocio | Datos del negocio | Mensaje en ticket | Cfg:593 | 4 Ticket y folios | Ticket |
| 40 | negocio | Datos del negocio | Ancho del papel del ticket | Cfg:601 | 4 Ticket y folios | Ticket |
| 41 | negocio | Datos del negocio | Usar mesas | Cfg:621 | 6 Salón (escondido en restaurante; fuera de restaurante, 16 Avanzado) | Usar mesas |
| 42 | negocio | Datos del negocio | Permitir venta sin stock | Cfg:628 | 9 Productos e inventario | Vender sin existencia |
| 43 | negocio | Datos del negocio · Propinas | Activar propinas | Cfg:640 | 3 Ventas y cobro | Propinas |
| 44 | negocio | Datos del negocio · Propinas | Porcentajes sugeridos | Cfg:654 | 3 Ventas y cobro | Propinas |
| 45 | negocio | Datos del negocio | Abrir PDF automático al cerrar caja | Cfg:670 | 5 Caja | PDF del corte al cerrar |
| 46 | negocio | Asignación de mesas y notificaciones | Asignación de mesas a meseros | Cfg:686 | 6 Salón | Asignación de mesas |
| 47 | negocio | Asignación de mesas y notificaciones | Silenciar notificaciones del administrador | Cfg:702 | 11 Sonidos y avisos | Avisos del administrador |
| 48 | negocio | Pedidos desde Portal QR | Permitir pedidos del comensal (`portal_qr_permitir_pedidos_cliente`; sólo con módulo mesas) | Cfg:727 | 8 Portal de comensales | Pedidos |
| 49 | negocio | Datos del negocio | «Guardar configuración» (botón general de la tarjeta) | Cfg: botón al final de la tarjeta | — (desaparece; cada tarjeta guarda lo suyo) | cada tarjeta nueva |
| 50 | negocio | IVA (Bloque 1) | Sin IVA / 8 % / 16 % + «precios incluyen IVA» | `IvaDelNegocio.tsx` (Cfg:752) | 3 Ventas y cobro | IVA |
| 51 | negocio | Quién elige la propina (Bloque 4) | Comensales / Mesero / Caja | `QuienEligeLaPropina.tsx` (Cfg:754) | 3 Ventas y cobro | Quién elige la propina |
| 52 | negocio | Folios (Bloque 6) | Prefijo del folio | `FoliosDelNegocio.tsx` (Cfg:755) | 4 Ticket y folios | Folios |
| 53 | negocio | Folios (Bloque 6) | Primer folio de las cuentas | `FoliosDelNegocio.tsx` | 4 Ticket y folios | Folios |
| 54 | negocio | Folios (Bloque 6) | Primer folio de los cortes | `FoliosDelNegocio.tsx` | 4 Ticket y folios | Folios |
| 55 | negocio | Estaciones de preparación | Activar estaciones | Cfg:777 | 7 Cocina | Estaciones de preparación |
| 56 | negocio | Estaciones de preparación | Alta, edición, orden, baja y «estación general» | `EstacionesPreparacionSection.jsx` (Cfg:801) | 7 Cocina | Estaciones de preparación |
| 57 | negocio | Alertas de espera de cocina | Minutos de ámbar y de rojo | `src/cocina/AlertasDeEspera.tsx` (Cfg:809) | 7 Cocina | Alertas de espera |
| 58 | negocio | Categorías de producto | CRUD de categorías (y su estación) | `CategoriasProductoSection.jsx` (Cfg:819) | 9 Productos e inventario | Categorías |
| 59 | negocio | Unidades de medida | Lista de unidades | `UnidadesMedidaSection.jsx` (Cfg:824) | 9 Productos e inventario | Unidades de medida |
| 60 | negocio | Proveedores | CRUD de proveedores | `ProveedoresSection.jsx` (Cfg:829) | 9 Productos e inventario | Proveedores |
| 61 | negocio | Copias de impresión | Copias de ticket, precuenta y corte | `src/impresion/pantallas/CopiasDeImpresion.tsx` (Cfg:833) | 4 Ticket y folios | Copias de impresión |
| 62 | negocio | Laboratorio | Entrar / salir del laboratorio del proveedor | `EntradaAlLaboratorio.tsx` (Cfg:834) | 14 Laboratorio del proveedor | Entrada al laboratorio |
| 63 | usuarios | Usuarios POS | Alta, edición, puesto, activar y desactivar (y el PIN, sin mostrarlo) | `UsuariosPOSSection.jsx` | 10 Personas y seguridad | Usuarios POS |
| 64 | caja | Cajas a la vez (Bloque 5) | Cuántas cajas puede haber abiertas | `CajaYDescuentos.tsx:42` | 5 Caja | Las cajas |
| 65 | caja | Cajas a la vez | Nombres de las cajas | `NombresDeLasCajas.tsx` (dentro de la tarjeta anterior) | 5 Caja | Las cajas |
| 66 | caja | PIN en retiros | Monto en pesos desde el que se pide PIN de gerente | `UmbralDeRetiro.tsx:95` | 5 Caja | PIN en retiros |
| 67 | caja | Candado de los puestos de mando (Bloque 2) | Minutos sin uso (5 a 30) | `CandadoDeMando.tsx:83` | 10 Personas y seguridad | Candado de los puestos de mando |
| 68 | descuentos | Permitir descuentos | Permitir descuentos (sí/no) | `CajaYDescuentos.tsx:125` | 3 Ventas y cobro | Descuentos |
| 69 | descuentos | Permitir descuentos | Tabla de topes por puesto (sólo lectura) | `CajaYDescuentos.tsx:193` | 3 Ventas y cobro | Descuentos |
| 70 | mesas | Mapa de mesas | Nueva mesa, editar, reordenar, reactivar | Cfg:879… + `MesaEditDialog.jsx` | 6 Salón | Mapa de mesas |
| 71 | mesas | Mapa de mesas | Zonas | `ZonasDelSalonDialog.jsx` | 6 Salón | Mapa de mesas |
| 72 | mesas | Mapa de mesas | Repartir mesas (dueño, administrador, gerente) | `RepartirMesasDialog.jsx` | 6 Salón | Mapa de mesas |
| 73 | mesas | Mapa de mesas | Eliminar todas (mesas demo; sólo plataforma) | Cfg:~892 | 6 Salón | Mapa de mesas (sólo plataforma) |
| 74 | datos | Base de datos y respaldo | Exportar (por sección y todo) | `ExportarDatos.jsx` | 12 Datos | Exportar |
| 75 | datos | Base de datos y respaldo | Importar y plantillas | `ImportarDatos.jsx` | 12 Datos | Importar |
| 76 | integraciones | Integraciones en la nube | Google Sheets · conectar | `IntegracionesRespaldos.jsx:96-105` | **Se quita** (encargo) | — |
| 77 | integraciones | Integraciones en la nube | Google Drive · conectar | `IntegracionesRespaldos.jsx` | **Se quita** (encargo) | — |
| 78 | integraciones | Cola de sincronización pendiente | Lista de pendientes y fallidos (`IntegrationSyncLog`) | `IntegracionesRespaldos.jsx:123` | **Se quita con Integraciones** (ver duda 3) | — |
| 79 | mantenimiento | Reiniciar sistema | Reiniciar pruebas | `ReiniciarSistemaSection.jsx:167` | 15 Mantenimiento | Reiniciar pruebas |
| 80 | mantenimiento | Reiniciar sistema | Reiniciar todo | `ReiniciarSistemaSection.jsx:185` | 15 Mantenimiento | Reiniciar todo |
| 81 | portal-qr · «Configuración» | Portal QR | Activar Portal QR | `portalqr/ConfiguracionQRTab.jsx:137` | 8 Portal de comensales | Activación y menú |
| 82 | portal-qr | Portal QR | Cómo se ve el menú | `ConfiguracionQRTab.jsx:146` | 8 Portal de comensales | Activación y menú |
| 83 | portal-qr | Portal QR | Mostrar precios | `ConfiguracionQRTab.jsx:165` | 8 Portal de comensales | Activación y menú |
| 84 | portal-qr | Portal QR | Mostrar productos sin imagen | `ConfiguracionQRTab.jsx:171` | 8 Portal de comensales | Activación y menú |
| 85 | portal-qr | Portal QR | Mensaje de bienvenida | `ConfiguracionQRTab.jsx:311` | 8 Portal de comensales | Activación y menú |
| 86 | portal-qr | Portal QR | Quién manda a cocina | `ConfiguracionQRTab.jsx:186` | 8 Portal de comensales | Pedidos |
| 87 | portal-qr | Portal QR | Los comensales abren su mesa | `ConfiguracionQRTab.jsx:203` | 8 Portal de comensales | Pedidos |
| 88 | portal-qr | Portal QR | «Quiero ordenar» | `ConfiguracionQRTab.jsx:224` | 8 Portal de comensales | Pedidos |
| 89 | portal-qr | Portal QR | «Pedir cuenta» | `ConfiguracionQRTab.jsx:230` | 8 Portal de comensales | Cuenta y propina |
| 90 | portal-qr | Portal QR | «Necesito ayuda» | `ConfiguracionQRTab.jsx:236` | 8 Portal de comensales | Cuenta y propina |
| 91 | portal-qr | Portal QR | Quién dispara la propina (`portal_qr_cuenta_modo`) | `ConfiguracionQRTab.jsx:259` | 8 Portal de comensales | Cuenta y propina |
| 92 | portal-qr | Portal QR | Mostrar precuenta al cliente | `ConfiguracionQRTab.jsx:277` | 8 Portal de comensales | Cuenta y propina |
| 93 | portal-qr | Portal QR | Propina elegida por el comensal | `ConfiguracionQRTab.jsx:286` | 8 Portal de comensales | Cuenta y propina |
| 94 | portal-qr | Portal QR | «Guardar» general de la pestaña | `ConfiguracionQRTab.jsx:321` | — (desaparece; las tres tarjetas guardan lo suyo) | cada tarjeta |
| 95 | portal-qr · Menú | Botones del menú QR | Editor de botones (`portal_qr_botones`) | `src/restaurante/menu-qr/EditorDeBotones.tsx` | **Se queda en la pantalla Portal QR** (lo operativo/diseño; enlace desde sección 8) | — |
| 96 | portal-qr · Menú | Aspecto del portal | Tema (`portal_qr_tema`) | `AspectoDelPortal.tsx` | Se queda en Portal QR (con enlace) | — |
| 97 | portal-qr · Mesas | Diseño de los QR de mesas | `qr_de_mesas` | `qr-de-mesas/*` | Se queda en Portal QR (con enlace) | — |
| 98 | (ninguna) | — | Barra lateral recogida/abierta | `AppLayout.jsx:35` (`useState`, sin control) | 13 Este aparato | Barra lateral (control nuevo; ver duda 6) |

**Recuento:** 98 filas. 89 controles o piezas de hoy cambian de lugar (74 de las pestañas, 2 de Mantenimiento y 13 del portal), 3 editores del portal se quedan donde están con enlace (95 a 97), 3 se quitan con Integraciones (76 a 78), 2 botones generales desaparecen al dar a cada tarjeta su propio guardado (49 y 94) y 1 control no existe y el encargo pide crearlo (98). **Ningún control queda sin destino.** Tarjetas nuevas: **47** (§4).

## 3. Los `?tab=` viejos

El enrutado conserva `/configuracion?tab=<viejo>` y lo lleva a `/configuracion?seccion=<id>` (URL nueva; el `?tab=` queda como alias permanente y no se retira). Un `?tab=` que hoy no se ve para ese puesto sigue sin verse: cae en la primera sección permitida, sin mensaje de error (hoy el contenido simplemente no se pinta).

| `?tab=` | → Sección | Ancla dentro | Quién lo usa hoy |
|---|---|---|---|
| `identidad` (por omisión sin `?tab`) | 1 El negocio | — | Pantalla por omisión; `PrimerosPasosCard.jsx:34` (sin tab) |
| `apariencia` | 2 Apariencia | — | `AccesosDelDueno.tsx:24`; `espera/reglas.test.ts:59`; e2e `estilos-del-negocio`, `morfi` |
| `aparato` | 13 Este aparato | — | e2e `modo-espera`, `sonidos` |
| `impresion` | 13 Este aparato | `#impresora-y-cajon` | `BarraDeImpresion.tsx:79`; e2e `impresion-por-la-app` |
| `sonidos` | 11 Sonidos y avisos | — | `sonidos.test.ts:164`; e2e `sonidos.spec.ts:122` |
| `negocio` | 3 Ventas y cobro | ver duda 2 | e2e `estaciones-de-punta-a-punta`, `impresion-por-la-app:51`, `qa1-00-preparar:99` |
| `usuarios` | 10 Personas y seguridad | `#usuarios-pos` | e2e `usuarios-y-mesas` (3 sitios) |
| `caja` | 5 Caja | — | e2e `cajas-del-negocio.spec.ts:25` |
| `descuentos` | 3 Ventas y cobro | `#descuentos` | — |
| `mesas` | 6 Salón | `#mapa-de-mesas` | `AccesosDelDueno.tsx:18`; `textos-de-carga.test.ts:17`; e2e `estados-de-mesa`, `mesas-tres-y-veinticinco`, `restaurante`, `qa1-00`, `qa1-07`, `qa1-08`, `usuarios-y-mesas:249` |
| `datos` | 12 Datos | — | — |
| `integraciones` | 12 Datos | — (la tarjeta ya no existe) | — |
| `mantenimiento` | 15 Mantenimiento | — | e2e `qa1-07-purgas` (por la pestaña de mesas) |
| (otro valor) | la primera permitida | — | — |

Enlaces sin `?tab=` a `/configuracion` (`PrimerosPasosCard.jsx:34-38`, `RestrictedRoute.jsx:25`) siguen sin cambio. Se propone que Primeros pasos apunte con ancla a la sección nueva de cada paso (negocio, usuarios, mesas, categorías, unidades).

## 4. Qué guarda cada tarjeta nueva y con qué

«Genérico» = `api.entidades.ConfiguracionNegocio.update` (puente, `guardarConfiguracionParcial`, mezcla sólo las claves del parche). «Aparato» = almacenamiento del navegador de este aparato (no sale al servidor). Esta tabla es la que usa la prueba «cada tarjeta guarda sólo lo suyo»: lo enviado ha de ser subconjunto de la columna «Guarda».

| Sección | Tarjeta nueva | Guarda (clave o entidad) | Con qué |
|---|---|---|---|
| 1 | Datos del negocio | `nombre_negocio` (columna de `organizaciones`), `direccion`, `telefono`, `correo` | Genérico |
| 1 | Logo y marca | `logo_url`, `nombre_sistema`, `platform_brand` | Genérico |
| 2 | Estilo | estilo, densidad, redondeo, elevación, movimiento (sólo dueño) | `configuracion.fijar_apariencia` (`/api/configuracion/apariencia`) |
| 2 | Colores | `color_primario`, `color_acento` | Genérico |
| 2 | Fondo | `background_image_url`, `background_logo_url`, `background_opacity`, `background_fit` | Genérico |
| 2 | Importes en color | `colorear_importes_monetarios` | Genérico |
| 2 | Morfi | `experiencia.mascota` | `/api/datos/escribir` (ConfiguracionNegocio, parche `experiencia`) |
| 3 | IVA | `impuesto` | `configuracion.fijar_impuesto` |
| 3 | Propinas | `propinas_activas`, `propina_porcentajes_sugeridos` | Genérico |
| 3 | Quién elige la propina | `propina_la_elige_mesero`, `propina_la_elige_caja` (la del comensal es `portal_qr_permitir_propina_cliente`, ver duda 8) | `configuracion.fijar_quien_elige_la_propina` |
| 3 | Descuentos | `descuentos_permitidos` | `configuracion.permitir_descuentos` |
| 4 | Ticket | `mensaje_ticket`, `ancho_papel_ticket`, `ticket_footer`, `logo_ticket_url` | Genérico |
| 4 | PDF del corte y reportes | `pdf_footer`, `footer_text`, `logo_pdf_url` | Genérico |
| 4 | Folios | `folios` (prefijo, primer folio de cuentas y de cortes) | `configuracion.fijar_folios` (sólo dueño) |
| 4 | Copias de impresión | `copias_de_impresion` | `caja.fijar_copias_de_impresion` |
| 5 | Las cajas | `sucursales.cajas_simultaneas`; `nombres_de_cajas` | `caja.fijar_cajas_simultaneas`; `caja.nombrar_cajas` |
| 5 | PIN en retiros | `retiro_pin_arriba_de_centavos` | `caja.fijar_umbral_de_retiro` |
| 5 | PDF del corte al cerrar | `descargar_pdf_corte_auto` | Genérico |
| 6 | Mapa de mesas | filas de `Mesa` y `Zona` (puente); reparto de mesas; baja masiva (plataforma) | entidades del puente y comandos del salón |
| 6 | Asignación de mesas | `asignacion_mesas_activa` | Genérico |
| 6 | Usar mesas | `usa_mesas` | Genérico |
| 7 | Estaciones de preparación | `estaciones_preparacion_activas`; filas de `EstacionPreparacion` | Genérico; `restaurante.crear_estacion`, `marcar_estacion_general`, entidad |
| 7 | Alertas de espera | `cocina_alerta_ambar_min`, `cocina_alerta_roja_min` | Genérico (el servidor valida ámbar < rojo) |
| 7 | Voz de las comandas (prueba) | nada | — |
| 8 | Activación y menú | `portal_qr_activo`, `portal_qr_modo_menu`, `portal_qr_mostrar_precios`, `portal_qr_mostrar_sin_imagen`, `portal_qr_mensaje_bienvenida` | Genérico |
| 8 | Pedidos | `portal_qr_envia_a_cocina`, `portal_qr_comensales_abren_mesa`, `portal_qr_permitir_pedidos_cliente`, `portal_qr_permitir_ordenar` | Genérico |
| 8 | Cuenta y propina | `portal_qr_permitir_cuenta`, `portal_qr_permitir_ayuda`, `portal_qr_cuenta_modo`, `portal_qr_mostrar_precuenta`, `portal_qr_permitir_propina_cliente` | Genérico |
| 9 | Categorías | filas de `CategoriaProducto` | entidad del puente |
| 9 | Unidades de medida | `unidades_medida_lista` | Genérico |
| 9 | Proveedores | filas de `Proveedor` | entidad del puente |
| 9 | Vender sin existencia | `permitir_venta_sin_stock` | Genérico (hoy desconectado; Bloque 14) |
| 10 | Usuarios POS | filas de empleados y su PIN (sin mostrarlo) | `/api/identidad/empleados` |
| 10 | Pedir PIN al despertar | `experiencia.pin_al_despertar` | `/api/datos/escribir` (parche `experiencia`) |
| 10 | Candado de los puestos de mando | `candado_de_mando_min` | `configuracion.fijar_candado_de_mando` |
| 11 | Sonidos de cada momento | `experiencia.tecla`, `experiencia.sonidos_en_el_portal` (el mapa momento → sonido es de sólo lectura) | `/api/datos/escribir` |
| 11 | Avisos del administrador | `silenciar_notificaciones_admin` | Genérico |
| 12 | Exportar | nada (descarga) | — |
| 12 | Importar | filas de las entidades importadas | `ImportarDatos.jsx` |
| 13 | Nombre de este aparato | `terminales.nombre` | `caja.nombrar_terminal` |
| 13 | Impresora y cajón | perfil de impresión de este aparato; ajustes de la app | Aparato / app nativa |
| 13 | Sonido de este aparato | `morphiqpos.sonidos` | Aparato |
| 13 | Modo espera | `morphiqpos.modo-espera` | Aparato |
| 13 | Voz de este aparato | `mh_voice_manual`, `mh_voice_rate` | Aparato |
| 13 | Esta pantalla anuncia las comandas | `morphiqpos.cocina-anuncia` | Aparato |
| 13 | Barra lateral (nueva) | clave nueva de aparato | Aparato |
| 14 | Entrada al laboratorio | sesión de proveedor | `/api/proveedor/entrar`, `salir` |
| 15 | Reiniciar pruebas / Reiniciar todo | borra datos (confirmación por nombre del negocio) | `mantenimiento.reiniciar_pruebas`, `mantenimiento.reiniciar_todo` |

**Ninguna clave en dos tarjetas.** Una pantalla de hoy que muestra la misma clave en dos sitios se resuelve así: `propinas_activas` se escribe sólo en «Propinas» (el portal la muestra como lectura con enlace); `silenciar_notificaciones_admin` sólo en «Avisos del administrador».

## 5. La prueba automática de inventario (antes y después)

**Antes (se escribe ANTES de mover nada, desde el commit de hoy).** Un guion `scripts/inventariar-configuracion.mjs` abre la Configuración real (Playwright, base desechable) una vez por puesto (dueño, administrador, gerente, cajero, mesero, cocina, almacén, y dueño de plataforma) y por cada pestaña visible recorre el árbol de accesibilidad (`role`, nombre accesible, tipo: interruptor, texto, número, selección, botón, radio, enlace; deshabilitado o no). A cada control le cruza su clave o comando con el manifiesto de la §4 (hecho a mano y revisado una vez). Salida: `docs/configuracion-inventario-antes.json`, ordenado, con `{ puesto, pestaña, tarjeta, etiqueta, tipo, clave, comando, puedeCambiar }`. El archivo se confirma con el commit previo a la mudanza y NO se vuelve a generar: es la fotografía contra la que se compara.

**Después (prueba que corre siempre, en vitest + Playwright).**
1. Para cada fila del archivo «antes», encuentra el control por etiqueta y tipo dentro de la sección y tarjeta que dice el manifiesto (`docs/configuracion-inventario-destino.json`, que es la §2 en JSON). Falla si falta uno, y falla si está en más de un sitio. Los tres de Integraciones y los dos botones generales llevan `destino: "quitado"` con su razón; cualquier otra excepción necesita razón escrita.
2. Cada `?tab=` de la §3 redirige a su sección, y un `?tab=` no permitido para el puesto no abre nada que ese puesto no veía.
3. Permisos: por puesto, el conjunto de controles visibles y editables después es igual al de antes (la tarjeta que no puede cambiar dice quién puede).
4. «Cada tarjeta guarda sólo lo suyo»: se intercepta la petición de guardado de cada tarjeta y se comprueba que sus claves son subconjunto de la columna «Guarda» de la §4. Y una prueba estática comprueba que ninguna clave aparece en dos tarjetas.
5. Salir con cambios sin guardar avisa (una prueba por tipo de tarjeta de formulario).
6. Siguen en verde `pruebas/e2e/estilos-del-negocio.spec.ts` y las demás que tocan la Configuración (lista en la §3), actualizadas a los nombres nuevos sólo donde la ruta lo exige.

Qué cuenta la prueba: etiquetas, tipos, claves y permisos; no pixeles. De dónde saca el «antes»: del archivo confirmado antes de la mudanza, nunca de la pantalla nueva.

## 6. Dudas y choques con el encargo

1. **Son 13 pestañas, no 14.** El encargo y el mapa usan los 13 `?tab=` de la lista; confirmo que no falta ninguno.
2. **`?tab=negocio` es ambiguo.** Hoy es una sola pestaña con unas 25 piezas que el mapa reparte en 9 secciones, y 12 specs e2e entran por ahí para cosas distintas (estaciones → Cocina, ancho de papel → Ticket, qa1-00 → varios). Propongo: `?tab=negocio` va a «Ventas y cobro» y los specs se actualizan a `?seccion=…` en la mudanza; si se prefiere no tocarlos, aceptar `?tab=negocio&campo=…`.
3. **«Integraciones» incluye la «Cola de sincronización pendiente»** (`IntegrationSyncLog`: pendientes y fallidos), no sólo los botones de Google. Quitar Integraciones quita esa lista. Si hay filas fallidas guardadas, desaparecen de la vista (siguen en la base y las purga `reiniciar_todo`). Confirmar que va también.
4. **Hoy ya no existe un «Guardar» que mande todo el formulario** (DP-18 manda sólo lo cambiado), pero sí un botón único que guarda 13 claves a la vez en Operación y otro en Identidad y en el portal; además Estaciones y Alertas de espera llaman a ese mismo guardado (`onGuardar={saveBiz}`). Hay que partirlos en tarjetas (47 en total); las que usan el camino genérico no necesitan comando nuevo. Falta verificar qué puesto acepta el servidor en el camino genérico para cada clave (hoy lo decide el puente, no la pantalla): si una tarjeta debe ser sólo-dueño y el genérico la deja pasar a un administrador, hace falta comando.
5. **El conteo de «controles»** depende de cómo se cuente un CRUD (mesas, usuarios, proveedores, categorías, estaciones): cada uno es una pieza con muchas filas. Las cuento como un control por tarjeta.
6. **«La barra lateral» en Este aparato no existe como ajuste.** Hoy se recoge con un botón y su estado es `useState` de `AppLayout.jsx:35` (se pierde al recargar). Crearlo es un control nuevo, no una mudanza. Propongo hacerlo (interruptor y clave de aparato) o dejarlo fuera de este bloque.
7. **«Usar mesas» y otros escondidos.** `usa_mesas` está desconectado (anexo 1B: «lo decide Miguel») y el mapa lo manda a «escondido en el restaurante». Un control escondido no puede pasar la prueba «cada ajuste sigue existiendo»: va en «Avanzado» para los demás giros y queda con razón escrita en el manifiesto para el restaurante. Lo mismo para `permitir_venta_sin_stock` (desconectado), `silenciar_notificaciones_admin` (roto, anexo 1B) y `footer_text` (sin lector): se mudan con su estado, y Avanzado sólo recibe lo que el Bloque 20 confirme.
8. **Dos ajustes parecidos para lo mismo.** «¿Quién puede elegir la propina?» (Bloque 4: comensales, mesero, caja) y «Quién dispara la propina» del portal (`portal_qr_cuenta_modo`) más «Propina elegida por el comensal» (`portal_qr_permitir_propina_cliente`). Son claves distintas con efectos solapados; «cada ajuste en un solo lugar» no las obliga a fundirse, pero conviene que Miguel decida si «Comensales» de la tarjeta de Ventas y la del portal son la misma cosa. Las dejo cada una en su tarjeta, con un enlace cruzado.
9. **Mitad del portal se queda fuera.** Botones del menú, aspecto del portal y diseño de los QR de mesas (filas 95 a 97) tienen su editor en la pantalla Portal QR y no son «ajustes» de formulario. Los dejo allí con enlace desde la sección 8, como pide el encargo («lo operativo»). Sólo la pestaña «Configuración» del Portal QR (filas 81 a 94) se muda; la pestaña desaparece o queda como enlace.
10. **«Lo de la voz de las comandas que es del negocio» (Cocina).** No hay hoy un ajuste de voz del negocio: la voz es de cada aparato (`mh_voice_*`) y el anuncio de comandas también (`morphiqpos.cocina-anuncia`). Lo único que toca Cocina es el botón de prueba (fila 35). Propongo Cocina con esa prueba y dejar el resto en Este aparato.
11. **Choques de nombres con el Bloque 6 ya unido.** Mi tarjeta «Folios» está hoy montada debajo de IVA en la pestaña `negocio` (no en «Ticket y folios»); el candado de mando está en la pestaña `caja`; `QuienEligeLaPropina` en `negocio`. Los tres cambian de sección en la mudanza (Ticket y folios; Personas y seguridad; Ventas y cobro). El Bloque 12 (qué sale en precuenta y ticket) aún no está en `dp-21-a`: nace directo en «Ticket y folios». El PDF del corte y «su carpeta» (Bloque 18) sólo existe hoy como el interruptor `descargar_pdf_corte_auto`; la carpeta no.
12. **Permisos que hoy no se corresponden con el título del encargo.** El encargo dice «Del negocio: dueño o administrador», pero hoy son sólo-dueño el estilo (`SelectorDeApariencia`) y los folios, y Usuarios, Sonidos y Este aparato se ven con el acceso general a la pantalla. La mudanza conserva cada tarjeta con su permiso actual y escribe en ella «Lo cambia el dueño» o «el dueño o el administrador»; no ensancha ni estrecha nada.
13. **Mantenimiento tiene dos puertas distintas hoy.** La pestaña `mantenimiento` exige `rol === 'administrador'` y usuario de plataforma; la baja masiva de mesas demo (dentro de Mesas) exige usuario de plataforma y el permiso `eliminar_mesas`. Se conservan por separado: la baja masiva sigue en Salón, sólo para plataforma.
14. **Estado por aparato.** Las tarjetas de Este aparato guardan al instante en el navegador (no hay botón ni «Guardado»), y la regla «cada tarjeta con su botón y su “Guardado”» no les aplica igual. Propongo mantenerles su comportamiento y ponerles la etiqueta «Sólo este aparato».

## 7. Cómo quedó la mudanza (PR B)

Lo que se hizo, y en qué se apartó del mapa de arriba (las decisiones de la coordinación, por omisión):

- **Dieciséis secciones, 49 tarjetas** (`apps/web/src/configuracion/secciones.ts` es el mapa vivo: ids, sección, quién la ve, qué claves guarda y con qué). La dirección nueva es `/configuracion?seccion=<id>`; los `?tab=` de antes siguen sirviendo y llevan a su sección (§3), con ancla a la tarjeta cuando apuntaban a una (`impresion`, `usuarios`, `descuentos`, `mesas`).
- **`?tab=negocio` → «Ventas y cobro»** (duda 2). Las especificaciones y ayudantes e2e que entraban por ahí ya usan la sección que corresponde (`?seccion=ticket-y-folios`, `?seccion=cocina`, `?seccion=salon`, `?seccion=portal`).
- **«Integraciones» se quita completa, con su «Cola de sincronización»** (duda 3): el componente `IntegracionesRespaldos.jsx` se borró y con él las dos lecturas de `IntegrationSyncLog` y sus invalidaciones. Caja sigue encolando al cerrar (no se tocó el servidor); sólo ya no hay pantalla que la muestre.
- **Cada tarjeta guarda lo suyo** (duda 4). El formulario único de Operación se partió: `TarjetaDeAjustes` (campos declarados en `ajustes-de-tarjetas.ts`), `IdentidadNegocio` por grupo (marca, logos del ticket y de los PDF, fondo, importes), `ConfiguracionQRTab` por grupo (activación y menú, pedidos, cuenta y propina), `EstacionesDeCocina` y `AlertasDeEsperaDeCocina`. Todas mandan sólo el parche de lo que cambió por la misma escritura del puente de antes: **no hizo falta ningún comando nuevo y no se abrió ningún permiso** (el camino genérico ya aceptaba a quien hoy guarda; lo que el servidor niega por puesto, se sigue negando).
- **Salir con cambios sin guardar avisa**: `cambios-sin-guardar.ts` (cada tarjeta con formulario dice si tiene algo sin guardar; la pantalla pregunta antes de cambiar de sección y el navegador antes de cerrar).
- **«Barra lateral»** (duda 5) usa la elección que ya recuerda `use-barra-lateral` (`localStorage['mpos.barra-lateral']`); no hay otra clave.
- **Avanzado (plegado)** (duda 6): `Usar mesas`, `Permitir venta sin stock` y `Texto legal o pie general`, cada uno con su línea «qué era». Nada se borró; `permitir venta sin stock` pasa a Productos e inventario cuando el Bloque 14 lo conecte.
- **Diferencias con la tabla de §2** (cosméticas): el «Logo en tickets» y el «Logo en PDFs» van en una tarjeta propia, «Logos del ticket y de los PDF» (Ticket y folios); «Quiero ordenar» pasa con «Pedir cuenta» y «Necesito ayuda» a «Cuenta y propina desde QR» (los tres botones de atención siguen juntos); «Silenciar notificaciones del administrador» queda en «Avisos del administrador» (Sonidos y avisos).
- **Bloque 12 (hecho)**: junto a la tarjeta «Ticket» (mensaje, ancho y pie) vive «El ticket a tu gusto» (`PapelATuGusto.tsx`): qué renglones salen en la precuenta y en el ticket de venta, con vista previa en vivo. Se guarda con `caja.fijar_papel_a_tu_gusto` (dueño o administrador) en `configuracion.valores.papel_a_tu_gusto`.
- **La prueba**: `docs/configuracion-inventario-antes.json` es la fotografía de la Configuración de antes (223 controles de 36 archivos; la escribe `scripts/inventariar-configuracion.mjs` desde el commit 68cacde y NO se regenera); `apps/web/src/configuracion/mudanza.contrato.test.ts` busca cada uno en su lugar nuevo (`inventario/destinos.ts`) y falla si falta alguno; además comprueba que ninguna clave se guarde desde dos tarjetas, que cada tarjeta guarde sólo las suyas, que los trece `?tab=` lleven a su sección y que los permisos por puesto no cambien.
- **Bloque 20 (PR B)**: tarjeta «El corte de la caja» en Caja (`CorteDeLaCaja.tsx`, `caja.fijar_ajustes_del_corte`, dueño o administrador): «El cajero ve costos y utilidad en su corte» (`mostrar_costos_a_caja`) y «Comisión de la terminal (%)» (`comision_terminal_bp`, en puntos base). Campo «RFC» en «Datos del negocio» (`rfc`, 12 o 13 caracteres en mayúsculas). «Eliminar corte» (Registros) sólo se ofrece al dueño y «Vaciar todas» (solicitudes QR) sólo a dueño y administrador, como sus comandos.
