select id, access_token
from public.orders
where access_token is not null
order by created_at desc
limit 1;
