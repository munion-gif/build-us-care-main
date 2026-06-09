/* ============================================================================
   Build us Care — customer prototype logic (web / desktop)
   Sticky top nav + #web router. Mirrors the mobile intake model.
   ============================================================================ */
const ITEM_EN = {'양변기 교체':'Toilet','세면대 교체':'Washbasin','수전 교체':'Faucet','비데 설치':'Bidet','환풍기 교체':'Ventilation','샷시손잡이':'Window Handle','도어핸들':'Door Handle','실리콘 재시공':'Silicone Reseal','욕실 악세서리':'Bath Accessory'};
const ITEM_IMG = {'수전 교체':'assets/prod-faucet-1.png','양변기 교체':'assets/prod-toilet-1.png','세면대 교체':'assets/prod-washbasin-1.png','비데 설치':'assets/prod-bidet-1.png','환풍기 교체':'assets/prod-vent-1.png','샷시손잡이':'assets/prod-windowhandle-1.png','도어핸들':'assets/prod-doorhandle-1.png','실리콘 재시공':'assets/prod-silicone-1.png','욕실 악세서리':'assets/prod-accessory-1.png'};
const CAT_ICON = {'수전 교체':'assets/prodicon-faucet.webp','양변기 교체':'assets/prodicon-toilet.webp','세면대 교체':'assets/prodicon-washbasin.webp','비데 설치':'assets/prodicon-bidet.webp','환풍기 교체':'assets/prodicon-vent.webp','샷시손잡이':'assets/prodicon-windowhandle.webp','도어핸들':'assets/prodicon-doorhandle.webp','실리콘 재시공':'assets/prodicon-silicone.webp','욕실 악세서리':'assets/prodicon-accessory.webp'};
const LINEUP_IMG = {'수전 교체':'assets/lineup-faucet.png','양변기 교체':'assets/lineup-toilet.png','세면대 교체':'assets/lineup-washbasin.png','비데 설치':'assets/lineup-bidet.png','환풍기 교체':'assets/lineup-vent.png','샷시손잡이':'assets/lineup-windowhandle.png','도어핸들':'assets/lineup-doorhandle.png','실리콘 재시공':'assets/lineup-silicone.png','욕실 악세서리':'assets/lineup-accessory.png'};
const W_KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_PxkzsX';

/* Warm the product-category icons up front so the 제품 선택 strip paints
   instantly instead of streaming in one PNG at a time on navigation. */
(function preloadCatIcons(){
  const warm = () => {
    Object.values(CAT_ICON).forEach(src => { const im = new Image(); im.decoding = 'async'; im.src = src; });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 1500 });
  else setTimeout(warm, 200);
})();

/* Assets loaded inside the 견적서 window (a separate popup) can't resolve
   relative paths, so any image shown there must be inlined as a data URI.
   Fetch from the main page (where assets/ is reachable) and cache. */
const _imgUriCache = {};
function imgToDataUri(path){
  if (_imgUriCache[path]) return Promise.resolve(_imgUriCache[path]);
  return fetch(path).then(r=>r.blob()).then(b=>new Promise(res=>{
    const fr = new FileReader();
    fr.onload = () => { _imgUriCache[path] = fr.result; res(fr.result); };
    fr.onerror = () => res('');
    fr.readAsDataURL(b);
  })).catch(()=> '');
}
let BC_LOGO_URI = '';
imgToDataUri('assets/bc-logo.png').then(u=>{ BC_LOGO_URI = u; });

/* One stable 접수번호 per session, generated on first use and reused
   across the 접수 완료 화면 · 주문 현황 · 최종 견적서. */
function wOrderNo(){
  if (!W.orderNo){
    const d = new Date();
    const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
    W.orderNo = 'BC-' + ymd + '-' + String(Math.floor(Math.random()*900)+100);
  }
  return W.orderNo;
}
const W_ITEMS = [
  ['양변기 교체','bath','오래된 변기, 흔들림과 물샘까지.','인기'],
  ['세면대 교체','droplets','낡은 세면대, 하부 배관까지 깔끔하게.',''],
  ['수전 교체','droplet','물샘·노후 수전을 새 디자인으로.','인기'],
  ['비데 설치','shower-head','기존 변기에 비데를 더하다.',''],
  ['환풍기 교체','fan','소음과 약해진 흡입력을 개선.',''],
  ['샷시손잡이','grip-horizontal','헐거운 창호 손잡이를 새것으로.',''],
  ['도어핸들','door-open','현관·방문 손잡이를 새것처럼.',''],
  ['실리콘 재시공','spray-can','곰팡이·들뜬 마감을 깔끔하게.',''],
  ['욕실 악세서리','shapes','수건걸이·선반·휴지걸이를 한 번에.','신규']
];
const CATALOG = window.BUILDUS_CARE_CATALOG || {};
const wlist = () => CATALOG[W.item] || CATALOG['수전 교체'] || [];
const wlistOf = (name) => CATALOG[name] || CATALOG['수전 교체'] || [];
/* 카테고리별 하위 종류 필터 (제품명 기준) */
const SUBTYPES = {
  '양변기 교체':[['원피스',/^원피스/],['투피스',/^투피스/]],
  '세면대 교체':[['반다리',/^반다리/],['긴다리',/^긴다리/]],
  '수전 교체':[['세면수전',/^세면수전/],['주방수전',/^주방수전/],['샤워욕조',/^샤워욕조/],['레인샤워',/^레인샤워/],['샤워수전',/^샤워수전/]],
  '욕실 악세서리':[['세트',/세트/],['선반·수건걸이',/선반|수건걸이/]],
};
const catOf = (id) => Object.keys(CATALOG).find(k=>CATALOG[k].some(p=>p.id===id)) || '';
const selectedCats = () => [...new Set(W.selected.map(id=>catOf(id).replace(/\s*교체$/,'')))];
const ALL_PRODUCTS = Object.values(CATALOG).flat();
const W_LABOR = 60000, W_DISPOSAL = 10000;
const WKK = '<svg class="kkic" viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;flex:none"><path d="M12 3.4C6.7 3.4 2.4 6.85 2.4 11.1c0 2.74 1.82 5.14 4.55 6.52-.2.72-.72 2.62-.83 3.03-.14.5.18.5.39.37.16-.1 2.5-1.7 3.52-2.4.51.07 1.03.11 1.57.11 5.3 0 9.6-3.45 9.6-7.63S17.3 3.4 12 3.4z"/></svg>';
const W = { cur:'home', item:'수전 교체', selected:[], qty:{}, productPage:1, productSort:'low', brandFilter:'', colorFilter:'', photos:0, photoFiles:[], photoSets:[0,0,0], photoSetFiles:[[],[],[]], region:'', regionDetail:'', postalCode:'', name:'', phone:'', date:null, time:null, selfDisposal:false, cashReceiptType:'none', cashReceiptIdentity:'', orderNo:'', specCheck:false, privacyOk:false, privacyOkInq:false, submitting:false, submitErr:'', remoteOrder:null, _lookupNo:'', _lookupName:'', _lookupErr:false, _lookupLoading:false };

