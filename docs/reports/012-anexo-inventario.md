# 012 · Anexo · Inventario de lo desconectado, roto o sin propósito (DP-21 · Bloque 20, parte de lectura de código)

- **Fecha:** 15-11-2026 · **Rama:** `dp-21-ag2` · **Alcance:** sólo lectura de código. No se tocó código de la app, ni producción, ni Supabase, ni Vercel. No se corrió la app.
- **Cómo se hizo:** cada clave de `CLAVES_EDITABLES`, `PUBLICOS` y `CONFIG_POR_OMISION` y cada valor de `ConfigContext.jsx` se buscó con `grep -w` en `apps/web/heredado`, `apps/web/src`, `apps/web/app`, `packages/app/src` y `scripts` (sin pruebas). Las rutas `/api/...` se cruzaron con `apps/web/app/api/**/route.ts` y con `pruebas/e2e/matriz-de-permisos.json`; el catálogo de comandos se generó con `node scripts/generar-catalogo-comandos.mjs` (salida a un archivo temporal, sin tocar el repo).
- **Estados:** `funciona` · `desconectado` (debería funcionar y no está conectado) · `roto` (falla o promete más de lo que hace) · `sin propósito` (no sirve en una barbacoa; se esconde para el paquete restaurante, no se borra, lo decide Miguel).
- **Rutas:** todas relativas a la raíz del repo. `puente/configuracion.ts` es `packages/app/src/puente/configuracion.ts`.
- **Resumen al final (§7):** primero lo que toca dinero, seguridad o datos; después lo demás.
- **Sin secretos, PIN ni correos reales** en este documento.

Diferencias entre el encargo y el repo (gana el repo):

1. El encargo dice que `usa_barra`, `usa_cocina` y `formato_export_default` «no los lee nadie»: confirmado, y tampoco los escribe ninguna pantalla.
2. La pantalla del portal es `apps/web/heredado/pages/PortalQR.jsx` y su pestaña de ajustes está en `apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx`.
3. El crédito de marca que hoy se imprime en el acceso dice «Sistema por Morphiq» (`apps/web/src/marca/contenido.ts:14`), no «Hecho por MORPHIQ».
4. `apps/web/heredado/pages/Barra.jsx` existe pero no tiene ruta en `apps/web/app/**` (§3).

---

## 1 · Los ajustes

### 1A · Listas y valores por omisión

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| `CONFIG_POR_OMISION` (35 claves) | packages/app/src/puente/configuracion.ts:35-84 | funciona | `leerConfiguracion` la mezcla bajo lo guardado (`:381-383`). Varias claves no las lee nadie: ver 1E | Sin cambio. Conectar o esconder las claves marcadas en 1E |
| `DEFAULT_CONFIG` del navegador | apps/web/heredado/lib/ConfigContext.jsx:25-67 | funciona | Se mezcla bajo lo leído (`:89-107`). Le faltan `descuentos_permitidos`, `bascula_etiqueta` y `comision_terminal_bp`, que el servidor declara; los tres se leen por consultas propias, así que no daña | Dejar. Al añadir claves nuevas declararlas en los dos sitios |
| `PUBLICOS` (15 claves) | packages/app/src/puente/configuracion.ts:96-112 | desconectado | Sólo la usa `portal/consulta.ts:127`, y `negocioPublico` toma 3 campos (`nombre_negocio`, `logo_url`, `background_logo_url`; `packages/app/src/portal/lista-blanca.ts:93-95`). Los otros 12 (colores, `background_*`, IVA, moneda, `mensaje_ticket`, `usa_mesas`, `nombre_sistema`) salen de la lectura pública y nadie los usa; el propio `lista-blanca.ts:78-84` lo anota | Recortar `PUBLICOS` a las 3 que se usan: menos superficie pública. Lo decide Miguel |
| `CLAVES_EDITABLES` (lista blanca de escritura) | packages/app/src/puente/configuracion.ts:157-229 | funciona | Rechaza lo que no esté (`:449-457`). Contiene 12 claves sin ninguna pantalla que las escriba (1E) y le falta `rfc` | Quitar las que Miguel esconda; añadir `rfc` si se conecta (1E) |
| `NUNCA_SALEN` y `SOLO_POR_COMANDO` | packages/app/src/puente/configuracion.ts:120-152 | funciona | Se aplican al escribir (`:431-448`) y al leer (`:407-410`): `presentacion_password`, `plataforma`, `telefonos_de_cocina`, etc. nunca salen | Sin cambio (es seguridad) |
| `presentacion_ultimo_acceso` | packages/app/src/puente/configuracion.ts:145,223 | sin propósito | Está en `SOLO_POR_COMANDO` y en `CLAVES_EDITABLES`, pero ningún comando ni pantalla la escribe ni la lee (`grep` en todo `apps/web` y `packages/app/src`) | Esconder para restaurante (resto del «modo presentación» retirado) |

