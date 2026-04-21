-- ============================================================
-- 沃勝 Pipeline — Seed data (6 existing customers from Excel)
-- Run this AFTER your 10 team members have logged in at least once
-- (so their profiles exist), and AFTER you update the RM emails below.
-- ============================================================

-- Step 1: promote yourself to manager
-- Replace with your own Google login email
update public.profiles set role = 'manager'
  where email = 'YOUR_EMAIL@example.com';

-- Step 2: seed 6 deals (replace RM emails to match actual team members)
do $$
declare
  hugh_id  uuid;
  ada_id   uuid;
  kenny_id uuid;
  d_id     uuid;
begin
  select id into hugh_id  from public.profiles where email = 'hugh@yourdomain.com'  limit 1;
  select id into ada_id   from public.profiles where email = 'ada@yourdomain.com'   limit 1;
  select id into kenny_id from public.profiles where email = 'kenny@yourdomain.com' limit 1;

  if hugh_id is null or ada_id is null or kenny_id is null then
    raise notice 'One or more RM profiles not found. Ask team members to log in first, then update the emails in this seed file.';
    return;
  end if;

  -- 陳先生
  insert into public.deals (name, rm_id, aum_usd, product, first_contact, last_updated, stage, next_step)
    values ('陳先生', hugh_id, 1000000, 'HSBC 500萬', '2026-03-01', '2026-04-10', 'L3', '林小姐 (CFO)') returning id into d_id;
  update public.scores set m=7,e=6,d1=7,d2=5,p=4,i=8,c1=5,c2=3 where deal_id = d_id;

  -- 王董事長
  insert into public.deals (name, rm_id, aum_usd, product, first_contact, last_updated, stage, next_step)
    values ('王董事長', hugh_id, 8000000, '宏利 5M + 公司戶', '2026-02-15', '2026-04-05', 'L5', '下週簽約') returning id into d_id;
  update public.scores set m=8,e=8,d1=9,d2=7,p=6,i=9,c1=7,c2=5 where deal_id = d_id;

  -- 李太太
  insert into public.deals (name, rm_id, aum_usd, product, first_contact, last_updated, stage, next_step)
    values ('李太太', ada_id, 300000, 'PLR + CIMB', '2026-03-20', '2026-04-12', 'L2', '找配偶面談') returning id into d_id;
  update public.scores set m=5,e=3,d1=4,d2=4,p=2,i=6,c1=4,c2=3 where deal_id = d_id;

  -- 張先生
  insert into public.deals (name, rm_id, aum_usd, product, first_contact, last_updated, stage, next_step)
    values ('張先生', ada_id, 5000000, 'HSBC 3000萬', '2026-01-10', '2026-02-20', 'L2', 'EB 無法見面,降級') returning id into d_id;
  update public.scores set m=6,e=2,d1=5,d2=4,p=3,i=5,c1=2,c2=4 where deal_id = d_id;

  -- 趙董事
  insert into public.deals (name, rm_id, aum_usd, product, first_contact, last_updated, stage, next_step)
    values ('趙董事', kenny_id, 30000000, 'HSBC 3000萬 + 宏利 80M', '2026-04-01', '2026-04-14', 'L5', '核保中') returning id into d_id;
  update public.scores set m=9,e=9,d1=9,d2=8,p=7,i=9,c1=8,c2=6 where deal_id = d_id;

  -- 錢家族
  insert into public.deals (name, rm_id, aum_usd, product, first_contact, last_updated, stage, next_step)
    values ('錢家族', kenny_id, 2000000, '香港分紅 + 保誠 + DBS', '2026-03-10', '2026-04-08', 'L4', '下週提案') returning id into d_id;
  update public.scores set m=7,e=7,d1=8,d2=6,p=5,i=8,c1=7,c2=4 where deal_id = d_id;
end $$;
