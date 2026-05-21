alter table public.notifications
  add column if not exists attempts integer not null default 0 check (attempts >= 0),
  add column if not exists last_error text;

create index if not exists idx_notifications_dispatch_queue
  on public.notifications(send_status, created_at)
  where send_status in ('queued', 'pending');

comment on column public.notifications.attempts is '알림 발송 시도 횟수.';
comment on column public.notifications.last_error is '마지막 알림 발송 실패 사유.';