### 1B · Configuración → Operación («Datos del negocio»)

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| Dirección, Teléfono, Correo | apps/web/heredado/pages/Configuracion.jsx:562-583 (guarda `saveBiz` :220-264) | funciona | Los leen `CorteTicket.jsx:195-197`, `PreCuentaTicket.jsx:106-110`, `PeriodoPDF.jsx:57` y el corte nuevo `packages/app/src/caja/corte/documento.ts:360-362` | Sin cambio. Corregir la ayuda (§4: dice «Portal QR» y el portal no los muestra) |
| IVA / Impuesto (%) · `iva_porcentaje` | apps/web/heredado/pages/Configuracion.jsx:585-598 | desconectado | La pantalla guarda `iva_porcentaje`; el servidor cotiza con `configuracion.valores.impuesto.puntosBase` (`packages/app/src/venta/cotizar.ts:45-66`, por omisión 16 % incluido, `:29-32`). El único comando que lo escribe, `configuracion.guardar` (`packages/app/src/configuracion/configuracion.ts:173-178`), cuelga de `POST /api/catalogo/configuracion` (`apps/web/app/api/catalogo/configuracion/route.ts:15-17`) y ninguna pantalla lo llama. Resultado: desde ninguna pantalla se puede cambiar el IVA | Conectar así: el campo escribe `impuestoPuntosBase` (porcentaje × 100, tope 3500) con `configuracion.guardar`, o añadir un comando chico sólo-IVA (`configuracion.guardar` pide el documento entero y su versión). Ver también `:597` (ayuda engañosa) y `apps/web/src/registros/describir-accion.ts:105` que ya espera ese campo |
| Mensaje en ticket · `mensaje_ticket` | apps/web/heredado/pages/Configuracion.jsx:600-606 | funciona | `PreCuentaTicket.jsx:266` (ticket final y precuenta). No sale en el corte | Sin cambio |
| Ancho del papel · `ancho_papel_ticket` | apps/web/heredado/pages/Configuracion.jsx:608-626 | funciona | `PreCuentaTicket.jsx:50`, `apps/web/src/impresion/use-ancho-del-papel.ts:20-24`, `apps/web/heredado/pages/Mesero.jsx:1288`; el servidor valida 58/80 (`puente/configuracion.ts:485-491`) | Sin cambio |
| Usar mesas · `usa_mesas` | apps/web/heredado/pages/Configuracion.jsx:628-634 | desconectado | Su único lector es el paso «Configura las mesas» de Primeros pasos (`apps/web/heredado/pages/Dashboard.jsx:228`). Apagarlo no esconde mesas, mapa, mesero ni pestaña (la pestaña la gobierna el módulo: `Configuracion.jsx:112`) | Esconder para restaurante (siempre hay mesas) o dejarlo como interruptor de verdad. Lo decide Miguel |
| Permitir venta sin stock · `permitir_venta_sin_stock` | apps/web/heredado/pages/Configuracion.jsx:635-641 | desconectado | El servidor decide con `permite_venta_sin_stock` de cada producto (`packages/app/src/venta/cobrar.ts:220`, `packages/app/src/catalogo/productos.ts:92,288`); `apps/web/heredado/pages/POS.jsx:519-523` lo dice. Ninguna pantalla pone ese campo por producto (`grep permiteVentaSinStock` en `apps/web` sólo da un comentario). Cobrar lo que pasó por cocina ya nunca traba por stock (`cobrar.ts:213-230`) | Conectar así: añadir el interruptor por producto (Productos) y que el de Configuración sea el valor con el que nace un producto; o esconder el global. Toca dinero y existencias |
| Activar propinas · `propinas_activas` | apps/web/heredado/pages/Configuracion.jsx:655-658 | funciona | `apps/web/heredado/utils/tipsUtils.js:15`, servidor `packages/app/src/portal/banderas.ts:133` → `portal/cuenta.ts:207`, y `ConfiguracionQRTab.jsx:251` | Sin cambio |
| Porcentajes sugeridos · `propina_porcentajes_sugeridos` | apps/web/heredado/pages/Configuracion.jsx:660-673 | funciona | `tipsUtils.js:35`, `banderas.ts:134`. La ayuda dice «Hasta 6 valores» (`:671`) y ni el navegador ni el servidor lo limitan | Corregir la ayuda («enteros del 1 al 100») o recortar a 6 en `tipsUtils.js:35-41` y `banderas.ts:83-92` |
| Abrir PDF automático al cerrar caja · `descargar_pdf_corte_auto` | apps/web/heredado/pages/Configuracion.jsx:676-687 | funciona | `apps/web/heredado/pages/Caja.jsx:1209`, `packages/app/src/caja/corte/documento.ts:367`, `apps/web/src/corte/CorteEnPdf.tsx:22` | Sin cambio |
| Asignación de mesas a meseros · `asignacion_mesas_activa` | apps/web/heredado/pages/Configuracion.jsx:692-707 | funciona | `apps/web/heredado/lib/asignacionMesas.js:54`, `PortalCliente.jsx:213`, `Configuracion.jsx:995`, servidor `banderas.ts:135` | Sin cambio |
| Silenciar notificaciones del administrador · `silenciar_notificaciones_admin` | apps/web/heredado/pages/Configuracion.jsx:708-724 | roto | La ayuda promete «no escucha sonidos ni voz». Sólo lo consulta `PedidoListoWatcher.jsx:125` (por `asignacionMesas.js:61-73`). Los avisos de solicitudes QR de `apps/web/heredado/pages/Mesero.jsx:316-329` suenan y hablan sin consultarlo, y la voz de cocina tampoco | Conectar así: usar `debeEscucharAudio` en `anunciarSolicitudes` (`Mesero.jsx:316`) o acotar la ayuda a «pedido listo» |
| Permitir que el comensal envíe pedidos · `portal_qr_permitir_pedidos_cliente` | apps/web/heredado/pages/Configuracion.jsx:727-752 | funciona | `packages/app/src/portal/negocio.ts:78` (`puede_ordenar`), `banderas.ts:129`. Sólo se ve con módulo de mesas (`:730`) y NO está en la pestaña del Portal QR, donde la ayuda dice que lo gobierna «Quiero ordenar» (§4) | Mover o repetir el interruptor en `ConfiguracionQRTab.jsx` |
| Activar estaciones de preparación · `estaciones_preparacion_activas` | apps/web/heredado/pages/Configuracion.jsx:776-791 | funciona | `CategoriasProductoSection.jsx:67`, `FilaDeUsuario.jsx:27`, `UsuarioPOSDialog.jsx:81`, `pages/Cocina.jsx:50` (el servidor ya no la lee, `banderas.ts:140`) | Sin cambio |
| Alertas de espera de cocina · `cocina_alerta_ambar_min` / `cocina_alerta_roja_min` | apps/web/heredado/pages/Configuracion.jsx:808-816; apps/web/src/cocina/AlertasDeEspera.tsx:60,75 | funciona | Los lee `apps/web/src/cocina/TableroDeCocina.tsx:53` con `espera.ts:35-41`; el servidor valida al guardar (`puente/configuracion.ts:304-321`) | Sin cambio |
| Unidades de medida · `unidades_medida_lista` | apps/web/heredado/components/configuracion/UnidadesMedidaSection.jsx:53,71 (montada en `Configuracion.jsx:824-826`) | funciona | `apps/web/heredado/utils/unidadesMedida.js:194`, `Dashboard.jsx:231` | Sin cambio |
| Copias de impresión · `copias_de_impresion` | apps/web/src/impresion/pantallas/CopiasDeImpresion.tsx:61 | funciona | Comando `caja.fijar_copias_de_impresion`; lo leen `apps/web/src/impresion/copias.ts:31` y `BarraDeImpresion.tsx:135` | Sin cambio |
| Pestaña Caja: cajas a la vez, umbral de retiro | apps/web/src/configuracion/CajaYDescuentos.tsx:58; apps/web/src/configuracion/UmbralDeRetiro.tsx:53 | funciona | Comandos `caja.fijar_cajas_simultaneas` y `caja.fijar_umbral_de_retiro`; el umbral lo leen `packages/app/src/caja/retiro-con-pin.ts:27` y `apps/web/src/venta/pin-en-retiros.ts:18` | Sin cambio |
| Pestaña Descuentos · `descuentos_permitidos` | apps/web/src/configuracion/CajaYDescuentos.tsx:137 | funciona | El servidor lo exige en `packages/app/src/venta/descuento-de-mostrador.ts:162` y el navegador lo lee en `apps/web/src/venta/use-descuentos-permitidos.ts:21` | Sin cambio |

