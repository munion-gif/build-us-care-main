INSERT INTO public.app_configs (key, value, description)
VALUES
  ('admin_email', '', '관리자 이메일 알림 수신 주소'),
  ('admin_phone', '', '관리자 SMS 알림 수신 번호'),
  ('notify_channel', 'none', '관리자 알림 방식: email, sms, kakao, none'),
  ('warranty_period_days', '365', 'A/S 보증 기간'),
  ('warranty_reminder_days', '30', 'A/S 만료 전 알림 대상 기간')
ON CONFLICT (key) DO NOTHING;
