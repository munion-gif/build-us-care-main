import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MobileAppBar } from "@/components/builduscare/MobileAppChrome";
import { BUILDUSCARE_CATEGORIES } from "@/lib/builduscare-public-routes";
import { getBuilduscarePublicCatalog } from "@/lib/builduscare-public-products";

export const metadata = {
  title: "Build us Care",
  description: "집 전체가 아니라, 바꿀 수 있는 것부터.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    url: "/"
  }
};

function formatKRW(value: number) {
  return `₩${Number(value || 0).toLocaleString("ko-KR")}`;
}

function mobileTitle(title: string) {
  if (title === "양변기") return "양변기 교체";
  if (title === "세면대") return "세면대 교체";
  if (title === "수전") return "수전 교체";
  if (title === "환풍기") return "환풍기 교체";
  return title;
}

function photoCheckHref(itemLabel: string) {
  return `/photo-check?item=${encodeURIComponent(itemLabel)}`;
}

export default function ProductsPage() {
  return (
    <main className="bc-page products-page">
      <MobileAppBar title="무엇을 바꿀까요?" backHref="/service" />

      <div className="bc-mobile-only mobile-products-screen">
        <h1>여러 제품을<br />한번에 교체할 수 있어요</h1>
        <p>
          여러 가지를 한 번에 교체하세요!<br />
          여러 품목을 함께 교체해도 <b style={{ color: "#1d1d1f" }}>출장비와 견적비는 0원</b>입니다.
        </p>
        <section className="mobile-product-grid" aria-label="교체 가능한 제품">
          {BUILDUSCARE_CATEGORIES.map((category) => (
            <article key={category.slug} className="mobile-product-card">
              <Link className="mobile-product-main-link" href={`/products/${category.slug}`}>
                <b>{mobileTitle(category.title)}</b>
                <span className="m-product-media">
                  <img src={category.image} alt={category.title} loading="lazy" decoding="async" />
                </span>
              </Link>
              <Link className="m-photo-link" href={photoCheckHref(category.itemLabel)}>사진 확인부터 ›</Link>
              <Link className="m-more" href={`/products/${category.slug}`}>더 알아보기</Link>
            </article>
          ))}
        </section>
        <p className="mobile-products-note">고르신 품목에 맞춰 꼭 필요한 사진 3장을 안내해 드려요.</p>
      </div>

      <div className="wrap bc-desktop-only">
        <div className="stepline" aria-label="진행 단계">
          <span className="on">제품 선택</span>
          <ChevronRight aria-hidden="true" />
          <span>사진 확인</span>
          <ChevronRight aria-hidden="true" />
          <span>예약</span>
          <ChevronRight aria-hidden="true" />
          <span>접수</span>
        </div>

        <h1 className="web-h1" style={{ marginTop: 14 }}>무엇을 바꿀까요?</h1>
        <p className="web-lede products-intro">
          여러 가지를 한 번에 교체하세요!<br />
          여러 품목을 함께 교체해도 <b>출장비와 견적비는 0원</b>입니다.
        </p>

        <section className="lineup-grid" aria-label="교체 가능한 제품">
          {BUILDUSCARE_CATEGORIES.map((category) => {
            const catalog = getBuilduscarePublicCatalog(category.serviceCode);
            const from = catalog?.minPrice ?? 0;
            return (
              <Link
                key={category.slug}
                className="lcard"
                href={`/products/${category.slug}`}
              >
                <div className="lcard-head">
                  <div className="lcard-t">{category.title}</div>
                  <div className="lcard-en">{category.english}</div>
                </div>
                <div className="lcard-media">
                  <img className="lcard-img" src={category.image} alt={category.title} loading="lazy" decoding="async" />
                </div>
                <div className="lcard-foot">
                  <div className="lcard-price">{from ? `${formatKRW(from)}부터` : "사진 확인부터"}</div>
                  <span className="lcard-btn">둘러보기</span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
