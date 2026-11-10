'use client';
import { etiquetaDePeso } from '~/restaurante/peso';
import React, { useState, useEffect, useMemo, useId } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Minus, Scale, Beaker } from 'lucide-react';
import { formatCurrency } from '@/utils/financialUtils';
import { fondoDeLaTarjeta, inicialDelPlatillo } from '~/portal/menu-digital/menu-digital';
import '~/portal/menu-digital/menu-digital.css';
import {
  TIPO_VENTA,
  calcularPrecioVariableMedida,
  calcularPrecioPorcion,
  mlPorPorcionEfectivo,
} from '@/utils/tipoVentaUtils';
import {
  avisoDelGrupo,
  elegidasConPrecio,
  faltaEnElGrupo,
  puedeElegirOtra,
  totalDeLaLinea,
} from '~/portal/eleccion-de-opciones';
import { etiquetaDelPrecio } from '~/restaurante/toma-de-pedido/precio-de-las-opciones';

/**
 * Modal de producto para el comensal en Portal QR.
 * - Reutiliza la MISMA estructura de modificadores que ya usa el Mesero
 *   (producto.modificadores: [{nombre, obligatorio, tipo, minimo, maximo, opciones:[{id,nombre,precioCentavos}]}]).
 * - DP-16 · Las opciones pueden cobrar: cada una enseña su precio (si el negocio enseña precios),
 *   el grupo respeta su mínimo y su máximo, y lo que va por peso también lleva opciones. El precio
 *   que cuenta lo pone el servidor (`eleccion-de-opciones.ts` sólo lo enseña).
 * - Emite onConfirm({producto, cantidad, notas, modificadores})
 *
 * Diseño mobile-first. No introduce nuevas dependencias.
 */
