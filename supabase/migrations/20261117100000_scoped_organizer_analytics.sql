-- One authoritative scope and refund policy for dashboard and exports.
create function private.analytics_scope(p_org uuid,p_event uuid,p_days integer)
returns timestamptz language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_org_member(p_org) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if p_days not in (0,7,30,365) or p_days is null then raise exception 'Invalid analytics range' using errcode='22023'; end if;
 if p_event is not null and not exists(select 1 from public.events where id=p_event and organization_id=p_org) then
  raise exception 'Event access denied' using errcode='42501';
 end if;
 if p_days=0 then
  return (date_trunc('day',(select min(t) from (
   select e.created_at t from public.events e where e.organization_id=p_org and (p_event is null or e.id=p_event)
   union all select b.created_at from public.vote_batches b join public.events e on e.id=b.event_id where e.organization_id=p_org and (p_event is null or e.id=p_event)
   union all select coalesce(l.confirmed_at,l.created_at) from public.paid_vote_ledger l where l.organization_id=p_org and (p_event is null or l.event_id=p_event)
   union all select now()
  ) activity) at time zone 'UTC')) at time zone 'UTC';
 end if;
 return ((now() at time zone 'UTC')::date-(p_days-1))::timestamp at time zone 'UTC';
end $$;
revoke all on function private.analytics_scope(uuid,uuid,integer) from public,anon,authenticated;

create function private.analytics_votes(p_org uuid,p_event uuid,p_since timestamptz)
returns table(batch_id uuid,event_id uuid,category_id uuid,nominee_id uuid,created_at timestamptz,recorded_votes bigint,valid_votes bigint,paid boolean)
language sql stable security definer set search_path='' as $$
 select b.id,b.event_id,b.category_id,b.nominee_id,b.created_at,b.quantity::bigint,
 case when b.reversed_at is not null then 0
 when b.payment_attempt_id is null then b.quantity
 when l.status in ('confirmed','refunded','reversed') then greatest(0,b.quantity-ceil(coalesce(l.refunded_amount_minor,0)::numeric/nullif(p.unit_price_minor,0)))
 else 0 end::bigint,b.payment_attempt_id is not null
 from public.vote_batches b join public.events e on e.id=b.event_id
 left join public.payment_attempts p on p.id=b.payment_attempt_id
 left join public.paid_vote_ledger l on l.reference=p.provider_reference
 where e.organization_id=p_org and (p_event is null or e.id=p_event) and b.created_at>=p_since and b.created_at<=now();
$$;
revoke all on function private.analytics_votes(uuid,uuid,timestamptz) from public,anon,authenticated;

create function public.get_scoped_organizer_analytics(p_org uuid,p_event uuid default null,p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 since:=private.analytics_scope(p_org,p_event,p_days);
 with selected_events as (select * from public.events where organization_id=p_org and (p_event is null or id=p_event)),
 votes as materialized (select * from private.analytics_votes(p_org,p_event,since)),
 payments as materialized (select l.* from public.paid_vote_ledger l join selected_events e on e.id=l.event_id
  where l.status in ('confirmed','refunded','reversed') and coalesce(l.confirmed_at,l.created_at)>=since and coalesce(l.confirmed_at,l.created_at)<=now()),
 event_votes as (select event_id,sum(valid_votes) total_votes,sum(case when paid then valid_votes else 0 end) paid_votes from votes group by event_id),
 event_money as (select event_id,sum(gross_amount_minor) gross_minor,sum(refunded_amount_minor) refunded_minor,sum(organizer_net_minor) net_minor from payments group by event_id),
 event_rows as (select e.id event_id,e.name event_name,e.status,coalesce(v.total_votes,0) total_votes,coalesce(v.paid_votes,0) paid_votes,
  coalesce(m.gross_minor,0) gross_minor,coalesce(m.refunded_minor,0) refunded_minor,coalesce(m.net_minor,0) net_minor
  from selected_events e left join event_votes v on v.event_id=e.id left join event_money m on m.event_id=e.id),
 nominee_rows as (select n.id nominee_id,n.name nominee_name,e.id event_id,e.name event_name,c.id category_id,c.name category_name,
  coalesce(sum(v.valid_votes),0) total_votes,coalesce(sum(case when v.paid then v.valid_votes else 0 end),0) paid_votes
  from selected_events e join public.categories c on c.event_id=e.id join public.nominees n on n.category_id=c.id
  left join votes v on v.nominee_id=n.id group by n.id,n.name,e.id,e.name,c.id,c.name),
 category_rows as (select c.id category_id,c.name category_name,e.id event_id,e.name event_name,coalesce(sum(v.valid_votes),0) total_votes,
  coalesce(sum(case when v.paid then v.valid_votes else 0 end),0) paid_votes
  from selected_events e join public.categories c on c.event_id=e.id left join votes v on v.category_id=c.id group by c.id,c.name,e.id,e.name),
 days as (select generate_series(since at time zone 'UTC',(now() at time zone 'UTC')::date::timestamp,interval '1 day')::date as day),
 daily_votes as (select (created_at at time zone 'UTC')::date as day,sum(valid_votes) total_votes,sum(case when paid then valid_votes else 0 end) paid_votes from votes group by 1),
 daily_money as (select (coalesce(confirmed_at,created_at) at time zone 'UTC')::date as day,sum(gross_amount_minor) gross_minor,sum(refunded_amount_minor) refunded_minor,sum(organizer_net_minor) net_minor from payments group by 1),
 daily_traffic as (select a.day,sum(a.views) views from public.event_analytics_daily a join selected_events e on e.id=a.event_id where a.day>=(since at time zone 'UTC')::date and a.day<=(now() at time zone 'UTC')::date group by a.day),
 trends as (select d.day,coalesce(v.total_votes,0) total_votes,coalesce(v.paid_votes,0) paid_votes,coalesce(v.total_votes-v.paid_votes,0) free_votes from days d left join daily_votes v using(day)),
 revenue as (select d.day,coalesce(m.gross_minor,0) gross_minor,coalesce(m.refunded_minor,0) refunded_minor,coalesce(m.net_minor,0) net_minor from days d left join daily_money m using(day))
 select jsonb_build_object(
 'events',coalesce((select jsonb_agg(jsonb_build_object('event_id',id,'event_name',name) order by created_at desc,id) from public.events where organization_id=p_org),'[]'::jsonb),
 'rows',coalesce((select jsonb_agg(to_jsonb(r) order by event_name,event_id) from event_rows r),'[]'::jsonb),
 'nominees',coalesce((select jsonb_agg(to_jsonb(n) order by event_id,category_id,total_votes desc,nominee_id) from nominee_rows n),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(to_jsonb(c) order by event_id,category_name,category_id) from category_rows c),'[]'::jsonb),
 'trends',(select jsonb_agg(to_jsonb(t) order by day) from trends t),
 'revenue',(select jsonb_agg(to_jsonb(r) order by day) from revenue r),
 'views',coalesce((select sum(views) from daily_traffic),0),
 'event_visitors',(select count(distinct (v.event_id,v.visitor_hash)) from private.event_analytics_visitors v join selected_events e on e.id=v.event_id where v.day>=(since at time zone 'UTC')::date and v.day<=(now() at time zone 'UTC')::date)
 ) into result;
 return result;
