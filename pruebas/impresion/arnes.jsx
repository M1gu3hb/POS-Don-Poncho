/**
 * EL ARNÉS DE LA PRUEBA DEL TICKET (DP-20 · refuerzo §1.5). Corre DENTRO del navegador de la prueba.
 *
 * Empaqueta lo MISMO que usa la app en producción: el componente del ticket (`PreCuentaTicket`) y
 * el camino de impresión (`dibujarPieza` → 1 bit → `armarTrabajo`). La prueba (`*.spec.ts`) lo
 * carga en una página en blanco y le pide cada caso; lo que vuelve son los bytes ESC/POS y el
 * mapa de 1 bit que se dibujó, para leerlos de vuelta con la impresora falsa.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import PreCuentaTicket from '@/components/tickets/PreCuentaTicket';
import { marcarReimpresion, ponerPie } from '~/impresion/termico/decorar';
import { dibujarPieza } from '~/impresion/termico/dibujar-elemento';
import { aMonocromo } from '~/impresion/termico/monocromo';
import { perfilPorOmision } from '~/impresion/termico/perfil';
import { aBase64, armarTrabajo } from '~/impresion/termico/trabajo';

const VENTA = {
  id: '00000000-0000-4000-8000-000000000001',
  folio: 'EJEMPLO-7',
  estado: 'pagada',
  personas: 4,
  usuario_mesero_nombre: 'Ángel Muñoz',
  usuario_cajero_nombre: 'Señora Íñiguez',
  fecha_cierre: '2026-11-14T20:15:00.000Z',
  subtotal: 1085,
  descuentos: 50,
  total: 1035,
  metodo_pago: 'efectivo',
  monto_efectivo: 1100,
  cambio: 65,
};

const DETALLES = [
  { cantidad: 2, producto_nombre: 'Barbacoa de borrego en penca de maguey', subtotal: 560 },
  { cantidad: 1, producto_nombre: 'Consomé con garbanzo y arroz', subtotal: 85 },
  {
    cantidad: 3,
    producto_nombre: 'Tacos de pancita',
    subtotal: 195,
    opciones_texto: 'Salsa: Verde · Queso +$15.00',
    notas_producto:
      'Sin cebolla ni cilantro, la salsa aparte y bien caliente; el niño pidió ¿limón? ¡y más tortillas!',
  },
  { cantidad: 4, producto_nombre: 'Agua de piña con chía', subtotal: 160 },
  { cantidad: 1, producto_nombre: 'Pulque curado de piñón ½ litro', subtotal: 85 },
];

/** Un logo con grises (un degradado y un círculo): es lo que obliga al tramado. */
function logoDePrueba() {
  const lienzo = document.createElement('canvas');
  lienzo.width = 240;
  lienzo.height = 120;
  const pincel = lienzo.getContext('2d');
  const degradado = pincel.createLinearGradient(0, 0, 240, 0);
  degradado.addColorStop(0, '#000');
  degradado.addColorStop(1, '#fff');
  pincel.fillStyle = degradado;
  pincel.fillRect(0, 0, 240, 120);
  pincel.fillStyle = '#777';
  pincel.beginPath();
  pincel.arc(120, 60, 40, 0, Math.PI * 2);
  pincel.fill();
  return lienzo.toDataURL('image/png');
}

function configuracion(caso) {
  return {
    nombre_negocio: 'Don Poncho',
    direccion: 'Carr. a Sta. Cecilia #1, San Lorenzo Atemoaya',
    telefono: '55 0000 0000',
    ancho_papel_ticket: caso.papelMm,
    mensaje_ticket: '¡Gracias por tu visita! Vuelve pronto, aquí te esperamos.',
    mostrar_logo_ticket: caso.conLogo,
    logo_ticket_url: caso.conLogo ? logoDePrueba() : '',
    logo_url: '',
    // DP-21 · Bloque 12: los renglones que el dueño apagó en el ticket (`caso.ocultos`).
    papel_a_tu_gusto: {
      ticket: Object.fromEntries((caso.ocultos ?? []).map((campo) => [campo, false])),
    },
  };
}

function ticket(caso, soloLienzo) {
  return (
    <PreCuentaTicket
      venta={VENTA}
      detalles={DETALLES}
      mesa={{ numero: 4, nombre: 'Terraza' }}
      config={configuracion(caso)}
      esFinal
      soloLienzo={soloLienzo}
    />
  );
}

const perfilDe = (caso) => ({
  ...perfilPorOmision(caso.papelMm, { conexion: 'red', host: '192.0.2.1' }),
  franjaFilas: caso.franjaFilas ?? 64,
});

