import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { TIPO_VENTA } from '@/utils/tipoVentaUtils';
import { sonar } from '~/sonidos/gestor';
import { ColaDeUnoEnUno } from '~/restaurante/cola-de-uno-en-uno';
import { conSusOpciones, pideOpciones } from '~/restaurante/opciones-de-los-platillos';
import { consultaDeLasOpciones } from '~/restaurante/use-opciones-de-los-platillos';
import {
  almacenDelBorrador,
  borrarBorrador,
  guardarBorrador,
  leerBorrador,
} from '~/restaurante/borrador-del-pedido';

/**
 * DP-16 · EL PEDIDO QUE SE ESTÁ ARMANDO, con las reglas del mesero.
 *
 * Agregar un platillo hace lo mismo que en `Mesero.jsx`: lo agotado no entra; si el platillo pide
 * opciones se espera su lectura (y si falla se ofrece reintentar); lo que va por peso o porción
 * abre su diálogo; lo que tiene grupos abre el de opciones, uno a la vez. Lo armado se guarda en el
 * aparato (`borrador-del-pedido`) y sobrevive a una recarga.
 *
 * A diferencia del carrito del mesero, cada renglón lleva su propia `_linea`: dos barbacoas de
 * distinto peso son dos renglones, y cambiar la cantidad de una no toca a la otra.
 */

let consecutivo = 0;
const nuevaLinea = () => {
  consecutivo += 1;
  return `l${Date.now().toString(36)}${consecutivo.toString(36)}`;
};

export function tieneGrupos(producto) {
  const grupos = Array.isArray(producto?.modificadores) ? producto.modificadores : [];
  return grupos.some(
    (g) =>
      g?.activo !== false &&
      String(g?.nombre || '').trim() &&
      (Array.isArray(g.opciones) ? g.opciones : []).some(
        (o) => o?.activo !== false && String(o?.nombre || '').trim(),
      ),
  );
}

function textoDeLasOpciones(modificadores) {
  return (Array.isArray(modificadores) ? modificadores : [])
    .filter((m) => m && Array.isArray(m.opciones) && m.opciones.length > 0)
    .map(
      (m) =>
        `${m.grupo_nombre}: ${m.opciones
          .map((o) => o.nombre)
          .filter(Boolean)
          .join(', ')}`,
    )
    .join(' · ');
}

/**
 * @param {{ claveDelAparato: string | null, ordenDelBorrador: string, opcionesListas: boolean }} p
 */
