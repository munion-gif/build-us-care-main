CREATE TABLE IF NOT EXISTS public.app_configs (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON public.app_configs;
CREATE POLICY "service role full access" ON public.app_configs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.app_configs (key, value, description)
VALUES
  ('kakao_channel_url', 'https://pf.kakao.com/_placeholder', '고객 상담 카카오 채널 URL'),
  ('service_phone', '010-0000-0000', '대표 상담 전화번호'),
  ('slot_cap', '3', '오전/오후 각 최대 예약 건수'),
  ('maintenance_mode', 'false', 'true이면 홈에 점검 안내 표시'),
  ('admin_email', '', '관리자 이메일 알림 수신 주소'),
  ('admin_phone', '', '관리자 SMS 알림 수신 번호'),
  ('notify_channel', 'none', '관리자 알림 방식: email, sms, kakao, none'),
  ('warranty_period_days', '365', 'A/S 보증 기간'),
  ('warranty_reminder_days', '30', 'A/S 만료 전 알림 대상 기간')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.events
SET created_at = COALESCE(created_at, occurred_at, now())
WHERE created_at IS NULL;

ALTER TABLE public.events
  ALTER COLUMN created_at SET DEFAULT now();
