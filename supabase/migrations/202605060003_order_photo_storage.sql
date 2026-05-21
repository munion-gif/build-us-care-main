insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buildus-order-photos',
  'buildus-order-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists service_role_full_access_buildus_order_photos on storage.objects;
create policy service_role_full_access_buildus_order_photos
on storage.objects
for all
to service_role
using (bucket_id = 'buildus-order-photos')
with check (bucket_id = 'buildus-order-photos');
