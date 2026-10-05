create or replace function public.get_organization_event_analytics(p_org uuid)
returns table(event_id uuid,event_name text,status text,starts_at timestamptz,ends_at timestamptz,total_votes bigint,free_votes bigint,paid_votes bigint,gross_minor bigint,net_minor bigint,payment_count bigint)
language sql stable security definer set search_path='' as $$
 select e.id,e.name,e.status,e.starts_at,e.ends_at,
   coalesce(sum(case when b.payment_attempt_id is null then b.quantity else greatest(0,b.quantity-ceil(coalesce(l.refunded_amount_minor,0)::numeric/nullif(p.unit_price_minor,0))) end),0)::bigint,
   coalesce(sum(case when b.payment_attempt_id is null then b.quantity else 0 end),0)::bigint,
   coalesce(sum(case when b.payment_attempt_id is null then 0 else greatest(0,b.quantity-ceil(coalesce(l.refunded_amount_minor,0)::numeric/nullif(p.unit_price_minor,0))) end),0)::bigint,
   coalesce(sum(case when l.status in ('confirmed','refunded','reversed') then greatest(0,l.gross_amount_minor-l.refunded_amount_minor) else 0 end),0)::bigint,
   coalesce(sum(case when l.status in ('confirmed','refunded','reversed') then l.organizer_net_minor else 0 end),0)::bigint,
   count(distinct case when l.status in ('confirmed','refunded','reversed') then l.reference end)::bigint
 from public.events e
 left join public.vote_batches b on b.event_id=e.id
 left join public.payment_attempts p on p.id=b.payment_attempt_id
 left join public.paid_vote_ledger l on l.reference=p.provider_reference
 where e.organization_id=p_org and private.is_org_member(p_org)
 group by e.id,e.name,e.status,e.starts_at,e.ends_at,e.created_at
 order by e.created_at desc;
$$;
revoke all on function public.get_organization_event_analytics(uuid) from public,anon;
grant execute on function public.get_organization_event_analytics(uuid) to authenticated;

create or replace function public.get_organization_payment_export(p_org uuid)
returns table(reference text,event_name text,created_at timestamptz,status text,gross_minor bigint,refunded_minor bigint,provider_fee_minor bigint,platform_fee_minor bigint,net_minor bigint)
language sql stable security definer set search_path='' as $$
 select p.provider_reference,coalesce(e.name,'Unknown event'),p.created_at,
   case when l.refunded_amount_minor>0 and l.refunded_amount_minor<l.gross_amount_minor then 'partially refunded' else coalesce(l.status,p.status) end,
   p.total_amount_minor,coalesce(l.refunded_amount_minor,0),coalesce(l.provider_fee_minor,0),
   coalesce(floor((l.gross_amount_minor-coalesce(l.refunded_amount_minor,0))/10.0)::bigint,0),coalesce(l.organizer_net_minor,0)
 from public.payment_attempts p
 left join public.events e on e.id=p.event_id
 left join public.paid_vote_ledger l on l.reference=p.provider_reference
 where p.organization_id=p_org and private.is_org_member(p_org)
 order by p.created_at desc;
$$;
revoke all on function public.get_organization_payment_export(uuid) from public,anon;
grant execute on function public.get_organization_payment_export(uuid) to authenticated;