### 1C · Configuración → Identidad

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| Nombre del negocio · `nombre_negocio` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:254-259 | funciona | Se guarda en `organizaciones.nombre` (`puente/configuracion.ts:526-562`); lo leen `Sidebar.jsx:190`, `POSLogin.jsx:181`, tickets y PDFs | Sin cambio |
| Nombre del sistema · `nombre_sistema` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:262-267 | funciona | `CorteTicket.jsx:765`, `PeriodoPDF.jsx:257`, `POSLogin.jsx:174`. El placeholder dice «Morphiq POS» (`:266`) | Cambiar el placeholder (§4). Esconder el campo al dueño: lo decide Miguel |
| Plataforma (marca) · `platform_brand` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:270-275 | funciona | `Sidebar.jsx:193`, `CorteTicket.jsx:205`, `documento.ts:365`. Placeholder «Morphiq» (`:274`) | Cambiar el placeholder (§4). Es un campo de plataforma: esconder al dueño, lo decide Miguel |
| Logo del negocio · `logo_url` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:283-288 | funciona | `Sidebar.jsx:177`, `POSLogin.jsx:227`, `apps/web/src/espera/ModoEspera.tsx:104`, `documento.ts:364` | Sin cambio |
| Logo del ticket · `logo_ticket_url` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:289-294 | funciona | `PreCuentaTicket.jsx:87-89` | Sin cambio |
| Logo de los PDFs · `logo_pdf_url` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:295-300 | funciona | `CorteTicket.jsx:183-185`, `documento.ts:364` | Sin cambio |
| Fondo del sistema · `background_image_url` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:313-318 | funciona | `BrandedBackground.jsx:20` (montado en `AppLayout.jsx:93`) | Sin cambio |
| Logo de fondo / marca de agua · `background_logo_url` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:320-326 | funciona | `BrandedBackground.jsx:20`, `POSLogin.jsx:192`, portal `PortalCliente.jsx:427` | Sin cambio |
| Opacidad y ajuste del fondo · `background_opacity`, `background_fit` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:330-360 | funciona | `BrandedBackground.jsx:21-22` (sólo la app interna; el portal no los lee aunque `PUBLICOS` los deja salir) | Sin cambio |
| Pie del ticket térmico · `ticket_footer` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:378-384 | funciona | Sólo `PreCuentaTicket.jsx:267` | Sin cambio |
| Pie de los PDFs · `pdf_footer` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:386-392 | funciona | `CorteTicket.jsx:760`, `documento.ts:366` | Sin cambio |
| Texto legal o pie general · `footer_text` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:394-400 | desconectado | Se guarda (`:149`) pero ningún archivo lo lee (`grep -w footer_text` sólo da Identidad, `ConfigContext.jsx:54` y `puente/configuracion.ts`). El placeholder invita a poner el RFC, que así nunca sale | Conectar así: imprimirlo en `PreCuentaTicket.jsx` y en el corte (`pie`), o esconderlo. Ver `rfc` (1E) |
| Colorear importes monetarios · `colorear_importes_monetarios` | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:406-420 | funciona | Se lee en más de 20 sitios, p. ej. `components/dashboard/ColoredStatCard.jsx:26`, `components/pos/CartPanel.jsx:12`, `lib/moneyColors.js:15,23`, `pages/Caja.jsx:1486` | Sin cambio |
| Colores del sistema · `color_primario`, `color_acento` | apps/web/heredado/components/configuracion/ColoresSistemaSection.jsx:54 (montada en `IdentidadNegocio.jsx:371`) | funciona | `BrandColorsApplier.jsx:22-23` (en `AppLayout.jsx:92`), `LoginBrandColors.jsx:19-20`. El portal no los usa | Sin cambio |

### 1D · Portal QR → pestaña «Configuración»