export function useArmadoDelPedido({ claveDelAparato, ordenDelBorrador, opcionesListas }) {
  const queryClient = useQueryClient();
  const [guardado] = useState(() =>
    claveDelAparato
      ? leerBorrador(almacenDelBorrador(), claveDelAparato, ordenDelBorrador, Date.now())
      : null,
  );
  const [carrito, setCarrito] = useState(() => (guardado ? [...guardado.carrito] : []));
  // La nota del pedido (en el pedido para llevar, el nombre del cliente) viaja con el borrador.
  const [nota, setNota] = useState(() => guardado?.nota ?? '');
  const [productoParaPersonalizar, setProductoParaPersonalizar] = useState(null);
  const [turnoDePersonalizar, setTurnoDePersonalizar] = useState(0);
  const [productoVariable, setProductoVariable] = useState(null);
  const [lecturaDeOpciones, setLecturaDeOpciones] = useState(null);
  const colaRef = useRef(new ColaDeUnoEnUno());
  const toqueRef = useRef(0);

  useEffect(() => {
    if (!claveDelAparato) return;
    guardarBorrador(
      almacenDelBorrador(),
      claveDelAparato,
      { ordenId: ordenDelBorrador, carrito, nota },
      Date.now(),
    );
  }, [carrito, nota, claveDelAparato, ordenDelBorrador]);

  const total = useMemo(
    () => carrito.reduce((s, i) => s + (Number(i.precio_venta) || 0) * (Number(i.cantidad) || 0), 0),
    [carrito],
  );

  const abrirPersonalizacion = (producto) => {
    if (colaRef.current.llegar(producto)) {
      setTurnoDePersonalizar((n) => n + 1);
      setProductoParaPersonalizar(producto);
    }
  };
  const cerrarPersonalizacion = () => {
    setTurnoDePersonalizar((n) => n + 1);
    setProductoParaPersonalizar(colaRef.current.terminar());
  };

  const agregar = async (productoTocado) => {
    if (productoTocado?.agotado_hoy === true) {
      toast.error(`${productoTocado.nombre} se agotó por hoy`);
      return;
    }
    let producto = productoTocado;
    const sinSusGrupos = productoTocado?.tiene_opciones === true && !tieneGrupos(productoTocado);
    const esperaLaLectura = opcionesListas
      ? sinSusGrupos
      : pideOpciones(productoTocado, undefined) !== 'no';
    if (esperaLaLectura) {
      const toque = toqueRef.current;
      const aviso = setTimeout(
        () => setLecturaDeOpciones({ producto: productoTocado, estado: 'leyendo' }),
        600,
      );
      try {
        const opciones = opcionesListas
          ? await queryClient.fetchQuery(consultaDeLasOpciones())
          : await queryClient.ensureQueryData(consultaDeLasOpciones());
        if (toque !== toqueRef.current) return;
        producto = conSusOpciones([productoTocado], opciones)[0];
        setLecturaDeOpciones(null);
      } catch (error) {
        console.error('[Para llevar] opciones de los platillos:', error);
        if (toque === toqueRef.current) {
          setLecturaDeOpciones({ producto: productoTocado, estado: 'fallo' });
        }
        return;
      } finally {
        clearTimeout(aviso);
      }
    }
    if (
      producto?.tipo_venta === TIPO_VENTA.VARIABLE_MEDIDA ||
      producto?.tipo_venta === TIPO_VENTA.PORCION_CONTENEDOR
    ) {
      setProductoVariable(producto);
      return;
    }
    if (tieneGrupos(producto)) {
      abrirPersonalizacion(producto);
      return;
    }
    sonar('agregar');
    setCarrito((prev) => {
      const igual = prev.find(
        (i) => i.id === producto.id && !i._variable && (i._modificadores || []).length === 0 && !i.notas,
      );
      if (igual) {
        return prev.map((i) => (i._linea === igual._linea ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [
        ...prev,
        { ...producto, _linea: nuevaLinea(), cantidad: 1, notas: '', _notaUsuario: '', _exclusiones: [], _modificadores: [] },
      ];
    });
  };

  const confirmarCantidadVariable = (snapshot) => {
    const producto = productoVariable;
    setProductoVariable(null);
    if (!producto || !snapshot) return;
    sonar('agregar');
    setCarrito((prev) => [
      ...prev,
      {
        ...producto,
        _linea: nuevaLinea(),
        cantidad: 1,
        // El carrito suma precio × 1: el precio del renglón ya trae el peso.
        precio_venta: Number(snapshot?.precio_total_linea) || 0,
        notas: '',
        _notaUsuario: '',
        _exclusiones: [],
        _modificadores: [],
        _variable: snapshot,
      },
    ]);
  };

  const confirmarPersonalizacion = ({ modificadores, notas }) => {
    const producto = productoParaPersonalizar;
    if (!producto) return;
    const delPlatillo = (notas || '').trim();
    sonar('agregar');
    setCarrito((prev) => [
      ...prev,
      {
        ...producto,
        _linea: nuevaLinea(),
        cantidad: 1,
        notas: [textoDeLasOpciones(modificadores), delPlatillo].filter(Boolean).join(' · '),
        _notaUsuario: delPlatillo,
        _exclusiones: [],
        _modificadores: Array.isArray(modificadores) ? modificadores : [],
      },
    ]);
    cerrarPersonalizacion();
  };

  const cambiarCantidad = (linea, delta) => {
    const actual = carrito.find((i) => i._linea === linea);
    sonar(actual && actual.cantidad + delta > 0 ? 'cantidad' : 'quitar');
    setCarrito((prev) =>
      prev
        .map((i) => (i._linea === linea ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0),
    );
  };
  const cambiarNotas = (linea, notas) =>
    setCarrito((prev) =>
      prev.map((i) =>
        i._linea === linea ? { ...i, notas: notas || '', _notaUsuario: notas || i._notaUsuario || '' } : i,
      ),
    );
  const cambiarExclusiones = (linea, exclusiones) =>
    setCarrito((prev) =>
      prev.map((i) =>
        i._linea === linea ? { ...i, _exclusiones: Array.isArray(exclusiones) ? exclusiones : [] } : i,
      ),
    );

  const vaciar = () => {
    setCarrito([]);
    setNota('');
    if (claveDelAparato) borrarBorrador(almacenDelBorrador(), claveDelAparato);
  };

  return {
    recuperado: guardado !== null,
    carrito,
    setCarrito,
    nota,
    setNota,
    total,
    agregar,
    cambiarCantidad,
    cambiarNotas,
    cambiarExclusiones,
    vaciar,
    dialogos: {
      productoParaPersonalizar,
      turnoDePersonalizar,
      cerrarPersonalizacion,
      confirmarPersonalizacion,
      productoVariable,
      cerrarVariable: () => setProductoVariable(null),
      confirmarCantidadVariable,
      lecturaDeOpciones,
      cerrarLectura: () => {
        toqueRef.current += 1;
        setLecturaDeOpciones(null);
      },
      reintentarLectura: () => {
        const producto = lecturaDeOpciones?.producto;
        setLecturaDeOpciones({ producto, estado: 'leyendo' });
        void agregar(producto);
      },
    },
  };
}
