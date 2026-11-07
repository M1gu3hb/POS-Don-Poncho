# La mudanza · lo que hace Miguel

Don Poncho pasa de la base compartida de MorphiqPOS a **su propio proyecto de Supabase el lunes 9
de noviembre de 2026**. Tú creas el proyecto el **domingo 8**; yo corro las migraciones en el
proyecto vacío ese mismo domingo, y el lunes, contigo presente, se muda. El guion completo, con
tiempos y regreso atrás, está en [`MUDANZA-FASE-B.md`](MUDANZA-FASE-B.md).

**Costo:** unos **10 USD al mes** más, por el cómputo Micro del proyecto nuevo en la organización
Pro.

**Ningún secreto va al chat, a un correo ni al repositorio.** Todo lo que copies va directo al
archivo `D:\MIS PROYECTOS\MORPHIQ POS\_PRIVADO\fase-b.env` (créalo con el Bloc de notas). Cuando
termines, en el chat sólo escribe «listo».

## Domingo 8 · crear el proyecto (unos 15 minutos)

1. Entra a <https://supabase.com/dashboard> y elige la organización **M1gu3l97** (la Pro).
2. **New project**.
3. **Name:** `POS Don Poncho`.
4. **Database Password:** toca **Generate a password**, cópiala y pégala en `fase-b.env` como
   una línea así (sin espacios alrededor del `=`):

   ```
   POSTGRES_PASSWORD=la-contraseña-que-copiaste
   ```

5. **Region:** **East US (Ohio)** (`us-east-2`). Es la más cercana a las funciones de
   `pos-don-poncho` en Vercel (`cle1`, Cleveland) y la misma de la base compartida: las
   consultas no cambian de distancia.
6. **Compute size:** **Micro**.
7. Lo demás (Data API, seguridad) se queda como viene. **Create new project** y espera a que
   diga que está listo (unos 2 minutos).
8. Arriba, botón **Connect** → pestaña **Connection String** → tipo **URI**:
   - en **Method**, elige **Session pooler**; copia la cadena y pégala como
     `POSTGRES_URL_SESION=` (deja `[YOUR-PASSWORD]` tal cual, yo la completo con la línea 4);
   - en **Method**, elige **Transaction pooler**; copia la cadena y pégala como
     `POSTGRES_URL_TRANSACCION=`.
9. **Project Settings** → **General** → **Project ID**: cópialo como `SUPABASE_REF=`.
10. **Storage** → **New bucket**:
    - **Name:** `pos-don-poncho`;
    - **Public bucket:** apagado (privado);
    - **Create**.
11. **Storage** → **Settings** (S3 Connection):
    - copia **Endpoint** como `STORAGE_ENDPOINT=`;
    - toca **New access key**, descripción `pos-don-poncho`, **Create**; copia **Access key ID**
      como `STORAGE_ACCESS_KEY=` y **Secret access key** como `STORAGE_SECRET_KEY=` (la secreta
      se ve una sola vez);
    - escribe también `STORAGE_BUCKET=pos-don-poncho`.
12. Guarda el archivo y escribe «listo» en el chat.

El archivo queda así (con tus valores en lugar de los puntos):

```
POSTGRES_PASSWORD=…
POSTGRES_URL_SESION=…
POSTGRES_URL_TRANSACCION=…
SUPABASE_REF=…
STORAGE_ENDPOINT=…
STORAGE_ACCESS_KEY=…
STORAGE_SECRET_KEY=…
STORAGE_BUCKET=pos-don-poncho
```

**En Vercel no tienes que hacer nada:** las variables las cambio yo el lunes, por la entrada
estándar del CLI, y sólo esas cinco (`DATABASE_URL` y las cuatro `STORAGE_*`).

## Domingo 8 · lo que hago yo después

- Doy de alta el rol de la aplicación (`morphiqpos_app`) con su propia contraseña (va a
  `fase-b.env`, nunca al chat) y corro las migraciones hasta la 188 con `pnpm db:migrate`, más
  `verify:esquema` estricto. El proyecto está vacío: no hay riesgo, y el lunes sólo se importa.

## Lunes 9 · contigo (unos 45 minutos, con el restaurante cerrado)

1. Confirmas que nadie usa el POS (cajas cerradas, tabletas apagadas).
2. Yo: huella de los otros 10 negocios, exportación con `--exigir-cerrado`, importación, conteos y
   md5, `verify:esquema` estricto, las cinco variables de Vercel y el redespliegue.
3. **Tú entras con tu PIN** en <https://pos-don-poncho.vercel.app> y abres cada pantalla una vez.
   Sin cobrar nada: el primer ticket real tiene que ser el folio 1.
4. Yo: el QR de una mesa con su código de siempre, el teléfono de cocina y el portal; la huella de
   los otros 10, idéntica.

Si algo falla después de cambiar las variables, se regresan las de la compartida y se redespliega
(10 minutos). La compartida conserva los datos de Don Poncho intactos como respaldo.

## Martes 10 · tus PIN

Desde Configuración → Usuarios POS cambias el PIN de cada persona, tecleándolo tú, empezando por
el tuyo. Nadie más los ve: ni el chat, ni el repositorio.
