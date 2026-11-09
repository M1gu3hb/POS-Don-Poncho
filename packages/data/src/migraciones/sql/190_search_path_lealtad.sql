-- ─────────────────────────────────────────────────────────────────────────────
-- 190 · EL `search_path` DE `lealtad_movimientos_inmutables` (DP-15.1, base propia de Don Poncho).
--
-- El linter de Supabase (regla 0011, `function_search_path_mutable`) marcó una sola función de la base
-- propia: la del disparador que vuelve inmutable `lealtad_movimientos` (088). Sin `search_path` fijo,
-- una función resuelve los nombres con el de quien la llama. Ésta no nombra ningún objeto —sólo
-- lanza un error—, así que hoy no hay hueco; se fija igual que las demás (`pg_catalog, public`, como
-- la 121, 134, 167 y 185) para que el linter quede limpio y para que un cambio futuro del cuerpo no
-- herede el problema.
--
-- Sin datos ni permisos: sólo la configuración de la función. El disparador no cambia.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regprocedure('public.lealtad_movimientos_inmutables()') is null then
    raise exception '190: no existe la función lealtad_movimientos_inmutables()';
  end if;
  if exists (
    select 1
      from pg_proc p, unnest(coalesce(p.proconfig, '{}')) as c(ajuste)
     where p.oid = 'public.lealtad_movimientos_inmutables()'::regprocedure
       and c.ajuste like 'search_path=%'
  ) then
    raise exception '190: lealtad_movimientos_inmutables ya tiene search_path; la base no está como se esperaba';
  end if;
end $$;

alter function public.lealtad_movimientos_inmutables() set search_path = pg_catalog, public;

do $$
begin
  if not exists (
    select 1
      from pg_proc p, unnest(coalesce(p.proconfig, '{}')) as c(ajuste)
     where p.oid = 'public.lealtad_movimientos_inmutables()'::regprocedure
       and c.ajuste = 'search_path=pg_catalog, public'
  ) then
    raise exception '190: lealtad_movimientos_inmutables no quedó con search_path = pg_catalog, public';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgname = 'lealtad_movimientos_sin_update'
       and tgfoid = 'public.lealtad_movimientos_inmutables()'::regprocedure
  ) then
    raise exception '190: el disparador lealtad_movimientos_sin_update dejó de usar la función';
  end if;
end $$;
