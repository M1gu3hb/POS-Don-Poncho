import { randomUUID } from 'node:crypto';

import { conTransaccion } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { negocioDe } from '../caja/corte/documento.ts';
import { leerConfiguracion as leerConfiguracionTipada } from '../configuracion/configuracion.ts';
import { mezclarEnElDocumento } from '../configuracion/pruebas/otra-escritura-en-medio.ts';
import { payloadDelPortal } from '../portal/consulta.ts';
import { mesaConPortal, PIMIENTA } from '../portal/pruebas/mesa-con-portal.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { escribirDatos } from './comandos.ts';
import { leerConfiguracion } from './configuracion.ts';

/**
 * DP-13.3b · NINGUNA LECTURA DE CONFIGURACIÓN DEVUELVE LAS CLAVES DEL SERVIDOR, contra Postgres.
 *
 * `plataforma` (quién ejecuta los botones que borran en masa) y sus compañeras —el hash y el
 * destino de la presentación, la versión del teléfono de cocina— viven en el MISMO documento
 * que lo que sí se enseña. Que `leerConfiguracion` las filtre no basta: hay otros caminos que
 * leen ese documento y salen al navegador (el puente, la respuesta de guardar, el portal público
 * del comensal, el documento del corte). Cada uno se ejecuta aquí con un documento que lleva
 * las seis claves y valores centinela, y se afirma sobre lo que SALE, serializado.
 *
 * `lecturas-de-configuracion.contrato.test.ts` cuida que no aparezca un lector nuevo sin
 * clasificar; esta prueba cuida que los que sí salen no dejen salir nada.
 */

const EMPLEO = randomUUID();
const ESTACION = randomUUID();

const DEL_SERVIDOR = {
  plataforma: { empleos: [EMPLEO] },
  telefonos_de_cocina: { [ESTACION]: 7 },
  presentacion_password: 'centinela-clave-en-claro',
  presentacion_password_hash: 'centinela-hash',
  presentacion_dueno_empleo: EMPLEO,
  presentacion_destinos: ['centinela-destino'],
} as const;

const CLAVES = Object.keys(DEL_SERVIDOR);
/** Lo que no puede aparecer en NINGUNA parte de lo que sale: ni como clave ni como valor. */
const CENTINELAS = [
  EMPLEO,
  ESTACION,
  'centinela-clave-en-claro',
  'centinela-hash',
  'centinela-destino',
];

function exigirLimpio(salida: unknown, camino: string): void {
  const texto = JSON.stringify(salida);
  for (const clave of CLAVES) {
    expect(texto, `«${camino}» deja salir la clave «${clave}»`).not.toContain(`"${clave}"`);
  }
  for (const centinela of CENTINELAS) {
    expect(texto, `«${camino}» deja salir «${centinela}»`).not.toContain(centinela);
  }
}

async function negocioConLasClavesDelServidor() {
  const caso = await mesaConPortal();
  const org = caso.negocio.organizacionId;
  await conTransaccion((tx) => mezclarEnElDocumento(tx, org, DEL_SERVIDOR));
  return { ...caso, org };
}

describe('lo que sale del puente y del guardado', () => {
  it('la lectura del puente (lo que sirve /api/datos/consultar) no las trae', async () => {
    const { org } = await negocioConLasClavesDelServidor();
    const leida = await leerConfiguracion(org);
    expect(leida['nombre_sistema']).toBeDefined(); // se leyó el documento de verdad
    exigirLimpio(leida, 'puente · leerConfiguracion');
  });

  it('la lectura pública del portal sólo trae su lista blanca', async () => {
    const { org } = await negocioConLasClavesDelServidor();
    exigirLimpio(
      await leerConfiguracion(org, { publica: true }),
      'puente · leerConfiguracion(publica)',
    );
  });

  it('la respuesta de guardar tampoco las devuelve, y lo pedido sí se guarda', async () => {
    const { org, ambito } = await negocioConLasClavesDelServidor();
    const guardada = exigirOk(
      await comando(escribirDatos, {
        ambito,
        entrada: {
          entidad: 'ConfiguracionNegocio',
          operacion: 'update',
          datos: { nombre_sistema: 'POS guardado' },
        },
        idempotencyKey: clave(),
      }),
      'puente.escribir (ConfiguracionNegocio)',
    );
    expect(guardada['nombre_sistema']).toBeDefined(); // la respuesta es la configuración
    exigirLimpio(guardada, 'puente · escribir ConfiguracionNegocio');
    const despues = await leerConfiguracion(org);
    expect(despues['nombre_sistema']).toBe('POS guardado'); // y sí se guardó
    exigirLimpio(despues, 'puente · leer después de guardar');
  });
});

describe('lo que sale por los otros caminos que leen el documento', () => {
  it('la configuración tipada de las pantallas (consultas-produccion, gestion)', async () => {
    const { org } = await negocioConLasClavesDelServidor();
    const tipada = await conTransaccion((tx) => leerConfiguracionTipada(tx, org));
    expect(tipada.nombreNegocio).toBeDefined();
    exigirLimpio(tipada, 'configuracion · leerConfiguracion (tipada)');
  });

  it('el portal del comensal, entero (/api/publico/qr/[token])', async () => {
    const { org, qrToken } = await negocioConLasClavesDelServidor();
    const payload = await payloadDelPortal(org, qrToken, PIMIENTA);
    // El portal se armó de verdad, y su nombre es el del negocio —un texto corto— y no un volcado.
    expect(payload.negocio.nombre_negocio).toBe('Fonda del carrito');
    exigirLimpio(payload, 'portal · payloadDelPortal');
  });

  it('el documento del corte (negocioDe) toma campos con nombre, no el documento', () => {
    const negocio = negocioDe(
      'Fonda',
      { ...DEL_SERVIDOR, direccion: 'Calle 1', pdf_footer: 'Gracias' },
      { sucursalDireccion: null, sucursalTelefono: null },
    );
    expect(negocio.direccion).toBe('Calle 1');
    exigirLimpio(negocio, 'caja · negocioDe');
  });
});