const W_ITEM_SLUGS = {'양변기 교체':'toilet','세면대 교체':'washbasin','수전 교체':'faucet','비데 설치':'bidet','환풍기 교체':'ventilation','샷시손잡이':'window-handle','도어핸들':'door-handle','실리콘 재시공':'silicone','욕실 악세서리':'bath-accessory'};
const W_SLUG_ITEMS = Object.fromEntries(Object.entries(W_ITEM_SLUGS).map(([name, slug]) => [slug, name]));
const W_SCREEN_ROUTES = {
  home:'/',
  services:'/service',
  items:'/products',
  products:'/products',
  upload:'/photo-check',
  prebook:'/reservation/info',
  booking:'/reservation/schedule',
  checkout:'/reservation/confirm',
  done:'/reservation/complete',
  orders:'/order-lookup',
  orderview:'/order-status'
};
const W_ROUTER_ID = `web-${Math.random().toString(36).slice(2)}`;
const KR_PUBLIC_HOLIDAYS = new Set([
  '2026-01-01',
  '2026-02-16','2026-02-17','2026-02-18',
  '2026-03-01','2026-03-02',
  '2026-05-05','2026-05-24','2026-05-25',
  '2026-06-03','2026-06-06',
  '2026-08-15','2026-08-17',
  '2026-09-24','2026-09-25','2026-09-26',
  '2026-10-03','2026-10-05','2026-10-09',
  '2026-12-25'
]);
const BOOKING_LEAD_DAYS = 3;
const DATE_WEEKDAYS = ['일','월','화','수','목','금','토'];
function datePad(n){ return String(n).padStart(2,'0'); }
function localIsoDate(date){ return `${date.getFullYear()}-${datePad(date.getMonth()+1)}-${datePad(date.getDate())}`; }
function parseIsoDate(value){
  const text = String(value || '').trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
  const day = Number(text);
  if(Number.isFinite(day) && day >= 1 && day <= 31) return new Date(2026, 5, day);
  return null;
}
function addLocalDays(date, days){
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}
function bookingToday(){ const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function bookingEarliestDate(){ return addLocalDays(bookingToday(), BOOKING_LEAD_DAYS); }
function bookingCalendarBase(){
  const earliest = bookingEarliestDate();
  return { year: earliest.getFullYear(), month: earliest.getMonth(), earliest };
}
function bookingMonthTitle(year, month){ return `${year}년 ${month+1}월`; }
function bookingDateLabel(value, includeYear=false){
  const date = parseIsoDate(value);
  if(!date) return '';
  return `${includeYear?`${date.getFullYear()}년 `:''}${date.getMonth()+1}월 ${date.getDate()}일 (${DATE_WEEKDAYS[date.getDay()]})`;
}
function isHolidayOrRedDay(date){
  return date.getDay() === 0 || KR_PUBLIC_HOLIDAYS.has(localIsoDate(date));
}
function bookingCalendarCells(selectedIso, onclickName){
  const { year, month, earliest } = bookingCalendarBase();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let cells = Array.from({ length: firstDay }, () => '<div></div>').join('');
  for(let day=1; day<=daysInMonth; day++){
    const date = new Date(year, month, day);
    const iso = localIsoDate(date);
    const dow = date.getDay();
    const isPrep = date < earliest;
    const isHoliday = KR_PUBLIC_HOLIDAYS.has(iso);
    const isClosed = date.getDay() === 0 || isHoliday;
    const off = isPrep || isClosed;
    const cls = `cal-d ${dow===0?'sun':(dow===6?'sat':'')}${isHoliday?' holiday':''}${off?' dim':''}${selectedIso===iso?' on':''}`;
    cells += `<div class="${cls}"${off?'':` onclick="${onclickName}('${iso}')"`}>${day}${isClosed?'<span class="cd-tag">휴무</span>':''}</div>`;
  }
  return { cells, title: bookingMonthTitle(year, month) };
}
function wTopWindow(){
  try {
    if (window.top && window.top.location.origin === window.location.origin) return window.top;
  } catch (_) {}
  return window;
}
const W_ROUTER_TARGET = wTopWindow();
function wRouterPath(){
  try { return W_ROUTER_TARGET.location.pathname || '/'; } catch (_) { return window.location.pathname || '/'; }
}
function wPathForScreen(id){
  if(id === 'products'){
    const slug = W_ITEM_SLUGS[W.item];
    return slug ? `/products/${slug}` : '/products';
  }
  return W_SCREEN_ROUTES[id] || '/';
}
function wScreenFromPath(path){
  const parts = String(path || '/').replace(/\/+$/,'').split('/').filter(Boolean);
  if(!parts.length) return 'home';
  if(parts[0] === 'service') return 'services';
  if(parts[0] === 'products'){
    if(parts[1] && W_SLUG_ITEMS[parts[1]]) W.item = W_SLUG_ITEMS[parts[1]];
    W.subFilter = '';
    W.brandFilter = '';
    W.colorFilter = '';
    W.productPage = 1;
    return parts[1] ? 'products' : 'items';
  }
  if(parts[0] === 'photo-check') return 'upload';
  if(parts[0] === 'reservation'){
    if(parts[1] === 'schedule') return 'booking';
    if(parts[1] === 'confirm') return 'checkout';
    if(parts[1] === 'complete') return 'done';
    return 'prebook';
  }
  if(parts[0] === 'order-lookup') return 'orders';
  if(parts[0] === 'order-status') return 'orderview';
  return 'home';
}
function wSetBrowserRoute(id, mode='push'){
  const path = wPathForScreen(id);
  try {
    if(wRouterPath() === path) return;
    W_ROUTER_TARGET.history[mode === 'replace' ? 'replaceState' : 'pushState']({ builduscare: true, screen: id }, '', path);
    W_ROUTER_TARGET.dispatchEvent(new CustomEvent('builduscare-routechange', { detail: { path, source: W_ROUTER_ID } }));
  } catch (_) {}
}
function wApplyBrowserRoute(){
  const id = wScreenFromPath(wRouterPath());
  if(WS[id]) webnav(id, { history: false, dir: 'back' });
}
function wWireBrowserRouter(){
  try {
    W_ROUTER_TARGET.addEventListener('popstate', wApplyBrowserRoute);
    W_ROUTER_TARGET.addEventListener('builduscare-routechange', (event) => {
      if(event?.detail?.source === W_ROUTER_ID) return;
      wApplyBrowserRoute();
    });
  } catch (_) {}
}

const won = n => n.toLocaleString('ko-KR');
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const productImg = p => p && p.image ? `<img class="product-img" src="${p.image}" alt="" loading="lazy" decoding="async">` : '<i data-lucide="image"></i>';
const productText = p => [p.categoryName, p.model, p.note, p.sourceSheet].filter(Boolean).join(' ');
const priceValue = p => Number.isFinite(Number(p?.price)) ? Number(p.price) : Number.POSITIVE_INFINITY;
const lowestFirst = list => [...list].sort((a,b)=> priceValue(a)-priceValue(b) || String(a.name||'').localeCompare(String(b.name||''), 'ko-KR'));
const PRODUCT_SORTS = [
  ['rank', '랭킹순'],
  ['low', '낮은가격순'],
  ['high', '높은가격순'],
  ['popular', '인기순']
];
const recommendationLabelRank = label => ({'인기':0, '가성비':1, '프리미엄':2}[label] ?? 9);
const catalogOrderValue = p => Number.isFinite(Number(p?.sourceRow)) ? Number(p.sourceRow) : Number.POSITIVE_INFINITY;
const productRankScore = p => (p?.rec ? 0 : 1) * 10 + recommendationLabelRank(p?.recommendLabel);
const productPopularityScore = p => (p?.recommendLabel === '인기' ? 0 : p?.rec ? 1 : 2);
const productNameCompare = (a,b) => String(a?.name||'').localeCompare(String(b?.name||''), 'ko-KR');
function sortedProducts(list, sortKey){
  const sort = sortKey || 'low';
  return [...list].sort((a,b)=>{
    if(sort === 'high') return priceValue(b)-priceValue(a) || productNameCompare(a,b);
    if(sort === 'rank') return productRankScore(a)-productRankScore(b) || catalogOrderValue(a)-catalogOrderValue(b) || priceValue(a)-priceValue(b) || productNameCompare(a,b);
    if(sort === 'popular') return productPopularityScore(a)-productPopularityScore(b) || recommendationLabelRank(a?.recommendLabel)-recommendationLabelRank(b?.recommendLabel) || catalogOrderValue(a)-catalogOrderValue(b) || priceValue(a)-priceValue(b) || productNameCompare(a,b);
    return priceValue(a)-priceValue(b) || productNameCompare(a,b);
  });
}
const categoryMinPrice = name => {
  const prices = wlistOf(name).map(priceValue).filter(Number.isFinite);
  return prices.length ? Math.min(...prices) : null;
};
const productBrand = p => p?.brand || '브랜드 미상';
const productColor = p => p?.color || '기본';
const usefulColor = color => color && color !== '기본' && color !== '-';
const visibleColors = colors => colors.filter(color => color !== '-');
const uniqueSorted = (list, pick) => [...new Set(list.map(pick).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ko-KR'));
const filteredProducts = (list, brand, color) => list.filter(p => (!brand || productBrand(p)===brand) && (!color || productColor(p)===color));
const wp = id => ALL_PRODUCTS.find(p=>p.id===id);
const wq = id => W.qty[id] || 1;
const wunits = () => W.selected.reduce((s,id)=> s+wq(id), 0);
const wsub = () => W.selected.reduce((s,id)=> s+wp(id).price*wq(id), 0);
const SASH_SIZE_ORDER = ['소','중','대','그립'];
const COLOR_VARIANT_CATEGORIES = new Set(['환풍기 교체']);
const COLOR_VARIANT_ORDER = ['화이트','그레이','블루','핑크','엘로우'];
const colorVariantOrder = color => {
  const index = COLOR_VARIANT_ORDER.indexOf(color);
  return index < 0 ? 99 : index;
};
function sashSizeOf(p){
  const text = [p?.note, p?.model, p?.name].filter(Boolean).join(' ');
  const m = text.match(/사이즈\s*(소|중|대|그립)\b/) || String(p?.model||'').match(/\s(소|중|대|그립)$/) || String(p?.name||'').match(/\s(소|중|대|그립)$/);
  return m ? m[1] : '';
}
function sashBaseOf(p){
  return String(p?.model || p?.name || '').replace(/\s(소|중|대|그립)$/,'').replace(/\s+/g,' ').trim();
}
function wSashVariantOptions(id){
  const p = wp(id);
  if(!p || catOf(id)!=='샷시손잡이') return [];
  const base = sashBaseOf(p);
  const bySize = new Map();
  (CATALOG['샷시손잡이'] || []).filter(v=>sashBaseOf(v)===base).forEach(v=>{
    const size = sashSizeOf(v) || '기본';
    const prev = bySize.get(size);
    if(!prev || priceValue(v) < priceValue(prev)) bySize.set(size, v);
  });
  return [...bySize.entries()].sort(([a,av],[b,bv])=>{
    const ai = SASH_SIZE_ORDER.indexOf(a), bi = SASH_SIZE_ORDER.indexOf(b);
    return (ai<0?99:ai) - (bi<0?99:bi) || priceValue(av) - priceValue(bv);
  }).map(([size, product])=>({ size, product }));
}
function wSashGroupSelected(id){
  const variants = wSashVariantOptions(id);
  return variants.some(v=>W.selected.includes(v.product.id));
}
function wSashSizeChoices(id){
  const options = wSashVariantOptions(id);
  if(!options.length) return [];
  const bySize = new Map(options.map(v=>[v.size, v.product]));
  const sizes = ['소','중','대', ...[...bySize.keys()].filter(size=>!['소','중','대'].includes(size))].filter(size=>bySize.has(size));
  return sizes.map(size=>({ size, product:bySize.get(size) }));
}
function productGroupKey(p, cat){
  const c = cat || catOf(p?.id);
  if(c==='샷시손잡이') return `${c}|${sashBaseOf(p) || p?.id}`;
  return `${c}|${p?.brand || ''}|${p?.model || p?.sku || p?.name || p?.id}`;
}
function hasColorVariantGroup(group, cat){
  return COLOR_VARIANT_CATEGORIES.has(cat) && new Set(group.map(v=>productColor(v)).filter(usefulColor)).size > 1;
}
function productGroupVariants(id){
  const p = wp(id), cat = catOf(id);
  if(!p || !cat) return [];
  const key = productGroupKey(p, cat);
  const variants = (CATALOG[cat] || []).filter(v=>productGroupKey(v, cat)===key);
  if(cat==='샷시손잡이') return variants;
  if(hasColorVariantGroup(variants, cat)) return variants;
  const prices = new Set(variants.map(v=>priceValue(v)));
  return prices.size>1 ? variants : [p];
}
function productGroupSelected(id){
  const p = wp(id);
  if(!p) return false;
  const key = productGroupKey(p, catOf(id));
  return W.selected.some(selId=>productGroupKey(wp(selId), catOf(selId))===key);
}
function productCardList(list, source=list){
  const groups = new Map();
  source.forEach(p=>{
    const key = productGroupKey(p, W.item);
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  const seen = new Set();
  const out = [];
  list.forEach(p=>{
    const key = productGroupKey(p, W.item);
    const group = groups.get(key) || [p];
    const shouldGroup = W.item==='샷시손잡이' || hasColorVariantGroup(group, W.item) || new Set(group.map(v=>priceValue(v))).size>1;
    if(!shouldGroup){ out.push(p); return; }
    if(seen.has(key)) return;
    seen.add(key);
    out.push(group.reduce((best,v)=>priceValue(v)<priceValue(best)?v:best, group[0]));
  });
  return out;
}
function productDisplayName(p){
  if(!p) return '';
  if(catOf(p.id)==='실리콘 재시공' && usefulColor(p.color)){
    return `실리콘 ${p.color}`;
  }
  const base = catOf(p.id)==='샷시손잡이' ? sashBaseOf(p) : (p.model || p.name || p.categoryName || '');
  return cleanProductDisplayName(base, p.categoryName || p.sourceSheet);
}
function cleanProductDisplayName(value, category){
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  const cat = String(category || '').replace(/\s+/g, ' ').trim();
  if(cat && text.startsWith(`${cat} `)) text = text.slice(cat.length).trim();
  text = text.replace(/^샷시\s*손잡이\s*/,'').trim();
  const tokens = text.split(' ').filter(Boolean);
  if(tokens.length >= 2){
    let changed = true;
    while(changed){
      changed = false;
      outer: for(let size=Math.floor(tokens.length/2); size>=1; size--){
        for(let start=0; start + size * 2 <= tokens.length; start++){
          let same = true;
          for(let i=0; i<size; i++){
            if(tokens[start+i] !== tokens[start+size+i]){ same = false; break; }
          }
          if(same){
            tokens.splice(start + size, size);
            changed = true;
            break outer;
          }
        }
      }
    }
    text = tokens.join(' ') || text;
  }
  const label = productDisplayCategoryLabel(cat);
  if(label && isCodeLikeProductName(text) && !text.startsWith(`${label} `)) return `${label} ${text}`;
  return text;
}
function isCodeLikeProductName(value){
  const text = String(value || '').trim();
  return Boolean(text && /[A-Za-z0-9]/.test(text) && !/[가-힣]/.test(text));
}
function productDisplayCategoryLabel(category){
  let label = String(category || '').replace(/\s+/g, ' ').trim();
  if(!label) return '';
  if(/^샷시\s*손잡이$/.test(label)) return '';
  if(label === '실리콘') return '';
  label = label.replace(/\s*세면기$/, '').trim();
  return label;
}
function productSubSearchText(p){
  return [p?.categoryName, p?.sourceSheet, p?.name, p?.model].filter(Boolean).join(' ');
}
function productNoteSegments(p){
  const raw = String(p?.note || '').replace(/\r\n?/g, '\n').trim();
  if(!raw) return [];
  if(raw.includes('\n')) return raw.split('\n').map(v=>v.trim()).filter(Boolean);
  return raw.split(/\s*,\s*/).map(v=>v.trim()).filter(Boolean);
}
const isProductSizeSegment = v => /^사이즈(?:\s|$)/.test(v);
const isProductColorSegment = v => /^색상(?:\s|$)/.test(v);
const featureLabelOrder = ['분류', '섹션', '가격구분', '포장', '확인'];
const featureLabelPattern = /(분류|섹션|가격구분|포장|확인|제조사단가|비고):/g;
function productPrimarySpec(p){
  const segments = productNoteSegments(p);
  const size = segments.find(isProductSizeSegment)
    || segments.find(v=>/(?:[LWHØ]?\d|×|x|\[W\]|mm)/i.test(v) && !isProductColorSegment(v));
  if(size) return size;
  return segments.find(v=>!isProductColorSegment(v)) || p?.note || p?.categorySummary || '사진 확인 후 규격을 확정합니다.';
}
function productFeatureSpec(p){
  const segments = productNoteSegments(p);
  const primary = productPrimarySpec(p);
  const features = segments.filter(v=>v!==primary && !isProductColorSegment(v));
  const text = features.join(', ');
  const matches = [...text.matchAll(featureLabelPattern)];
  if(matches.length){
    const byLabel = new Map();
    matches.forEach((match, index)=>{
      const label = match[1];
      const start = match.index + match[0].length;
      const end = matches[index + 1]?.index ?? text.length;
      const value = text.slice(start, end).trim();
      if(value && !byLabel.has(label)) byLabel.set(label, value);
    });
    const lines = featureLabelOrder
      .filter(label=>byLabel.has(label))
      .map(label=>`${label}: ${byLabel.get(label)}`);
    if(lines.length) return lines.join('\n');
  }
  return features.join('\n') || p?.categorySummary || '사진 확인 후 세부 특징을 확정합니다.';
}
function wProductSelected(id){
  return W.selected.includes(id) || wSashGroupSelected(id) || productGroupSelected(id);
}
function sashSizeLabel(id){
  return '';
}
function wColorVariantOptions(id){
  const p = wp(id), cat = catOf(id);
  if(!p || !COLOR_VARIANT_CATEGORIES.has(cat)) return [];
  const key = productGroupKey(p, cat);
  const byColor = new Map();
  (CATALOG[cat] || []).filter(v=>productGroupKey(v, cat)===key).forEach(v=>{
    const color = productColor(v);
    if(!usefulColor(color)) return;
    const prev = byColor.get(color);
    if(!prev || priceValue(v) < priceValue(prev)) byColor.set(color, v);
  });
  if(byColor.size < 2) return [];
  return [...byColor.entries()]
    .sort(([a,av],[b,bv])=> colorVariantOrder(a)-colorVariantOrder(b) || priceValue(av)-priceValue(bv) || String(a).localeCompare(String(b),'ko-KR'))
    .map(([color, product])=>({ color, product }));
}
function wColorInitialVariantId(id){
  const choices = wColorVariantOptions(id);
  if(!choices.length) return id;
  return choices.find(v=>W.selected.includes(v.product.id))?.product.id
    || choices.find(v=>v.product.id===id)?.product.id
    || choices[0].product.id;
}
function wDetailInitialVariantId(id){
  const colorId = wColorInitialVariantId(id);
  if(colorId !== id || wColorVariantOptions(id).length) return colorId;
  return wSashInitialVariantId(id);
}
function wSashInitialVariantId(id){
  const choices = wSashSizeChoices(id);
  if(!choices.length) return id;
  return choices.find(v=>W.selected.includes(v.product.id))?.product.id
    || choices.find(v=>v.product.id===id)?.product.id
    || choices[0].product.id;
}
function wSetDetailVariantFields(modal, p){
  if(!modal || !p) return;
  const hero = modal.querySelector('.pm-hero');
  if(hero){
    hero.className = `pm-hero imgph${p.image?' has-img':''}`;
    hero.innerHTML = productImg(p);
  }
  const price = modal.querySelector('[data-sash-price]');
  if(price) price.innerHTML = `${won(p.price)}<small>원부터</small>`;
  const note = modal.querySelector('[data-sash-note]');
  if(note) note.textContent = productPrimarySpec(p);
  const sku = modal.querySelector('[data-sash-sku]');
  if(sku) sku.textContent = `품번 · ${p.sku || p.model || '제품 정보 확인'}`;
  const color = modal.querySelector('[data-sash-color]');
  if(color) color.textContent = `색상 · ${p.color || '기본'}`;
  const feature = modal.querySelector('[data-sash-feature]');
  if(feature) feature.textContent = productFeatureSpec(p);
  if(window.lucide) lucide.createIcons();
}
function wSetSashDetailChoice(sourceId, variantId){
  const modal = document.getElementById('wmodal');
  const p = wp(variantId);
  if(!modal || !p) return;
  modal.dataset.sashSource = sourceId;
  modal.dataset.sashVariant = variantId;
  modal.querySelectorAll('.size-choice-btn').forEach(btn=>btn.classList.toggle('selected', btn.dataset.variantId===variantId));
  wSetDetailVariantFields(modal, p);
  const buy = modal.querySelector('[data-sash-buy]');
  if(buy){
    const added = W.selected.includes(variantId);
    buy.classList.toggle('added', added);
    buy.textContent = added ? '담김 ✓' : '담기';
  }
}
function wSetColorDetailChoice(sourceId, variantId){
  const modal = document.getElementById('wmodal');
  const p = wp(variantId);
  if(!modal || !p) return;
  modal.dataset.colorSource = sourceId;
  modal.dataset.colorVariant = variantId;
  modal.querySelectorAll('.color-choice-btn').forEach(btn=>btn.classList.toggle('selected', btn.dataset.variantId===variantId));
  wSetDetailVariantFields(modal, p);
  const buy = modal.querySelector('[data-color-buy]');
  if(buy){
    const added = W.selected.includes(variantId);
    buy.classList.toggle('added', added);
    buy.textContent = added ? '담김 ✓' : '담기';
  }
}
function wSashDetailSizeHtml(id, selectedId){
  const choices = wSashSizeChoices(id);
  if(catOf(id)!=='샷시손잡이' || !choices.length) return '';
  return `<div class="size-choice-box">
    <div class="size-choice-label">사이즈</div>
    <div class="size-choice-options">
      ${choices.map(v=>`<button class="size-choice-btn${v.product.id===selectedId?' selected':''}" data-variant-id="${v.product.id}" onclick="wSetSashDetailChoice('${id}','${v.product.id}')"><b>${v.size}</b><span>${won(v.product.price)}원</span></button>`).join('')}
    </div>
  </div>`;
}
function wColorDetailHtml(id, selectedId){
  const choices = wColorVariantOptions(id);
  if(!choices.length) return '';
  return `<div class="size-choice-box color-choice-box">
    <div class="size-choice-label">색상</div>
    <div class="size-choice-options">
      ${choices.map(v=>`<button class="size-choice-btn color-choice-btn${v.product.id===selectedId?' selected':''}" data-variant-id="${v.product.id}" onclick="wSetColorDetailChoice('${id}','${v.product.id}')"><b>${v.color}</b><span>${won(v.product.price)}원</span></button>`).join('')}
    </div>
  </div>`;
}
/* 시공비: 제품 종류별 1개 시공 비용 × 수량 */
function laborOf(id){
  const p = wp(id) || {}; const cat = catOf(id); const nm = productText(p) || p.name || '';
  switch(cat){
    case '양변기 교체': return 100000;
    case '세면대 교체': return 80000;
    case '수전 교체':
      if(/주방/.test(nm)) return 40000;
      if(/레인/.test(nm)) return 100000;
      if(/멀티|욕조|샤워/.test(nm)) return 60000;
      return 40000;
    case '환풍기 교체': return /일체형|습도|복합|LED|휴젠뜨|온풍|제습|헤어|바디|히터/.test(nm) ? 80000 : 60000;
    case '실리콘 재시공': return 6000;
    case '욕실 악세서리': return /세트/.test(nm) ? 50000 : 25000;
    case '비데 설치': return 60000;
    case '샷시손잡이': return 40000;
    case '도어핸들': return 40000;
    default: return 60000;
  }
}
const wlabor = () => W.selected.reduce((s,id)=> s + laborOf(id)*wq(id), 0);
const wdisp = () => W.selfDisposal ? 0 : W_DISPOSAL * wunits();
const wtot = () => wsub() + wlabor() + wdisp();
const wvatTotal = () => Math.round(wtot() * 1.1);
function wToggleDisposal(){ W.selfDisposal = !W.selfDisposal; wPaintEstimate(); }
function wEstimateBody(){
  const n = W.selected.length;
  return `
        <div class="h-md">예상 견적</div>
        <div style="margin-top:14px">
          ${n? `${W.selected.map(id=>{const p=wp(id);return `<div class="qrow-sel"><div class="qrs-info"><div class="qrs-name"><span class="qrs-cat">${catOf(id).replace(/\s*교체$/,'')}</span> ${productDisplayName(p)}</div><div class="qrs-price">${won(p.price)}원</div></div><div class="qstep"><button onclick="wSetQty(event,'${id}',-1)" aria-label="감소">−</button><span>${wq(id)}</span><button onclick="wSetQty(event,'${id}',1)" aria-label="증가">+</button></div></div>`;}).join('')}
          <div class="prow" style="margin-top:6px"><span class="pk"><i data-lucide="package" style="width:16px;height:16px"></i> 제품가 합계 <span class="sub">${wunits()}개</span></span><span class="pv">${won(wsub())}</span></div>
          <div class="prow"><span class="pk"><i data-lucide="wrench" style="width:16px;height:16px"></i> 시공비 <span class="sub">×${wunits()}</span></span><span class="pv">${won(wlabor())}</span></div>
          <div class="prow"><span class="pk"><i data-lucide="trash-2" style="width:16px;height:16px"></i> 폐기물 처리비 <span class="sub">×${wunits()}</span></span><span class="pv${W.selfDisposal?' strike':''}">${won(wdisp())}</span></div>
          <label class="disp-opt"><input type="checkbox" ${W.selfDisposal?'checked':''} onchange="wToggleDisposal()"><span class="disp-box"></span><span class="disp-txt">폐기물은 직접 처리할게요 <span class="disp-sub">직접 처리 시 폐기물 처리비 제외</span></span></label>
          <div class="prow tot"><span class="pk">예상 합계</span><span class="pv">${won(wtot())}<span class="sub" style="font-weight:600"> 원~</span></span></div>`
          : `<div class="qest-empty"><i data-lucide="shopping-bag"></i><div class="qest-empty-t">선택한 제품이 없어요</div><div class="qest-empty-d">바꿀 제품을 담으면<br>예상 견적이 여기에 표시돼요.</div></div>`}
        </div>
        <button class="web-btn pri block lg" style="margin-top:16px" aria-disabled="${n?'false':'true'}" onclick="${n?"openEstimate()":''}">견적서 보기</button>
        <button class="web-btn book-btn block lg" style="margin-top:10px" aria-disabled="${n?'false':'true'}" onclick="${n?"webnav('prebook')":''}"><i data-lucide="calendar-check" style="width:18px;height:18px"></i> 바로 예약하기</button>
        <button class="web-btn kkbtn block" style="margin-top:10px" onclick="webKakao('product')">${WKK} 카카오톡 상담</button>`;
}
function wPaintEstimate(){ const e=document.getElementById('wEstimate'); if(e){ e.innerHTML=wEstimateBody(); if(window.lucide) lucide.createIcons(); } }
function wSyncCard(id){ document.querySelectorAll('.pcard[data-pid]').forEach(c=>c.classList.toggle('sel', wProductSelected(c.dataset.pid))); }

function webnav(id, opts={}){
  const same = (W.cur === id);
  const sy = same ? window.scrollY : 0;
  W.cur = id;
  document.getElementById('web').innerHTML = `<div class="web-screen web-screen-${id}${same?' noanim':''}">${WS[id]()}</div>`;
  if (window.lucide) lucide.createIcons();
  window.scrollTo(0, same ? sy : 0);
  alignNav();
  if(opts.history !== false) wSetBrowserRoute(id, opts.history);
}
function alignNav(){
  const wrap = document.querySelector('#web .wrap, #web .home-wrap');
  const logo = document.querySelector('.topnav .bc-logo');
  if(!wrap || !logo) return;
  const cs = getComputedStyle(wrap);
  const left = wrap.getBoundingClientRect().left + parseFloat(cs.paddingLeft || 0);
  const nav = logo.closest('.topnav');
  const navPad = nav ? parseFloat(getComputedStyle(nav).paddingLeft || 0) : 0;
  logo.style.marginLeft = Math.max(0, left - navPad) + 'px';
}
window.addEventListener('resize', alignNav);
const W_PRODUCT_PAGE_SIZE = 15; // desktop product grid: 3 columns x 5 rows
function wProductPager(total, page){
  const totalPages = Math.max(1, Math.ceil(total / W_PRODUCT_PAGE_SIZE));
  if(totalPages<=1) return '';
  return `<div class="product-pager">
    <button class="pager-btn" ${page<=1?'aria-disabled="true"':''} onclick="wSetProductPage(${page-1})"><i data-lucide="chevron-left"></i> 이전</button>
    <span class="pager-state"><small>${page} / ${totalPages} 페이지</small></span>
    <button class="pager-btn" ${page>=totalPages?'aria-disabled="true"':''} onclick="wSetProductPage(${page+1})">다음 <i data-lucide="chevron-right"></i></button>
  </div>`;
}
function wProductsListBody(){
  const all=wlist();
  const subs=SUBTYPES[W.item]||null;
  const cur=subs?(W.subFilter||''):'';
  const sel=cur&&subs.find(x=>x[0]===cur);
  const baseList = sel?all.filter(p=>sel[1].test(productSubSearchText(p))):all;
  const brands = uniqueSorted(baseList, productBrand);
  const colors = uniqueSorted(baseList, productColor);
  const colorOptions = visibleColors(colors);
  const showColorFilter = colors.filter(usefulColor).length > 1;
  if(W.brandFilter && !brands.includes(W.brandFilter)) W.brandFilter='';
  if(!showColorFilter) W.colorFilter='';
  else if(W.colorFilter && !colorOptions.includes(W.colorFilter)) W.colorFilter='';
  const filteredList = filteredProducts(baseList, W.brandFilter, W.colorFilter);
  const list=sortedProducts(productCardList(filteredList, filteredList), W.productSort);
  const totalPages = Math.max(1, Math.ceil(list.length / W_PRODUCT_PAGE_SIZE));
  W.productPage = Math.min(Math.max(W.productPage || 1, 1), totalPages);
  const start = (W.productPage - 1) * W_PRODUCT_PAGE_SIZE;
  const paged = list.slice(start, start + W_PRODUCT_PAGE_SIZE);
  const subFilter = subs ? [['','전체'],...subs.map(s=>[s[0],s[0]])].map(o=>`<span class="fbtn${cur===o[0]?' on':''}" onclick="wSetSub('${esc(o[0])}')">${esc(o[1])}</span>`).join('') : '';
  const sortFilter = PRODUCT_SORTS.map(([key,label])=>`<span class="fbtn sort-chip${(W.productSort||'low')===key?' on':''}" onclick="wSetProductSort('${key}')">${(W.productSort||'low')===key?'<i data-lucide="check"></i>':''}${label}</span>`).join('');
  const brandSelect = `<label class="filter-select"><span>브랜드</span><select onchange="wSetBrandFilter(this.value)"><option value="">전체</option>${brands.map(b=>`<option value="${esc(b)}"${W.brandFilter===b?' selected':''}>${esc(b)}</option>`).join('')}</select></label>`;
  const colorSelect = showColorFilter ? `<label class="filter-select"><span>색상</span><select onchange="wSetColorFilter(this.value)"><option value="">전체</option>${colorOptions.map(c=>`<option value="${esc(c)}"${W.colorFilter===c?' selected':''}>${esc(c)}</option>`).join('')}</select></label>` : '';
  const resetFilter = (W.brandFilter || W.colorFilter || cur) ? `<span class="fbtn" onclick="wClearProductFilters()">초기화</span>` : '';
  const categoryRow = subFilter ? `<div class="filterbar filter-tabs" style="margin-top:10px">${subFilter}</div>` : '';
  const sortRow = `<div class="filterbar filter-sort" style="margin-top:${subFilter?'8px':'10px'}">${sortFilter}</div>`;
  const selectsRow = `<div class="filterbar filter-selects" style="margin-top:8px">${brandSelect}${colorSelect}${resetFilter}</div>`;
  return `
      <div class="between"><div class="h-md">전체 제품 (${list.length})</div></div>
      ${categoryRow}${sortRow}${selectsRow}
      <div class="prodgrid" style="margin-top:16px">${paged.map(p=>wpcard(p,false)).join('')}</div>
      ${wProductPager(list.length, W.productPage)}
      <button class="web-btn kkbtn" style="margin-top:18px" onclick="webKakao('product')">${WKK} 원하는 제품이 따로 있어요</button>`;
}
function wSetProductPage(page){
  W.productPage = page;
  const l=document.getElementById('wpList');
  if(l){ l.innerHTML=wProductsListBody(); if(window.lucide) lucide.createIcons(); }
  document.getElementById('wpList')?.scrollIntoView({ behavior:'auto', block:'start' });
}
function wRefreshProducts(){ const l=document.getElementById('wpList'); if(l){ l.innerHTML=wProductsListBody(); if(window.lucide) lucide.createIcons(); } }
function wSetSub(label){ W.subFilter=label; W.brandFilter=''; W.colorFilter=''; W.productPage=1; wRefreshProducts(); }
function wSetProductSort(value){ W.productSort=value; W.productPage=1; wRefreshProducts(); }
function wSetBrandFilter(value){ W.brandFilter=value; W.productPage=1; wRefreshProducts(); }
function wSetColorFilter(value){ W.colorFilter=value; W.productPage=1; wRefreshProducts(); }
function wClearProductFilters(){ W.subFilter=''; W.brandFilter=''; W.colorFilter=''; W.productPage=1; wRefreshProducts(); }
function wSelectItem(name){
  W.item = name;
  W.subFilter = '';
  W.brandFilter = '';
  W.colorFilter = '';
  W.productPage = 1;
  if(W.cur==='products'){
    const short = name.replace(/\s*교체$/,'');
    document.querySelectorAll('.cat-item').forEach(b=>{ b.classList.toggle('on', b.querySelector('.cat-lbl').textContent===short); });
    const t=document.getElementById('wpTitle'); if(t) t.innerHTML = `${short} <span class="enlabel">${ITEM_EN[name]||''}</span>`;
    const l=document.getElementById('wpList'); if(l) l.innerHTML = wProductsListBody();
    wPaintEstimate();
    if(window.lucide) lucide.createIcons();
    wSetBrowserRoute('products');
  } else {
    webnav('products');
  }
}
function wToggleProductId(id){
  const variants = productGroupVariants(id);
  const selected = variants.filter(v=>W.selected.includes(v.id));
  if(selected.length){
    selected.forEach(v=>{ const i=W.selected.indexOf(v.id); if(i>=0) W.selected.splice(i,1); delete W.qty[v.id]; });
  } else { W.selected.push(id); W.qty[id]=1; }
  wSyncCard(id);
  wPaintEstimate();
}
function wSelectSashVariant(sourceId, variantId){
  if(!variantId) return;
  wSashVariantOptions(sourceId).forEach(v=>{
    if(v.product.id!==variantId){
      const i=W.selected.indexOf(v.product.id);
      if(i>=0){ W.selected.splice(i,1); delete W.qty[v.product.id]; wSyncCard(v.product.id); }
    }
  });
  if(!W.selected.includes(variantId)){
    W.selected.push(variantId);
    W.qty[variantId]=1;
  }
  wSyncCard(sourceId);
  wPaintEstimate();
  webClose();
}
function wSelectColorVariant(sourceId, variantId){
  if(!variantId) return;
  wColorVariantOptions(sourceId).forEach(v=>{
    if(v.product.id!==variantId){
      const i=W.selected.indexOf(v.product.id);
      if(i>=0){ W.selected.splice(i,1); delete W.qty[v.product.id]; wSyncCard(v.product.id); }
    }
  });
  if(!W.selected.includes(variantId)){
    W.selected.push(variantId);
    W.qty[variantId]=1;
  }
  wSyncCard(sourceId);
  wPaintEstimate();
  webClose();
}
function wOpenSashSizePicker(id){
  const p = wp(id), choices = wSashSizeChoices(id);
  if(!choices.length){ wToggleProductId(id); return; }
  webModal(`<div class="between"><div><div class="h-md">손잡이 사이즈 선택</div><p class="p-sm mt4">${productDisplayName(p)}</p></div><button class="iconbtn" onclick="webClose()" aria-label="닫기"><i data-lucide="x"></i></button></div>
    <div class="sash-size-grid">
      ${choices.map(v=>{
        const selected = W.selected.includes(v.product.id);
        return `<button class="sash-size-option${selected?' selected':''}" onclick="wSelectSashVariant('${id}','${v.product.id}')"><b>${v.size}</b><span>${won(v.product.price)}원</span><small>${v.product.color || '기본'}</small></button>`;
      }).join('')}
    </div>
    <p class="p-sm mt12">선택한 사이즈가 장바구니에 담겨요. 같은 사이즈에 색상별 가격 차이가 있으면 최저가 기준으로 담습니다.</p>`);
}
function wOpenColorVariantPicker(id){
  const p = wp(id), choices = wColorVariantOptions(id);
  if(!choices.length){ wToggleProductId(id); return; }
  webModal(`<div class="between"><div><div class="h-md">색상 선택</div><p class="p-sm mt4">${productDisplayName(p)}</p></div><button class="iconbtn" onclick="webClose()" aria-label="닫기"><i data-lucide="x"></i></button></div>
    <div class="sash-size-grid">
      ${choices.map(v=>{
        const selected = W.selected.includes(v.product.id);
        return `<button class="sash-size-option${selected?' selected':''}" onclick="wSelectColorVariant('${id}','${v.product.id}')"><b>${v.color}</b><span>${won(v.product.price)}원</span><small>${v.product.sku || v.product.model || ''}</small></button>`;
      }).join('')}
    </div>`);
}
function wToggle(ev, id){
  if(ev?.stopPropagation) ev.stopPropagation();
  if(catOf(id)==='샷시손잡이'){ wOpenSashSizePicker(id); return; }
  if(wColorVariantOptions(id).length){ wOpenColorVariantPicker(id); return; }
  wToggleProductId(id);
}
function wSetQty(ev, id, d){ ev.stopPropagation(); const next=(W.qty[id]||1)+d; if(next<1){ const i=W.selected.indexOf(id); if(i>=0) W.selected.splice(i,1); delete W.qty[id]; wSyncCard(id); } else { W.qty[id]=next; } wPaintEstimate(); }
function wEnsurePhotoState(){
  if(!Array.isArray(W.photoFiles)) W.photoFiles=[];
  if(!Array.isArray(W.photoSetFiles)) W.photoSetFiles=[[],[],[]];
  [0,1,2].forEach(i=>{ if(!Array.isArray(W.photoSetFiles[i])) W.photoSetFiles[i]=[]; });
  W.photos = W.photoFiles.length;
  W.photoSets = W.photoSetFiles.map(a=>a.length);
}
function wPhotoEntry(file){ return { name:file.name || '사진', url:URL.createObjectURL(file), file }; }
function wHandlePhotoFiles(files, target='prebook'){
  wEnsurePhotoState();
  [...(files||[])].slice(0, 3-W.photoFiles.length).forEach(file=>W.photoFiles.push(wPhotoEntry(file)));
  wEnsurePhotoState();
  webnav(target);
}
function wHandleSetPhotoFiles(group, files){
  wEnsurePhotoState();
  const arr = W.photoSetFiles[group] || (W.photoSetFiles[group]=[]);
  [...(files||[])].slice(0, 3-arr.length).forEach(file=>arr.push(wPhotoEntry(file)));
  wEnsurePhotoState();
  webnav('upload');
}
function wRemovePhoto(index, target='prebook'){
  wEnsurePhotoState();
  const [removed] = W.photoFiles.splice(index,1);
  if(removed?.url) URL.revokeObjectURL(removed.url);
  wEnsurePhotoState();
  webnav(target);
}
function wRemoveSetPhoto(group, index){
  wEnsurePhotoState();
  const arr = W.photoSetFiles[group] || [];
  const [removed] = arr.splice(index,1);
  if(removed?.url) URL.revokeObjectURL(removed.url);
  wEnsurePhotoState();
  webnav('upload');
}
function wAddPhoto(){ document.getElementById('wBookingPhotoInput')?.click(); }
function wAddSetPhoto(g){ document.getElementById(`wSetPhotoInput${g}`)?.click(); }
function wPhotoSlot(file, label, removeCall, emptyCall, active=true){
  if(file) return `<div class="slot filled has-photo" style="aspect-ratio:1"><img src="${esc(file.url)}" alt="${esc(label)}"><button type="button" class="slot-remove" onclick="event.stopPropagation();${removeCall}" aria-label="사진 삭제"><i data-lucide="x"></i></button><span class="ph-tag">${esc(label)}</span><span class="slot-name">${esc(file.name)}</span><span class="ph-check"><i data-lucide="check"></i></span></div>`;
  return `<div class="slot" style="aspect-ratio:1${active?'':';opacity:.55'}"${active?` onclick="${emptyCall}"`:''}><i data-lucide="plus" class="sl-ic"></i><span class="sl-t">${esc(label)}</span></div>`;
}
const wContactOk = () => W.phone.replace(/\D/g,'').length>=10 && W.name.trim().length>=1 && W.region.trim().length>=1 && W.regionDetail.trim().length>=1 && !!W.regionOk;
function wInquiryOk(){ wEnsurePhotoState(); return wContactOk() && (W.photoSets[0]||0)>=3 && !!W.privacyOkInq; }  // 사진확인/문의: 곳1 사진 3장 + 개인정보 동의 필수
function wPrebookOk(){ return wContactOk() && !!W.specCheck && !!W.privacyOk; }    // 예약정보 페이지
function wUpdateNext(){ const b=document.getElementById('upNext'); if(b){ const ok=(W.cur==='prebook')?wPrebookOk():wInquiryOk(); b.setAttribute('aria-disabled', ok?'false':'true'); } }
function wName(v){ W.name=v; wUpdateNext(); }
function wPhone(v){ W.phone=v; wUpdateNext(); }
function wRegionToggle(c){ W.regionOk=c; wUpdateNext(); }
function wSpecToggle(c){ W.specCheck=c; wUpdateNext(); }
function wPrivacyToggle(c){ W.privacyOk=c; wUpdateNext(); }
function wPrivacyInqToggle(c){ W.privacyOkInq=c; wUpdateNext(); }
function wBookingPhotoCount(){ wEnsurePhotoState(); return W.photos || W.photoFiles.length || 0; }
function wBookingPhotoLabel(){
  const count = wBookingPhotoCount();
  return count > 0 ? `${count}장 첨부됨` : '미첨부 (선택)';
}
function wDonePhotoLabel(){
  const count = W.remoteOrder?.photoCount ?? wBookingPhotoCount();
  return count > 0 ? `사진 ${count}장` : '사진 미첨부';
}
function wDigits(v){ return String(v||'').replace(/\D/g,''); }
function wCashReceiptIdentity(){
  if(W.cashReceiptType === 'personal') return wDigits(W.cashReceiptIdentity) || wDigits(W.phone);
  return wDigits(W.cashReceiptIdentity);
}
function wCashReceiptPayload(){
  return {
    type: W.cashReceiptType || 'none',
    identity: W.cashReceiptType === 'none' ? '' : wCashReceiptIdentity()
  };
}
function wCashReceiptText(){
  const type = W.cashReceiptType || 'none';
  if(type === 'none') return '신청 안 함';
  const value = wCashReceiptIdentity() || '정보 입력 전';
  return type === 'business' ? `사업자 지출증빙 / ${value}` : `개인 소득공제 / ${value}`;
}
function wCashReceiptOk(){
  if(W.cashReceiptType === 'none') return true;
  return wCashReceiptIdentity().length >= 10;
}
function wSetCashReceiptType(type){
  W.cashReceiptType = type;
  if(type === 'none') W.cashReceiptIdentity = '';
  if(type === 'personal' && !W.cashReceiptIdentity) W.cashReceiptIdentity = wDigits(W.phone);
  webnav('checkout', { history:false });
}
function wSetCashReceiptIdentity(v){
  W.cashReceiptIdentity = wDigits(v);
}
function wCashReceiptBox(){
  const type = W.cashReceiptType || 'none';
  const label = type === 'business' ? '사업자등록번호' : '휴대전화번호';
  const placeholder = type === 'business' ? '사업자등록번호 10자리' : '01000000000';
  const desc = type === 'none'
    ? '현금영수증이 필요하면 용도를 선택해 주세요.'
    : '입금 확인 후 아래 정보로 현금영수증 발급을 진행합니다.';
  return `
  <div class="bcard pad" style="padding:24px;margin-top:16px">
    <div class="h-md">현금영수증</div>
    <p class="p-sm" style="margin-top:6px;color:var(--gray-600)">${desc}</p>
    <div class="chips" style="margin-top:12px">
      <span class="chip${type==='none'?' on':''}" onclick="wSetCashReceiptType('none')">발급 안 함</span>
      <span class="chip${type==='personal'?' on':''}" onclick="wSetCashReceiptType('personal')">소득공제용</span>
      <span class="chip${type==='business'?' on':''}" onclick="wSetCashReceiptType('business')">지출증빙용</span>
    </div>
    ${type!=='none'?`<div class="field" style="margin-top:14px"><label>${label}</label><input class="input" inputmode="numeric" autocomplete="off" placeholder="${placeholder}" value="${esc(wCashReceiptIdentity())}" oninput="wSetCashReceiptIdentity(this.value)"></div>`:''}
  </div>`;
}

const ADDR_DB = [
  {zip:'16827', road:'경기 용인시 수지구 풍덕천로 100', jibun:'경기 용인시 수지구 풍덕천동 1015'},
  {zip:'16942', road:'경기 용인시 수지구 죽전로 152', jibun:'경기 용인시 수지구 죽전동 1281'},
  {zip:'16942', road:'경기 용인시 수지구 신봉1로 30', jibun:'경기 용인시 수지구 신봉동 762'},
  {zip:'13529', road:'경기 성남시 분당구 판교역로 235', jibun:'경기 성남시 분당구 삼평동 681'},
  {zip:'13561', road:'경기 성남시 분당구 분당내곡로 131', jibun:'경기 성남시 분당구 백현동 532'},
  {zip:'16681', road:'경기 수원시 영통구 광교중앙로 145', jibun:'경기 수원시 영통구 이의동 1535'},
  {zip:'06236', road:'서울 강남구 테헤란로 152', jibun:'서울 강남구 역삼동 737'},
  {zip:'06035', road:'서울 강남구 가로수길 5', jibun:'서울 강남구 신사동 535'},
  {zip:'04524', road:'서울 중구 세종대로 110', jibun:'서울 중구 태평로1가 31'},
  {zip:'03187', road:'서울 종로구 사직로 161', jibun:'서울 종로구 세종로 1-1'},
  {zip:'48058', road:'부산 해운대구 해운대해변로 264', jibun:'부산 해운대구 우동 1394'},
];
const POSTCODE_SCRIPT_SRC = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
function postcodeCtor(){ return window.daum?.Postcode || window.kakao?.Postcode; }
function loadPostcodeScript(){
  if(postcodeCtor()) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-kakao-postcode="true"]');
    if(existing){
      existing.addEventListener('load',()=>resolve(),{once:true});
      existing.addEventListener('error',()=>reject(new Error('주소 검색을 불러오지 못했어요.')),{once:true});
      return;
    }
    const s=document.createElement('script');
    s.src=POSTCODE_SCRIPT_SRC;
    s.async=true;
    s.dataset.kakaoPostcode='true';
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('주소 검색을 불러오지 못했어요.'));
    document.head.appendChild(s);
  });
}
function postcodeAddress(data){
  return {
    road: data.userSelectedType === 'R' ? data.roadAddress : (data.jibunAddress || data.address || data.roadAddress),
    zip: data.zonecode || ''
  };
}
function openAddrSearch(){
  webClose();
  const o=document.createElement('div');
  o.id='wmodal';
  o.className='addr-modal-scrim';
  o.innerHTML=`<div class="addr-modal-card">
    <div class="addr-modal-head">
      <div><div class="h-md">주소 검색</div><p>도로명 주소를 선택해주세요.</p></div>
      <button type="button" class="addr-x" onclick="webClose()" aria-label="닫기"><i data-lucide="x"></i></button>
    </div>
    <div id="webPostcodeFrame" class="addr-postcode-frame"><div class="addr-empty">주소 검색을 불러오는 중입니다.</div></div>
    <p id="webPostcodeMsg" class="addr-modal-msg"></p>
  </div>`;
  o.addEventListener('click',e=>{ if(e.target===o) webClose(); });
  document.body.appendChild(o);
  if(window.lucide) lucide.createIcons();
  embedPostcode('webPostcodeFrame', (address)=>{
    W.region=address.road;
    W.postalCode=address.zip;
    W.regionDetail='';
    webClose();
    webnav(W.cur==='prebook'?'prebook':'upload');
    setTimeout(()=>{ const d=document.querySelector('.addr-detail'); if(d) d.focus(); }, 80);
  }, 'webPostcodeMsg');
}
async function embedPostcode(containerId, onSelect, messageId){
  const frame=document.getElementById(containerId);
  const msg=messageId ? document.getElementById(messageId) : null;
  try{
    if(msg) msg.textContent='';
    await loadPostcodeScript();
    const Postcode=postcodeCtor();
    if(!Postcode) throw new Error('주소 검색을 사용할 수 없어요.');
    if(!frame) return;
    frame.innerHTML='';
    new Postcode({
      width:'100%',
      height:'100%',
      oncomplete:(data)=>onSelect(postcodeAddress(data))
    }).embed(frame);
  }catch(err){
    const text=err instanceof Error ? err.message : '주소 검색을 다시 시도해주세요.';
    if(msg) msg.textContent=text;
    if(frame) frame.innerHTML=`<div class="addr-empty">${text}<br>네트워크 연결 후 다시 열어주세요.</div>`;
  }
}
function wTryUpload(){ if(wPrebookOk()) webnav('booking'); }
function wAllPhotoEntries(){
  wEnsurePhotoState();
  return [...W.photoFiles, ...W.photoSetFiles.flat()].filter(entry=>entry&&entry.file);
}
const W_PHOTO_MAX_DIM = 1600;
const W_PHOTO_QUALITY = 0.78;
const W_PHOTO_SKIP_BYTES = 900 * 1024;
async function wOptimizePhotoFile(file){
  if(!(file instanceof File) || !/^image\/(jpeg|jpg|png|webp)$/i.test(file.type) || file.size <= W_PHOTO_SKIP_BYTES) return file;
  const url = URL.createObjectURL(file);
  try{
    const img = await new Promise((resolve,reject)=>{
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const maxSide = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const scale = Math.min(1, W_PHOTO_MAX_DIM / Math.max(1, maxSide));
    const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha:false });
    if(!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise(resolve=>canvas.toBlob(resolve, 'image/jpeg', W_PHOTO_QUALITY));
    if(!blob || blob.size >= file.size) return file;
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type:'image/jpeg', lastModified:file.lastModified || Date.now() });
  }catch(_){
    return file;
  }finally{
    URL.revokeObjectURL(url);
  }
}
async function wAppendOptimizedPhotos(fd, entries){
  for(const [idx, entry] of entries.entries()){
    const file = await wOptimizePhotoFile(entry.file);
    fd.append('photos', file, file.name || entry.name || `photo-${idx+1}.jpg`);
  }
}
async function wUploadOrderPhotos(order, entries){
  if(!order?.id || !order?.accessToken || !entries?.length) return;
  try{
    const fd = new FormData();
    fd.append('accessToken', order.accessToken);
    await wAppendOptimizedPhotos(fd, entries);
    const res = await fetch(`/api/builduscare/orders/${encodeURIComponent(order.id)}/photos`, { method:'POST', body:fd });
    const json = await res.json().catch(()=>null);
    if(!res.ok || !json?.ok) throw new Error(json?.error?.message || json?.message || '사진 업로드에 실패했어요.');
    if(W.remoteOrder?.id === order.id && json.data?.photoCount != null){
      W.remoteOrder.photoCount = json.data.photoCount;
    }
  }catch(err){
    console.warn('Build us Care photo upload failed', err);
  }
}
function wSelectedOrderPayload(){
  return W.selected.map(id=>({ id, qty:wq(id) }));
}
function wBuildOrderPayload(){
  return {
    deviceType:'desktop',
    item:W.item,
    customer:{ name:W.name, phone:W.phone },
    address:{ roadAddress:W.region, detailAddress:W.regionDetail, postalCode:W.postalCode },
    reservation:{ date:W.date, time:W.time },
    selected:wSelectedOrderPayload(),
    selfDisposal:W.selfDisposal,
    cashReceipt:wCashReceiptPayload(),
    totals:{ productAmount:wsub(), laborAmount:wlabor(), disposalAmount:wdisp(), totalAmount:wtot() }
  };
}
function wApplyRemoteOrder(order){
  if(!order) return;
  W.remoteOrder = order;
  W.orderNo = order.orderNumber || W.orderNo;
  W.item = order.item || W.item;
  W.name = order.customerName || W.name;
  W.phone = order.phone || W.phone;
  W.region = order.roadAddress || W.region;
  W.regionDetail = order.detailAddress || W.regionDetail;
  W._lookupNo = W.orderNo;
  W._lookupName = W.name;
}
function wOpenTransfer(){
  const url = W.remoteOrder?.transferUrl;
  if(!url) return;
  try{ window.top.location.href = url; }catch(_){ window.location.href = url; }
}
function wPaymentAmount(){
  const order = W.remoteOrder || {};
  return Number(order?.totals?.onlinePaymentAmount || order?.payment?.amount || 0);
}
function wPaymentStatusLabel(){
  const status = W.remoteOrder?.payment?.status || '';
  if(status==='done') return '입금 완료';
  if(status==='pending') return '입금 대기';
  return '확인 중';
}
async function wSubmitOrder(){
  if(W.submitting) return;
  if(!wCashReceiptOk()){
    W.submitErr = '현금영수증 발급 정보를 확인해 주세요.';
    webnav('checkout', { history:false });
    return;
  }
  W.submitting = true;
  W.submitErr = '';
  webnav('checkout');
  try{
    const photoEntries = wAllPhotoEntries();
    const fd = new FormData();
    fd.append('payload', JSON.stringify(wBuildOrderPayload()));
    const res = await fetch('/api/builduscare/orders', { method:'POST', body:fd });
    const json = await res.json().catch(()=>null);
    if(!res.ok || !json?.ok) throw new Error(json?.error?.message || json?.message || '접수 저장에 실패했어요.');
    const order = json.data.order;
    if(order) order.photoCount = Math.max(Number(order.photoCount || 0), photoEntries.length);
    wApplyRemoteOrder(order);
    W.submitting = false;
    webnav('done');
    void wUploadOrderPhotos(order, photoEntries);
  }catch(err){
    W.submitting = false;
    W.submitErr = err instanceof Error ? err.message : '접수 저장에 실패했어요.';
    webnav('checkout');
  }
}
async function wLookupOrder(){
  const no=(W._lookupNo||'').trim().toUpperCase();
  const nm=(W._lookupName||'').trim();
  if(!no || !nm){
    W._lookupErr=true; webnav('orders'); return;
  }
  W._lookupLoading=true; W._lookupErr=false; webnav('orders');
  try{
    const res = await fetch('/api/builduscare/orders/lookup', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ orderNumber:no, name:nm })
    });
    const json = await res.json().catch(()=>null);
    if(!res.ok || !json?.ok) throw new Error(json?.error?.message || json?.message || '주문 조회에 실패했어요.');
    if(json.data?.order){
      W._lookupLoading=false;
      wApplyRemoteOrder(json.data.order);
      W._lookupErr=false;
      webnav('orderview');
      return;
    }
    if(W.orderNo && no===W.orderNo.toUpperCase() && nm && nm===(W.name||'').trim()){
      W._lookupLoading=false; W._lookupErr=false; webnav('orderview'); return;
    }
    W._lookupLoading=false; W._lookupErr=true; webnav('orders');
  }catch(err){
    W._lookupLoading=false;
    W._lookupErr=true;
    W.submitErr = err instanceof Error ? err.message : '';
    webnav('orders');
  }
}
async function wSubmitInquiry(){
  if(!wInquiryOk()) return;
  if(W.submitting) return;
  W.submitting = true;
  W.submitErr = '';
  webnav('upload');
  try{
    const photoEntries = wAllPhotoEntries();
    const payload = {
      ...wBuildOrderPayload(),
      item:'사진 확인',
      reservation:{ date:null, time:null },
      selected:[],
      totals:{ productAmount:0, laborAmount:0, disposalAmount:0, totalAmount:0 }
    };
    const fd = new FormData();
    fd.append('payload', JSON.stringify(payload));
    const res = await fetch('/api/builduscare/orders', { method:'POST', headers:{'x-builduscare-submission-type':'photo_check'}, body:fd });
    const json = await res.json().catch(()=>null);
    if(!res.ok || !json?.ok) throw new Error(json?.error?.message || json?.message || '접수 저장에 실패했어요.');
    const order = json.data.order;
    if(order) order.photoCount = Math.max(Number(order.photoCount || 0), photoEntries.length);
    wApplyRemoteOrder(order);
    W.submitting = false;
    webnav('done');
    void wUploadOrderPhotos(order, photoEntries);
  }catch(err){
    W.submitting = false;
    W.submitErr = err instanceof Error ? err.message : '접수 저장에 실패했어요.';
    webnav('upload');
  }
  return;
  const ono = wOrderNo();
  const now = new Date();
  const recv = `${now.getFullYear()}. ${now.getMonth()+1}. ${now.getDate()}. ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const addr = (W.region||'') + (W.regionDetail ? ' ' + W.regionDetail : '');
  const photoTotal = (W.photoSets||[]).reduce((s,n)=>s+(n||0),0);
  const photoLocs = (W.photoSets||[]).filter(n=>(n||0)>0).length;
  const logo = BC_LOGO_URI || await imgToDataUri('assets/bc-logo.png');
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>문의 접수증 · Build us Care</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Pretendard',-apple-system,sans-serif;color:#1d1d1f;background:#f5f5f7;padding:40px 20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{max-width:640px;margin:0 auto;background:#fff;border-radius:20px;padding:48px;box-shadow:0 10px 40px -16px rgba(0,0,0,.16)}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d1d1f;padding-bottom:22px}
    .q-logo{height:30px;width:auto}
    .meta{text-align:right;font-size:12px;color:#86868b;line-height:1.7}
    .meta b{color:#1d1d1f}
    .badge{display:inline-flex;align-items:center;gap:7px;margin-top:28px;background:#eaf2ff;color:#245FFF;font-size:13px;font-weight:700;padding:7px 14px;border-radius:980px}
    .badge i{width:7px;height:7px;border-radius:50%;background:#245FFF;display:inline-block}
    h1{font-size:28px;font-weight:700;letter-spacing:-.02em;margin:14px 0 4px}
    .sub{font-size:14px;color:#86868b;margin-bottom:26px}
    .ono{display:flex;justify-content:space-between;align-items:center;background:#f5f5f7;border-radius:14px;padding:18px 22px;margin-bottom:26px}
    .ono .k{font-size:13px;font-weight:600;color:#6e6e73}
    .ono .v{font-size:22px;font-weight:800;letter-spacing:-.01em}
    .info{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e5e5ea;border:1px solid #e5e5ea;border-radius:14px;overflow:hidden}
    .info .cell{background:#fff;padding:14px 18px}
    .info .cell.full{grid-column:1 / -1}
    .info .k{font-size:11px;font-weight:700;color:#86868b;letter-spacing:.02em}
    .info .v{font-size:15px;font-weight:600;margin-top:3px;letter-spacing:-.01em}
    .promise{margin-top:24px;background:#eef3ff;border-radius:16px;padding:20px 22px}
    .promise .pt{font-size:16px;font-weight:700;letter-spacing:-.01em;display:flex;align-items:center;gap:9px}
    .promise .pt svg{width:22px;height:22px;stroke:#245FFF;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .promise .pd{font-size:14px;line-height:1.65;color:#46443d;margin-top:9px}
    .promise .pd b{color:#245FFF}
    .foot{margin-top:30px;font-size:11px;color:#a0a0a5;line-height:1.7;border-top:1px solid #e5e5ea;padding-top:18px}
    .actions{max-width:640px;margin:20px auto 0;display:flex;gap:10px;justify-content:center}
    .btn{border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;padding:12px 24px;border-radius:980px}
    .btn.p{background:#245FFF;color:#fff}.btn.s{background:#fff;color:#1d1d1f;border:1px solid #d2d2d7}
    @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}.actions{display:none}}
  </style></head><body>
  <div class="sheet">
    <div class="top">
      <img class="q-logo" src="${logo}" alt="build us care">
      <div class="meta">접수일시 <b>${recv}</b><br>접수유형 사진 호환제품 문의<br>처리예정 24시간 이내</div>
    </div>
    <div class="badge"><i></i>접수 완료</div>
    <h1>사진 호환제품 문의 접수증</h1>
    <div class="sub">올려주신 사진을 매니저가 직접 확인하고 호환 제품을 찾아 안내드립니다.</div>
    <div class="ono"><span class="k">접수번호</span><span class="v">${ono}</span></div>
    <div class="info">
      <div class="cell"><div class="k">신청자</div><div class="v">${W.name||'-'}</div></div>
      <div class="cell"><div class="k">연락처</div><div class="v">${W.phone||'-'}</div></div>
      <div class="cell full"><div class="k">시공 주소</div><div class="v">${addr||'-'}</div></div>
      <div class="cell full"><div class="k">첨부 사진</div><div class="v">교체할 곳 ${photoLocs}곳 · 총 ${photoTotal}장</div></div>
    </div>
    <div class="promise">
      <div class="pt"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>24시간 내 호환 제품을 찾아드려요</div>
      <div class="pd">매니저가 사진 속 규격·연결부를 확인해 <b>설치 가능한 호환 제품</b>을 찾아, 접수 시각 기준 <b>24시간 이내</b>에 연락처로 후보 제품과 예상 견적을 안내드립니다. 추가 비용과 출장비는 없습니다.</div>
    </div>
    <div class="foot">주식회사 무니온 · 대표 김영태 · 경기도 용인시 포은대로59번길 37, 시그니처광교<br>사업자등록번호 601-81-39840 · 통신판매업신고 2025-용인수지-3087 · munion@mymunion.com</div>
  </div>
  <div class="actions">
    <button class="btn s" onclick="window.print()">인쇄 / PDF 저장</button>
    <button class="btn p" onclick="window.close()">닫기</button>
  </div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=720,height=900');
  if(w){ w.document.write(html); w.document.close(); }
}
function wDate(dateIso){ W.date=dateIso; webnav('booking'); }
function wTime(t){ W.time=t; webnav('booking'); }

function webModal(html){
  webClose();
  const o=document.createElement('div'); o.id='wmodal';
  o.style.cssText='position:fixed;inset:0;background:rgba(16,24,40,.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;';
  o.innerHTML=`<div class="bcard" style="max-width:420px;width:100%;padding:26px;">${html}</div>`;
  o.addEventListener('click',e=>{ if(e.target===o) webClose(); });
  document.body.appendChild(o); if(window.lucide) lucide.createIcons();
}
function webClose(){ const m=document.getElementById('wmodal'); if(m) m.remove(); }

const LEGAL_UPDATED = '2026년 6월 4일';
const LEGAL = {
  privacy: { title:'개인정보처리방침', body:`
    <p class="lg-lede">주식회사 무니온(이하 '회사')은 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의 개인정보를 보호하기 위해 다음과 같이 개인정보처리방침을 수립·공개합니다.</p>
    <h4>1. 수집하는 개인정보 항목</h4>
    <ul>
      <li>필수: 이름, 휴대전화번호, 시공 주소, 현장 사진</li>
      <li>자동 수집: 접속 IP, 쿠키, 서비스 이용기록, 기기정보</li>
      <li>결제 시: 결제수단 정보(전자결제대행사를 통해 처리)</li>
    </ul>
    <h4>2. 개인정보의 수집·이용 목적</h4>
    <ul>
      <li>교체 가능 여부 확인 및 견적 안내</li>
      <li>예약 접수, 방문 시공, 사후관리(A/S)</li>
      <li>고객 상담 및 불만 처리, 공지사항 전달</li>
    </ul>
    <h4>3. 개인정보의 보유 및 이용기간</h4>
    <p>원칙적으로 수집·이용 목적이 달성되면 지체 없이 파기합니다. 다만 관련 법령에 따라 아래 기간 동안 보관합니다.</p>
    <ul>
      <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
      <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
      <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
      <li>표시·광고에 관한 기록: 6개월 (전자상거래법)</li>
    </ul>
    <h4>4. 개인정보의 제3자 제공</h4>
    <p>회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 시공 진행에 필요한 범위에서 협력 시공기사에게 이름·연락처·주소·현장 사진이 제공될 수 있습니다.</p>
    <h4>5. 개인정보 처리의 위탁</h4>
    <p>원활한 서비스 제공을 위해 결제대행(PG사), 문자·알림 발송, 클라우드 인프라 운영 업무를 위탁할 수 있으며, 수탁자가 법령을 준수하도록 관리·감독합니다.</p>
    <h4>6. 이용자 및 법정대리인의 권리</h4>
    <p>이용자는 언제든지 본인의 개인정보 열람·정정·삭제·처리정지를 요구할 수 있으며, 회사는 지체 없이 조치합니다. 만 14세 미만 아동의 개인정보는 수집하지 않습니다.</p>
    <h4>7. 개인정보 보호책임자</h4>
    <p>성명: 김영태 (대표)<br>연락처: munion@mymunion.com</p>
    <p class="lg-note">본 방침은 ${LEGAL_UPDATED}부터 적용됩니다. 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 본 페이지를 통해 공지합니다.</p>` },

  terms: { title:'이용약관', body:`
    <p class="lg-lede">본 약관은 주식회사 무니온(이하 '회사')이 운영하는 Build us Care 서비스의 이용조건 및 절차, 회사와 이용자의 권리·의무를 규정합니다.</p>
    <h4>제1조 (목적)</h4>
    <p>이 약관은 회사가 제공하는 생활 제품 교체·시공 중개 및 관련 서비스의 이용에 관한 사항을 정함을 목적으로 합니다.</p>
    <h4>제2조 (서비스의 내용)</h4>
    <ul>
      <li>사진 기반 교체 가능 여부 확인 및 예상 견적 안내</li>
      <li>수전·양변기·세면대·비데·환풍기·손잡이·실리콘·욕실 악세서리 등 제품 교체 시공의 예약·중개</li>
      <li>주문 현황 조회 및 사후관리(A/S) 접수</li>
    </ul>
    <h4>제3조 (견적 및 계약의 성립)</h4>
    <p>서비스에 표시된 금액은 사진 확인 전 기준의 <b>예상 금액</b>이며, 현장 상황·규격·자재에 따라 달라질 수 있습니다. 최종 금액과 시공 가능 여부는 사진 확인 및 협의 후 확정되며, 이용자가 이에 동의하고 예약을 완료한 때 계약이 성립합니다.</p>
    <h4>제4조 (대금의 결제)</h4>
    <p>제품 대금, 기본 시공비, 폐기물 처리비 등은 견적에 명시되며, 출장비·숨은 비용은 청구하지 않습니다. 추가 비용이 발생하는 경우 사전에 안내하고 동의를 받습니다.</p>
    <h4>제5조 (이용자의 의무)</h4>
    <p>이용자는 정확한 정보와 현장 사진을 제공해야 하며, 허위 정보로 인해 발생한 추가 비용·시공 불가에 대해 회사는 책임지지 않습니다.</p>
    <h4>제6조 (청약철회 및 환불)</h4>
    <p>청약철회·환불은 「전자상거래 등에서의 소비자보호에 관한 법률」 및 회사의 '취소·환불 안내'에 따릅니다.</p>
    <h4>제7조 (책임의 제한)</h4>
    <p>천재지변, 이용자 귀책사유 등 회사의 통제를 벗어난 사유로 인한 손해에 대해서는 책임이 제한될 수 있습니다.</p>
    <h4>제8조 (분쟁의 해결)</h4>
    <p>본 약관은 대한민국 법령에 따라 해석되며, 분쟁 발생 시 「소비자분쟁해결기준」 및 관할 법원의 판단에 따릅니다.</p>
    <p class="lg-note">시행일: ${LEGAL_UPDATED}</p>` },

  refund: { title:'취소·환불 안내', body:`
    <p class="lg-lede">취소 및 환불은 「전자상거래 등에서의 소비자보호에 관한 법률」을 기준으로 합니다.</p>
    <h4>1. 예약(시공) 취소</h4>
    <ul>
      <li>방문 예정일 <b>2일 전까지</b>: 전액 환불</li>
      <li>방문 예정일 <b>1일 전</b>: 결제금액의 90% 환불</li>
      <li>방문 <b>당일 취소·부재</b>: 출장 준비 비용을 제외하고 환불(최대 80%)</li>
    </ul>
    <h4>2. 제품 청약철회 (단순 변심)</h4>
    <p>제품 수령일 또는 시공 완료일로부터 <b>7일 이내</b> 청약철회가 가능합니다. 다만 다음의 경우에는 청약철회가 제한될 수 있습니다.</p>
    <ul>
      <li>이용자의 사용·시공으로 제품의 가치가 현저히 감소한 경우</li>
      <li>이용자의 주문에 따라 개별 제작·주문된 제품인 경우</li>
      <li>설치 후 분리가 어렵거나 재판매가 곤란한 경우</li>
    </ul>
    <h4>3. 제품 하자에 의한 환불·교환</h4>
    <p>제품 불량 또는 시공 하자가 확인되면 수령·시공 후 <b>3개월 이내</b> 무상 교환 또는 환불이 가능하며, 반환에 필요한 비용은 회사가 부담합니다.</p>
    <h4>4. 환불 처리 기간</h4>
    <p>환불 사유 확인 후 <b>3영업일 이내</b>에 결제수단으로 환불합니다. 카드 결제는 카드사 사정에 따라 영업일이 추가될 수 있습니다.</p>
    <h4>5. 환불 신청 방법</h4>
    <p>주문 현황 화면의 'A/S 접수' 또는 카카오톡 상담, munion@mymunion.com으로 접수해 주세요.</p>
    <p class="lg-note">본 기준은 회사 정책이며, 사안에 따라 「소비자분쟁해결기준」이 우선 적용될 수 있습니다. 시행일: ${LEGAL_UPDATED}</p>` },

  as: { title:'A/S 기준', body:`
    <p class="lg-lede">사후관리(A/S)는 공정거래위원회 「소비자분쟁해결기준」을 참고하여 운영합니다.</p>
    <h4>1. 무상 A/S 기간</h4>
    <ul>
      <li>시공(설치) 하자: 시공 완료일로부터 <b>1년</b></li>
      <li>제품 자체 하자: 제조사 보증기간 (통상 1~2년)</li>
      <li>누수·연결부 등 설치 관련 하자: 시공 완료일로부터 <b>1년</b></li>
    </ul>
    <h4>2. 무상 A/S 대상</h4>
    <ul>
      <li>정상적인 사용 중 발생한 시공·연결 불량</li>
      <li>설치 직후 발견된 제품 불량</li>
    </ul>
    <h4>3. 유상 A/S 대상</h4>
    <ul>
      <li>이용자의 부주의·임의 분해·개조로 인한 고장</li>
      <li>천재지변, 외부 충격, 소모성 부품의 자연 마모</li>
      <li>무상 보증기간이 경과한 경우</li>
    </ul>
    <h4>4. 접수 및 처리</h4>
    <p>주문 현황의 'A/S 접수' 또는 카카오톡 상담으로 신청하시면, 사진·상담 기록을 바탕으로 영업일 기준 <b>1~2일 이내</b> 안내해 드립니다. 동일 하자가 반복되어 수리가 불가능한 경우 「소비자분쟁해결기준」에 따라 교환 또는 환불로 처리합니다.</p>
    <h4>5. 완료 리포트</h4>
    <p>모든 시공은 완료 리포트와 상담 기록으로 남아 A/S까지 이어집니다.</p>
    <p class="lg-note">본 기준은 회사 정책이며, 품목별 세부 기준은 상담 시 안내됩니다. 시행일: ${LEGAL_UPDATED}</p>` },
};
function legalModal(type){
  const d = LEGAL[type]; if(!d) return;
  webClose();
  const o=document.createElement('div'); o.id='wmodal';
  o.style.cssText='position:fixed;inset:0;background:rgba(16,24,40,.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;';
  o.innerHTML=`<div class="legal-card">
    <div class="legal-head">
      <div class="legal-title">${d.title}</div>
      <button class="pm-close" onclick="webClose()" aria-label="닫기"><i data-lucide="x"></i></button>
    </div>
    <div class="legal-body">${d.body}</div>
  </div>`;
  o.addEventListener('click',e=>{ if(e.target===o) webClose(); });
  document.body.appendChild(o); if(window.lucide) lucide.createIcons();
}
function openEstimate(){
  const rows = W.selected.map(id=>{ const p=wp(id); const q=wq(id); return `<tr><td>${catOf(id).replace(/\\s*교체$/,'')} · ${p.brand} ${productDisplayName(p)}</td><td class="c">${q}</td><td class="r">${won(p.price*q)}</td></tr>`; }).join('');
  const today = new Date().toLocaleDateString('ko-KR');
  const estimateTotal = wtot();
  const vatIncludedTotal = wvatTotal();
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><base href="${location.href}"><title>견적서 · Build us Care</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Pretendard',-apple-system,sans-serif;color:#1d1d1f;background:#f5f5f7;padding:40px 20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{max-width:680px;margin:0 auto;background:#fff;border-radius:20px;padding:48px;box-shadow:0 10px 40px -16px rgba(0,0,0,.16)}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d1d1f;padding-bottom:22px}
    .q-logo{height:30px;width:auto}
    .meta{text-align:right;font-size:12px;color:#86868b;line-height:1.7}
    h1{font-size:28px;font-weight:700;letter-spacing:-.02em;margin:28px 0 4px}
    .sub{font-size:14px;color:#86868b;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;font-size:15px}
    th{text-align:left;font-size:12px;font-weight:700;color:#86868b;padding:10px 0;border-bottom:1px solid #e5e5ea}
    th.r,td.r{text-align:right}
    th.c,td.c{text-align:center;width:64px;color:#6e6e73}
    td{padding:13px 0;border-bottom:1px solid #f0f0f2;font-weight:500}
    .grp td{color:#6e6e73;font-weight:400}
    .sum td{padding-top:16px;border-top:2px solid #1d1d1f;border-bottom:none;font-weight:800;color:#1d1d1f}
    .tot{display:flex;justify-content:space-between;align-items:baseline;margin-top:22px;padding-top:18px;border-top:2px solid #1d1d1f}
    .tot .k{font-size:17px;font-weight:700}
    .tot .k small{display:block;margin-top:3px;font-size:12px;color:#86868b;font-weight:600}
    .tot .v{font-size:30px;font-weight:800;color:#245FFF;letter-spacing:-.02em}
    .tot .v small{font-size:15px;color:#86868b;font-weight:600}
    .note{margin-top:24px;background:#eef3ff;border-radius:14px;padding:16px 18px;font-size:13px;line-height:1.6;color:#46443d}
    .self-disp{margin-top:14px;background:#f5f5f7;border-radius:12px;padding:13px 16px;font-size:13px;line-height:1.6;color:#1d1d1f}
    .self-disp b{color:#245FFF}
    .foot{margin-top:30px;font-size:11px;color:#a0a0a5;line-height:1.7;border-top:1px solid #e5e5ea;padding-top:18px}
    .actions{max-width:680px;margin:20px auto 0;display:flex;gap:10px;justify-content:center}
    .btn{border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;padding:12px 24px;border-radius:980px}
    .btn.p{background:#245FFF;color:#fff}.btn.s{background:#fff;color:#1d1d1f;border:1px solid #d2d2d7}
    @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}.actions{display:none}}
  </style></head><body>
  <div class="sheet">
    <div class="top">
      <img class="q-logo" src="${BC_LOGO_URI || 'assets/bc-logo.png'}" alt="build us care">
      <div class="meta">견적일 ${today}<br>견적번호 BC-EST-${Date.now().toString().slice(-6)}<br>유효기간 발행일로부터 14일</div>
    </div>
    <h1>견적서</h1>
    <div class="sub">${W.item.replace(/\s*교체$/,'')} · 선택 제품 ${W.selected.length}종 · 총 ${wunits()}개 · ${W.region}</div>
    <table>
      <thead><tr><th>항목</th><th class="c">수량</th><th class="r">금액 (원)</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="grp"><td>시공비</td><td class="c">×${wunits()}</td><td class="r">${won(wlabor())}</td></tr>
        <tr class="grp"><td>폐기물 처리비${W.selfDisposal?' <span style="color:#86868b">(직접 처리)</span>':''}</td><td class="c">×${wunits()}</td><td class="r">${won(wdisp())}</td></tr>
        <tr class="sum"><td>합계</td><td class="c"></td><td class="r">${won(estimateTotal)}</td></tr>
      </tbody>
    </table>
    <div class="tot"><span class="k">최종 합계<small>부가세 10% 포함</small></span><span class="v">${won(vatIncludedTotal)}<small> 원</small></span></div>
    ${W.selfDisposal?'<div class="self-disp"><b>폐기물 직접 처리</b>로 선택하셨습니다. 폐기물 처리비는 청구되지 않습니다.</div>':''}
    <div class="foot">주식회사 무니온 · 대표 김영태 · 경기도 용인시 포은대로59번길 37, 시그니처광교<br>사업자등록번호 601-81-39840 · 통신판매업신고 2025-용인수지-3087 · munion@mymunion.com</div>
  </div>
  <div class="actions">
    <button class="btn s" onclick="window.print()">인쇄 / PDF 저장</button>
    <button class="btn p" onclick="window.close()">닫기</button>
  </div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=760,height=900');
  if(w){ w.document.write(html); w.document.close(); }
}
async function openFinalEstimate(){
  const ono = wOrderNo();
  const today = new Date().toLocaleDateString('ko-KR');
  const addr = (W.region||'') + (W.regionDetail ? ' ' + W.regionDetail : '');
  const dateTxt = W.date ? `${bookingDateLabel(W.date, true)}${W.time?' · '+W.time:''}` : '사진 확인 후 협의';
  const cashReceiptText = wCashReceiptText();
  // Inline logo + each selected product's image as data URIs (popup can't load relative paths)
  const logo = BC_LOGO_URI || await imgToDataUri('assets/bc-logo.png');
  const uris = {};
  await Promise.all([...new Set(W.selected.map(id=>catOf(id)))].map(async cat=>{ uris[cat] = ITEM_IMG[cat] ? await imgToDataUri(ITEM_IMG[cat]) : ''; }));
  const rows = W.selected.map(id=>{ const p=wp(id); const q=wq(id); const cat=catOf(id); const im=uris[cat];
    return `<tr>
      <td class="it">
        <span class="thumb">${im?`<img src="${im}" alt="">`:''}</span>
        <span class="it-tx"><b>${p.brand} ${productDisplayName(p)}</b><small>${cat.replace(/\s*교체$/,'')}</small></span>
      </td>
      <td class="c">${q}</td><td class="r">${won(p.price*q)}</td></tr>`; }).join('');
  const estimateTotal = wtot();
  const vatIncludedTotal = wvatTotal();
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>최종 견적서 · Build us Care</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Pretendard',-apple-system,sans-serif;color:#1d1d1f;background:#f5f5f7;padding:40px 20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{max-width:700px;margin:0 auto;background:#fff;border-radius:20px;padding:48px;box-shadow:0 10px 40px -16px rgba(0,0,0,.16)}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d1d1f;padding-bottom:22px}
    .q-logo{height:30px;width:auto}
    .meta{text-align:right;font-size:12px;color:#86868b;line-height:1.7}
    .meta b{color:#1d1d1f}
    h1{font-size:28px;font-weight:700;letter-spacing:-.02em;margin:28px 0 4px}
    .sub{font-size:14px;color:#86868b;margin-bottom:24px}
    .info{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e5e5ea;border:1px solid #e5e5ea;border-radius:14px;overflow:hidden;margin-bottom:28px}
    .info .cell{background:#fff;padding:14px 18px}
    .info .cell.full{grid-column:1 / -1}
    .info .k{font-size:11px;font-weight:700;color:#86868b;letter-spacing:.02em}
    .info .v{font-size:15px;font-weight:600;margin-top:3px;letter-spacing:-.01em}
    table{width:100%;border-collapse:collapse;font-size:15px}
    th{text-align:left;font-size:12px;font-weight:700;color:#86868b;padding:10px 0;border-bottom:1px solid #e5e5ea}
    th.r,td.r{text-align:right}
    th.c,td.c{text-align:center;width:60px;color:#6e6e73}
    td{padding:12px 0;border-bottom:1px solid #f0f0f2;font-weight:500;vertical-align:middle}
    td.it{display:flex;align-items:center;gap:14px}
    .thumb{width:54px;height:54px;border-radius:12px;background:#f2f2f4;display:grid;place-items:center;overflow:hidden;flex:none}
    .thumb img{width:100%;height:100%;object-fit:cover}
    .it-tx{display:flex;flex-direction:column;gap:2px}
    .it-tx b{font-weight:600;letter-spacing:-.01em}
    .it-tx small{font-size:12px;color:#86868b;font-weight:500}
    .grp td{color:#6e6e73;font-weight:400}
    .sum td{padding-top:16px;border-top:2px solid #1d1d1f;border-bottom:none;font-weight:800;color:#1d1d1f}
    .tot{display:flex;justify-content:space-between;align-items:baseline;margin-top:22px;padding-top:18px;border-top:2px solid #1d1d1f}
    .tot .k{font-size:17px;font-weight:700}
    .tot .k small{display:block;margin-top:3px;font-size:12px;color:#86868b;font-weight:600}
    .tot .v{font-size:30px;font-weight:800;color:#245FFF;letter-spacing:-.02em}
    .tot .v small{font-size:15px;color:#86868b;font-weight:600}
    .note{margin-top:24px;background:#eef3ff;border-radius:14px;padding:16px 18px;font-size:13px;line-height:1.6;color:#46443d}
    .self-disp{margin-top:14px;background:#f5f5f7;border-radius:12px;padding:13px 16px;font-size:13px;line-height:1.6;color:#1d1d1f}
    .self-disp b{color:#245FFF}
    .foot{margin-top:30px;font-size:11px;color:#a0a0a5;line-height:1.7;border-top:1px solid #e5e5ea;padding-top:18px}
    .actions{max-width:700px;margin:20px auto 0;display:flex;gap:10px;justify-content:center}
    .btn{border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;padding:12px 24px;border-radius:980px}
    .btn.p{background:#245FFF;color:#fff}.btn.s{background:#fff;color:#1d1d1f;border:1px solid #d2d2d7}
    @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}.actions{display:none}}
  </style></head><body>
  <div class="sheet">
    <div class="top">
      <img class="q-logo" src="${logo}" alt="build us care">
      <div class="meta">발행일 ${today}<br>접수번호 <b>${ono}</b><br>유효기간 발행일로부터 14일</div>
    </div>
    <h1>최종 견적서</h1>
    <div class="sub">${selectedCats().join(' · ')||W.item.replace(/\s*교체$/,'')} · 선택 제품 ${W.selected.length}종 · 총 ${wunits()}개</div>
    <div class="info">
      <div class="cell"><div class="k">예약자</div><div class="v">${W.name||'-'}</div></div>
      <div class="cell"><div class="k">연락처</div><div class="v">${W.phone||'-'}</div></div>
      <div class="cell full"><div class="k">시공 주소</div><div class="v">${addr||'-'}</div></div>
      <div class="cell full"><div class="k">예약 일시</div><div class="v">${dateTxt}</div></div>
      <div class="cell full"><div class="k">현금영수증</div><div class="v">${cashReceiptText}</div></div>
    </div>
    <table>
      <thead><tr><th>제품</th><th class="c">수량</th><th class="r">금액 (원)</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="grp"><td>시공비</td><td class="c">×${wunits()}</td><td class="r">${won(wlabor())}</td></tr>
        <tr class="grp"><td>폐기물 처리비${W.selfDisposal?' <span style="color:#86868b">(직접 처리)</span>':''}</td><td class="c">×${wunits()}</td><td class="r">${won(wdisp())}</td></tr>
        <tr class="sum"><td>합계</td><td class="c"></td><td class="r">${won(estimateTotal)}</td></tr>
      </tbody>
    </table>
    <div class="tot"><span class="k">최종 합계<small>부가세 10% 포함</small></span><span class="v">${won(vatIncludedTotal)}<small> 원</small></span></div>
    ${W.selfDisposal?'<div class="self-disp"><b>폐기물 직접 처리</b>로 선택하셨습니다. 폐기물 처리비는 청구되지 않습니다.</div>':''}
    <div class="foot">주식회사 무니온 · 대표 김영태 · 경기도 용인시 포은대로59번길 37, 시그니처광교<br>사업자등록번호 601-81-39840 · 통신판매업신고 2025-용인수지-3087 · munion@mymunion.com</div>
  </div>
  <div class="actions">
    <button class="btn s" onclick="window.print()">인쇄 / PDF 저장</button>
    <button class="btn p" onclick="window.close()">닫기</button>
  </div>
  </body></html>`;
  const w = window.open('', '_blank', 'width=780,height=920');
  if(w){ w.document.write(html); w.document.close(); }
}
function webOpenKakaoLink(){
  const opened = window.open(W_KAKAO_CHANNEL_URL, '_blank');
  if(!opened){
    try{ window.top.location.href = W_KAKAO_CHANNEL_URL; }catch(_){ window.location.href = W_KAKAO_CHANNEL_URL; }
  }
}
function webKakao(ctx){
  const msg = ctx==='product'
    ? '원하는 제품이 따로 있으신가요? 카카오톡으로 제품 링크를 보내주시면 설치 가능 여부를 확인해 드려요.'
    : ctx==='rebook'
    ? '예약변경은 카카오톡 상담으로 도와드립니다.'
    : '사진이 어려우시면 카카오톡으로 도와드려요. 어떤 부분이 헷갈리는지 편하게 보내주세요.';
  webModal(`<div class="row gap10"><span style="width:42px;height:42px;border-radius:13px;background:#FEE500;color:#191600;display:grid;place-items:center;flex:none">${WKK}</span><div><div class="h-sm">카카오톡 상담 · 보조</div><div class="p-sm">메인 접수는 사이트에서 그대로 진행돼요</div></div></div>
  <p class="p-md mt12">${msg}</p>
  <button class="web-btn kkbtn block lg" style="margin-top:16px" onclick="webOpenKakaoLink();webClose()">${WKK} 카카오톡 열기</button>
  <button class="web-btn ghost block" style="margin-top:8px" onclick="webClose()">사이트에서 계속하기</button>`);
}