Escribe todo `apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx` con `ConfiguracionNegocio.update` (`:83`). Lee el servidor en `packages/app/src/portal/banderas.ts` y el portal desde la lista blanca `portal/lista-blanca.ts:94-105`.

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| Activar Portal QR · `portal_qr_activo` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:137-145 | funciona | `banderas.ts:118` → `portal/negocio.ts:78`; en pantalla `Mesero.jsx:332`, `SolicitudesQRWatcher.jsx:56`, `SolicitudesQRCardList.jsx:45,57` | Sin cambio |
| Cómo se ve el menú · `portal_qr_modo_menu` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:146-164 | funciona | `banderas.ts:120`, `PortalCliente.jsx:135`, `apps/web/src/restaurante/personalizar-menu/PersonalizarMenu.tsx:101,189` | Sin cambio |
| Mostrar precios · `portal_qr_mostrar_precios` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:165-170 | funciona | `banderas.ts:122`; el servidor ya quita los precios (`lista-blanca.ts:197`); `PortalCliente.jsx:414` | Sin cambio |
| Mostrar productos sin imagen · `portal_qr_mostrar_sin_imagen` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:171-176 | funciona | `banderas.ts:123`, `PortalCliente.jsx:415`, `apps/web/src/portal/menu-digital/MenuALaCarta.tsx:39` | Sin cambio |
| Quién manda a cocina · `portal_qr_envia_a_cocina` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:186-202 | funciona | `banderas.ts:138` → `portal/pedido.ts:76`, `portal/mesa.ts:53`, `portal/quien-envia.ts:46` | Sin cambio |
| Comensales abren su mesa · `portal_qr_comensales_abren_mesa` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:203-216 | funciona | `banderas.ts:139` → `portal/mesa.ts:53`, `portal/consulta.ts:162` | Sin cambio |
| «Quiero ordenar» · `portal_qr_permitir_ordenar` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:224-229 | funciona | Sólo gobierna la SOLICITUD de tipo «ordenar» (`portal/solicitudes.ts:60`, `apps/web/heredado/utils/qrUtils.js:42`), no el envío de pedidos | Corregir la ayuda (§4) |
| «Pedir cuenta» · `portal_qr_permitir_cuenta` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:230-235 | funciona | `solicitudes.ts:61`, `portal/cuenta.ts:171-178`, `qrUtils.js:43` | Sin cambio |
| «Necesito ayuda» · `portal_qr_permitir_ayuda` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:236-241 | funciona | `solicitudes.ts:62`, `qrUtils.js:44` | Sin cambio |
| Quién dispara la propina · `portal_qr_cuenta_modo` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:259-276 | funciona | `banderas.ts:121`, `cuenta.ts:171`, `PortalCliente.jsx:140`, `Mesero.jsx:1181` | Sin cambio |
| Mostrar precuenta al cliente · `portal_qr_mostrar_precuenta` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:277-285 | funciona | `banderas.ts:131` → `portal/cuenta-publica.ts:130`, `PedirCuentaQR.jsx:47` | Sin cambio |
| Propina elegida por el comensal · `portal_qr_permitir_propina_cliente` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:286-299 | funciona | `banderas.ts:130` → `cuenta.ts:207`, `PedirCuentaQR.jsx:49`, `Mesero.jsx:1183` | Sin cambio |
| Mensaje de bienvenida · `portal_qr_mensaje_bienvenida` | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:310-318 | funciona | `banderas.ts:132`, `PortalCliente.jsx:520-525`. El formulario muestra un texto por omisión (`:59-61`) que el comensal NO ve hasta que se guarda (el portal pinta sólo lo guardado); la primera vez que se guarda cualquier ajuste de la pestaña, viaja también ese texto | Dejar vacío el campo si no hay nada guardado, o decir «así se verá si guardas» |
| Botones del menú · `portal_qr_botones` | apps/web/src/restaurante/menu-qr/EditorDeBotones.tsx:128 | funciona | Lo lee el servidor en `portal/consulta.ts:150` | Sin cambio |
| Aspecto del portal · `portal_qr_tema` | apps/web/src/restaurante/menu-qr/AspectoDelPortal.tsx:94; `personalizar-menu/use-personalizar-menu.ts:116` | funciona | `portal/consulta.ts:167`, `PortalCliente.jsx:115` | Sin cambio |
| Diseño de los QR de mesas · `qr_de_mesas` | apps/web/src/restaurante/qr-de-mesas/use-qr-de-mesas.ts:46 | funciona | Lo lee la misma pantalla (`:20-23`) y valida `puente/configuracion.ts:470-476` | Sin cambio |

### 1E · Claves sin control, sin lector, o con uno solo

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| `usa_cocina` | packages/app/src/puente/configuracion.ts:55,178; apps/web/heredado/lib/ConfigContext.jsx:45 | sin propósito | Ni lector ni escritor en todo el repo. Un restaurante siempre tiene cocina | Esconder para restaurante. Lo decide Miguel |
| `usa_barra` | packages/app/src/puente/configuracion.ts:56,179; apps/web/heredado/lib/ConfigContext.jsx:46 | sin propósito | Ni lector ni escritor. La «barra» sólo existe como área de preparación de cada producto (`apps/web/src/restaurante/Productos.tsx:89`) | Esconder para restaurante. Lo decide Miguel |
| `formato_export_default` | packages/app/src/puente/configuracion.ts:67,189; apps/web/heredado/lib/ConfigContext.jsx:56 | desconectado | Ni lector ni escritor; `ExportarDatos.jsx` no ofrece elegir formato | Esconder (no hay nada que elegir) o conectar al botón de exportar. Lo decide Miguel |
| `moneda` | packages/app/src/puente/configuracion.ts:51,174; ConfigContext.jsx:41 | sin propósito | Nadie la lee; el dominio sólo admite pesos (`packages/domain/src/dinero/formato.ts:20-22`) | Esconder para restaurante |
| `simbolo_moneda` | packages/app/src/puente/configuracion.ts:52,175 | desconectado | Su único lector es el formateador local de `apps/web/heredado/components/mesero/MesaActivaView.jsx:60`; no hay control que la cambie | Esconder; que ese formateador use el de dominio |
| `mostrar_costos_a_caja` | packages/app/src/puente/configuracion.ts:58,181 | desconectado | Lo lee el corte (`packages/app/src/caja/corte/documento.ts:166`, `sin-costos.ts:6`) para decidir si el cajero ve costos; ninguna pantalla lo escribe, así que siempre vale `false`. Toca datos (costos y utilidad) | Conectar así: interruptor en la pestaña Caja (sólo dueño/administrador, con comando y auditoría), o fijar `false` y esconderlo. Lo decide Miguel |
| `mostrar_logo_ticket` | packages/app/src/puente/configuracion.ts:59,182 | desconectado | Lo lee `PreCuentaTicket.jsx:87`; sólo lo pone un ejemplo del laboratorio (`apps/web/src/impresion/pantallas/ejemplos.jsx:44`). Nadie puede apagar el logo del ticket | Conectar: interruptor junto al logo del ticket (Identidad `:289`) |
| `modo_presentacion_activo` | apps/web/heredado/lib/ConfigContext.jsx:63,111,122; packages/app/src/puente/configuracion.ts:74,191 | sin propósito | El contexto lo entrega y nadie lo consume (`grep` en `apps/web`); no hay pantalla de «Presentación» (§4: `RestrictedRoute.jsx:42` la menciona) | Esconder/retirar de la superficie. Lo decide Miguel |
| `bascula_etiqueta` | packages/app/src/puente/configuracion.ts:75-77,224,236-263,459 | sin propósito | Sólo se valida al guardar; ni lector ni escritor. Es una báscula de etiquetas EAN-13 de mostrador | Esconder para restaurante. Lo decide Miguel |
| `comision_terminal_bp` | packages/app/src/puente/configuracion.ts:78-80,225,269-277; lector `packages/app/src/caja/corte/documento.ts:368`, `apps/web/src/corte/hoja.ts:773` | desconectado | El corte calcula la comisión estimada de la terminal con esa tasa, pero ninguna pantalla la escribe: el corte siempre dice «sin tasa». Toca dinero (comisión que se descuenta del corte) | Conectar así: campo «Comisión de la terminal (%)» en la pestaña Caja que guarde puntos base (3.6 % = 360), con el comando de mando y auditoría |
| `rfc` | lector `packages/app/src/caja/corte/documento.ts:363`, `apps/web/src/corte/HojaDelCorte.tsx:195`; ausente de `CLAVES_EDITABLES` | desconectado | El corte imprime «RFC:» si existe, pero no se puede escribir en ningún lado (la clave ni siquiera está en la lista blanca) | Conectar: campo RFC en Operación y añadirlo a `CLAVES_EDITABLES`; si Don Poncho no factura, esconder la línea. Lo decide Miguel |
| `color_secundario` | packages/app/src/puente/configuracion.ts:49,172; apps/web/heredado/lib/brandColors.js:22 | sin propósito | `brandColors.js:22` lo dice: «legacy, no se expone en UI». Nadie lo lee | Esconder |
| Experiencia: `mascota`, `pin_al_despertar`, `sonidos_en_el_portal`, `tecla` | apps/web/src/configuracion/ExperienciaDelNegocio.tsx:75-79; apps/web/src/configuracion/SonidosDelNegocio.tsx:65 | funciona | Validada en `packages/app/src/configuracion/experiencia.ts:30-37`; leen `MorfiCargando.tsx:32`, `MorfiNoEncontrada.tsx:47`, `espera/PantallaDeEspera.tsx:66`, `espera/ModoEspera.tsx:59`, `sonidos/ProveedorDeSonidos.tsx:29,34-37` | Sin cambio |

