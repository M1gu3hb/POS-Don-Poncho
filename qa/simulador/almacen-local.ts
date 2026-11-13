/**
 * UN ALMACÉN DE ARCHIVOS LOCAL para el simulador: la parte de la API de Almacenamiento de Supabase
 * que usa `packages/data/src/archivos.ts` (guardar, obtener, borrar, copiar y listar), sobre una
 * carpeta de esta máquina. Así las fotos de los platillos se suben de verdad en la copia sin tocar
 * el bucket de producción. Escucha sólo en 127.0.0.1.
 *
 *   node qa/simulador/almacen-local.ts --carpeta D:/mpos-tmp/dp18/almacen --puerto 54500
 *   → STORAGE_ENDPOINT=http://127.0.0.1:54500/storage/v1
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const PREFIJO = '/storage/v1/object/';

/** La ruta en disco de una clave, sin escaparse de la carpeta (`..` no sale). */
export function rutaSegura(carpeta: string, bucket: string, clave: string): string {
  const destino = normalize(join(carpeta, bucket, ...clave.split('/').map(decodeURIComponent)));
  const dentro = relative(join(carpeta, bucket), destino);
  if (dentro === '' || dentro.startsWith('..') || /^[a-zA-Z]:/.test(dentro)) {
    throw new Error('Ruta fuera del almacén');
  }
  return destino;
}

async function cuerpo(req: IncomingMessage): Promise<Buffer> {
  const trozos: Buffer[] = [];
  for await (const t of req) trozos.push(t as Buffer);
  return Buffer.concat(trozos);
}

function responder(
  res: ServerResponse,
  estado: number,
  datos?: unknown,
  tipo = 'application/json',
): void {
  res.writeHead(estado, { 'content-type': tipo });
  res.end(
    datos === undefined
      ? ''
      : tipo === 'application/json'
        ? JSON.stringify(datos)
        : (datos as Buffer),
  );
}

export function crearAlmacenLocal(carpeta: string) {
  const tipos = new Map<string, string>();
  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith(PREFIJO)) {
        responder(res, 404, { error: 'no' });
        return;
      }
      const resto = url.pathname.slice(PREFIJO.length);
      if (req.method === 'POST' && resto === 'copy') {
        const b = JSON.parse((await cuerpo(req)).toString('utf8')) as Record<string, string>;
        const origen = rutaSegura(carpeta, b['bucketId'] ?? '', b['sourceKey'] ?? '');
        const destino = rutaSegura(carpeta, b['bucketId'] ?? '', b['destinationKey'] ?? '');
        mkdirSync(dirname(destino), { recursive: true });
        copyFileSync(origen, destino);
        tipos.set(destino, tipos.get(origen) ?? 'application/octet-stream');
        responder(res, 200, { Key: b['destinationKey'] });
        return;
      }
      if (req.method === 'POST' && resto.startsWith('list/')) {
        const bucket = decodeURIComponent(resto.slice('list/'.length));
        const b = JSON.parse((await cuerpo(req)).toString('utf8')) as {
          prefix?: string;
          limit?: number;
          offset?: number;
        };
        const dir = join(carpeta, bucket, ...(b.prefix ?? '').split('/').filter((p) => p !== ''));
        const nombres = existsSync(dir) ? readdirSync(dir).sort() : [];
        const pagina = nombres.slice(b.offset ?? 0, (b.offset ?? 0) + (b.limit ?? 100)).map((n) => {
          const s = statSync(join(dir, n));
          return s.isDirectory()
            ? { name: n, id: null }
            : { name: n, id: n, metadata: { size: s.size } };
        });
        responder(res, 200, pagina);
        return;
      }
      const [bucketCodificado, ...partes] = resto.split('/');
      const archivo = rutaSegura(
        carpeta,
        decodeURIComponent(bucketCodificado ?? ''),
        partes.join('/'),
      );
      if (req.method === 'POST' || req.method === 'PUT') {
        mkdirSync(dirname(archivo), { recursive: true });
        writeFileSync(archivo, await cuerpo(req));
        tipos.set(archivo, req.headers['content-type'] ?? 'application/octet-stream');
        responder(res, 200, { Key: resto });
        return;
      }
      if (req.method === 'GET') {
        if (!existsSync(archivo)) {
          responder(res, 404, { error: 'not_found' });
          return;
        }
        responder(
          res,
          200,
          readFileSync(archivo),
          tipos.get(archivo) ?? 'application/octet-stream',
        );
        return;
      }
      if (req.method === 'DELETE') {
        if (!existsSync(archivo)) {
          responder(res, 404, { error: 'not_found' });
          return;
        }
        rmSync(archivo);
        responder(res, 200, {});
        return;
      }
      responder(res, 405, { error: 'método' });
    })().catch((error: unknown) => {
      responder(res, 400, { error: String(error) });
    });
  });
}

if (import.meta.main) {
  const arg = (n: string, d: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i === -1 ? d : (process.argv[i + 1] ?? d);
  };
  const carpeta = arg('carpeta', 'D:/mpos-tmp/dp18/almacen');
  const puerto = Number(arg('puerto', '54500'));
  mkdirSync(carpeta, { recursive: true });
  crearAlmacenLocal(carpeta).listen(puerto, '127.0.0.1', () => {
    console.log(`Almacén local en http://127.0.0.1:${String(puerto)}/storage/v1 → ${carpeta}`);
  });
}