const wpcard = (p, rec) => {
  const sel = wProductSelected(p.id);
  const recTag = rec ? `<span class="tag-rec">${p.recommendLabel||'대표'}</span>` : '';
  const label = catOf(p.id)==='샷시손잡이' ? sashSizeLabel(p.id) : '';
  const sizeLabel = label ? `<div class="psizes">${label}</div>` : '';
  return `<div class="pcard${sel?' sel':''}" data-pid="${p.id}">
    <div class="pimg imgph${p.image?' has-img':''}" style="cursor:pointer" onclick="webProductModal('${p.id}')">${productImg(p)}${recTag}</div>
    <div class="psel" onclick="wToggle(event,'${p.id}')"><i data-lucide="check"></i></div>
    <div class="pinfo" style="cursor:pointer" onclick="webProductModal('${p.id}')"><div class="pbrand">${p.brand}</div><div class="pname">${productDisplayName(p)}</div><div class="pprice">${won(p.price)}<small> 원</small></div>${sizeLabel}</div>
  </div>`;
};
function wBuyProduct(ev, id){
  if(ev?.stopPropagation) ev.stopPropagation();
  if(catOf(id)==='샷시손잡이'){
    const variantId = document.getElementById('wmodal')?.dataset.sashVariant || wSashInitialVariantId(id);
    wSelectSashVariant(id, variantId);
    return;
  }
  if(wColorVariantOptions(id).length){
    const variantId = document.getElementById('wmodal')?.dataset.colorVariant || wColorInitialVariantId(id);
    wSelectColorVariant(id, variantId);
    return;
  }
  wToggleProductId(id);
  webClose();
}
function webProductModal(id){
  const p = wp(id), selectedVariantId = wDetailInitialVariantId(id), display = wp(selectedVariantId) || p;
  const hasColorVariants = wColorVariantOptions(id).length > 0;
  const isVariantChoice = catOf(id)==='샷시손잡이' || hasColorVariants;
  const sel = isVariantChoice ? W.selected.includes(selectedVariantId) : wProductSelected(id);
  const spec = (ic,t)=>`<div class="pm-spec"><span class="pm-ic"><i data-lucide="${ic}"></i></span><p>${t}</p></div>`;
  const sku = display.sku || display.model || '제품 정보 확인';
  const html = `<div class="pm-card">
    <button class="pm-close" onclick="webClose()" aria-label="닫기"><i data-lucide="x"></i></button>
    <div class="pm-body">
      <div class="pm-gallery">
        <div class="pm-hero imgph${display.image?' has-img':''}">${productImg(display)}</div>
      </div>
      <div class="pm-detail-info">
        <div class="pm-brand">${p.brand}</div>
        <h2 class="pm-title">${productDisplayName(p)}</h2>
        <div class="pm-row"><div class="pm-price" data-sash-price>${won(display.price)}<small>원부터</small></div>
          <button class="pm-buy${sel?' added':''}" ${catOf(id)==='샷시손잡이'?'data-sash-buy':''} ${hasColorVariants?'data-color-buy':''} onclick="wBuyProduct(event,'${id}')">${sel?'담김 ✓':'담기'}</button></div>
        ${wSashDetailSizeHtml(id, selectedVariantId)}
        ${wColorDetailHtml(id, selectedVariantId)}
        <div class="pm-specs">
          ${spec('ruler',`<span data-sash-note>${productPrimarySpec(display)}</span>`)}
          ${spec('package',`<span data-sash-sku>품번 · ${sku}</span>`)}
          ${spec('palette',`<span data-sash-color>색상 · ${display.color || '기본'}</span>`)}
          ${spec('info',`<span data-sash-feature>${productFeatureSpec(display)}</span>`)}
        </div>
      </div>
    </div>
  </div>`;
  webClose();
  const o=document.createElement('div'); o.id='wmodal'; o.className='pm-scrim';
  o.innerHTML=html;
  o.addEventListener('click',e=>{ if(e.target===o) webClose(); });
  document.body.appendChild(o);
  if(catOf(id)==='샷시손잡이') wSetSashDetailChoice(id, selectedVariantId);
  if(hasColorVariants) wSetColorDetailChoice(id, selectedVariantId);
  if(window.lucide) lucide.createIcons();
}
const steps = (i) => `<div class="stepline">${['제품 선택','사진 확인','예약','접수'].map((s,k)=>`<span class="${k===i?'on':''}">${s}</span>${k<3?'<i data-lucide=\"chevron-right\"></i>':''}`).join('')}</div>`;