---

## 2 · Las llamadas

Comprobado: las 118 cadenas `/api/...` distintas que llaman las pantallas (7 son prefijos de rutas dinámicas) existen como `route.ts` en `apps/web/app/api/**` (las dinámicas `/api/publico/qr/[token]/...`, `/api/publico/cocina/[token]`, `/api/archivos/[...ruta]` también). Los 27 nombres distintos de `api.entidades.X` existen en el puente (`UsuarioPOS` vive en `puente/usuarios.ts`, `ConfiguracionNegocio` en `puente/configuracion.ts` y `DescuentoInventarioVenta` en `puente/mapa.ts:3832`). **No hay ninguna llamada a una ruta o entidad inexistente.** No se revisó, operación por operación, que el puente permita cada `create/update/delete` que llaman las pantallas.

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| Rutas `/api/...` llamadas por las pantallas (118 cadenas) | apps/web/heredado y apps/web/src, contra apps/web/app/api/**/route.ts | funciona | Cruce completo con `pruebas/e2e/matriz-de-permisos.json` (113 rutas incluidas, 62 excluidas con razón) | Sin cambio |
| Entidades `api.entidades.X` usadas | apps/web/heredado/api/cliente.ts; packages/app/src/puente/mapa.ts | funciona | 27 nombres, todos mapeados | Sin cambio |
| Eliminar corte (botón en Registros) | apps/web/heredado/pages/Registros.jsx:80,140,441 → `POST /api/caja/eliminar-corte` | roto | El botón sale con `isAdmin = posUser.rol === 'administrador'` (`:80`), y `rolMH` junta dueño, administrador y gerente en ese valor (`apps/web/src/restaurante/alcance-de-la-cocina.ts:37`). El comando `caja.eliminar_corte` es sólo de `dueno` (matriz de permisos). Un gerente o administrador ve el botón y el servidor lo niega | Arreglar así: mostrar el botón sólo con `miPuesto === 'dueno'` (ya existe `usePuesto`). Toca datos |
| «Vaciar todas» las solicitudes QR | apps/web/heredado/components/portalqr/SolicitudesQRTab.jsx:98,186 → `POST /api/restaurante/vaciar-solicitudes` | roto | El comando es de `administrador, dueno` y la pantalla `/portal-qr` la ve todo el que tiene `ver_portal_qr` (`apps/web/heredado/lib/permissions.js:38`, incluye al gerente). Falta confirmar en la app corriendo que el gerente llega a esa pestaña | Mostrar el botón sólo a `esDeMando(miPuesto)` |
| Comando de configuración sin pantalla: `configuracion.guardar` | apps/web/app/api/catalogo/configuracion/route.ts:15-17 | desconectado | Ninguna pantalla llama `POST /api/catalogo/configuracion`; es la única vía a `impuesto.puntosBase` (ver IVA, §1B) | Conectar (IVA) o retirar |
| Comandos de sala sin pantalla (7) | `/api/restaurante/espera/registrar`, `espera/mover`, `espera/sentar`, `marchar-tiempo`, `relevar`, `rotacion`, `tiempos` | desconectado | Existen en el servidor y en la matriz, y no hay ninguna llamada en `apps/web/heredado` ni `apps/web/src` (lista de espera, marchar tiempos, relevar responsable, rotación de mesas, tiempos de preparación) | Lo decide Miguel: construir la pantalla o dejarlos como futuro. No se muestran: no hay botón que falle |
| Comandos de propinas sin pantalla (3) | `/api/propinas/entregar`, `/api/propinas/esquema`, `/api/propinas/pasivo` | desconectado | Sin llamada en pantallas. Sí se llaman `propinas/liquidar` y `propinas/pendientes` (`LiquidarPropinasDialog.jsx:124,211`) | Lo decide Miguel (toca dinero de propinas) |
| Comandos de inventario sin pantalla (5) | `/api/inventario/consumo-interno`, `kardex`, `traspaso`, `traspaso-recibir`, `valuacion` | desconectado | Sin llamada en pantallas (el «kardex» de `apps/web/src/restaurante/Inventario.tsx` es otra consulta) | Lo decide Miguel. `traspaso*` no sirve con un solo almacén |
| Comandos de cuentas por pagar sin pantalla (3) | `/api/por-pagar`, `/api/por-pagar/pagar`, `/api/por-pagar/resumen` | sin propósito | Sin llamada; es crédito de proveedores | Lo decide Miguel |
| Comandos de catálogo, precios y compras sin pantalla (8) | `/api/catalogo/archivar`, `crear-producto`, `fiscal-masivo`, `modificador`, `modificadores`, `/api/precios/aplicar-sugerido`, `/api/compras/importar-nota`, `/api/compras/plantilla/usar` | desconectado | Sin llamada; productos y modificadores se escriben hoy por `api.entidades` (`/api/datos/escribir`) | Lo decide Miguel |
| Comandos de módulos y vocabulario sin pantalla (4) | `/api/configuracion/modulo`, `modulo-restablecer`, `vocabulario`, `vocabulario-restablecer` | sin propósito | Sin llamada (sólo `apps/web/src/registros/describir-accion.ts` los nombra para la bitácora). Es de la plataforma multi-giro | Esconder / dejar para plataforma |
| Otros comandos sin pantalla (2) | `/api/clientes` (`cliente.alta`), `/api/caja/abiertas` | sin propósito | Sin llamada (`cliente.alta` es de fiado/crédito) | Lo decide Miguel |
| Tarea de «cola de sincronización» en cada corte | apps/web/heredado/pages/Caja.jsx:1183 → `/api/caja/encolar-sincronizacion` | sin propósito | Cada corte encola un registro `pending_external_sync` que ninguna integración consume (§3, Integraciones) | Esconder para restaurante / dejar de encolar. Toca datos (filas que sólo crecen) |

