import { llamarAlMeseroParaConfirmar, manejadorPublico } from '@morphiqpos/app/portal';

/**
 * `POST /api/publico/qr/:token/carrito/llamar` — DP-12.2.
 *
 * «Llamar a mi mesero para confirmar»: deja una solicitud `ordenar` con la nota «Pedido listo
 * para confirmar (N platillos)». `manejadorPublico` pone el límite por token, la transacción y la
 * idempotencia.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const manejar = manejadorPublico(llamarAlMeseroParaConfirmar);

interface Contexto {
  readonly params: Promise<{ readonly token: string }>;
}

export async function POST(peticion: Request, contexto: Contexto): Promise<Response> {
  const { token } = await contexto.params;
  const salida = await manejar(token, peticion);
  return new Response(JSON.stringify(salida.cuerpo), {
    status: salida.estado,
    headers: salida.cabeceras,
  });
}