end $$;
revoke all on function public.get_scoped_organizer_analytics(uuid,uuid,integer) from public,anon;
grant execute on function public.get_scoped_organizer_analytics(uuid,uuid,integer) to authenticated;

create function public.get_scoped_vote_export(p_org uuid,p_event uuid default null,p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 since:=private.analytics_scope(p_org,p_event,p_days);
 select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc,batch_id),'[]'::jsonb) into result from (
 select v.batch_id,v.event_id,e.name event_name,c.name category_name,n.name nominee_name,v.created_at,v.recorded_votes,v.valid_votes,v.paid
 from private.analytics_votes(p_org,p_event,since) v join public.events e on e.id=v.event_id
 join public.categories c on c.id=v.category_id join public.nominees n on n.id=v.nominee_id) r;
 return result;
end $$;
revoke all on function public.get_scoped_vote_export(uuid,uuid,integer) from public,anon;
grant execute on function public.get_scoped_vote_export(uuid,uuid,integer) to authenticated;

create function public.get_scoped_payment_export(p_org uuid,p_event uuid default null,p_days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 since:=private.analytics_scope(p_org,p_event,p_days);
 select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc,reference),'[]'::jsonb) into result from (
 select l.reference,l.event_id,e.name event_name,coalesce(l.confirmed_at,l.created_at) created_at,
 case when l.refunded_amount_minor>0 and l.refunded_amount_minor<l.gross_amount_minor then 'partially refunded' else l.status end status,
 l.gross_amount_minor gross_minor,l.refunded_amount_minor refunded_minor,l.organizer_net_minor net_minor
 from public.paid_vote_ledger l join public.events e on e.id=l.event_id
 where e.organization_id=p_org and (p_event is null or e.id=p_event) and l.status in ('confirmed','refunded','reversed')
 and coalesce(l.confirmed_at,l.created_at)>=since and coalesce(l.confirmed_at,l.created_at)<=now()) r;
 return result;
end $$;
revoke all on function public.get_scoped_payment_export(uuid,uuid,integer) from public,anon;
grant execute on function public.get_scoped_payment_export(uuid,uuid,integer) to authenticated;

create function public.get_scoped_sms_export(p_org uuid,p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 since:=private.analytics_scope(p_org,null,p_days);
 select coalesce(jsonb_agg(to_jsonb(r) order by created_at desc,entry_type,reference),'[]'::jsonb) into result from (
  select 'purchase'::text entry_type,p.reference,p.credits,p.amount_minor,p.refunded_amount_minor refunded_minor,p.status,p.created_at
  from public.sms_credit_purchases p where p.organization_id=p_org and p.created_at>=since and p.created_at<=now()
  union all
  select 'send_attempt',null::text,-1,0,0,case when u.accepted then 'accepted' when u.accepted is false then 'rejected' else 'uncertain' end,u.created_at
  from public.sms_credit_usage u where u.organization_id=p_org and u.created_at>=since and u.created_at<=now()
 ) r;
 return result;
end $$;
revoke all on function public.get_scoped_sms_export(uuid,integer) from public,anon;
grant execute on function public.get_scoped_sms_export(uuid,integer) to authenticated;
