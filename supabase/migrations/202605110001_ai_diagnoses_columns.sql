alter table public.diagnoses
  add column if not exists service_type_code text,
  add column if not exists image_urls jsonb not null default '[]',
  add column if not exists confidence numeric,
  add column if not exists details text,
  add column if not exists recommendation text,
  add column if not exists raw_response jsonb;

update public.diagnoses
set
  service_type_code = coalesce(service_type_code, service_code),
  image_urls = case
    when image_urls = '[]'::jsonb and photos is not null then photos
    else image_urls
  end
where service_type_code is null
   or image_urls = '[]'::jsonb;

alter table public.diagnoses
  drop constraint if exists diagnoses_result_check;

alter table public.diagnoses
  add constraint diagnoses_result_check
  check (
    result is null
    or result in (
      '교체추천',
      '교체불필요',
      '보류',
      '현장확인필요',
      'replace_recommended',
      'no_replacement_needed',
      'hold',
      'site_check_required'
    )
  );

comment on column public.diagnoses.service_type_code is 'AI 사진 판정 대상 서비스 코드.';
comment on column public.diagnoses.image_urls is '판정에 사용한 이미지 URL 또는 Storage path 배열.';
comment on column public.diagnoses.confidence is 'AI 판정 신뢰도 0.0~1.0.';
comment on column public.diagnoses.details is 'AI 판정 상세 설명.';
comment on column public.diagnoses.recommendation is '고객에게 표시할 추천 안내 문구.';
comment on column public.diagnoses.raw_response is 'AI 모델 원본 JSON 응답.';