---

## 3 · El paquete

El paquete restaurante trae `BASE` sin escáner + `OPERACION` + `SALA` + `propinas` (`packages/contracts/src/comandos/plantillas.ts:364-368`). El menú lateral del restaurante sale limpio: Dashboard, Mesas y pedidos, Cocina, Caja, Ventas, Recetas, Productos, Inventario, Compras, Registros, Portal QR, Configuración y «Cierre del día» (`apps/web/heredado/lib/packageConfig.js:405-446` y `apps/web/heredado/lib/permissions.js:70-106`). No hay entradas de tienda, canjes, fiado, remisiones, obras, citas ni lealtad en pantallas visibles.

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| Menú lateral del restaurante | apps/web/heredado/components/common/Sidebar.jsx; apps/web/heredado/lib/packageConfig.js:405-446 | funciona | Sin entradas de otros giros; las rutas de otros giros no tienen carpeta en `apps/web/app/**` (sólo `(modelos)/restaurante`) | Sin cambio |
| Página `Barra` sin ruta | apps/web/heredado/pages/Barra.jsx:1-152; `ROUTE_TO_MODULE['/barra']` en apps/web/heredado/lib/packageConfig.js:364 | sin propósito | No existe `apps/web/app/(interno)/barra/page.tsx`, ninguna entrada de menú apunta a `/barra` y nada importa `Barra.jsx`. El módulo `barra` sí está en el restaurante (`plantillas.ts` `SALA`) | Esconder el módulo `barra` para restaurante; el archivo se queda. Lo decide Miguel |
| Pestaña «Integraciones» (Google Sheets/Drive) | apps/web/heredado/pages/Configuracion.jsx:495-500,860-864; apps/web/heredado/components/configuracion/IntegracionesRespaldos.jsx:37,66-77,89 | sin propósito | Insignias «Pendiente de conectar» (`:37`) y «Demo — pendiente de configurar» (`:89`); los botones «Conectar» sólo muestran un aviso (`:66-72`) y «Reintentar sincronización» espera 800 ms y dice «pendiente de conexión» (`:74-79`) | Esconder la pestaña para restaurante (lo ve dueño y administrador) |
| Cola de sincronización | apps/web/heredado/components/configuracion/IntegracionesRespaldos.jsx:50-64; apps/web/heredado/pages/Caja.jsx:1183 | sin propósito | Cuenta filas `pending_external_sync` que sólo crece (ver §2) | Esconder junto con la pestaña |
| Texto comercial «Módulo no incluido» | apps/web/heredado/components/common/RestrictedRoute.jsx:36-42 | roto | Dice «paquete actual … cambia el paquete en Configuración → Presentación»: esa pestaña no existe y el paquete no se cambia desde ahí | Cambiar el texto («Esta función no está disponible en tu negocio») |
| Resumen comercial por paquete | apps/web/heredado/lib/packageConfig.js:66-231 (`PACKAGE_FLOW`, `PACKAGE_FEATURES`, `ADDONS`, `PACKAGE_COMPARISON`) | sin propósito | Sólo `packageLabel`/`packageFeatures` se exponen en `ConfigContext.jsx:113-125` y nadie los consume; el resto ya no tiene pantalla (era el Modo Presentación) | No se muestra. Retirar de la superficie en una limpieza; lo decide Miguel |
| `ZONAS_MESA` con «Barra» | apps/web/heredado/lib/constants.js:167 | funciona | Es un nombre de zona de salón; el negocio crea las suyas (`Configuracion.jsx:149-152`) | Sin cambio |
| Rol heredado `barra` | apps/web/heredado/lib/constants.js:139; apps/web/heredado/components/configuracion/UsuarioPOSDialog.jsx:147 | sin propósito | Sólo para mostrar usuarios viejos; no se ofrece al crear | Sin cambio |
| Plantillas descargables con ejemplos de cafetería | apps/web/heredado/components/datos/PlantillasDescargables.jsx:33,62,87,126 | roto | Los ejemplos que baja el dueño dicen «Café molido», «Capuchino», «Bebidas calientes» y un proveedor de panadería con un correo de ejemplo | Cambiar a ejemplos de barbacoa (carne, tortillas, salsas) |
| Estaciones con ejemplos de barra | apps/web/heredado/components/configuracion/EstacionesPreparacionSection.jsx:352,484 | funciona | «barra, postres, barbacoa»: el ejemplo ya incluye barbacoa | Sin cambio |

---

