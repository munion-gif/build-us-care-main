CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text DEFAULT 'general',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS faqs_question_uq ON public.faqs (question);
CREATE INDEX IF NOT EXISTS idx_faqs_active_order ON public.faqs (is_active, display_order, created_at);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON public.faqs;
CREATE POLICY "service role full access" ON public.faqs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.faqs (question, answer, display_order, is_active)
VALUES
  ('견적은 무료인가요?', '네, 견적 확인까지는 무료입니다. 결제는 견적을 수락하신 후 진행됩니다.', 1, true),
  ('예약 취소는 어떻게 하나요?', '주문 현황 페이지에서 [예약 취소] 버튼을 눌러주세요. 결제 후 24시간 이내 + 방문 3일 전까지는 전액 환불됩니다.', 2, true),
  ('시공 후 하자가 발생하면 어떻게 하나요?', '시공 완료 후 1년간 무상 A/S를 제공합니다. 주문 현황 페이지에서 [A/S 신청]을 눌러주세요.', 3, true),
  ('현장 상황이 견적과 다르면?', '기사님이 현장 확인 후 추가 비용이 발생할 수 있습니다. 고객님께 먼저 안내드린 후 진행합니다.', 4, true),
  ('결제 수단은 무엇이 있나요?', '신용카드, 체크카드 결제가 가능합니다.', 5, true),
  ('사진 판정은 정확한가요?', 'AI가 사진을 분석해 1차 판정을 제공합니다. 정확한 진단은 기사님의 현장 확인 후 최종 확정됩니다.', 6, true)
ON CONFLICT (question) DO UPDATE SET
  answer = EXCLUDED.answer,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS experience_years integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS profile_image_url text;

COMMENT ON COLUMN public.technicians.experience_years IS '경력 (년)';
COMMENT ON COLUMN public.technicians.specialties IS '전문 분야 배열';
COMMENT ON COLUMN public.technicians.bio IS '한 줄 소개';
COMMENT ON COLUMN public.technicians.profile_image_url IS '프로필 사진 URL';

ANALYZE public.faqs;
ANALYZE public.technicians;
