do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sms_opt_outs' and column_name = 'user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sms_opt_outs' and column_name = 'from_number'
  ) then
    alter table public.sms_opt_outs add column from_number text;
    update public.sms_opt_outs set from_number = '*';
    alter table public.sms_opt_outs alter column from_number set not null;
    alter table public.sms_opt_outs drop constraint sms_opt_outs_pkey;
    alter table public.sms_opt_outs add primary key (user_id, from_number, recipient);
  end if;
end $$;