## 4 · Los textos (y «Primeros pasos»)

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| «Ajustes de Morphiq POS» | apps/web/heredado/pages/Configuracion.jsx:428,441 | roto | Texto visible bajo el título de Configuración, con la marca de la plataforma | Cambiar a «Ajustes de POS Don Poncho» o quitarlo |
| Placeholder «Morphiq POS» en Nombre del sistema | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:266 | roto | Visible cuando el campo está vacío | `POS Don Poncho` |
| Placeholder «Morphiq» en Plataforma (marca) | apps/web/heredado/components/configuracion/IdentidadNegocio.jsx:274 | roto | Idem | `POS Don Poncho` |
| Migas «MorphiqPOS › Sistema de diseño» | apps/web/src/sistema/PaginaDelSistema.tsx:149 | roto | `/sistema` es una página pública (sin sesión): `apps/web/app/sistema/page.tsx:1-15`. Muestra la marca como migas y ejemplos genéricos (`:358` «Mostrador») | Cambiar a «POS Don Poncho» o dejarla sólo para desarrollo. Lo decide Miguel |
| Marca por omisión del corte «MorphiqPOS» | packages/app/src/caja/corte/documento.ts:365 | funciona | Si el negocio no escribió `platform_brand`, el documento lleva «MorphiqPOS»; `marcaVisibleDePlataforma` lo traduce al imprimir (`apps/web/src/marca/nombre-visible.ts:97,132-136`) | Cambiar el valor por omisión del servidor a «POS Don Poncho» para no depender del traductor |
| Nombre por omisión del acceso «Morphiq POS» | apps/web/app/api/auth/empleados/route.ts:88 | funciona | Va al acceso como `negocio` si no hay organización única; `nombreVisibleDelNegocio` lo traduce (`POSLogin.jsx:181`) | Cambiarlo a «Don Poncho» |
| Crédito del acceso «Sistema por Morphiq» | apps/web/src/marca/contenido.ts:4,14 | roto | La regla del encargo es «Hecho por MORPHIQ»; el texto real es «Sistema por Morphiq» | Lo decide Miguel (el repo manda hoy; el encargo pide otra frase) |
| Marca vieja «AZECAFE» en un alias | apps/web/heredado/components/registros/PeriodoPDF.jsx:6,51 | funciona | Es sólo el nombre de una variable (`AZECAFE_LOGO_URL` = logo de la casa); no se ve | Renombrar el alias |
| Nombre vacío «MH Astral Systems» | apps/web/heredado/pages/Dashboard.jsx:224 | roto | El paso 1 de Primeros pasos se da por hecho si el nombre no es «MH Astral Systems», «Mi negocio» o vacío; el nombre de la casa es «Don Poncho», así que el paso 1 siempre sale completo | Comparar contra `NOMBRE_DEL_NEGOCIO` de la casa o con un dato real |
| Ayuda de «Datos del negocio» | apps/web/heredado/pages/Configuracion.jsx:555-558 | roto | Dice que los datos «aparecen en tickets, PDFs y Portal QR». El portal no muestra dirección, teléfono ni correo (`lista-blanca.ts:57-105`) | Quitar «y Portal QR» |
| Ayuda del IVA | apps/web/heredado/pages/Configuracion.jsx:596-598 | roto | «Si no manejas impuesto desglosado, déjalo en 0»: el servidor cobra con el 16 % incluido en el precio y el ticket muestra «IVA incluido» sin importar ese campo (`PreCuentaTicket.jsx:188-191`) | Reescribir al conectar el campo (§1B) |
| Ayuda del Portal QR: «Quiero ordenar» | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:117-120 | roto | Dice que con «Quiero ordenar» apagado el cliente «NO puede mandar pedidos a cocina». Ese botón sólo gobierna la solicitud «ordenar» (`portal/solicitudes.ts:60`); mandar pedidos depende de `portal_qr_permitir_pedidos_cliente` (en Operación) | Corregir el texto y enlazar al interruptor de pedidos |
| Ayuda de la propina del QR | apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx:291 | funciona | Remite a «Configuración general» (la pestaña se llama «Operación») | Cambiar a «Configuración → Operación» |
| «NIPs» en Primeros pasos | apps/web/heredado/components/dashboard/PrimerosPasosCard.jsx:33-42 | roto | El resto del sistema dice PIN | «Crea usuarios y PIN» |
| Primeros pasos: enlaces sin pestaña | apps/web/heredado/components/dashboard/PrimerosPasosCard.jsx:33-42 | roto | Cuatro pasos (usuarios, mesas, categorías, unidades) mandan a `/configuracion` sin `?tab=` y abren Identidad (`Configuracion.jsx:443`); la pantalla sí acepta `?tab=usuarios`, `mesas`, `negocio` | Añadir `?tab=` a cada paso |
| Primeros pasos: pasos que aplican hoy | apps/web/heredado/components/dashboard/PrimerosPasosCard.jsx:33-42; apps/web/heredado/pages/Dashboard.jsx:220-250 | funciona | Los 8 pasos (negocio, usuarios, mesas, categorías, unidades, inventario, recetas, caja) existen y sus rutas `/configuracion`, `/inventario`, `/recetas`, `/caja` existen. «Unidades» sólo se completa tras guardar la lista aunque la pantalla muestre una por omisión (`Dashboard.jsx:231`) | Sin cambio; marcar «unidades» como hecho si la lista por omisión es aceptable |
| Título de Primeros pasos | apps/web/heredado/components/dashboard/PrimerosPasosCard.jsx:122 | funciona | «Primeros pasos para configurar tu restaurante» | Sin cambio |
| «Hasta 6 valores» de propinas | apps/web/heredado/pages/Configuracion.jsx:671 | roto | Nada lo hace cumplir (ver §1B) | Corregir |

---

## 5 · Los sonidos y los avisos

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| Sonido de este aparato (Apagado, Suave, Normal) | apps/web/src/configuracion/SonidoDelAparato.tsx:44 (guarda en el aparato, clave `morphiqpos.sonidos`) | funciona | Lo lee `apps/web/src/sonidos/ProveedorDeSonidos.tsx:25-28` → `gananciaDe` | Sin cambio |
| Modo espera de este aparato | apps/web/src/configuracion/ModoEsperaDelAparato.tsx:39 | funciona | Lo lee `apps/web/src/espera/use-modo-espera.ts:60,127` | Sin cambio |
| Sonido del teclado (nib, keycap, thock, clasp) · `experiencia.tecla` | apps/web/src/configuracion/SonidosDelNegocio.tsx:65,120-153 | funciona | `ProveedorDeSonidos.tsx:34-37` | Sin cambio |
| Sonidos en el portal del comensal · `experiencia.sonidos_en_el_portal` | apps/web/src/configuracion/SonidosDelNegocio.tsx:160-182 | funciona | `ProveedorDeSonidos.tsx:29` con `reglas-del-gestor.ts:7`; el servidor resuelve el negocio también sin sesión (`apps/web/app/layout.tsx:151-162`) | Sin cambio |
| Tabla «Cada momento y su sonido» | apps/web/src/configuracion/SonidosDelNegocio.tsx:76-106,184-190 | funciona | Es la lista del mapa (`apps/web/src/sonidos/mapa.ts`) con botón «Oír» que llama `oir` (`gestor.ts`); no guarda nada | Sin cambio |
| Voz de los avisos (elegir voz, velocidad, probar) | apps/web/heredado/components/configuracion/ConfiguracionDeVoz.jsx:199,294 | funciona | Las leen `apps/web/heredado/lib/voiceAlert.js:138-156,277` en cada `speak` | Sin cambio |
| Alertas del mesero (modo silencio / sonido / voz / ambos, decir nombre) | apps/web/heredado/components/mesero/AlertasMeseroDialog.jsx:77 | funciona | `getAlertConfig` en `voiceAlert.js:72`, usado por `PedidoListoWatcher.jsx:126-128` y `Mesero.jsx:317` | Sin cambio |
| Voz de cocina activa/apagada | apps/web/heredado/components/cocina/CocinaVozControl.jsx:43 | funciona | `CocinaNuevoPedidoWatcher.jsx:83,95` | Sin cambio |
| Silenciar notificaciones del administrador | apps/web/heredado/pages/Configuracion.jsx:708-724 | roto | Ver §1B: sólo afecta «pedido listo» (`PedidoListoWatcher.jsx:125`) | Conectar a las solicitudes (`Mesero.jsx:316`) |
| Aviso visual de solicitudes QR | apps/web/heredado/components/common/SolicitudesQRWatcher.jsx:19-27 | funciona | Su comentario (DP-9.3) dice que ya no suena ni habla: queda el toast. La voz va en la vista de Solicitudes de Mesas | Sin cambio |
| Alerta de espera de cocina (ámbar/rojo) | apps/web/src/cocina/AlertasDeEspera.tsx:60,75 | funciona | `TableroDeCocina.tsx:53` | Sin cambio |

