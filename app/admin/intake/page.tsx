import Link from "next/link";
import { getIntakeList, getIntakeDetail } from "@/lib/admin-intake-data";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ id?: string }> };

const TONE_CLASS: Record<string, string> = {
  new: "it-t-new",
  sent: "it-t-sent",
  talk: "it-t-talk",
  done: "it-t-done"
};

function maskPhone(phone?: string | null) {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.length < 8) return phone;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function shortTime(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export default async function AdminIntakePage({ searchParams }: PageProps) {
  const { id } = await searchParams;
  const { items, hasDb } = await getIntakeList();
  const selectedId = id ?? items[0]?.id ?? null;
  const detail = selectedId ? await getIntakeDetail(selectedId) : null;

  return (
    <div className="intake-wrap">
      <style>{intakeCss}</style>

      <header className="it-head">
        <div>
          <h1>사진접수</h1>
          <p>고객이 보낸 사진을 보고 견적을 작성해 보내요. <span className="it-soon">(견적 작성·발송·상담은 다음 단계에서 연결됩니다)</span></p>
        </div>
        <div className="it-chip">새 접수 대기 <b>{items.filter((i) => i.status.tone === "new").length}건</b></div>
      </header>

      {!hasDb ? (
        <div className="it-note">
          지금은 <b>미리보기 환경</b>이라 실제 접수 데이터가 없어요. 실제 접수 목록은 <b>builduscare.co.kr/admin/intake</b> 에서 보여요.
        </div>
      ) : items.length === 0 ? (
        <div className="it-note">아직 사진접수 내역이 없어요.</div>
      ) : (
        <div className="it-split">
          {/* 왼쪽: 접수 목록 */}
          <aside className="it-queue">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/admin/intake?id=${encodeURIComponent(item.id)}`}
                className={`it-qi ${item.id === selectedId ? "sel" : ""}`}
              >
                <div className="it-qi-top">
                  <span className="it-qi-name">{item.name ?? "이름 미입력"}</span>
                  <span className={`it-tag ${TONE_CLASS[item.status.tone]}`}>{item.status.text}</span>
                </div>
                <div className="it-qi-desc">
                  {item.item} · 사진 {item.photoCount}장
                </div>
                <div className="it-qi-time">{shortTime(item.createdAt)}</div>
              </Link>
            ))}
          </aside>

          {/* 오른쪽: 작업 영역 */}
          <section className="it-work">
            {detail ? (
              <>
                <div className="it-panel">
                  <div className="it-panel-h">
                    <h3>고객 사진</h3>
                    <span className="it-meta">
                      {detail.name ?? "이름 미입력"} · {detail.address} · {maskPhone(detail.phone)}
                    </span>
                  </div>
                  {detail.photos.length > 0 ? (
                    <div className="it-photos">
                      {detail.photos.map((src, i) => (
                        <a key={i} className="it-photo" href={src} target="_blank" rel="noreferrer">
                          <img src={src} alt={`고객 사진 ${i + 1}`} loading="lazy" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="it-empty">첨부된 사진이 없어요.</div>
                  )}
                  {detail.memo ? <div className="it-memo"><span className="it-memo-l">고객 요청</span>{detail.memo}</div> : null}
                </div>

                <div className="it-panel it-info">
                  <div className="it-panel-h"><h3>접수 정보</h3></div>
                  <div className="it-rows">
                    <div className="it-row"><span className="k">접수번호</span><span className="v">{detail.orderNumber ?? "미연결"}</span></div>
                    <div className="it-row"><span className="k">품목</span><span className="v">{detail.item}</span></div>
                    <div className="it-row"><span className="k">연락처</span><span className="v">{maskPhone(detail.phone) || "-"}</span></div>
                    <div className="it-row"><span className="k">주소</span><span className="v">{detail.address}</span></div>
                    <div className="it-row"><span className="k">접수시각</span><span className="v">{shortTime(detail.createdAt) || "-"}</span></div>
                  </div>
                  <div className="it-next">
                    다음 단계에서 여기 아래에 <b>견적서 작성·PDF 저장·카톡 발송·일정 선택</b>이 붙어요.
                  </div>
                </div>
              </>
            ) : (
              <div className="it-placeholder">왼쪽에서 접수를 선택하세요.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

const intakeCss = `
.intake-wrap { padding: 4px 2px 40px; color: #0f1729; }
.it-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.it-head h1 { font-size: 23px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
.it-head p { color: #5b6472; font-size: 13.5px; margin: 5px 0 0; }
.it-soon { color: #98a2b3; }
.it-chip { background: #fff; border: 1px solid #e4e8ee; border-radius: 999px; padding: 9px 15px; font-size: 13px; font-weight: 700; }
.it-chip b { color: #1a49cc; }
.it-note { background: #fff7e8; border: 1px solid #ffe7b8; color: #7a5b16; border-radius: 12px; padding: 15px 18px; font-size: 13.5px; line-height: 1.6; }
.it-split { display: grid; grid-template-columns: 280px 1fr; gap: 16px; align-items: start; }
.it-queue { background: #fff; border: 1px solid #e4e8ee; border-radius: 15px; overflow: hidden; }
.it-qi { display: block; padding: 13px 16px; border-bottom: 1px solid #eef1f5; border-left: 3px solid transparent; text-decoration: none; color: inherit; }
.it-qi:hover { background: #f7f9fc; }
.it-qi.sel { background: #eaf0ff; border-left-color: #245fff; }
.it-qi-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.it-qi-name { font-weight: 800; font-size: 14.5px; }
.it-tag { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.it-t-new { background: #efecfb; color: #6d5bd0; }
.it-t-sent { background: #eaf0ff; color: #1a49cc; }
.it-t-talk { background: #fdf3e2; color: #b7791f; }
.it-t-done { background: #e6f6ec; color: #178a4c; }
.it-qi-desc { font-size: 12.5px; color: #5b6472; margin-top: 4px; }
.it-qi-time { font-size: 11px; color: #98a2b3; margin-top: 4px; font-variant-numeric: tabular-nums; }
.it-work { display: grid; gap: 14px; }
.it-panel { background: #fff; border: 1px solid #e4e8ee; border-radius: 15px; padding: 17px; }
.it-panel-h { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; }
.it-panel-h h3 { margin: 0; font-size: 14px; font-weight: 800; }
.it-meta { margin-left: auto; font-size: 11.5px; color: #98a2b3; font-weight: 600; text-align: right; }
.it-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.it-photo { display: block; aspect-ratio: 1; border-radius: 11px; overflow: hidden; border: 1px solid #e4e8ee; background: #f5f7fa; }
.it-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.it-empty { color: #98a2b3; font-size: 13px; padding: 18px 0; text-align: center; }
.it-memo { margin-top: 13px; background: #f5f7fa; border-radius: 11px; padding: 12px 14px; font-size: 13.5px; line-height: 1.6; }
.it-memo-l { display: block; font-size: 11px; font-weight: 800; color: #98a2b3; letter-spacing: 0.03em; margin-bottom: 4px; }
.it-rows { display: grid; gap: 1px; }
.it-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef1f5; font-size: 13.5px; }
.it-row .k { flex: 0 0 82px; color: #5b6472; font-weight: 700; }
.it-row .v { color: #0f1729; font-weight: 600; }
.it-next { margin-top: 14px; background: #eaf0ff; color: #1a49cc; border-radius: 11px; padding: 12px 14px; font-size: 12.5px; line-height: 1.5; }
.it-placeholder { background: #fff; border: 1px dashed #d3d9e2; border-radius: 15px; padding: 60px 20px; text-align: center; color: #98a2b3; font-size: 14px; }
@media (max-width: 800px) {
  .it-split { grid-template-columns: 1fr; }
  .it-photos { grid-template-columns: repeat(3, 1fr); }
}
`;
