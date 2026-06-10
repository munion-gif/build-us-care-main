"use client";

const STATIC_VERSION = "20260610-catalog-resync";
const WEB_SRC = `/builduscare/app-web.html?v=${STATIC_VERSION}`;
const MOBILE_SRC = `/builduscare/app-mobile.html?v=${STATIC_VERSION}`;

export function HomeClient() {
  return (
    <main className="reference-home">
      <style>{referenceHomeCss}</style>
      <iframe
        className="reference-frame reference-frame-web"
        src={WEB_SRC}
        title="Build us Care web"
      />
      <iframe
        className="reference-frame reference-frame-mobile"
        src={MOBILE_SRC}
        title="Build us Care mobile"
      />
    </main>
  );
}

const referenceHomeCss = `
  .global-header,
  .global-footer {
    display: none !important;
  }
  html,
  body {
    margin: 0;
    width: 100%;
    height: 100%;
    background: #fff;
    overflow: hidden;
  }
  .reference-home {
    width: 100%;
    height: 100dvh;
    min-height: 100vh;
    margin: 0;
    padding: 0;
    background: #fff;
    overflow: hidden;
  }
  .reference-frame {
    display: block;
    width: 100%;
    height: 100dvh;
    min-height: 100vh;
    border: 0;
    background: #fff;
  }
  .reference-frame-web {
    display: block;
  }
  .reference-frame-mobile {
    display: none;
  }
  @media (max-width: 720px) {
    .reference-home,
    .reference-frame {
      height: 100vh;
      height: 100svh;
      min-height: 100svh;
    }
    .reference-frame-web {
      display: none;
    }
    .reference-frame-mobile {
      display: block;
    }
  }
`;
