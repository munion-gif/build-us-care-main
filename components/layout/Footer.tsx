import Link from "next/link";

const productLinks = [
  ["수전", "/products/faucet"],
  ["양변기", "/products/toilet"],
  ["세면대", "/products/washbasin"],
  ["비데", "/products/bidet"],
  ["환풍기", "/products/ventilation"],
  ["도어핸들", "/products/door-handle"],
  ["샷시손잡이", "/products/window-handle"],
  ["실리콘 재시공", "/products/silicone"],
  ["욕실 악세서리", "/products/bath-accessory"]
] as const;

export function Footer() {
  return (
    <footer className="site-foot">
      <style>{footerCss}</style>
      <div className="fwrap">
        <div className="fcols">
          <div>
            <h5>서비스</h5>
            <Link href="/service">서비스 소개</Link>
            <Link href="/photo-check">사진판정</Link>
            <Link href="/products">가격 안내</Link>
            <Link href="/products">교체 사례</Link>
          </div>

          <div>
            <h5>제품</h5>
            <div className="fsub">
              <div>
                {productLinks.slice(0, 5).map(([label, href]) => (
                  <Link key={href} href={href}>{label}</Link>
                ))}
              </div>
              <div>
                {productLinks.slice(5).map(([label, href]) => (
                  <Link key={href} href={href}>{label}</Link>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h5>고객지원</h5>
            <Link href="/order-lookup">주문조회</Link>
            <Link href="/order-lookup">A/S 접수</Link>
            <a href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noopener noreferrer">카카오톡 상담</a>
            <a href="mailto:munion@mymunion.com">munion@mymunion.com</a>
          </div>

          <div>
            <h5>고객센터</h5>
            <p>평일 오전 10:00 – 오후 7:00</p>
            <p>금요일 오후 6:00까지</p>
            <p>휴무 : 일요일·법정공휴일</p>
            <div className="fsoc">
              <a href="https://www.instagram.com/builduscare" target="_blank" rel="noopener noreferrer" aria-label="인스타그램">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
                  <circle cx="12" cy="12" r="4.2" />
                  <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noopener noreferrer" aria-label="카카오톡">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.2C6.9 4.2 2.8 7.4 2.8 11.3c0 2.5 1.7 4.7 4.2 5.9-.2.6-.7 2.4-.8 2.7-.1.4.1.4.4.3.2-.1 2.7-1.8 3.7-2.5.5.1 1.1.1 1.7.1 5.1 0 9.2-3.2 9.2-7.1S17.1 4.2 12 4.2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="flegal">
          <div className="flinks">
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/terms">이용약관</Link>
            <Link href="/refund-policy">취소·환불 안내</Link>
            <Link href="/as-policy">A/S 기준</Link>
          </div>
          <p>주식회사 무니온 · 대표 김영태 · 경기도 용인시 포은대로59번길 37, 시그니처광교</p>
          <p>사업자등록번호 601-81-39840 · 통신판매업신고 2025-용인수지-3087 · munion@mymunion.com</p>
          <p>ⓒ 2026 Build us Care. All rights reserved. · 대한민국</p>
        </div>
      </div>
    </footer>
  );
}

const footerCss = `
  .site-foot {
    background: #F5F5F7;
    border-top: 1px solid var(--gray-200, #eaecf0);
    margin-top: 0;
  }
  .site-foot .fwrap {
    max-width: 1120px;
    width: 100%;
    margin: 0 auto;
    padding: 48px 40px 36px;
    word-break: keep-all;
  }
  .site-foot .fcols {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 28px;
  }
  .site-foot h5 {
    margin: 0 0 12px;
    color: var(--gray-900, #101828);
    font-size: 13px;
    line-height: 1.4;
    font-weight: 700;
  }
  .site-foot a,
  .site-foot p {
    display: block;
    margin: 0;
    color: var(--gray-500, #667085);
    font-size: 12.5px;
    line-height: 1.9;
    text-decoration: none;
  }
  .site-foot a:hover {
    color: var(--gray-900, #101828);
  }
  .site-foot .fsub {
    display: grid;
    grid-template-columns: auto auto;
    justify-content: start;
    gap: 0 28px;
  }
  .site-foot .fsoc {
    display: flex;
    gap: 10px;
    margin-top: 14px;
  }
  .site-foot .fsoc a {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 1px solid var(--gray-200, #eaecf0);
    border-radius: 50%;
    background: #fff;
    color: var(--gray-600, #475467);
  }
  .site-foot .fsoc a:hover {
    border-color: var(--gray-300, #d0d5dd);
    color: var(--gray-900, #101828);
  }
  .site-foot .fsoc svg {
    width: 17px;
    height: 17px;
  }
  .site-foot .flegal {
    margin-top: 34px;
    padding-top: 22px;
    border-top: 1px solid var(--gray-200, #eaecf0);
  }
  .site-foot .flegal p {
    color: var(--gray-400, #98a2b3);
    font-size: 11.5px;
    line-height: 1.8;
  }
  .site-foot .flinks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin-bottom: 12px;
  }
  .site-foot .flinks a {
    color: var(--gray-600, #475467);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
  @media (max-width: 860px) {
    .site-foot .fcols {
      grid-template-columns: 1fr 1fr;
      gap: 24px 16px;
    }
  }
  @media (max-width: 560px) {
    .site-foot .fwrap {
      padding: 32px 20px 28px;
    }
    .site-foot .fcols {
      grid-template-columns: 1fr;
    }
  }
`;