/** Lo que haría la app: dibuja las copias y arma el trabajo. Devuelve los bytes y lo dibujado. */
async function imprimir(caso) {
  const perfil = perfilDe(caso);
  const piezas = [];
  const total = caso.copias ?? 1;
  for (let i = 0; i < total; i += 1) {
    if (caso.desdeElNodo) {
      // Como `printDocument`: una copia del lienzo que está en pantalla, con sus marcas.
      const lienzo = document.querySelector('#en-pantalla [data-lienzo-termico]');
      piezas.push({
        nodo: lienzo,
        preparar(copia) {
          if (caso.reimpresion) marcarReimpresion(copia, caso.reimpresion, caso.papelMm);
          if (total > 1)
            ponerPie(copia, i === 0 ? 'ORIGINAL — CLIENTE' : 'COPIA — NEGOCIO', caso.papelMm);
        },
      });
    } else {
      piezas.push(ticket(caso, true));
    }
  }
  const mapas = [];
  const avisos = [];
  for (const pieza of piezas) {
    const dibujado = await dibujarPieza(pieza, { puntos: perfil.puntos, umbral: perfil.umbral });
    mapas.push(dibujado.mapa);
    avisos.push(...dibujado.avisos);
  }
  const bytes = armarTrabajo(perfil, mapas);
  return {
    base64: aBase64(bytes),
    puntos: perfil.puntos,
    lineasAntesDelCorte: perfil.lineasAntesDelCorte,
    avisos,
    mapas: mapas.map((mapa) => ({
      ancho: mapa.ancho,
      alto: mapa.alto,
      base64: aBase64(mapa.puntos),
    })),
  };
}

let raiz = null;

/** Pinta el ticket en la página: como se ve en pantalla (`#en-pantalla`) y en puntos (`#en-puntos`). */
async function montar(caso) {
  if (raiz !== null) raiz.unmount();
  document.body.innerHTML =
    '<div id="en-pantalla"></div><div id="en-puntos" style="position:absolute;left:0;top:0;background:#fff"></div>';
  const enPantalla = createRoot(document.getElementById('en-pantalla'));
  const enPuntos = createRoot(document.getElementById('en-puntos'));
  flushSync(() => {
    enPantalla.render(ticket(caso, false));
    enPuntos.render(ticket(caso, true));
  });
  raiz = {
    unmount() {
      enPantalla.unmount();
      enPuntos.unmount();
    },
  };
  // El logo carga después de pintar: se mide con el logo ya en su lugar.
  await Promise.all(Array.from(document.images, (imagen) => imagen.decode()));
  const lienzo = document.querySelector('#en-puntos [data-lienzo-termico]');
  const caja = lienzo.getBoundingClientRect();
  const marco = document.querySelector('#en-pantalla .ticket-printable').getBoundingClientRect();
  return {
    ancho: Math.round(caja.width),
    alto: Math.ceil(caja.height),
    anchoEnPantalla: marco.width,
    texto: lienzo.textContent ?? '',
    logos: Array.from(lienzo.querySelectorAll('img'), (img) => {
      const r = img.getBoundingClientRect();
      return { x: r.left - caja.left, y: r.top - caja.top, ancho: r.width, alto: r.height };
    }),
  };
}

/** La captura de la pantalla (PNG en base64), vuelta 1 bit con el mismo umbral. */
async function capturaEnUnBit(pngBase64, umbral) {
  const imagen = new Image();
  await new Promise((resolver, rechazar) => {
    imagen.onload = resolver;
    imagen.onerror = () => rechazar(new Error('La captura no se pudo leer.'));
    imagen.src = `data:image/png;base64,${pngBase64}`;
  });
  const lienzo = document.createElement('canvas');
  lienzo.width = imagen.naturalWidth;
  lienzo.height = imagen.naturalHeight;
  const pincel = lienzo.getContext('2d');
  pincel.drawImage(imagen, 0, 0);
  const pixeles = pincel.getImageData(0, 0, lienzo.width, lienzo.height);
  const mapa = aMonocromo(
    { ancho: lienzo.width, alto: lienzo.height, datos: pixeles.data },
    { umbral },
  );
  return { ancho: mapa.ancho, alto: mapa.alto, base64: aBase64(mapa.puntos) };
}

/** Pone, junto al ticket de la pantalla, el papel que salió de los bytes (a su tamaño real). */
function ponerElPapel(papel) {
  const puntos = Uint8Array.from(atob(papel.base64), (letra) => letra.charCodeAt(0));
  const lienzo = document.createElement('canvas');
  lienzo.id = 'papel';
  lienzo.width = papel.ancho;
  lienzo.height = papel.alto;
  const pincel = lienzo.getContext('2d');
  const pixeles = pincel.createImageData(papel.ancho, papel.alto);
  for (let i = 0; i < puntos.length; i += 1) {
    const tono = puntos[i] === 1 ? 0 : 255;
    pixeles.data.set([tono, tono, tono, 255], i * 4);
  }
  pincel.putImageData(pixeles, 0, 0);
  document.getElementById('en-puntos').remove();
  document.body.style.cssText =
    'margin:0;padding:24px;display:flex;gap:32px;align-items:flex-start;background:#d9d4cb';
  lienzo.style.cssText = `width:${String((papel.ancho / 8) * (96 / 25.4))}px;image-rendering:auto;background:#fff`;
  document.body.appendChild(lienzo);
}

window.arnes = { imprimir, montar, capturaEnUnBit, ponerElPapel };
