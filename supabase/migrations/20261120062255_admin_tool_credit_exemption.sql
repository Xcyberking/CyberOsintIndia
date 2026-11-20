-- Preserve unlimited tool access for active administrators in the query-aware credit RPC.
-- Keep administrator searches in history without charging credits.
create or replace function public.consume_tool_credit(
  p_tool_slug text,
  p_query text
) returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := (select auth.uid());
  cost integer;
  remaining integer;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  select credit_cost
    into cost
    from public.tools
   where slug = p_tool_slug
     and enabled = true;

  if not found then
    raise exception 'Tool is unavailable';
  end if;
  if cost is null or cost < 0 then
    raise exception 'Invalid tool credit configuration';
  end if;

  if private.is_admin() then
    select credits
      into remaining
      from public.profiles
     where id = uid
       and status = 'active';
    if not found then
      raise exception 'Your account is not active';
    end if;

    insert into public.search_history(user_id, tool_slug, input_summary, status)
    values (uid, left(p_tool_slug, 80), left(p_query, 500), 'success');

    return remaining;
  end if;

  update public.profiles
     set credits = credits - cost,
         updated_at = now()
   where id = uid
     and status = 'active'
     and credits >= cost
  returning credits into remaining;

  if not found then
    raise exception 'Insufficient credits or inactive account';
  end if;

  insert into public.credit_transactions(user_id, amount, delta, reason)
  values (uid, -cost, -cost, 'Tool use: ' || left(p_tool_slug, 80));

  insert into public.search_history(user_id, tool_slug, input_summary, status)
  values (uid, left(p_tool_slug, 80), left(p_query, 500), 'success');

  return remaining;
end;
$function$;
