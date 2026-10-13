-- Arkesel supplies incremental inputs rather than a cumulative navigation path.
alter table public.ussd_sessions
  add column native_path text not null default '',
  add column native_reply jsonb,
  add column native_lease uuid,
  add column native_lease_until timestamptz,
  add column native_previous_path text,
  add column native_user_id text,
  add column native_network text;

create function public.begin_native_ussd(p_session text,p_hash text,p_user text,p_network text,p_new boolean,p_input text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.ussd_sessions%rowtype; lease uuid;
begin
 if p_session is null or p_session !~ '^[A-Za-z0-9_-]{1,128}$' or p_hash !~ '^[a-f0-9]{64}$' or p_user is null or char_length(p_user) not between 1 and 128 or p_network is null or char_length(p_network) not between 1 and 64 or p_new is null or p_input is null or char_length(p_input)>100 then raise exception 'Invalid callback'; end if;
 if p_new then
  insert into public.ussd_sessions(session_id,phone_hash,native_user_id,native_network)
  values(p_session,p_hash,p_user,p_network) on conflict(session_id) do nothing;
 end if;
 select * into s from public.ussd_sessions where session_id=p_session for update;
 if not found or s.phone_hash is distinct from p_hash or s.native_user_id is distinct from p_user or s.native_network is distinct from p_network then raise exception 'Session mismatch'; end if;
 if s.expires_at<=now() then raise exception 'Session expired'; end if;
 if s.native_lease_until>now() then return jsonb_build_object('busy',true); end if;
 if s.native_reply is not null and (p_new or coalesce((s.native_reply->>'continueSession')::boolean,false)=false) then return jsonb_build_object('reply',s.native_reply); end if;
 if not p_new and p_input !~ '^[0-9]{1,12}$' then raise exception 'Use numeric input'; end if;
 lease:=gen_random_uuid();
 -- Recover an interrupted request at its previous path, never reset a vote identity.
 if s.native_lease is not null then s.native_path:=coalesce(s.native_previous_path,''); end if;
 update public.ussd_sessions set native_previous_path=s.native_path,
  native_path=case when p_new then s.native_path else s.native_path||case when s.native_path='' then '' else '*' end||p_input end,
  native_lease=lease,native_lease_until=now()+interval '45 seconds' where session_id=p_session
  returning * into s;
 if char_length(s.native_path)>1000 then raise exception 'Session too long'; end if;
 return jsonb_build_object('path',s.native_path,'lease',lease);
end $$;

create function public.finish_native_ussd(p_session text,p_hash text,p_lease uuid,p_reply jsonb,p_failed boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.ussd_sessions set native_reply=case when p_failed then native_reply else p_reply end,
  native_path=case when p_failed then coalesce(native_previous_path,'') else native_path end,
  native_lease=null,native_lease_until=null,native_previous_path=null
 where session_id=p_session and phone_hash=p_hash and native_lease=p_lease;
 if not found then raise exception 'Session lease changed'; end if;
end $$;
revoke all on function public.begin_native_ussd(text,text,text,text,boolean,text),public.finish_native_ussd(text,text,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.begin_native_ussd(text,text,text,text,boolean,text),public.finish_native_ussd(text,text,uuid,jsonb,boolean) to service_role;
