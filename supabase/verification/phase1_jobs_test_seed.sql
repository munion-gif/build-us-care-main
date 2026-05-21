insert into public.technicians (
  id,
  name,
  phone,
  type,
  grade,
  skills,
  is_active
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Step6 기사',
  '01099998888',
  'direct',
  'gold',
  '["toilet_replace"]'::jsonb,
  true
)
on conflict (id) do update
set
  name = excluded.name,
  phone = excluded.phone,
  type = excluded.type,
  grade = excluded.grade,
  skills = excluded.skills,
  is_active = excluded.is_active;

select
  'step6_seed_technician' as seed_name,
  id,
  name,
  is_active
from public.technicians
where id = '11111111-1111-4111-8111-111111111111';
