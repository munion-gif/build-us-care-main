import { DiagnosisPanel } from "./diagnoses-client";
import { formatKRDateTime, formatServiceName } from "@/lib/format";
import { measure } from "@/lib/perf";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ result?: string; id?: string; offset?: string; page?: string; order?: string }> };

const RESULT_LABELS: Record<string, string> = {
  교체추천: "교체추천",
  교체불필요: "교체불필요",
  보류: "보류",
  현장확인필요: "현장확인필요",
  replace_recommended: "교체추천",
  no_replacement_needed: "교체불필요",
  hold: "보류",
  site_check_required: "현장확인필요"
};
const RESULT_FILTER_VALUES: Record<string, string[]> = {
  교체추천: ["교체추천", "replace_recommended", "replacement_recommended"],
  교체불필요: ["교체불필요", "no_replacement_needed", "not_needed"],
  보류: ["보류", "hold"],
  현장확인필요: ["현장확인필요", "site_check_required"]
};

function badgeClass(result?: string | null) {
  const label = RESULT_LABELS[result ?? ""] ?? result;
  if (label === "교체추천") return "adm-badge-orange";
  if (label === "교체불필요") return "adm-badge-green";
  if (label === "보류") return "adm-badge-sky";
  if (label === "현장확인필요") return "adm-badge-red";
  return "adm-badge-gray";
}

function nextActionLabel(result?: string | null) {
  const label = RESULT_LABELS[result ?? ""] ?? result;
  if (!label) return "판정 입력";
  if (label === "교체추천") return "견적/서비스 연결";
  if (label === "현장확인필요") return "상담 후 방문 판단";
  if (label === "보류") return "추가 사진 요청";
  if (label === "교체불필요") return "안내 후 종료";
  return "확인 필요";
}

function statusLabel(result?: string | null) {
  return RESULT_LABELS[result ?? ""] ?? result ?? "대기";
}

function orderNumber(diagnosis: any) {
  const order = Array.isArray(diagnosis.orders) ? diagnosis.orders[0] : diagnosis.orders;
  return order?.order_number ?? diagnosis.raw_response?.receipt_number ?? diagnosis.raw_response?.order_number ?? null;
}

function diagnosesHref(params: { result: string; id?: string; page?: number; orderSearch?: string }) {
  const query = new URLSearchParams();
  query.set("result", params.result);
  if (params.id) query.set("id", params.id);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.orderSearch) query.set("order", params.orderSearch);
  return `/admin/diagnoses?${query.toString()}`;
}

function imageInputs(diagnosis: any): string[] {
  const urls = Array.isArray(diagnosis.image_urls) ? diagnosis.image_urls : [];
  const photos = Array.isArray(diagnosis.photos) ? diagnosis.photos : [];
  return photos.length ? photos : urls;
}

function customerName(diagnosis: any) {
  return diagnosis.customer_name ?? diagnosis.raw_response?.customer?.name ?? null;
}

function customerPhone(diagnosis: any) {
  return diagnosis.customer_phone ?? diagnosis.raw_response?.customer?.phone ?? null;
}