const WS = {

services: () => {
  const benefits = [
    ['사진 판정','방문견적 없이 사진 3장.','전체·문제부위·규격만 보내면 매니저가 직접 확인해 가능 여부를 알려드려요.','camera'],
    ['정찰가','제품값과 시공비를 나눠서.','뭉뚱그리지 않고 항목별로 투명하게. 추가 비용과 출장비는 없어요.','receipt-text'],
    ['정직한 진단','교체 안 해도 됩니다.','청소·조임으로 해결되면 그렇게 안내해요. 무조건 바꾸라 하지 않아요.','shield-check'],
    ['한 번의 방문','여러 품목 함께 교체.','수전·양변기·세면대를 한 번에 담아 한 번의 방문으로 끝내요.','layers'],
    ['사후 케어','시공 후 보증과 A/S.','완료 리포트와 보증으로 사후까지 책임지고 케어해요.','life-buoy'],
  ];
  const knows = [
    ['생활 리프레시','낡아 보이는 작은 이유부터.','dark'],
    ['호환 확인','우리집에 맞는지 먼저.','dark'],
    ['가격 투명','제품값·시공비 분리.','dark'],
    ['한 번의 방문','여러 품목 함께.','dark'],
  ];
  return `
<div class="wrap svc-page" style="max-width:1320px">
  <div class="sec-head" style="max-width:760px">
    <div class="eyebrow" style="color:var(--brand-700);font-size:13px;font-weight:600">Build us Care 서비스</div>
    <h1 class="web-h2" style="margin:10px 0 0">집 전체가 아니라,<br>바꿀 수 있는 것부터.</h1>
    <p class="web-lede" style="margin-top:14px">오래된 수전·변기·환풍기·손잡이. 방문견적 없이 사진 3장으로 우리 집에 맞는 제품인지 먼저 확인하고, 필요한 교체만 예약하는 생활 리프레시 케어 서비스입니다.</p>
  </div>

  <div class="svc-sec">
    <div class="between svc-head"><div class="web-h2" style="font-size:34px">Build us Care에서<br>하면 좋은 이유.</div><a class="web-btn-link" onclick="webnav('items')">서비스 둘러보기 ›</a></div>
    <div class="svc-grid5">
      ${benefits.map(b=>`<div class="svc-card light"><div class="svc-eye">${b[0]}</div><div class="svc-title">${b[1]}</div><div class="svc-desc">${b[2]}</div><div class="svc-art"><i data-lucide="${b[3]}"></i></div></div>`).join('')}
    </div>
  </div>

  <div class="svc-sec">
    <div class="web-h2" style="font-size:34px;margin-bottom:24px">알면 알수록, 케어.</div>
    <div class="svc-grid4">
      ${knows.map(k=>`<div class="svc-card tall ${k[2]}"><div class="svc-eye">${k[0]}</div><div class="svc-title" style="font-size:20px;white-space:nowrap;letter-spacing:-.035em">${k[1]}</div><div class="svc-photo imgph"></div></div>`).join('')}
    </div>
  </div>

  <div class="svc-sec">
    <div class="web-h2" style="font-size:34px;margin-bottom:24px">필요한 것만, 합리적으로.</div>
    <div class="svc-two">
      <div class="svc-card2"><div class="svc2-txt"><div class="svc-title" style="font-size:26px">낡아 보이는 작은 이유,<br>사진으로 먼저.</div><a class="web-btn-link" style="margin-top:14px;display:inline-block" onclick="webnav('upload')">사진으로 확인하기 ›</a></div><div class="svc2-img imgph"></div></div>
      <div class="svc-card2"><div class="svc2-txt"><div class="svc-title" style="font-size:26px">여러 품목도<br>한 번의 방문으로.</div><a class="web-btn-link" style="margin-top:14px;display:inline-block" onclick="webnav('items')">바꿀 수 있는 제품 보기 ›</a></div><div class="svc2-img imgph"></div></div>
    </div>
  </div>

  <div class="cta-row" style="margin-top:48px;justify-content:center">
    <button class="web-btn pri lg" onclick="webnav('upload')"><i data-lucide="camera" style="width:18px;height:18px"></i> 사진으로 먼저 확인하기</button>
    <button class="web-btn sec lg" onclick="webnav('items')">바꿀 수 있는 제품 보기</button>
  </div>
</div>`;
},

home: () => `
<div class="wrap home-wrap">
  <div class="hero-light">
    <div class="hero-logo"><img src="assets/bc-logo-hero.png" alt="build us care"></div>
    <p class="hero-sub">오래된 수전·변기·환풍기, 바꿀 수 있는 것부터.</p>
    <div class="hero-cta">
      <button class="web-btn pri" onclick="webnav('upload')">사진으로 확인하기</button>
      <button class="web-btn outline" onclick="webnav('items')">바꿀 수 있는 제품 보기</button>
    </div>
    <div class="hero-kakao"><button class="web-btn kkbtn" onclick="webKakao('guide')">${WKK} 카카오로 문의하기</button></div>
  </div>
  <div class="why-sec">
    <div class="why-head">
      <div class="web-h2" style="font-size:34px">Build us Care에서<br>하면 쉬운 이유.</div>
      <a class="why-link" onclick="webnav('items')">바꿀 수 있는 제품 보기 ›</a>
    </div>
    <div class="why-grid">
      <div class="bcwhy">
        <div class="bcwhy-eye">작은 교체부터</div>
        <div class="bcwhy-t">집 전체보다,<br>낡은 것부터.</div>
        <p class="bcwhy-d">수전·변기·환풍기처럼<br>눈에 먼저 보이는 제품부터 정리합니다.</p>
        <div class="bcwhy-media"><img src="assets/whycard-faucet.png" alt="수전·도어핸들·환풍기"></div>
      </div>
      <div class="bcwhy">
        <div class="bcwhy-eye">정직한 비용</div>
        <div class="bcwhy-t">추가비 견적비<br>0원.</div>
        <p class="bcwhy-d">예상 밖 작업은 먼저 설명합니다.<br>고객 동의 없이 진행하지 않습니다.</p>
        <div class="bcwhy-media"><img src="assets/whycard-receipt.png" alt="추가비·견적 방문비·출장비 0원 영수증"></div>
      </div>
      <div class="bcwhy">
        <div class="bcwhy-eye">표준가</div>
        <div class="bcwhy-t">제품값도 설치비도,<br>표준가로.</div>
        <p class="bcwhy-d">제품 가격과 설치비를 나눠 보여드립니다.<br>비교하기 쉽게, 결정하기 쉽게.</p>
        <div class="bcwhy-media"><img src="assets/whycard-bag-orig.png" alt="제품값·설치비 표준가"></div>
      </div>
      <div class="bcwhy">
        <div class="bcwhy-eye">방문견적 없음</div>
        <div class="bcwhy-t">견적 때문에<br>시간 비우지 마세요.</div>
        <p class="bcwhy-d">방문견적은 없습니다.<br>방문은 교체가 필요할 때만 진행합니다.</p>
        <div class="bcwhy-media"><img src="assets/whycard-schedule.png" alt="시간 예약 표"></div>
      </div>
    </div>
  </div>
  <div class="lineup-band">
  <div class="between" style="margin-top:0"><div><div class="eyebrow">사진으로 먼저 확인</div><div class="web-h2" style="margin-top:6px;font-size:34px">바꿀 수 있는 9가지.</div></div></div>
  <div class="lineup" style="margin-top:22px">
    ${W_ITEMS.map(it=>`<div class="lc"><div class="lc-media">${LINEUP_IMG[it[0]]?`<img src="${LINEUP_IMG[it[0]]}" alt="${it[0]}">`:`<div class="lc-icon"><i data-lucide="${it[1]}"></i></div>`}</div><div class="lc-tag">${it[3]||''}</div><div class="lc-name">${it[0].replace(/\s*교체$/,'')} <span class="enlabel">${ITEM_EN[it[0]]||''}</span></div><div class="lc-desc">${it[2]}</div><div class="lc-cta"><button class="web-btn pri" onclick="wSelectItem('${it[0]}')">둘러보기</button><a class="lc-link" onclick="W.item='${it[0]}';webnav('upload')">사진 확인 ›</a></div></div>`).join('')}
  </div>
  </div>
</div>`,

items: () => `
<div class="wrap">
  ${steps(0)}
  <h1 class="web-h2" style="margin:14px 0 0">무엇을 바꿀까요?</h1>
  <p class="web-lede" style="margin-top:10px;font-size:17px;color:#86868b">여러 가지를 한 번에 교체하세요!<br>여러 품목을 함께 교체해도 <b style="color:#1d1d1f">출장비와 견적비는 0원</b>입니다.</p>
  <div class="lineup-grid">
    ${W_ITEMS.map(it=>{const nm=it[0].replace(/\s*교체$/,'');const en=ITEM_EN[it[0]]||'';const from=categoryMinPrice(it[0]);return `<div class="lcard${it[0]===W.item?' sel':''}">
      <div class="lcard-head"><div class="lcard-t">${nm}</div><div class="lcard-en">${en}</div></div>
      <div class="lcard-media">${ITEM_IMG[it[0]]?`<img class="lcard-img" src="${ITEM_IMG[it[0]]}" alt="${nm}">`:`<span class="lcard-ic"><i data-lucide="${it[1]}"></i></span>`}</div>
      <div class="lcard-foot">
        <div class="lcard-price">${from?('₩'+from.toLocaleString('ko-KR')+'부터'):'사진 확인부터'}</div>
        <button class="lcard-btn" onclick="wSelectItem('${it[0]}')">둘러보기</button>
      </div>
    </div>`;}).join('')}
  </div>
</div>`,

products: () => {
  return `
<div class="wrap">
  ${steps(0)}
  <h1 id="wpTitle" class="web-h2" style="margin:14px 0 18px">${W.item.replace(/\s*교체$/,'')} <span class="enlabel">${ITEM_EN[W.item]||''}</span></h1>
  <div class="cat-nav">
    ${W_ITEMS.map(it=>`<button class="cat-item${it[0]===W.item?' on':''}" onclick="wSelectItem('${it[0]}')">
      <span class="cat-thumb"><img src="${CAT_ICON[it[0]]||ITEM_IMG[it[0]]}" alt="${it[0]}" decoding="async" fetchpriority="high" width="64" height="64"></span>
      <span class="cat-lbl">${it[0].replace(/\s*교체$/,'')}</span>
    </button>`).join('')}
  </div>
  <p class="cat-desc-out">바꿀 품목을 자유롭게 넘나들며 담아보세요. 여러 품목을 함께 담으면 <b>한 번의 방문</b>으로 교체하고, 견적도 한 장으로 받아볼 수 있어요.</p>
  <div class="split products-split" style="margin-top:32px">
    <div id="wpList">${wProductsListBody()}</div>
    <div class="sticky-side">
      <div class="bcard pad" id="wEstimate" style="padding:22px">${wEstimateBody()}</div>
    </div>
  </div>
</div>`;
},

/* ── 사진확인 / 호환제품 문의 페이지 ──────────────────────────────
   진입: 상단 "사진확인" 메뉴 · 홈 "사진으로 확인하기" (제품 미선택)
   ▶ 이 페이지만 수정할 것. 예약 흐름(prebook)과 완전히 분리되어 있음.  */
upload: () => {
  wEnsurePhotoState();
  const labels=['전체','문제부위','규격·연결부'];
  const ok = wInquiryOk();
  const setSlots=(g)=>[0,1,2].map(i=>wPhotoSlot((W.photoSetFiles[g]||[])[i], labels[i], `wRemoveSetPhoto(${g},${i})`, `wAddSetPhoto(${g})`, i===(W.photoSets[g]||0))).join('');
  const need=`<span style="font-size:11px;font-weight:700;color:#245FFF;background:#eaf2ff;padding:2px 8px;border-radius:999px;margin-left:6px;vertical-align:1px">필수</span>`;
  const opt=`<span style="font-size:11px;font-weight:600;color:var(--gray-500);background:rgba(120,120,128,.12);padding:2px 8px;border-radius:999px;margin-left:6px;vertical-align:1px">선택</span>`;
  const group=(g,required)=>`
    <div${g>0?' style="margin-top:20px;padding-top:20px;border-top:1px solid var(--gray-100)"':''}>
      <input id="wSetPhotoInput${g}" type="file" accept="image/*" multiple hidden onchange="wHandleSetPhotoFiles(${g}, this.files)">
      <div class="between" style="margin-bottom:10px"><div class="p-sm strong" style="color:var(--gray-700)">교체할 곳 ${g+1}${required?need:opt}</div><div class="p-sm" style="color:var(--gray-500)">${W.photoSets[g]||0} / 3장</div></div>
      <div class="slots">${setSlots(g)}</div>
    </div>`;
  return `
<div class="wrap narrow">
  ${steps(1)}
  <h1 class="web-h2" style="margin:14px 0 6px">사진 3장으로 먼저 확인해 드립니다.</h1>
  <p class="web-lede" style="font-size:16px">전체 · 문제부위 · 규격/연결부를 올려주세요. 매니저가 직접 확인합니다.</p>
  <div class="bcard pad" style="padding:24px;margin-top:24px">
    ${group(0,true)}
    ${group(1,false)}
    ${group(2,false)}
    <div class="note info" style="margin-top:16px"><i data-lucide="info"></i><div>교체할 곳이 여러 곳이면 <b>곳마다</b> 사진을 올려주세요. <b>교체할 곳 1</b>의 사진 3장은 필수, 2·3은 선택이에요.</div></div>
    <div class="note" style="margin-top:10px;background:#FEF8D6;color:#46443d;display:flex;gap:9px;padding:13px 15px;border-radius:14px;font-size:13px;line-height:1.6"><i data-lucide="message-circle" style="width:18px;height:18px;flex:none;color:#9a8a00"></i><div>교체할 곳이 <b>3곳보다 많다면</b> 카카오톡 <b>실시간 상담</b>으로 도와드려요. 사진을 보내주시면 빠르게 확인해 드립니다.</div></div>
    <button class="web-btn kkbtn" style="margin-top:10px" onclick="webKakao('guide')">${WKK} 카카오톡 실시간 상담</button>
  </div>
  <div class="bcard pad" style="padding:24px;margin-top:18px">
    <div class="h-md">문의 내용을 적어주세요</div>
    <p class="p-sm" style="color:var(--gray-500);margin-top:6px">교체하고 싶은 제품이나 증상을 자유롭게 적어주세요. 사진과 함께 매니저가 확인합니다.</p>
    <textarea class="input" style="width:100%;margin-top:14px;min-height:128px;resize:vertical;line-height:1.6;padding:14px 16px" placeholder="예: 세면수전과 샤워 욕조수전을 교체하고 싶어요.
집 전체 조명을 교체하고 싶어요.
수전에서 물이 새요." oninput="W.memo=this.value">${W.memo||''}</textarea>
  </div>
  <div class="bcard pad" style="padding:24px;margin-top:18px">
    <div class="h-md">연락 받을 정보</div>
    <div class="field" style="margin-top:14px">
      <label>시공 받을 지역</label>
      <button type="button" class="input addr-trigger${W.region?'':' empty'}" onclick="openAddrSearch()">
        <span class="addr-trigger-txt">${W.region||'주소 검색'}</span>
        <i data-lucide="search"></i>
      </button>
      ${W.postalCode?`<div class="addr-postal">우편번호 ${W.postalCode}</div>`:''}
      ${W.region?`<input class="input addr-detail" placeholder="상세 주소 (동·호수)" value="${W.regionDetail}" oninput="W.regionDetail=this.value;wUpdateNext()">`:''}
    </div>
    <div class="row gap16" style="margin-top:14px;align-items:flex-start">
      <div class="field grow"><label>성함</label><input class="input" placeholder="홍길동" value="${W.name}" oninput="wName(this.value)"></div>
      <div class="field grow"><label>연락 받을 번호</label><input class="input" inputmode="numeric" placeholder="010-0000-0000" value="${W.phone}" oninput="wPhone(this.value)"></div>
    </div>
    <div class="note info" style="margin-top:14px"><i data-lucide="info"></i><div>이 번호로 사진 확인 결과와 예상 견적을 안내드려요.</div></div>
    <div class="note region" style="margin-top:10px"><i data-lucide="map-pin"></i><div><b>예약 가능 지역</b> · 수원 · 성남(분당구) · 용인 · 의왕 · 군포 · 화성(동탄)<span class="region-soon">추후 확장 예정</span></div></div>
    <label class="disp-opt region-check"><input type="checkbox" ${W.regionOk?'checked':''} onchange="wRegionToggle(this.checked)"><span class="disp-box"></span><span class="disp-txt">우리 집이 예약 가능 지역이 맞나요? <span class="disp-sub">위 지역에 해당해야 예약을 진행할 수 있어요. 맞으면 체크해 주세요.</span></span></label>
    <label class="disp-opt region-check" style="margin-top:12px"><input type="checkbox" ${W.privacyOkInq?'checked':''} onchange="wPrivacyInqToggle(this.checked)"><span class="disp-box"></span><span class="disp-txt">개인정보 수집·이용에 동의합니다 <a onclick="event.stopPropagation();event.preventDefault();legalModal('privacy')" style="color:#245FFF;font-weight:600;cursor:pointer">(보기)</a> <span class="disp-sub">사진 확인·연락 목적으로 이름·연락처·주소·사진을 수집하며, 목적 달성 후 파기합니다. (필수)</span></span></label>
  </div>
  ${W.submitErr?`<div class="note" style="margin-top:14px;background:#FDECEC;color:#B42318;display:flex;gap:9px;padding:13px 15px;border-radius:14px;font-size:13px"><i data-lucide="alert-circle" style="width:18px;height:18px;flex:none"></i><div>${esc(W.submitErr)}</div></div>`:''}
  <button id="upNext" class="web-btn pri lg block" style="margin-top:20px" aria-disabled="${W.submitting?'true':ok?'false':'true'}" onclick="wSubmitInquiry()">${W.submitting?'접수 저장 중...':'사진으로 호환제품 문의접수 하기'}</button>
</div>`;
},

/* ── 예약정보 페이지 ──────────────────────────────────────────────
   진입: 제품 선택 → 견적 카드 "바로 예약하기"
   사진은 선택사항 · 제품/규격 확인 + 개인정보 동의 필수 → 일정 선택.   */
prebook: () => {
  wEnsurePhotoState();
  const labels=['전체','문제부위','규격·연결부'];
  const ok = wPrebookOk();
  const slots=[0,1,2].map(i=>wPhotoSlot(W.photoFiles[i], labels[i], `wRemovePhoto(${i},'prebook')`, 'wAddPhoto()', i===W.photos)).join('');
  return `
<div class="wrap narrow">
  ${steps(1)}
  <h1 class="p-sm strong" style="margin:14px 0 6px;color:var(--gray-900)">예약정보를 적어주세요</h1>
  <p class="web-lede" style="font-size:16px">예약에 필요한 정보를 입력해 주세요. 사진은 선택사항이에요.</p>
  <div class="bcard pad" style="padding:24px;margin-top:24px">
    <input id="wBookingPhotoInput" type="file" accept="image/*" multiple hidden onchange="wHandlePhotoFiles(this.files, 'prebook')">
    <div class="between"><div class="p-sm strong" style="color:var(--gray-700)">${W.photos} / 3장 <span style="color:var(--gray-400);font-weight:500">· 선택</span></div><div class="dots">${[0,1,2].map(i=>`<i class="${i<W.photos?'on':''}"></i>`).join('')}</div></div>
    <div class="slots" style="margin-top:14px">${slots}</div>
    <div class="note info" style="margin-top:16px"><i data-lucide="info"></i><div>규격·연결부 사진이 있으면 <b>더욱 정확한 확인</b>이 가능해요.</div></div>
    <button class="web-btn kkbtn" style="margin-top:6px" onclick="webKakao('guide')">${WKK} 잘 모르겠어요 · 카카오톡</button>
  </div>
  <div class="bcard pad" style="padding:24px;margin-top:18px">
    <div class="h-md">연락 받을 정보</div>
    <div class="field" style="margin-top:14px">
      <label>시공 받을 지역</label>
      <button type="button" class="input addr-trigger${W.region?'':' empty'}" onclick="openAddrSearch()">
        <span class="addr-trigger-txt">${W.region||'주소 검색'}</span>
        <i data-lucide="search"></i>
      </button>
      ${W.postalCode?`<div class="addr-postal">우편번호 ${W.postalCode}</div>`:''}
      ${W.region?`<input class="input addr-detail" placeholder="상세 주소 (동·호수)" value="${W.regionDetail}" oninput="W.regionDetail=this.value;wUpdateNext()">`:''}
    </div>
    <div class="row gap16" style="margin-top:14px;align-items:flex-start">
      <div class="field grow"><label>성함</label><input class="input" placeholder="홍길동" value="${W.name}" oninput="wName(this.value)"></div>
      <div class="field grow"><label>연락 받을 번호</label><input class="input" inputmode="numeric" placeholder="010-0000-0000" value="${W.phone}" oninput="wPhone(this.value)"></div>
    </div>
    <div class="note info" style="margin-top:14px"><i data-lucide="info"></i><div>이 번호로 사진 확인 결과와 예상 견적을 안내드려요.</div></div>
    <div class="note region" style="margin-top:10px"><i data-lucide="map-pin"></i><div><b>예약 가능 지역</b> · 수원 · 성남(분당구) · 용인 · 의왕 · 군포 · 화성(동탄)<span class="region-soon">추후 확장 예정</span></div></div>
    <label class="disp-opt region-check"><input type="checkbox" ${W.regionOk?'checked':''} onchange="wRegionToggle(this.checked)"><span class="disp-box"></span><span class="disp-txt">우리 집이 예약 가능 지역이 맞나요? <span class="disp-sub">위 지역에 해당해야 예약을 진행할 수 있어요. 맞으면 체크해 주세요.</span></span></label>
    <label class="disp-opt region-check" style="margin-top:12px"><input type="checkbox" ${W.specCheck?'checked':''} onchange="wSpecToggle(this.checked)"><span class="disp-box"></span><span class="disp-txt">교체할 제품과 기존 설치되어 있는 제품·규격을 확인하셨나요? <span class="disp-sub">현장 규격과 다르면 설치가 어려울 수 있어요. 확인하셨다면 체크해 주세요.</span></span></label>
    <label class="disp-opt region-check" style="margin-top:12px"><input type="checkbox" ${W.privacyOk?'checked':''} onchange="wPrivacyToggle(this.checked)"><span class="disp-box"></span><span class="disp-txt">개인정보 수집·이용에 동의합니다 <a onclick="event.stopPropagation();event.preventDefault();legalModal('privacy')" style="color:#245FFF;font-weight:600;cursor:pointer">(보기)</a> <span class="disp-sub">예약·연락 목적으로 이름·연락처·주소를 수집하며, 목적 달성 후 파기합니다.</span></span></label>
  </div>
  <button id="upNext" class="web-btn pri lg block" style="margin-top:20px" aria-disabled="${ok?'false':'true'}" onclick="wTryUpload()">다음 · 예약 일정 선택</button>
</div>`;
},

booking: () => {
  const times=[['오전','오전 · 9시–12시'],['오후','오후 · 1시–4시']], ok=W.date&&W.time;
  const cal = bookingCalendarCells(W.date, 'wDate');
  const hd=['일','월','화','수','목','금','토'].map((x,i)=>`<div class="cal-hd${i===0?' sun':i===6?' sat':''}">${x}</div>`).join('');
  return `
<div class="wrap narrow">
  ${steps(2)}
  <h1 class="web-h2" style="margin:14px 0 6px">예약 일정 선택</h1>
  <p class="web-lede" style="font-size:16px">제품 준비기간으로 <b style="color:#1d1d1f">오늘 기준 3일 이후부터</b> 예약할 수 있어요. 일요일과 공휴일은 휴무이고, 토요일은 예약 가능합니다.</p>
  <div class="bcard pad" style="padding:24px;margin-top:22px">
    <div class="between" style="margin-bottom:12px"><div class="h-md">${cal.title}</div></div>
    <div class="calendar">${hd}${cal.cells}</div>
    <div class="cal-legend"><span><i class="lg-dot work"></i> 토요일 영업</span><span><i class="lg-dot off"></i> 일요일·공휴일 휴무</span></div>
  </div>
  <div class="bcard pad" style="padding:24px;margin-top:18px">
    <div class="h-md">시간대</div>
    <div class="chips" style="margin-top:12px">${times.map(t=>`<span class="chip${W.time===t[0]?' on':''}" onclick="wTime('${t[0]}')">${t[1]}</span>`).join('')}</div>
    <div class="note" style="margin-top:14px"><i data-lucide="info"></i><div>제품 교체 개수나 항목에 따라 시간이 더 걸릴 수 있습니다.</div></div>
  </div>
  <button class="web-btn pri lg block" style="margin-top:20px" aria-disabled="${ok?'false':'true'}" onclick="${ok?"webnav('checkout')":''}">${ok?'다음 · 접수 확인':'날짜·시간을 골라주세요'}</button>
</div>`;
},

checkout: () => `
<div class="wrap narrow">
  ${steps(3)}
  <h1 class="web-h2" style="margin:14px 0 18px">접수 확인</h1>
  <div class="bcard pad" style="padding:24px">
    <div class="h-md">신청 내용</div>
    <div class="col gap10" style="margin-top:12px">
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">품목</span><span class="strong">${selectedCats().join(' · ')||W.item.replace(/\s*교체$/,'')}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">제품</span><span class="strong">${W.selected.length}종 · 총 ${wunits()}개</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">희망 예약</span><span class="strong">${bookingDateLabel(W.date)} · ${W.time}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">사진</span><span class="strong">${wBookingPhotoLabel()}</span></div>
    </div>
    <div class="divline" style="margin:16px 0"></div>
    <div class="col gap10">
      <div class="between"><span class="p-sm" style="color:var(--gray-600)"><i data-lucide="package" style="width:15px;height:15px;vertical-align:-2px"></i> 제품비 <span style="color:var(--gray-400)">총 ${wunits()}개</span></span><span class="strong">${won(wsub())}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)"><i data-lucide="wrench" style="width:15px;height:15px;vertical-align:-2px"></i> 시공비 <span style="color:var(--gray-400)">×${wunits()}</span></span><span class="strong">${won(wlabor())}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)"><i data-lucide="trash-2" style="width:15px;height:15px;vertical-align:-2px"></i> 폐기물처리비 <span style="color:var(--gray-400)">×${wunits()}</span></span><span class="strong">${won(W_DISPOSAL*wunits())}</span></div>
      <div class="between" style="padding:7px 0"><span class="p-sm" style="color:var(--gray-600)">합계</span><span class="strong">${won(wtot())}</span></div>
      <div class="prow tot" style="margin-top:4px"><span class="pk">최종 합계 <span class="sub" style="font-weight:600">부가세 10% 포함</span></span><span class="pv">${won(wvatTotal())}<span class="sub" style="font-weight:600"> 원</span></span></div>
    </div>
  </div>
  ${wCashReceiptBox()}
  <div class="note info" style="margin-top:16px"><i data-lucide="shield-check"></i><div><b>추가 비용은 없어요.</b> 출장비도 받지 않아요. 사진과 현장이 같다면 위 금액 그대로 진행됩니다.</div></div>
  <div class="note" style="margin-top:10px;background:rgba(120,120,128,.08);color:var(--gray-600);display:flex;gap:9px;padding:13px 15px;border-radius:14px;font-size:13px"><i data-lucide="info" style="width:18px;height:18px;flex:none;color:var(--gray-500)"></i><div>기존 제품을 <b>직접 처리하시면 폐기물처리비가 제외</b>돼요.</div></div>
  ${W.submitErr?`<div class="note" style="margin-top:14px;background:#FDECEC;color:#B42318;display:flex;gap:9px;padding:13px 15px;border-radius:14px;font-size:13px"><i data-lucide="alert-circle" style="width:18px;height:18px;flex:none"></i><div>${esc(W.submitErr)}</div></div>`:''}
  <button class="web-btn pri lg block" style="margin-top:20px" aria-disabled="${W.submitting?'true':'false'}" onclick="wSubmitOrder()">${W.submitting?'접수 저장 중...':'주문 접수하기'}</button>
  <button class="web-btn sec lg block" style="margin-top:10px" onclick="openFinalEstimate()"><i data-lucide="file-text" style="width:18px;height:18px"></i> 최종 견적서 보기</button>
</div>`,

done: () => {
  const payAmount = wPaymentAmount();
  const statusLabel = wPaymentStatusLabel();
  const hasTransfer = Boolean(W.remoteOrder?.transferUrl && payAmount > 0);
  const hasProducts = Array.isArray(W.remoteOrder?.selected) ? W.remoteOrder.selected.length > 0 : W.selected.length > 0;
  const bank = { bankName:'농협', bankAccount:'355-0094-9209-33', accountHolder:'주식회사 무니온' };
  const orderNo = wOrderNo();
  const payerName = `${W.remoteOrder?.customerName || W.name || '예약자'} ${String(orderNo).split('-').pop() || orderNo}`.trim();
  return `
<div class="wrap narrow" style="text-align:center">
  <div class="featured-icon circle" style="width:76px;height:76px;background:var(--success-50);color:var(--success-600);margin:24px auto 0"><i data-lucide="check" style="width:38px;height:38px"></i></div>
  <h1 class="web-h2" style="margin-top:18px">신청이 접수됐어요</h1>
  <p class="web-lede" style="font-size:16px;margin-top:8px">${hasTransfer?'사진 확인 후 최종 견적을 안내드려요. 선택 제품 예약을 위해 제품 금액 입금 안내를 확인해주세요.':'영업시간 기준 2시간 내 견적을 안내드려요. 카카오톡 알림도 가능해요.'}</p>
  <div class="bcard pad" style="padding:22px;text-align:left;max-width:440px;margin:22px auto 0">
    <div class="between"><div class="p-sm strong" style="color:var(--gray-700)">접수번호</div><div class="p-sm strong">${wOrderNo()}</div></div>
    <div class="between" style="margin-top:8px"><div class="p-sm strong" style="color:var(--gray-700)">현재 상태</div><span class="badge badge-warning dot">${statusLabel}</span></div>
    ${payAmount>0?`<div class="between" style="margin-top:8px"><div class="p-sm strong" style="color:var(--gray-700)">입금 금액</div><div class="p-sm strong">${won(payAmount)}원</div></div>`:''}
    <div class="divline" style="margin:12px 0"></div>
    <div class="row gap10"><span class="tile" style="width:38px;height:38px"><i data-lucide="droplet" style="width:20px;height:20px"></i></span><div class="grow"><div class="p-sm strong" style="color:var(--gray-900)">${W.item} · ${wDonePhotoLabel()}</div><div class="p-sm">${W.region} · ${statusLabel}</div></div></div>
    ${hasTransfer?`
    <div class="divline" style="margin:14px 0"></div>
    <div class="row gap10"><span class="tile" style="width:38px;height:38px;background:var(--brand-50);color:var(--brand-600)"><i data-lucide="wallet" style="width:20px;height:20px"></i></span><div class="grow"><div class="p-sm strong" style="color:var(--gray-900)">계좌이체 안내</div><div class="p-sm">제품 금액 입금 확인 후 주문이 진행돼요.</div></div></div>
    <div class="col gap8" style="margin-top:12px">
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">예금주</span><span class="p-sm strong" style="color:var(--gray-900)">${esc(bank.accountHolder)}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">입금 계좌</span><span class="p-sm strong" style="color:var(--gray-900)">${esc(bank.bankName)} ${esc(bank.bankAccount)}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">입금자명</span><span class="p-sm strong" style="color:var(--gray-900)">${esc(payerName)}</span></div>
    </div>
    <div class="note info" style="margin-top:14px"><i data-lucide="info"></i><div>입금 확인은 영업시간 기준으로 순차 반영됩니다. 시공비와 최종 금액은 사진 확인 후 확정돼요.</div></div>`:''}
  </div>
  <div style="display:grid;gap:10px;max-width:360px;margin:16px auto 0">
    ${hasProducts?`<button class="web-btn sec lg block" onclick="openFinalEstimate()"><i data-lucide="file-text" style="width:18px;height:18px"></i> 최종 견적서 보기</button>`:''}
    <button class="web-btn kkbtn lg block" onclick="webKakao('guide')">${WKK} 카카오톡으로 결과 알림 받기</button>
  </div>
  <div class="row gap10" style="justify-content:center;margin-top:14px">${hasProducts?`<button class="web-btn ${hasTransfer?'sec':'pri'}" onclick="webnav('orderview')">주문 현황 보기</button>`:''}<button class="web-btn sec" onclick="webnav('home')">홈으로</button></div>
</div>`;
},

/* ── 주문 조회 (주문번호 + 성함 입력) ───────────────────────────── */
orders: () => `
<div class="wrap narrow">
  <h1 class="web-h2">주문 조회</h1>
  <p class="web-lede" style="font-size:16px;margin-top:6px">주문번호와 예약자 성함을 입력하면 주문 내용을 확인할 수 있어요.</p>
  <div class="bcard pad" style="padding:24px;margin-top:22px">
    <div class="field"><label>주문번호</label><input class="input" placeholder="BC-000000-000" value="${W._lookupNo||''}" oninput="W._lookupNo=this.value"></div>
    <div class="field" style="margin-top:14px"><label>예약자 성함</label><input class="input" placeholder="홍길동" value="${W._lookupName||''}" oninput="W._lookupName=this.value"></div>
    ${W._lookupErr?`<div class="note" style="margin-top:14px;background:#FDECEC;color:#B42318;display:flex;gap:9px;padding:13px 15px;border-radius:14px;font-size:13px"><i data-lucide="alert-circle" style="width:18px;height:18px;flex:none"></i><div>입력하신 정보와 일치하는 주문을 찾을 수 없어요. 주문번호와 성함을 다시 확인해 주세요.</div></div>`:''}
    <button class="web-btn pri lg block" style="margin-top:18px" aria-disabled="${W._lookupLoading?'true':'false'}" onclick="wLookupOrder()">${W._lookupLoading?'조회 중...':'주문 조회하기'}</button>
  </div>
</div>`,

/* ── 주문 확인 (조회 결과) ─────────────────────────────────────────
   정보 구성은 최종 견적서와 동일하되, 화면 안에서 직접 렌더링하는
   별도 코드. ▶ openFinalEstimate(팝업/PDF)와 완전히 분리되어 있어
   이 페이지만 따로 수정해도 견적서에 영향이 없음.                      */
orderview: () => {
  const remote = W.remoteOrder;
  const addr=remote ? ((remote.roadAddress||'')+(remote.detailAddress?' '+remote.detailAddress:'')) : (W.region||'')+(W.regionDetail?' '+W.regionDetail:'');
  const remoteDate = remote?.reservation?.date ? bookingDateLabel(remote.reservation.date) : '';
  const dateTxt=remoteDate ? `${remoteDate}${remote?.reservation?.time?' · '+remote.reservation.time:''}` : (W.date?`${bookingDateLabel(W.date, true)}${W.time?' · '+W.time:''}`:'사진 확인 후 협의');
  const remoteRows = Array.isArray(remote?.selected) ? remote.selected : [];
  const hasProducts=remoteRows.length>0 || W.selected.length>0;
  const statusLabel = wPaymentStatusLabel();
  const productAmount = remote?.totals ? Number(remote.totals.productAmount||0) : wsub();
  const serviceAmount = remote?.totals ? Number(remote.totals.onsitePaymentAmount||remote.totals.laborAmount||0) : wlabor();
  const disposalAmount = remote?.totals ? 0 : wdisp();
  const totalAmount = remote?.totals ? Number(remote.totals.totalAmount||productAmount+serviceAmount) : wtot();
  const rows=remoteRows.length ? remoteRows.map(p=>{
    return `<div style="display:flex;align-items:center;gap:14px">
      <span style="width:52px;height:52px;border-radius:12px;background:var(--gray-100);overflow:hidden;flex:none;display:grid;place-items:center"><i data-lucide="package" style="width:22px;height:22px;color:var(--gray-400)"></i></span>
      <div style="flex:1;min-width:0"><div class="strong" style="font-size:14px">${p.name||p.model||'-'}</div><div class="p-sm" style="color:var(--gray-500);margin-top:1px">${p.categoryName||p.serviceCode||''} · ${p.qty||1}개</div></div>
      <div class="strong" style="white-space:nowrap">${won((p.price||0)*(p.qty||1))}<small style="color:var(--gray-400);font-weight:600"> 원</small></div>
    </div>`;
  }).join('') : W.selected.map(id=>{const p=wp(id);const q=wq(id);const cat=catOf(id);const im=ITEM_IMG[cat];
    return `<div style="display:flex;align-items:center;gap:14px">
      <span style="width:52px;height:52px;border-radius:12px;background:var(--gray-100);overflow:hidden;flex:none;display:grid;place-items:center">${im?`<img src="${im}" alt="" style="width:100%;height:100%;object-fit:cover">`:''}</span>
      <div style="flex:1;min-width:0"><div class="strong" style="font-size:14px">${p.brand} ${productDisplayName(p)}</div><div class="p-sm" style="color:var(--gray-500);margin-top:1px">${cat.replace(/\s*교체$/,'')} · ${q}개</div></div>
      <div class="strong" style="white-space:nowrap">${won(p.price*q)}<small style="color:var(--gray-400);font-weight:600"> 원</small></div>
    </div>`;}).join('');
  return `
<div class="wrap narrow">
  <div class="between" style="align-items:center"><h1 class="p-sm strong" style="margin:0;color:var(--gray-900)">주문 확인</h1><button class="web-btn sec" onclick="webnav('orders')"><i data-lucide="chevron-left" style="width:16px;height:16px"></i> 조회</button></div>
  <div class="bcard pad" style="padding:24px;margin-top:18px">
    <div class="between"><span class="badge badge-warning dot">${statusLabel}</span><span class="p-sm strong" style="color:var(--gray-600)">${remote?.orderNumber || W.orderNo}</span></div>
    <div class="atl" style="margin-top:18px">
      <div class="atl-row done"><span class="atl-node"><i data-lucide="check"></i></span><div><div class="tlt">사진 확인 신청</div><div class="tld">방금 · 접수 완료</div></div></div>
      ${remote?.payment?.status==='pending'?`<div class="atl-row now"><span class="atl-node"></span><div><div class="tlt">제품 입금 대기</div><div class="tld">${won(wPaymentAmount())}원 · 계좌이체 대기</div></div></div>`:`<div class="atl-row now"><span class="atl-node"></span><div><div class="tlt">매니저 확인 중</div><div class="tld">가능 여부·정찰가 확인</div></div></div>`}
      <div class="atl-row todo"><span class="atl-node"></span><div><div class="tlt">견적·예약 확정</div><div class="tld">동의 후 진행</div></div></div>
      <div class="atl-row todo"><span class="atl-node"></span><div><div class="tlt">방문 교체</div><div class="tld">희망 일정 기준</div></div></div>
      <div class="atl-row todo"><span class="atl-node"></span><div><div class="tlt">완료 · 보증 시작</div><div class="tld">완료 리포트 · A/S</div></div></div>
    </div>
  </div>
  <div class="bcard pad" style="padding:24px;margin-top:14px">
    <div class="p-sm strong" style="color:var(--gray-900)">예약 정보</div>
    <div class="col gap10" style="margin-top:12px">
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">예약자</span><span class="p-sm strong" style="color:var(--gray-900)">${remote?.customerName||W.name||'-'}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">연락처</span><span class="p-sm strong" style="color:var(--gray-900)">${remote?.phone||W.phone||'-'}</span></div>
      <div class="between" style="align-items:flex-start"><span class="p-sm" style="color:var(--gray-600)">시공 주소</span><span class="p-sm strong" style="color:var(--gray-900);text-align:right;max-width:62%">${addr||'-'}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">예약 일시</span><span class="p-sm strong" style="color:var(--gray-900)">${dateTxt}</span></div>
    </div>
    ${hasProducts?`
    <div class="divline" style="margin:16px 0"></div>
    <div class="p-sm strong" style="color:var(--gray-900)">선택 제품 <span class="p-sm" style="color:var(--gray-400);font-weight:500">${W.selected.length}종 · 총 ${wunits()}개</span></div>
    <div class="col gap12" style="margin-top:14px">${rows}</div>
    <div class="divline" style="margin:16px 0"></div>
    <div class="col gap10">
      <div class="between"><span class="p-sm" style="color:var(--gray-600)"><i data-lucide="package" style="width:15px;height:15px;vertical-align:-2px"></i> 제품비</span><span class="strong">${won(productAmount)}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)"><i data-lucide="wrench" style="width:15px;height:15px;vertical-align:-2px"></i> 시공·현장 결제 예정</span><span class="strong">${won(serviceAmount)}</span></div>
      ${disposalAmount>0?`<div class="between"><span class="p-sm" style="color:var(--gray-600)"><i data-lucide="trash-2" style="width:15px;height:15px;vertical-align:-2px"></i> 폐기물처리비</span><span class="strong">${won(disposalAmount)}</span></div>`:''}
      <div class="prow tot" style="margin-top:4px"><span class="pk">예상 합계</span><span class="pv">${won(totalAmount)}<span class="sub" style="font-weight:600"> 원</span></span></div>
    </div>`:`
    <div class="divline" style="margin:16px 0"></div>
    <div class="note info"><i data-lucide="info"></i><div>사진 호환제품 문의 접수예요. 매니저가 사진을 확인해 호환 제품과 견적을 안내드려요.</div></div>`}
  </div>
  <div class="row gap10" style="margin-top:16px">${remote?.transferUrl?`<button class="web-btn pri" onclick="wOpenTransfer()"><i data-lucide="wallet"></i> 계좌이체 안내</button>`:(hasProducts?`<button class="web-btn sec" onclick="openFinalEstimate()"><i data-lucide="file-text"></i> 최종 견적서</button>`:'')}<button class="web-btn sec" onclick="webKakao('rebook')"><i data-lucide="calendar"></i> 예약 변경</button><button class="web-btn sec" onclick="webKakao('guide')"><i data-lucide="headphones"></i> A/S 접수</button></div>
</div>`;
},

};

wWireBrowserRouter();
webnav(wScreenFromPath(wRouterPath()), { history: false });
