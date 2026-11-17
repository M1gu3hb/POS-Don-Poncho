import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * UN SERVIDOR DE VERDAD para lo que `page.route` no puede probar: la red. Una respuesta que Playwright
 * fabrica con `route.fulfill` no pasa por la red, así que ni un corte (`setOffline`) ni la latencia la
 * tocan. Aquí la página y sus peticiones viajan por un puerto local, que es lo que sí cortan.
 */

export interface ServidorLocal {
  readonly url: string;
  cerrar(): Promise<void>;
}

export async function servirPaginas(paginas: ReadonlyMap<string, string>): Promise<ServidorLocal> {
  const servidor: Server = createServer((peticion, respuesta) => {
    const ruta = new URL(peticion.url ?? '/', 'http://localhost').pathname;
    if (ruta === '/api/calibracion/ok') {
      respuesta.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      return;
    }
    const html = paginas.get(ruta);
    if (html === undefined) {
      respuesta.writeHead(404).end();
      return;
    }
    respuesta.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
  });
  await new Promise<void>((listo) => {
    servidor.listen(0, '127.0.0.1', listo);
  });
  const { port } = servidor.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    cerrar: () =>
      new Promise<void>((listo, falla) => {
        servidor.close((error) => {
          if (error === undefined) listo();
          else falla(error);
        });
        servidor.closeAllConnections();
      }),
  };
}