export default function ProductoQRDialog({
  producto,
  open,
  onClose,
  onConfirm,
  mostrarPrecios = true,
}) {
  const [cantidad, setCantidad] = useState(1);
  const [notas, setNotas] = useState('');
  // DP-16 (QA-D, H-09): la ficha se anuncia como diálogo, con el nombre del platillo de título.
  const idDelTitulo = useId();
  // selecciones[grupoNombre] = Set(opcionId) (Set para multi y para única).
  const [selecciones, setSelecciones] = useState({});
  const [errores, setErrores] = useState({});

  // 6B / 1.E — Estado para productos VARIABLES (medida o porción).
  const tipoVenta = producto?.tipo_venta;
  const esVariableMedida = tipoVenta === TIPO_VENTA.VARIABLE_MEDIDA;
  const esPorcionContenedor = tipoVenta === TIPO_VENTA.PORCION_CONTENEDOR;
  const esVariable = esVariableMedida || esPorcionContenedor;
  // Para variables: cantVariable es la cantidad en la unidad mostrada (ej. 500 g / 4 shots).
  const [cantVariable, setCantVariable] = useState('');

  // Resetear estado al abrir un producto distinto
  useEffect(() => {
    if (!open) return;
    setCantidad(1);
    setNotas('');
    setSelecciones({});
    setErrores({});
    // 6B / 1.E — Hidratar cantidad variable con preset/mínimo
    if (esVariableMedida) {
      const min = Number(producto?.cantidad_minima_variable);
      setCantVariable(Number.isFinite(min) && min > 0 ? String(min) : '');
    } else if (esPorcionContenedor) {
      setCantVariable('1');
    } else {
      setCantVariable('');
    }
  }, [open, producto?.id, esVariableMedida, esPorcionContenedor]);

  const gruposActivos = useMemo(() => {
    const arr = Array.isArray(producto?.modificadores) ? producto.modificadores : [];
    return arr
      .filter(
        (g) =>
          g &&
          g.activo !== false &&
          String(g.nombre || '').trim() &&
          Array.isArray(g.opciones) &&
          g.opciones.some((o) => o && o.activo !== false && String(o.nombre || '').trim()),
      )
      .map((g) => ({
        ...g,
        opciones: g.opciones.filter(
          (o) => o && o.activo !== false && String(o.nombre || '').trim(),
        ),
      }));
  }, [producto]);

  const toggleOpcion = (grupo, opcionId) => {
    setErrores((prev) => ({ ...prev, [grupo.nombre]: false }));
    setSelecciones((prev) => {
      const actual = prev[grupo.nombre] || new Set();
      const next = new Set(actual);
      if (grupo.tipo === 'multiple') {
        if (next.has(opcionId)) next.delete(opcionId);
        else if (puedeElegirOtra(grupo, next)) next.add(opcionId);
      } else {
        // 'unica' (default)
        next.clear();
        next.add(opcionId);
      }
      return { ...prev, [grupo.nombre]: next };
    });
  };

  const cambiarCantidad = (delta) => {
    setCantidad((c) => Math.max(1, Math.min(99, c + delta)));
  };

  const validar = () => {
    const errs = {};
    for (const g of gruposActivos) {
      const falta = faltaEnElGrupo(g, selecciones[g.nombre] || new Set());
      if (falta) errs[g.nombre] = falta;
    }
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  // 6B / 1.E — Validaciones y cálculo de precio para productos variables.
  const cantVariableNum = Number(cantVariable);
  const cantVariableValida = Number.isFinite(cantVariableNum) && cantVariableNum > 0;

  const precioVariable = useMemo(() => {
    if (!esVariable || !cantVariableValida) return 0;
    if (esVariableMedida) {
      return calcularPrecioVariableMedida({
        precio_por_unidad_variable: Number(producto?.precio_por_unidad_variable) || 0,
        cantidad_variable: cantVariableNum,
      });
    }
    return calcularPrecioPorcion({
      precio_por_porcion: Number(producto?.precio_por_porcion) || 0,
      cantidad_porciones: cantVariableNum,
    });
  }, [esVariable, esVariableMedida, cantVariableValida, cantVariableNum, producto]);

  // Validación de rango/incremento (solo variable_medida)
  const validacionVariable = useMemo(() => {
    if (!esVariableMedida || !cantVariableValida) return { ok: cantVariableValida, msg: '' };
    const min = Number(producto?.cantidad_minima_variable);
    const max = Number(producto?.cantidad_maxima_variable);
    const step = Number(producto?.incremento_variable);
    const u = producto?.unidad_variable || '';
    if (Number.isFinite(min) && min > 0 && cantVariableNum < min) {
      return { ok: false, msg: `Mínimo: ${min} ${u}` };
    }
    if (Number.isFinite(max) && max > 0 && cantVariableNum > max) {
      return { ok: false, msg: `Máximo: ${max} ${u}` };
    }
    if (Number.isFinite(step) && step > 0) {
      const ratio = cantVariableNum / step;
      if (Math.abs(ratio - Math.round(ratio)) > 1e-4) {
        return { ok: false, msg: `Múltiplos de ${step} ${u}` };
      }
    }
    return { ok: true, msg: '' };
  }, [esVariableMedida, cantVariableValida, cantVariableNum, producto]);

  // Presets sugeridos del producto
  const presetsVariable = useMemo(() => {
    if (esVariableMedida)
      return Array.isArray(producto?.presets_variable_qr) ? producto.presets_variable_qr : [];
    if (esPorcionContenedor)
      return Array.isArray(producto?.presets_porcion_qr) ? producto.presets_porcion_qr : [];
    return [];
  }, [esVariableMedida, esPorcionContenedor, producto]);

  const submit = () => {
    if (!validar()) return;

    // 6B / 1.E — Si es variable, validar y construir snapshot.
    if (esVariable) {
      if (!cantVariableValida || !validacionVariable.ok || precioVariable <= 0) return;
      const baseSnap = {
        ingrediente_base_id: producto?.ingrediente_base_id || '',
        ingrediente_base_nombre: producto?.ingrediente_base_nombre || '',
        precio_total_linea: precioVariable,
      };
      let variableSnap;
      if (esVariableMedida) {
        variableSnap = {
          ...baseSnap,
          tipo_venta: TIPO_VENTA.VARIABLE_MEDIDA,
          cantidad_variable: cantVariableNum,
          unidad_variable: producto?.unidad_variable || 'g',
          precio_por_unidad_snapshot: Number(producto?.precio_por_unidad_variable) || 0,
        };
      } else {
        variableSnap = {
          ...baseSnap,
          tipo_venta: TIPO_VENTA.PORCION_CONTENEDOR,
          cantidad_porciones: cantVariableNum,
          nombre_porcion: producto?.nombre_porcion || 'porción',
          ml_por_porcion: mlPorPorcionEfectivo({
            ml_por_porcion: producto?.ml_por_porcion,
            capacidad_contenedor_ml: producto?.capacidad_contenedor_ml,
            porciones_por_contenedor: producto?.porciones_por_contenedor,
          }),
          precio_por_unidad_snapshot: Number(producto?.precio_por_porcion) || 0,
        };
      }
      onConfirm?.({
        producto,
        cantidad: 1, // cantidad lógica = 1 para variables (la cantidad real va en _variable)
        notas: notas.trim(),
        // DP-16 · Lo que va por peso también lleva opciones (la barbacoa con su salsa).
        modificadores: elegidasConPrecio(gruposActivos, selecciones),
        _variable: variableSnap,
      });
      return;
    }

    // Los grupos elegidos, compatibles con el flujo del mesero (`grupo_nombre`, no `grupo`: lo
    // leen la cocina y la nota del pedido), con el precio de cada opción.
    const modificadoresArr = elegidasConPrecio(gruposActivos, selecciones);

    onConfirm?.({
      producto,
      cantidad,
      notas: notas.trim(),
      modificadores: modificadoresArr,
    });
  };

  if (!open || !producto) return null;

  const precio = Number(producto.precio_venta) || 0;
  const elegidasAhora = elegidasConPrecio(gruposActivos, selecciones);
  const totalLinea = esVariable
    ? totalDeLaLinea({ precio: 0, cantidad: 1, elegidas: elegidasAhora, precioPorPeso: precioVariable })
    : totalDeLaLinea({ precio, cantidad, elegidas: elegidasAhora });
  // DP-16 · «Sólo presentaciones»: lo que va por peso se pide en las presentaciones del negocio.
  const soloPresentaciones =
    esVariableMedida && producto?.solo_presets_variable === true && presetsVariable.length > 0;
  const puedeConfirmarVariable =
    !esVariable || (cantVariableValida && validacionVariable.ok && precioVariable > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-velo/50 flex items-end sm:items-center justify-center"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDelTitulo}
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        className="bg-card text-card-foreground w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        {/* Header con imagen */}
        <div className="relative">
          {producto.imagen_url ? (
            <img
              src={producto.imagen_url}
              alt={producto.nombre || ''}
              className="w-full h-44 sm:h-52 object-cover"
            />
          ) : (
            // DP-16 · Sin foto, el mismo fondo y la inicial que su tarjeta del menú digital.
            <div
              data-fondo={fondoDeLaTarjeta(producto)}
              className="menu-tarjeta relative w-full h-44 sm:h-52 overflow-hidden"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-2 -top-8 -z-10 select-none text-[11rem] font-black leading-none opacity-15"
              >
                {inicialDelPlatillo(producto.nombre || '')}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-11 h-11 rounded-full bg-velo/60 text-primario-texto flex items-center justify-center backdrop-blur"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h2 id={idDelTitulo} className="text-lg font-heading font-bold leading-tight">
              {producto.nombre || '—'}
            </h2>
            {producto.descripcion && (
              <p className="text-sm text-muted-foreground mt-1">{producto.descripcion}</p>
            )}
            {mostrarPrecios && !esVariable && precio > 0 && (
              <p className="mt-2 font-heading font-black text-xl text-exito">
                {formatCurrency(precio)}
              </p>
            )}
            {/* 6B / 1.E — Header de precio para producto variable */}
            {mostrarPrecios && esVariableMedida && (
              <p className="mt-2 font-heading font-bold text-base text-exito inline-flex items-center gap-1.5">
                <Scale className="w-4 h-4" />
                {formatCurrency(Number(producto?.precio_por_unidad_variable) || 0)} /{' '}
                {producto?.unidad_variable || 'g'}
              </p>
            )}
            {mostrarPrecios && esPorcionContenedor && (
              <p className="mt-2 font-heading font-bold text-base text-exito inline-flex items-center gap-1.5">
                <Beaker className="w-4 h-4" />
                {formatCurrency(Number(producto?.precio_por_porcion) || 0)} /{' '}
                {producto?.nombre_porcion || 'porción'}
              </p>
            )}
          </div>

          {/* 6B / 1.E — Selector de cantidad variable / porciones */}
          {esVariable && (
            <div className="rounded-2xl border p-3 space-y-3">
              <p className="text-sm font-heading font-bold">
                {esVariableMedida
                  ? `¿Cuánto quieres? (en ${producto?.unidad_variable || 'g'})`
                  : `¿Cuántos ${producto?.nombre_porcion || 'porciones'}?`}
              </p>

              {/* Presets */}
              {presetsVariable.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {presetsVariable.map((p, i) => {
                    const valor = Number(p);
                    if (!Number.isFinite(valor) || valor <= 0) return null;
                    const seleccionado = cantVariableValida && cantVariableNum === valor;
                    return (
                      <button
                        key={`preset-${i}`}
                        type="button"
                        onClick={() => setCantVariable(String(valor))}
                        className={`min-h-11 px-4 rounded-full text-sm font-semibold border-2 transition-colors ${
                          seleccionado
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border hover:bg-muted/40'
                        }`}
                      >
                        {esVariableMedida
                          ? etiquetaDePeso(valor, producto?.unidad_variable || 'kg')
                          : `${valor} ${producto?.nombre_porcion || ''}`}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Input numérico (no, si el negocio sólo vende sus presentaciones) */}
              {!soloPresentaciones && (
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  inputMode="decimal"
                  value={cantVariable}
                  onChange={(e) => setCantVariable(e.target.value)}
                  placeholder="0"
                  step={esVariableMedida ? producto?.incremento_variable || 'any' : 1}
                  min={esVariableMedida ? producto?.cantidad_minima_variable || 0 : 1}
                  className="flex-1 px-3 py-2 border rounded-xl bg-card text-sm"
                />
                <div className="px-3 py-2 rounded-xl bg-muted text-sm font-bold min-w-[70px] text-center">
                  {esVariableMedida
                    ? producto?.unidad_variable || 'g'
                    : producto?.nombre_porcion || 'porción'}
                </div>
              </div>
              )}

              {!validacionVariable.ok && validacionVariable.msg && (
                <p className="text-[11px] text-peligro font-semibold">{validacionVariable.msg}</p>
              )}
            </div>
          )}

          {/* Grupos de opciones — DP-16: también en lo que va por peso. */}
          {gruposActivos.map((g) => (
              <div
                key={g.nombre}
                className={`rounded-2xl border p-3 ${
                  errores[g.nombre] ? 'border-peligro bg-peligro/60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-heading font-bold">{g.nombre}</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {avisoDelGrupo(g)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {g.opciones.map((o) => {
                    const set = selecciones[g.nombre] || new Set();
                    const checked = set.has(o.id);
                    const tope = !checked && !puedeElegirOtra(g, set);
                    const etiqueta = mostrarPrecios ? etiquetaDelPrecio(o.precioCentavos) : '';
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggleOpcion(g, o.id)}
                        disabled={tope}
                        aria-pressed={checked}
                        className={`w-full min-h-11 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 text-sm text-left transition-colors disabled:opacity-45 ${
                          checked
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border bg-card text-foreground'
                        }`}
                      >
                        <span className="flex-1 min-w-0">{o.nombre}</span>
                        {etiqueta && (
                          <span className="shrink-0 tabular-nums text-sm font-semibold">
                            {etiqueta}
                          </span>
                        )}
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${
                            checked
                              ? 'border-primary bg-primary text-primario-texto'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {checked ? '✓' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errores[g.nombre] && (
                  <p role="alert" className="text-xs text-peligro mt-1.5 font-semibold">
                    {errores[g.nombre]}
                  </p>
                )}
              </div>
            ))}

          {/* Notas */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notas para cocina <span className="opacity-60 normal-case">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value.slice(0, 200))}
              placeholder="Ej. sin cebolla, término medio…"
              rows={2}
              className="w-full px-3 py-2 border rounded-xl bg-card mt-1 text-sm resize-none"
            />
          </div>

          {/* Cantidad — solo para productos precio_fijo. Para variables la cantidad
              va en el bloque "¿Cuánto quieres?" de arriba. */}
          {!esVariable && (
            <div className="flex items-center justify-between border rounded-xl p-2">
              <span className="text-sm font-semibold pl-2">Cantidad</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(-1)}
                  disabled={cantidad <= 1}
                  className="w-11 h-11 rounded-full border-2 flex items-center justify-center disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-black text-lg w-8 text-center tabular-nums">{cantidad}</span>
                <button
                  type="button"
                  onClick={() => cambiarCantidad(1)}
                  disabled={cantidad >= 99}
                  className="w-11 h-11 rounded-full border-2 flex items-center justify-center disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!puedeConfirmarVariable}
            className="flex-[1.5] h-12 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
          >
            <span>Agregar</span>
            {mostrarPrecios && totalLinea > 0 && (
              <span className="opacity-90">· {formatCurrency(totalLinea)}</span>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
