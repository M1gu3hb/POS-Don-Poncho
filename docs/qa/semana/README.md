# DP-18 · La semana simulada, tal como la escribió el simulador

- `DIA-1.md` … `DIA-7.md`: el informe de cada día (volumen del libro, el árbitro y los incidentes), como
  salió al terminar el día. El reporte que los explica es `docs/reports/011-semana-de-operacion.md`.
- `INCIDENTES.md`: todos los incidentes de la semana (día 0 incluido), con su gravedad y clase.
- `REPETICION-DIA-1.md` y `REPETICION-INCIDENTES.md`: la repetición del día 1 con el build de #27.

Lo que hay que saber al leerlos:

- **Los días 2 a 4 se escribieron con fallas del simulador que luego se corrigieron** (cada una está en
  el reporte, §4). La más grande: el árbitro del día 2 comparaba los cobros de toda la semana contra la
  base del día, y los 207 cobros del día 1 salieron como «en el libro y no en la base» (220 críticos
  falsos). Esos días se volvieron a comparar con el árbitro corregido y el resultado está en el reporte.
- **«Prueba mal hecha»** (clase `prueba`) es una falla del simulador, no de la app: se anotó, se esquivó
  y el día siguió.
- Los enlaces firmados del teléfono de cocina (de la copia, no de producción) y las rutas de la laptop
  están tapados; los tiempos van en segundos con un decimal, y el único número que por casualidad
  coincidía con un PIN dice «número omitido».