function photoCount(diagnosis: any) {
  return imageInputs(diagnosis).length;
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function signImages(diagnosis: any) {
  const supabase = getSupabaseAdmin();
  const signedPhotos = await Promise.all(
    imageInputs(diagnosis).slice(0, 3).map(async (photo) => {
      if (isUrl(photo)) return photo;
      const { data } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUrl(photo, ORDER_PHOTO_VIEW_EXPIRES_IN);
      return data?.signedUrl ?? null;
    })
  );
  return {
    ...diagnosis,
    customer_name: customerName(diagnosis),
    customer_phone: customerPhone(diagnosis),
    signedPhotos: signedPhotos.filter(Boolean)
  };
}

async function findDiagnosisIdsByOrderNumber(search: string) {
  const supabase = getSupabaseAdmin();
  const [receiptMatches, rawMatches, linkedOrders, recentDiagnoses] = await Promise.all([
    supabase
      .from("diagnoses")
      .select("id")
      .ilike("raw_response->>receipt_number", `%${search}%`)
      .limit(100),
    supabase
      .from("diagnoses")
      .select("id")
      .ilike("raw_response->>order_number", `%${search}%`)
      .limit(100),
    supabase
      .from("orders")
      .select("id")
      .ilike("order_number", `%${search}%`)
      .limit(100),
    supabase
      .from("diagnoses")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  const ids = new Set<string>([
    ...(receiptMatches.data ?? []).map((row) => row.id).filter(Boolean),
    ...(rawMatches.data ?? []).map((row) => row.id).filter(Boolean)
  ]);
  const normalizedSearch = search.toLowerCase();
  for (const row of recentDiagnoses.data ?? []) {
    if (String(row.id).toLowerCase().startsWith(normalizedSearch)) ids.add(row.id);
  }
  const orderIds = (linkedOrders.data ?? []).map((row) => row.id).filter(Boolean);

  if (orderIds.length > 0) {
    const { data } = await supabase
      .from("diagnoses")
      .select("id")
      .in("order_id", orderIds)
      .limit(100);
    for (const row of data ?? []) ids.add(row.id);
  }

  return [...ids];
}

async function getDiagnoses(result = "all", page = 1, orderSearch = "") {
  if (!hasSupabaseEnv()) return { list: [], count: 0, page: 1, limit: 20 };
  const limit = 20;
  const from = (Math.max(page, 1) - 1) * limit;
  const supabase = getSupabaseAdmin();
  const search = orderSearch.trim();
  const matchedIds = search ? await findDiagnosisIdsByOrderNumber(search) : null;

  if (matchedIds && matchedIds.length === 0) return { list: [], count: 0, page: Math.max(page, 1), limit };

  let query = supabase
    .from("diagnoses")
    .select("id,order_id,service_type_code,service_code,image_urls,photos,result,confidence,reason,details,recommendation,raw_response,created_at,orders(order_number)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (result !== "all") query = query.in("result", RESULT_FILTER_VALUES[result] ?? [result]);
  if (matchedIds) query = query.in("id", matchedIds);

  const { data, count } = await measure("admin.diagnoses.fetchRows", () => query);
  const list = await measure("admin.diagnoses.signImages", () => Promise.all((data ?? []).map(signImages)));
  return { list, count: count ?? 0, page: Math.max(page, 1), limit };
}

export default async function AdminDiagnosesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = params.result ?? "all";
  const orderSearch = (params.order ?? "").trim();
  const page = Math.max(Number(params.offset ? Math.floor(Number(params.offset) / 20) + 1 : params.page ?? 1), 1);
  const { list, count, limit } = await measure("admin.diagnoses.getDiagnoses", () => getDiagnoses(result, page, orderSearch));
  const totalPages = Math.max(Math.ceil(count / limit), 1);
  const selected = params.id ? list.find((item: any) => item.id === params.id) : null;
  const filters = ["all", "교체추천", "교체불필요", "보류", "현장확인필요"];
  const summary = {
    waiting: list.filter((item: any) => !item.result).length,
    needsMore: list.filter((item: any) => ["보류", "hold"].includes(String(item.result))).length,
    siteCheck: list.filter((item: any) => ["현장확인필요", "site_check_required"].includes(String(item.result))).length
  };

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">사진확인</h1>
        <p className="adm-page-sub">홈 사진확인에서 접수된 요청을 접수번호로 찾고, 상담원이 사진과 연락처를 확인합니다.</p>
      </header>
      <div className="adm-content">
        <form className="adm-card adm-section adm-diagnosis-search" action="/admin/diagnoses">
          <input type="hidden" name="result" value={result} />
          <label>
            <span className="adm-label">접수번호로 사진 접수 조회</span>
            <input className="adm-input" name="order" defaultValue={orderSearch} placeholder="예: BO-20260520-0001" />
          </label>
          <button className="adm-btn adm-btn-primary" type="submit">조회</button>
          {orderSearch ? <a className="adm-btn adm-btn-secondary" href={diagnosesHref({ result })}>초기화</a> : null}
        </form>
        <nav className="adm-filter-bar">
          {filters.map((filter) => (
            <a className={`adm-btn ${result === filter ? "adm-btn-primary" : "adm-btn-secondary"}`} href={diagnosesHref({ result: filter, orderSearch })} key={filter}>
              {filter === "all" ? "전체" : filter}
            </a>
          ))}
        </nav>
        <section className="adm-diagnosis-summary" aria-label="사진확인 처리 요약">
          <article>
            <strong>{count}</strong>
            <span>조회 결과</span>
          </article>
          <article>
            <strong>{summary.waiting}</strong>
            <span>판정 대기</span>
          </article>
          <article>
            <strong>{summary.needsMore}</strong>
            <span>추가 사진</span>
          </article>
          <article>
            <strong>{summary.siteCheck}</strong>
            <span>현장 확인</span>
          </article>
        </section>
        {selected ? (
          <section className="adm-diagnosis-detail" aria-label="선택한 사진확인 상세">
            <div className="adm-section-head">
              <div>
                <h2 className="adm-card-title">선택한 접수 상세</h2>
                <p className="adm-muted adm-section-note">{orderNumber(selected) ?? "접수번호 미연결"} · {formatServiceName(selected.service_type_code ?? selected.service_code)}</p>
              </div>
              <a className="adm-btn adm-btn-secondary" href={diagnosesHref({ result, orderSearch })}>목록만 보기</a>
            </div>
            <DiagnosisPanel diagnosis={selected} />
          </section>
        ) : null}
        <div className="adm-diagnoses-layout">
          <section className="adm-queue-list" aria-label="사진 확인 처리 목록">
            {list.length === 0 ? (
              <div className="adm-card adm-empty-line">표시할 사진 확인 요청이 없습니다.</div>
            ) : list.map((item: any) => (
              <a
                className={selected?.id === item.id ? "adm-queue-card active" : "adm-queue-card"}
                href={diagnosesHref({ result, id: item.id, orderSearch })}
                key={item.id}
              >
                <div className="adm-queue-main">
                  <div className="adm-queue-card-top">
                    <span className={`adm-badge ${badgeClass(item.result)}`}>{statusLabel(item.result)}</span>
                    <span className="adm-queue-action">{nextActionLabel(item.result)}</span>
                  </div>
                  <strong>{orderNumber(item) ?? "접수번호 미연결"}</strong>
                  <div className="adm-queue-meta-line">
                    <span>{formatServiceName(item.service_type_code ?? item.service_code)}</span>
                    <span>{item.customer_name ?? "이름 미입력"}</span>
                    <span>{item.customer_phone ?? "연락처 없음"}</span>
                    <span>{formatKRDateTime(item.created_at)}</span>
                  </div>
                  {item.reason ? <p>{item.reason}</p> : null}
                </div>
                <div className="adm-queue-side">
                  <span>{photoCount(item)}장 · 상세 보기</span>
                  <div className="adm-queue-thumbs">
                    {(item.signedPhotos ?? []).slice(0, 3).map((photo: string) => (
                      <img src={photo} alt="확인 사진" key={photo} />
                    ))}
                  </div>
                </div>
              </a>
            ))}
          </section>
        </div>
        <div className="adm-filter-bar" style={{ marginTop: 16 }}>
          {page > 1 && <a className="adm-btn adm-btn-secondary" href={diagnosesHref({ result, page: page - 1, orderSearch })}>이전</a>}
          <span className="adm-help" style={{ marginTop: 0 }}>페이지 {page} / {totalPages} · 총 {count}건</span>
          {page < totalPages && <a className="adm-btn adm-btn-secondary" href={diagnosesHref({ result, page: page + 1, orderSearch })}>다음</a>}
        </div>
      </div>
    </>
  );
}