---

## 6 · Otros

Buscado en `apps/web/heredado` y `apps/web/src`: «Pendiente de conectar», «Próximamente», `TODO`/`FIXME`, `onClick` vacío, `disabled` fijo, `href="#"` y enlaces internos a rutas inexistentes.

| Qué | Dónde | Estado | Evidencia | Propuesta |
|---|---|---|---|---|
| «Pendiente de conectar» / «Demo» | apps/web/heredado/components/configuracion/IntegracionesRespaldos.jsx:37,89 | sin propósito | Ver §3 | Esconder la pestaña |
| Botones «Conectar Google Sheets / Drive» | apps/web/heredado/components/configuracion/IntegracionesRespaldos.jsx:66-72 | sin propósito | El `onClick` sólo lanza un aviso «se configurará después» | Esconder |
| «Reintentar sincronización» | apps/web/heredado/components/configuracion/IntegracionesRespaldos.jsx:74-79 | sin propósito | Espera 800 ms y avisa «pendiente de conexión»; no hace nada | Esconder |
| `onClick` vacío, `disabled` permanente, `href="#"` | apps/web/heredado y apps/web/src | funciona | No hay ninguno (los `disabled` hallados dependen de estado: `apps/web/src/restaurante/Caja.tsx:807`, `LabPendientes.tsx:25`) | Sin cambio |
| Enlaces internos a rutas inexistentes | apps/web/heredado y apps/web/src | funciona | Todos los `to=`/`href=`/`navigate(...)` apuntan a rutas con `page.tsx` (`/`, `/caja`, `/pos`, `/mesero`, `/mesas`, `/cocina`, `/compras`, `/configuracion`, `/inventario`, `/portal-qr`, `/productos`, `/recetas`, `/registros`, `/ventas`, `/sistema`, `/login-pos` y `/restaurante/*`) | Sin cambio |
| `TODO`/`Próximamente` visibles | apps/web/heredado y apps/web/src | funciona | No hay textos «Próximamente» ni `TODO` en pantallas (sólo el botón «Exportar TODO el respaldo», `ExportarDatos.jsx:263`, que es un rótulo) | Sin cambio |
| Página pública `/sistema` | apps/web/app/sistema/page.tsx:1-15 | sin propósito | Sin sesión y sin datos del negocio, es el catálogo de diseño que Miguel enseña a prospectos; cualquiera con la URL la ve en producción | Lo decide Miguel (ocultar en producción o dejarla) |
| Ayuda del botón «Eliminar mesas demo» | apps/web/heredado/pages/Configuracion.jsx:884-893,1005 | funciona | Sólo la ve el usuario de plataforma (`esUsuarioDePlataforma`, `:113-114`) y el servidor lo exige | Sin cambio |
| Pantallas de `Datos` (importar/exportar) | apps/web/heredado/components/datos/ | funciona | No se auditaron una por una; sólo se revisó que no dependan de `formato_export_default` | Revisar con la app corriendo |

---

## 7 · Resumen

### Lo que toca dinero, seguridad o datos

1. **IVA sin conexión** (`iva_porcentaje`, §1B): el campo guarda un dato que el servidor no lee; el servidor cobra con `impuesto.puntosBase` (16 % incluido por omisión) y ninguna pantalla lo cambia. Toca dinero.
2. **Venta sin stock** (`permitir_venta_sin_stock`, §1B): el interruptor global no hace nada; manda el campo por producto y ninguna pantalla lo pone. Toca dinero y existencias.
3. **Comisión de la terminal** (`comision_terminal_bp`, §1E): el corte la usa y nadie la puede escribir. Toca dinero (corte).
4. **Costos al cajero** (`mostrar_costos_a_caja`, §1E): el servidor decide con ella y ninguna pantalla la escribe (siempre `false`). Toca datos sensibles.
5. **Eliminar corte** (`Registros.jsx:80,140,441`, §2): el menú enseña el botón a gerente y administrador y el servidor lo niega (sólo dueño). Toca datos contables.
6. **Vaciar solicitudes QR** (`SolicitudesQRTab.jsx:98,186`, §2): mismo patrón para gerente (por confirmar en la app corriendo).
7. **Cola de sincronización** (`Caja.jsx:1183`, §2/§3): cada corte encola una fila que nadie consume. Datos que sólo crecen.
8. **`PUBLICOS`** (§1A): 12 campos salen de la lectura pública sin que el portal los use (no son secretos, pero es superficie de más). Seguridad menor.
9. **`rfc`** (§1E): el corte imprime «RFC:» y no hay dónde escribirlo (y no está en `CLAVES_EDITABLES`). Fiscal.

### Lo demás

- Desconectados sin riesgo: `usa_mesas`, `footer_text`, `mostrar_logo_ticket`, `simbolo_moneda`, `formato_export_default`; `silenciar_notificaciones_admin` promete más de lo que hace.
- Sin propósito para restaurante: `usa_cocina`, `usa_barra`, `moneda`, `bascula_etiqueta`, `color_secundario`, `modo_presentacion_activo`, `presentacion_ultimo_acceso`, la pestaña Integraciones (demo), la página `Barra.jsx` sin ruta y el módulo `barra`, el resumen comercial de `packageConfig.js` y los 32 comandos del servidor sin pantalla (lista de espera, rotación, traspasos, cuentas por pagar, módulos y vocabulario…).
- Textos con marca de plataforma, ayudas falsas y ejemplos de cafetería: §4 y §3.
- Primeros pasos: el paso 1 siempre sale completo y cuatro pasos abren la pestaña equivocada.
