/* ============================================================================
   Build us Care — customer prototype logic (mobile)
   Single phone frame · JS router · shared state. Reuses board.css components.
   ============================================================================ */
const HOUSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V20h12v-9.5"/><path d="M10.5 20v-5h3v5"/></svg>';
const KK = '<svg class="kkic" viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;flex:none"><path d="M12 3.4C6.7 3.4 2.4 6.85 2.4 11.1c0 2.74 1.82 5.14 4.55 6.52-.2.72-.72 2.62-.83 3.03-.14.5.18.5.39.37.16-.1 2.5-1.7 3.52-2.4.51.07 1.03.11 1.57.11 5.3 0 9.6-3.45 9.6-7.63S17.3 3.4 12 3.4z"/></svg>';
const KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_PxkzsX';

const ITEM_EN = {'양변기 교체':'Toilet','세면대 교체':'Washbasin','수전 교체':'Faucet','비데 설치':'Bidet','환풍기 교체':'Ventilation','샷시손잡이':'Window Handle','도어핸들':'Door Handle','실리콘 재시공':'Silicone Reseal','욕실 악세서리':'Bath Accessory'};
const ITEMS = [
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
const productsList = () => CATALOG[S.item] || CATALOG['수전 교체'] || [];
const ALL_PRODUCTS = Object.values(CATALOG).flat();
const catalogCatOf = (id) => Object.keys(CATALOG).find(k=>CATALOG[k].some(p=>p.id===id)) || '';
/* 카테고리별 하위 종류 필터 (제품명 기준) */
const SUBTYPES = {
  '양변기 교체':[['원피스',/^원피스/],['투피스',/^투피스/]],
  '세면대 교체':[['반다리',/^반다리/],['긴다리',/^긴다리/]],
  '수전 교체':[['세면수전',/^세면수전/],['주방수전',/^주방수전/],['샤워욕조',/^샤워욕조/],['레인샤워',/^레인샤워/],['샤워수전',/^샤워수전/]],
  '욕실 악세서리':[['세트',/세트/],['선반·수건걸이',/선반|수건걸이/]],
};
const LABOR = 60000, DISPOSAL = 10000;

/* product images (same set as the web build) */
const ITEM_IMG = {'수전 교체':'assets/prod-faucet-1.png','양변기 교체':'assets/prod-toilet-1.png','세면대 교체':'assets/prod-washbasin-1.png','비데 설치':'assets/prod-bidet-1.png','환풍기 교체':'assets/prod-vent-1.png','샷시손잡이':'assets/prod-windowhandle-1.png','도어핸들':'assets/prod-doorhandle-1.png','실리콘 재시공':'assets/prod-silicone-1.png','욕실 악세서리':'assets/prod-accessory-1.png'};
const CAT_ICON = {'수전 교체':'assets/prodicon-faucet.webp','양변기 교체':'assets/prodicon-toilet.webp','세면대 교체':'assets/prodicon-washbasin.webp','비데 설치':'assets/prodicon-bidet.webp','환풍기 교체':'assets/prodicon-vent.webp','샷시손잡이':'assets/prodicon-windowhandle.webp','도어핸들':'assets/prodicon-doorhandle.webp','실리콘 재시공':'assets/prodicon-silicone.webp','욕실 악세서리':'assets/prodicon-accessory.webp'};
const LINEUP_IMG = {'수전 교체':'assets/lineup-faucet.png','양변기 교체':'assets/lineup-toilet.png','세면대 교체':'assets/lineup-washbasin.png','비데 설치':'assets/lineup-bidet.png','환풍기 교체':'assets/lineup-vent.png','샷시손잡이':'assets/lineup-windowhandle.png','도어핸들':'assets/lineup-doorhandle.png','실리콘 재시공':'assets/lineup-silicone.png','욕실 악세서리':'assets/lineup-accessory.png'};

const S = { cur:'home', hist:[], item:'수전 교체', selected:[], productPage:1, brandFilter:'', colorFilter:'', photos:0, photoFiles:[], photoSets:[0,0,0], photoSetFiles:[[],[],[]],
  info:{region:'', regionDetail:'', postalCode:'', name:'', phone:''}, date:null, time:null, applied:false, selfDisposal:false,
  regionOk:false, specCheck:false, privacyOk:false, privacyOkInq:false, orderNo:'',
  lookupNo:'', lookupName:'', lookupErr:false, lookupLoading:false, submitting:false, submitErr:'', remoteOrder:null, sashChoice:{} };

const M_ITEM_SLUGS = {'양변기 교체':'toilet','세면대 교체':'washbasin','수전 교체':'faucet','비데 설치':'bidet','환풍기 교체':'ventilation','샷시손잡이':'window-handle','도어핸들':'door-handle','실리콘 재시공':'silicone','욕실 악세서리':'bath-accessory'};
const M_SLUG_ITEMS = Object.fromEntries(Object.entries(M_ITEM_SLUGS).map(([name, slug]) => [slug, name]));
const M_SCREEN_ROUTES = {
  home:'/',
  services:'/service',
  items:'/products',
  list:'/products',
  detail:'/products/detail',
  inquiry:'/photo-check',
  upload:'/photo-check/photos',
  info:'/reservation/info',
  quote:'/quote-preview',
  booking:'/reservation/schedule',
  checkout:'/reservation/confirm',
  done:'/reservation/complete',
  orders:'/order-lookup',
  orderview:'/order-status',
  as:'/as-request'
};
const M_ROUTER_ID = `mobile-${Math.random().toString(36).slice(2)}`;
function mTopWindow(){
  try {
    if (window.top && window.top.location.origin === window.location.origin) return window.top;
  } catch (_) {}
  return window;
}
const M_ROUTER_TARGET = mTopWindow();
function mRouterPath(){
  try { return M_ROUTER_TARGET.location.pathname || '/'; } catch (_) { return window.location.pathname || '/'; }
}
function mPathForScreen(id){
  if(id === 'list'){
    const slug = M_ITEM_SLUGS[S.item];
    return slug ? `/products/${slug}` : '/products';
  }
  if(id === 'detail'){
    const p = productById(S.detail);
    const cat = p ? catalogCatOf(p.id) : S.item;
    const slug = M_ITEM_SLUGS[cat] || M_ITEM_SLUGS[S.item];
    return slug && S.detail ? `/products/${slug}/${S.detail}` : '/products/detail';
  }
  return M_SCREEN_ROUTES[id] || '/';
}
function mScreenFromPath(path){
  const parts = String(path || '/').replace(/\/+$/,'').split('/').filter(Boolean);
  if(!parts.length) return 'home';
  if(parts[0] === 'service') return 'services';
  if(parts[0] === 'products'){
    if(parts[1] === 'detail') return S.detail ? 'detail' : 'list';
    if(parts[1] && M_SLUG_ITEMS[parts[1]]) S.item = M_SLUG_ITEMS[parts[1]];
    if(parts[2]) S.detail = parts[2];
    S.subFilter = '';
    S.brandFilter = '';
    S.colorFilter = '';
    S.productPage = 1;
    return parts[2] ? 'detail' : (parts[1] ? 'list' : 'items');
  }
  if(parts[0] === 'photo-check') return parts[1] === 'photos' ? 'upload' : 'inquiry';
  if(parts[0] === 'reservation'){
    if(parts[1] === 'schedule') return 'booking';
    if(parts[1] === 'confirm') return 'checkout';
    if(parts[1] === 'complete') return 'done';
    return 'info';
  }
  if(parts[0] === 'quote-preview') return 'quote';
  if(parts[0] === 'order-lookup') return 'orders';
  if(parts[0] === 'order-status') return 'orderview';
  if(parts[0] === 'as-request') return 'as';
  return 'home';
}
function mSetBrowserRoute(id, mode='push'){
  const path = mPathForScreen(id);
  try {
    if(mRouterPath() === path) return;
    M_ROUTER_TARGET.history[mode === 'replace' ? 'replaceState' : 'pushState']({ builduscare: true, screen: id }, '', path);
    M_ROUTER_TARGET.dispatchEvent(new CustomEvent('builduscare-routechange', { detail: { path, source: M_ROUTER_ID } }));
  } catch (_) {}
}
function mApplyBrowserRoute(){
  const id = mScreenFromPath(mRouterPath());
  if(SCREENS[id]){
    if(S.hist.length) S.hist.pop();
    render(id, 'back');
  }
}
function mWireBrowserRouter(){
  try {
    M_ROUTER_TARGET.addEventListener('popstate', mApplyBrowserRoute);
    M_ROUTER_TARGET.addEventListener('builduscare-routechange', (event) => {
      if(event?.detail?.source === M_ROUTER_ID) return;
      mApplyBrowserRoute();
    });
  } catch (_) {}
}

/* warm category icons + cache logo as data URI (for the 견적서·접수증 popups) */
(function preloadM(){ const warm=()=>Object.values(CAT_ICON).forEach(s=>{const im=new Image();im.decoding='async';im.src=s;}); ('requestIdleCallback' in window)?requestIdleCallback(warm,{timeout:1500}):setTimeout(warm,200); })();
const _imgUriCacheM = {};
function imgToDataUriM(path){
  if(_imgUriCacheM[path]) return Promise.resolve(_imgUriCacheM[path]);
  return fetch(path).then(r=>r.blob()).then(b=>new Promise(res=>{const fr=new FileReader();fr.onload=()=>{_imgUriCacheM[path]=fr.result;res(fr.result);};fr.onerror=()=>res('');fr.readAsDataURL(b);})).catch(()=> '');
}
let BC_LOGO_URI_M = '';
imgToDataUriM('assets/bc-logo.png').then(u=>{ BC_LOGO_URI_M=u; });
function mOrderNo(){ if(!S.orderNo){ const d=new Date(); const ymd=String(d.getFullYear()).slice(2)+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'); S.orderNo='BC-'+ymd+'-'+String(Math.floor(Math.random()*900)+100); } return S.orderNo; }

const won = n => n.toLocaleString('ko-KR');
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const productImg = p => p && p.image ? `<img class="product-img" src="${p.image}" alt="" loading="lazy" decoding="async">` : '<i data-lucide="image"></i>';
const productText = p => [p.categoryName, p.model, p.note, p.sourceSheet].filter(Boolean).join(' ');
const priceValue = p => Number.isFinite(Number(p?.price)) ? Number(p.price) : Number.POSITIVE_INFINITY;
const lowestFirst = list => [...list].sort((a,b)=> priceValue(a)-priceValue(b) || String(a.name||'').localeCompare(String(b.name||''), 'ko-KR'));
const productBrand = p => p?.brand || '브랜드 미상';
const productColor = p => p?.color || '기본';
const uniqueSorted = (list, pick) => [...new Set(list.map(pick).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ko-KR'));
const filteredProducts = (list, brand, color) => list.filter(p => (!brand || productBrand(p)===brand) && (!color || productColor(p)===color));
const productById = id => ALL_PRODUCTS.find(p=>p.id===id);
const subtotal = () => S.selected.reduce((s,id)=> s + productById(id).price, 0);
const SASH_SIZE_ORDER = ['소','중','대','그립'];
function sashSizeOf(p){
  const text = [p?.note, p?.model, p?.name].filter(Boolean).join(' ');
  const m = text.match(/사이즈\s*(소|중|대|그립)\b/) || String(p?.model||'').match(/\s(소|중|대|그립)$/) || String(p?.name||'').match(/\s(소|중|대|그립)$/);
  return m ? m[1] : '';
}
function sashBaseOf(p){
  return String(p?.model || p?.name || '').replace(/\s(소|중|대|그립)$/,'').replace(/\s+/g,' ').trim();
}
function sashVariantOptions(id){
  const p = productById(id);
  if(!p || catalogCatOf(id)!=='샷시손잡이') return [];
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
function sashGroupSelected(id){
  return sashVariantOptions(id).some(v=>S.selected.includes(v.product.id));
}
function sashSizeChoices(id){
  const options = sashVariantOptions(id);
  if(!options.length) return [];
  const bySize = new Map(options.map(v=>[v.size, v.product]));
  const sizes = ['소','중','대', ...[...bySize.keys()].filter(size=>!['소','중','대'].includes(size))].filter(size=>bySize.has(size));
  return sizes.map(size=>({ size, product:bySize.get(size) }));
}
function productGroupKey(p, cat){
  const c = cat || catalogCatOf(p?.id);
  if(c==='샷시손잡이') return `${c}|${sashBaseOf(p) || p?.id}`;
  return `${c}|${p?.brand || ''}|${p?.model || p?.sku || p?.name || p?.id}`;
}
function productGroupVariants(id){
  const p = productById(id), cat = catalogCatOf(id);
  if(!p || !cat) return [];
  const key = productGroupKey(p, cat);
  const variants = (CATALOG[cat] || []).filter(v=>productGroupKey(v, cat)===key);
  if(cat==='샷시손잡이') return variants;
  const prices = new Set(variants.map(v=>priceValue(v)));
  return prices.size>1 ? variants : [p];
}
function productGroupSelected(id){
  const p = productById(id);
  if(!p) return false;
  const key = productGroupKey(p, catalogCatOf(id));
  return S.selected.some(selId=>productGroupKey(productById(selId), catalogCatOf(selId))===key);
}
function productCardList(list, source=list){
  const groups = new Map();
  source.forEach(p=>{
    const key = productGroupKey(p, S.item);
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  const seen = new Set();
  const out = [];
  list.forEach(p=>{
    const key = productGroupKey(p, S.item);
    const group = groups.get(key) || [p];
    const shouldGroup = S.item==='샷시손잡이' || new Set(group.map(v=>priceValue(v))).size>1;
    if(!shouldGroup){ out.push(p); return; }
    if(seen.has(key)) return;
    seen.add(key);
    out.push(group.reduce((best,v)=>priceValue(v)<priceValue(best)?v:best, group[0]));
  });
  return out;
}
function productDisplayName(p){
  if(!p) return '';
  if(catalogCatOf(p.id)==='샷시손잡이'){
    const base = (sashBaseOf(p) || p.name || '').replace(/^샷시\s*손잡이\s*/,'').trim();
    return `샷시 손잡이 ${base}`;
  }
  return p.name;
}
function productSelected(id){
  return S.selected.includes(id) || sashGroupSelected(id) || productGroupSelected(id);
}
function sashSizeLabel(id){
  return '';
}
function detailSashChoiceId(id){
  const choices = sashSizeChoices(id);
  if(!choices.length) return id;
  return S.sashChoice?.[id]
    || choices.find(v=>S.selected.includes(v.product.id))?.product.id
    || choices.find(v=>v.product.id===id)?.product.id
    || choices[0].product.id;
}
function setDetailSashChoice(sourceId, variantId){
  S.sashChoice = S.sashChoice || {};
  S.sashChoice[sourceId] = variantId;
  render('detail');
}
function detailSashSizeHtml(id, selectedId){
  const choices = sashSizeChoices(id);
  if(catalogCatOf(id)!=='샷시손잡이' || !choices.length) return '';
  return `<span class="flabel mt20">사이즈</span>
    <div class="size-choice-options detail-size-options">
      ${choices.map(v=>`<button class="size-choice-btn${v.product.id===selectedId?' selected':''}" onclick="setDetailSashChoice('${id}','${v.product.id}')"><b>${v.size}</b><span>${won(v.product.price)}원</span></button>`).join('')}
    </div>`;
}
/* 시공비: 제품 종류별 1개 시공 비용 (선택 제품마다 합산) */
function laborOf(id){
  const p = productById(id) || {}; const cat = catalogCatOf(id); const nm = productText(p) || p.name || '';
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
const laborTotal = () => S.selected.reduce((s,id)=> s + laborOf(id), 0);
const disposalFee = () => S.selfDisposal ? 0 : DISPOSAL;
const total = () => subtotal() + laborTotal() + disposalFee();
function toggleDisposal(){ S.selfDisposal = !S.selfDisposal; render(); }

const el = () => document.getElementById('app');
function render(id, dir){
  const same = (id===undefined) || (id===S.cur && !dir);
  if(id===undefined) id = S.cur;
  const prev = same ? (document.querySelector('.body.scroll')?.scrollTop || 0) : 0;
  S.cur = id;
  el().innerHTML = `<div class="screen ${same?'noanim':(dir||'enter')}">${SCREENS[id]()}</div>`;
  const scr = document.querySelector('.scr'); if(scr) scr.classList.toggle('page-grouped', id!=='home');
  if (window.lucide) lucide.createIcons();
  if(same){ const b=document.querySelector('.body.scroll'); if(b) b.scrollTop = prev; }
}
function nav(id, opts={}){ if(opts.history !== false) S.hist.push(S.cur); render(id,'enter'); if(opts.history !== false) mSetBrowserRoute(id, opts.history); }
function back(){
  if(S.hist.length){
    try { M_ROUTER_TARGET.history.back(); return; } catch (_) {}
    const p = S.hist.pop();
    render(p || 'home', 'back');
    mSetBrowserRoute(S.cur, 'replace');
    return;
  }
  goHome();
}
function goHome(){ S.hist = []; render('home','back'); mSetBrowserRoute('home'); }

/* ---- interactions ---- */
function selectItem(name, ev){
  S.item = name;
  document.querySelectorAll('.catcard').forEach(c=>c.classList.remove('sel'));
  ev.currentTarget.classList.add('sel');
  const b = document.getElementById('itemsNext');
  if (b){ b.setAttribute('aria-disabled','false'); }
}
function pickCat(name){ if(name===S.item) return; S.item = name; S.subFilter=''; S.brandFilter=''; S.colorFilter=''; S.productPage=1; render(); }
function setSub(label){ S.subFilter = label; S.brandFilter=''; S.colorFilter=''; S.productPage=1; render('list'); }
function setBrandFilter(value){ S.brandFilter=value; S.productPage=1; render('list'); }
function setColorFilter(value){ S.colorFilter=value; S.productPage=1; render('list'); }
function clearProductFilters(){ S.subFilter=''; S.brandFilter=''; S.colorFilter=''; S.productPage=1; render('list'); }
function setProductPage(page){ S.productPage = page; render('list'); }
function productPager(total, page){
  const pageSize = 10; // mobile product grid: 2 columns x 5 rows
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if(totalPages<=1) return '';
  const from = (page-1)*pageSize + 1;
  const to = Math.min(total, page*pageSize);
  return `<div class="product-pager">
    <button class="pager-btn" ${page<=1?'aria-disabled="true"':''} onclick="setProductPage(${page-1})"><i data-lucide="chevron-left"></i> 이전</button>
    <span class="pager-state"><b>${from}-${to} / ${total}</b><small>${page} / ${totalPages} 페이지</small></span>
    <button class="pager-btn" ${page>=totalPages?'aria-disabled="true"':''} onclick="setProductPage(${page+1})">다음 <i data-lucide="chevron-right"></i></button>
  </div>`;
}
function toggleProductId(id){
  const variants = productGroupVariants(id);
  const selected = variants.filter(v=>S.selected.includes(v.id));
  if(selected.length){
    selected.forEach(v=>{ const i = S.selected.indexOf(v.id); if(i>=0) S.selected.splice(i,1); });
  } else S.selected.push(id);
}
function selectSashVariant(sourceId, variantId, fromDetail){
  if(!variantId) return;
  sashVariantOptions(sourceId).forEach(v=>{
    if(v.product.id!==variantId){
      const i = S.selected.indexOf(v.product.id);
      if(i>=0) S.selected.splice(i,1);
    }
  });
  if(!S.selected.includes(variantId)) S.selected.push(variantId);
  closeSheet();
  if(fromDetail) back(); else render('list');
}
function openSashSizeSheet(id, fromDetail=false){
  const p = productById(id), choices = sashSizeChoices(id);
  if(!choices.length){
    toggleProductId(id);
    if(fromDetail) back(); else render('list');
    return;
  }
  showSheet(`<div class="sheet-grip"></div><div class="between"><div><div class="h-md">손잡이 사이즈 선택</div><p class="p-sm mt4">${productDisplayName(p)}</p></div><button class="iconbtn" onclick="closeSheet()" aria-label="닫기"><i data-lucide="x"></i></button></div>
    <div class="sash-size-grid">
      ${choices.map(v=>{
        const selected = S.selected.includes(v.product.id);
        return `<button class="sash-size-option${selected?' selected':''}" onclick="selectSashVariant('${id}','${v.product.id}',${fromDetail?'true':'false'})"><b>${v.size}</b><span>${won(v.product.price)}원</span><small>${v.product.color || '기본'}</small></button>`;
      }).join('')}
    </div>
    <p class="p-sm mt12">선택한 사이즈가 장바구니에 담겨요. 같은 사이즈에 색상별 가격 차이가 있으면 최저가 기준으로 담습니다.</p>`);
}
function toggleProduct(ev, id){
  if(ev?.stopPropagation) ev.stopPropagation();
  if(catalogCatOf(id)==='샷시손잡이'){ openSashSizeSheet(id); return; }
  toggleProductId(id);
  render('list');
}
function openDetail(id){ S.detail = id; nav('detail'); }
function detailAddContinue(){
  if(catalogCatOf(S.detail)==='샷시손잡이'){
    selectSashVariant(S.detail, detailSashChoiceId(S.detail), true);
    return;
  }
  if (!S.selected.includes(S.detail)) S.selected.push(S.detail);
  back();
}
function ensurePhotoState(){
  if(!Array.isArray(S.photoFiles)) S.photoFiles=[];
  if(!Array.isArray(S.photoSetFiles)) S.photoSetFiles=[[],[],[]];
  [0,1,2].forEach(i=>{ if(!Array.isArray(S.photoSetFiles[i])) S.photoSetFiles[i]=[]; });
  S.photos = S.photoFiles.length;
  S.photoSets = S.photoSetFiles.map(a=>a.length);
}
function photoEntry(file){ return { name:file.name || '사진', url:URL.createObjectURL(file), file }; }
function handlePhotoFiles(files, target='upload'){
  ensurePhotoState();
  [...(files||[])].slice(0, 3-S.photoFiles.length).forEach(file=>S.photoFiles.push(photoEntry(file)));
  ensurePhotoState();
  render(target);
}
function handleSetPhotoFiles(group, files){
  ensurePhotoState();
  const arr = S.photoSetFiles[group] || (S.photoSetFiles[group]=[]);
  [...(files||[])].slice(0, 3-arr.length).forEach(file=>arr.push(photoEntry(file)));
  ensurePhotoState();
  render('inquiry');
}
function removePhoto(index, target='upload'){
  ensurePhotoState();
  const [removed] = S.photoFiles.splice(index,1);
  if(removed?.url) URL.revokeObjectURL(removed.url);
  ensurePhotoState();
  render(target);
}
function removeSetPhoto(group, index){
  ensurePhotoState();
  const arr = S.photoSetFiles[group] || [];
  const [removed] = arr.splice(index,1);
  if(removed?.url) URL.revokeObjectURL(removed.url);
  ensurePhotoState();
  render('inquiry');
}
function addPhoto(){ document.getElementById('mUploadPhotoInput')?.click(); }
function addBookingPhoto(){ document.getElementById('mBookingPhotoInput')?.click(); }
function resetPhoto(){ ensurePhotoState(); S.photoFiles.forEach(f=>f.url&&URL.revokeObjectURL(f.url)); S.photoFiles = []; ensurePhotoState(); render('upload'); }
function addSetPhoto(g){ document.getElementById(`mSetPhotoInput${g}`)?.click(); }
function photoSlot(file, label, removeCall, emptyCall, active=true){
  if(file) return `<div class="slot filled has-photo"><img src="${esc(file.url)}" alt="${esc(label)}"><button type="button" class="slot-remove" onclick="event.stopPropagation();${removeCall}" aria-label="사진 삭제"><i data-lucide="x"></i></button><span class="ph-tag">${esc(label)}</span><span class="slot-name">${esc(file.name)}</span><span class="ph-check"><i data-lucide="check"></i></span></div>`;
  return `<div class="slot"${active?` onclick="${emptyCall}"`:' style="opacity:.55"'}><i data-lucide="plus" class="sl-ic"></i><span class="sl-t">${esc(label)}</span></div>`;
}
function updatePhone(v){
  S.info.phone = v;
  const ok = v.replace(/\D/g,'').length >= 10;
  const b = document.getElementById('infoNext');
  if (b){ b.setAttribute('aria-disabled', ok?'false':'true'); }
}
function tryQuote(){
  if (S.info.phone.replace(/\D/g,'').length >= 10) nav('quote');
}
function tryQuoteM(){ if (prebookOkM()) nav('quote'); }
function selectDate(d){ S.date = d; render('booking'); }
function dateLabel(){ if(!S.date) return ''; const W=['일','월','화','수','목','금','토']; return `6월 ${S.date}일 (${W[S.date%7]})`; }
function selectTime(t){ S.time = t; render('booking'); }
function allPhotoEntriesM(){
  ensurePhotoState();
  return [...S.photoFiles, ...S.photoSetFiles.flat()].filter(entry=>entry&&entry.file);
}
function selectedOrderPayloadM(){
  return S.selected.map(id=>({ id, qty:1 }));
}
function buildOrderPayloadM(){
  return {
    deviceType:'mobile',
    item:S.item,
    customer:{ name:S.info.name, phone:S.info.phone },
    address:{ roadAddress:S.info.region, detailAddress:S.info.regionDetail, postalCode:S.info.postalCode },
    reservation:{ date:S.date, time:S.time },
    selected:selectedOrderPayloadM(),
    selfDisposal:S.selfDisposal,
    totals:{ productAmount:subtotal(), laborAmount:laborTotal(), disposalAmount:disposalFee(), totalAmount:total() }
  };
}
function applyRemoteOrderM(order){
  if(!order) return;
  S.remoteOrder = order;
  S.orderNo = order.orderNumber || S.orderNo;
  S.info.name = order.customerName || S.info.name;
  S.info.phone = order.phone || S.info.phone;
  S.info.region = order.roadAddress || S.info.region;
  S.info.regionDetail = order.detailAddress || S.info.regionDetail;
  S.lookupNo = S.orderNo;
  S.lookupName = S.info.name;
}
function paymentAmountM(){
  const order = S.remoteOrder || {};
  return Number(order?.totals?.onlinePaymentAmount || order?.payment?.amount || 0);
}
function paymentStatusLabelM(){
  const status = S.remoteOrder?.payment?.status || '';
  if(status==='done') return '입금 완료';
  if(status==='pending') return '입금 대기';
  return '확인 중';
}
const DEFAULT_BANK_TRANSFER_M = {
  bankName: '농협',
  bankAccount: '355-0094-9209-33',
  accountHolder: '주식회사 무니온'
};
let BANK_TRANSFER_CONFIG_M = null;
function normalizeBankTransferConfigM(raw){
  const cfg = raw || {};
  return {
    bankName: String(cfg.bankName || cfg.bank || '').trim(),
    bankAccount: String(cfg.bankAccount || cfg.account || '').trim(),
    accountHolder: String(cfg.accountHolder || cfg.holder || '').trim(),
  };
}
function localBankTransferConfigM(){
  return normalizeBankTransferConfigM({ ...DEFAULT_BANK_TRANSFER_M, ...(window.BUILDUSCARE_BANK_TRANSFER || {}) });
}
async function loadBankTransferConfigM(){
  if(BANK_TRANSFER_CONFIG_M) return BANK_TRANSFER_CONFIG_M;
  const local = localBankTransferConfigM();
  BANK_TRANSFER_CONFIG_M = local;
  try{
    const res = await fetch('/api/builduscare/transfer-guide', { cache:'no-store' });
    const json = await res.json().catch(()=>null);
    if(res.ok && json?.ok) BANK_TRANSFER_CONFIG_M = normalizeBankTransferConfigM({ ...DEFAULT_BANK_TRANSFER_M, ...(json.data || {}) });
  }catch(_){}
  return BANK_TRANSFER_CONFIG_M;
}
function transferNumberM(value, fallback=0){
  const n = Number(value ?? fallback ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function transferGuideDataM(){
  const remote = S.remoteOrder || {};
  let params = null;
  if(remote.transferUrl){
    try{ params = new URL(remote.transferUrl, window.location.origin).searchParams; }catch(_){}
  }
  const amount = transferNumberM(params?.get('amount'), paymentAmountM());
  const productAmount = transferNumberM(params?.get('productAmount'), amount);
  const serviceFeeAmount = transferNumberM(params?.get('serviceFeeAmount'), remote?.totals?.onsitePaymentAmount || remote?.totals?.laborAmount || 0);
  const onsiteAmount = transferNumberM(params?.get('onsiteAmount'), serviceFeeAmount);
  const totalAmount = transferNumberM(params?.get('totalAmount'), productAmount + serviceFeeAmount);
  const orderNo = remote.orderNumber || S.orderNo || mOrderNo();
  const customerName = remote.customerName || S.info.name || '';
  const payerName = `${customerName || '예약자'} ${String(orderNo).split('-').pop() || orderNo}`.trim();
  return {
    amount,
    productAmount,
    serviceFeeAmount,
    onsiteAmount,
    totalAmount,
    orderNo,
    payerName,
    hasConfirmedTransfer: Boolean(remote.transferUrl && amount > 0),
    transferUrl: remote.transferUrl || ''
  };
}
async function copyTransferTextM(text, label){
  if(!text) return;
  let ok = false;
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  }catch(_){}
  if(!ok){
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly','');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try{ ok = document.execCommand('copy'); }catch(_){}
    ta.remove();
  }
  const msg = document.getElementById('transferCopyMsg');
  if(msg) msg.textContent = ok ? `${label} 복사됐어요.` : '복사하지 못했어요. 직접 선택해서 복사해 주세요.';
}
function copyTransferValueM(type){
  const cfg = BANK_TRANSFER_CONFIG_M || localBankTransferConfigM();
  const data = transferGuideDataM();
  if(type==='account') return copyTransferTextM(`${cfg.bankName} ${cfg.bankAccount}`, '계좌번호');
  if(type==='payer') return copyTransferTextM(data.payerName, '입금자명');
  if(type==='amount') return copyTransferTextM(String(data.amount), '입금 금액');
}
function openTransferPageM(){
  const url = S.remoteOrder?.transferUrl;
  if(!url) return;
  try{ window.top.location.href = url; }catch(_){ window.location.href = url; }
}
function renderTransferGuideM(config){
  const cfg = normalizeBankTransferConfigM(config);
  const hasBankAccount = Boolean(cfg.bankName && cfg.bankAccount && cfg.accountHolder);
  const data = transferGuideDataM();
  const amountRows = data.hasConfirmedTransfer ? `
    <div class="bcard pad mt14" style="text-align:left">
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">계좌이체 금액</span><strong>${won(data.amount)}원</strong></div>
      <div class="divline" style="margin:12px 0"></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">제품 가격</span><span class="strong">${won(data.productAmount)}원</span></div>
      <div class="between mt8"><span class="p-sm" style="color:var(--gray-600)">시공비</span><span class="strong">${won(data.serviceFeeAmount)}원</span></div>
      <div class="between mt8"><span class="p-sm" style="color:var(--gray-600)">예상 총액</span><span class="strong">${won(data.totalAmount)}원</span></div>
      ${data.onsiteAmount>0?`<div class="note info mt12"><i data-lucide="info"></i><div>제품값은 계좌이체로 확인하고, 시공비 ${won(data.onsiteAmount)}원은 사진 확인 후 최종 안내드려요.</div></div>`:''}
    </div>` : `
    <div class="note info mt14"><i data-lucide="info"></i><div>사진 확인 후 최종 금액이 확정되면 입금 계좌와 금액을 안내드려요.</div></div>`;
  const bankBlock = hasBankAccount ? `
    <div class="bcard pad mt12" style="text-align:left">
      <div class="p-sm strong" style="color:var(--gray-600)">입금 계좌</div>
      <div class="h-sm mt8">${esc(cfg.bankName)} ${esc(cfg.bankAccount)}</div>
      <div class="p-sm mt4">예금주 ${esc(cfg.accountHolder)}</div>
      <button class="btn btn-secondary btn-md btnf mt12" onclick="copyTransferValueM('account')"><i data-lucide="copy"></i> 계좌번호 복사</button>
    </div>` : `
    <div class="bcard pad mt12" style="text-align:left">
      <div class="p-sm strong" style="color:var(--gray-600)">입금 계좌</div>
      <div class="h-sm mt8">카톡으로 계좌 안내 예정</div>
      <div class="p-sm mt4">주문 확인 후 담당자가 입금 계좌와 진행 방법을 안내드립니다.</div>
    </div>`;
  showSheet(`<div class="sheet-grip"></div>
    <div class="row gap10">
      <span class="tile" style="width:42px;height:42px;background:var(--brand-50);color:var(--brand-600)"><i data-lucide="wallet"></i></span>
      <div><div class="h-md">계좌이체 안내</div><div class="p-sm">접수번호 ${esc(data.orderNo)}</div></div>
    </div>
    <p class="p-sm mt12">${data.hasConfirmedTransfer?'아래 금액과 입금자명을 확인한 뒤 진행해 주세요. 입금 확인 후 주문 상태가 업데이트됩니다.':'아직 최종 금액 확정 전입니다. 입금은 안내가 활성화된 뒤 진행해 주세요.'}</p>
    ${amountRows}
    ${bankBlock}
    <div class="bcard pad mt12" style="text-align:left">
      <div class="p-sm strong" style="color:var(--gray-600)">입금자명</div>
      <div class="h-sm mt8">${esc(data.payerName)}</div>
      <button class="btn btn-secondary btn-md btnf mt12" onclick="copyTransferValueM('payer')"><i data-lucide="copy"></i> 입금자명 복사</button>
    </div>
    <p id="transferCopyMsg" class="p-sm mt10" style="min-height:18px;color:var(--brand-600)"></p>
    ${data.transferUrl?`<button class="btn btn-tertiary btn-lg btnf mt8" onclick="openTransferPageM()">자세한 결제 페이지 열기</button>`:''}
    <button class="btn btn-primary btn-lg btnf mt8" onclick="closeSheet()">확인</button>`);
}
async function openTransferM(){
  renderTransferGuideM(BANK_TRANSFER_CONFIG_M || localBankTransferConfigM());
  if(!BANK_TRANSFER_CONFIG_M){
    const cfg = await loadBankTransferConfigM();
    if(document.getElementById('sheet')) renderTransferGuideM(cfg);
  }
}
async function submitIntake(){
  if(S.submitting) return;
  S.submitting = true;
  S.submitErr = '';
  render('checkout');
  try{
    const fd = new FormData();
    fd.append('payload', JSON.stringify(buildOrderPayloadM()));
    allPhotoEntriesM().forEach((entry,idx)=>fd.append('photos', entry.file, entry.name || `photo-${idx+1}.jpg`));
    const res = await fetch('/api/builduscare/orders', { method:'POST', body:fd });
    const json = await res.json().catch(()=>null);
    if(!res.ok || !json?.ok) throw new Error(json?.error?.message || json?.message || '접수 저장에 실패했어요.');
    applyRemoteOrderM(json.data.order);
    S.submitting = false;
    S.applied = true;
    nav('done');
  }catch(err){
    S.submitting = false;
    S.submitErr = err instanceof Error ? err.message : '접수 저장에 실패했어요.';
    render('checkout');
  }
}
function submitAS(){ showSheet(`<div class="sheet-grip"></div><div style="text-align:center"><div class="featured-icon circle" style="width:60px;height:60px;background:var(--brand-50);color:var(--brand-600);margin:0 auto"><i data-lucide="check"></i></div><div class="h-md mt12">A/S 접수됐어요</div><p class="p-sm mt4">담당 매니저가 카카오톡으로 확인 일정을 안내드려요.</p><button class="btn btn-primary btn-xl btnf mt16" onclick="closeSheet();back()">확인</button></div>`); }

/* ---- kakao fallback / sheets ---- */
function openKakaoLink(){
  const opened = window.open(KAKAO_CHANNEL_URL, '_blank');
  if(!opened){
    try{ window.top.location.href = KAKAO_CHANNEL_URL; }catch(_){ window.location.href = KAKAO_CHANNEL_URL; }
  }
}
function openKakao(ctx){
  const msg = ctx==='product'
    ? '원하는 제품이 따로 있으신가요? 카카오톡으로 제품 링크를 보내주시면 설치 가능 여부를 확인해 드려요.'
    : ctx==='guide'
    ? '사진 찍기가 어려우시면 카카오톡으로 도와드려요. 어떤 부분이 헷갈리는지 편하게 보내주세요.'
    : ctx==='rebook'
    ? '예약변경은 카카오톡 상담으로 도와드립니다.'
    : '카카오톡 상담으로 도와드려요. 궁금한 점을 편하게 남겨주세요.';
  showSheet(`<div class="sheet-grip"></div>
    <div class="row gap10"><span style="width:42px;height:42px;border-radius:13px;background:#FEE500;color:#191600;display:grid;place-items:center;flex:none">${KK}</span>
      <div><div class="h-sm">카카오톡 상담 · 보조</div><div class="p-sm">메인 접수는 앱에서 그대로 진행돼요</div></div></div>
    <p class="p-md mt12">${msg}</p>
    <button class="btn kkbtn btn-xl btnf mt16" onclick="openKakaoLink();closeSheet()">${KK} 카카오톡 열기</button>
    <button class="btn btn-tertiary btn-lg btnf mt8" onclick="closeSheet()">앱에서 계속하기</button>`);
}
function openChange(){
  showSheet(`<div class="sheet-grip"></div><div class="h-md">예약을 변경할까요?</div>
    <p class="p-sm mt4">방문 예정일이 가까우면 카카오톡으로 도와드려요.</p>
    <button class="btn btn-secondary btn-lg btnf mt16" onclick="closeSheet();nav('booking')">날짜 다시 고르기</button>
    <button class="btn kkbtn btn-lg btnf mt8" onclick="openKakaoLink();closeSheet()">${KK} 카카오톡으로 문의</button>
    <button class="btn btn-tertiary btn-lg btnf mt8" onclick="closeSheet()">닫기</button>`);
}
function openMenu(){
  closeMenu();
  const subItems = ITEMS.map(it=>{
    const nm = it[0].replace(/\s*교체$/,'');
    const subs = SUBTYPES[it[0]];
    if(subs){
      const kids = [['','전체'],...subs.map(s=>[s[0],s[0]])].map(o=>`<button class="mdrawer-sub2" onclick="closeMenu();menuPick('${it[0]}','${o[0]}')">${o[1]}</button>`).join('');
      return `<button class="mdrawer-sub expandable2" onclick="toggleMenuSub(this)">${nm}<i data-lucide="chevron-down" class="mdrawer-caret2"></i></button><div class="mdrawer-group2">${kids}</div>`;
    }
    return `<button class="mdrawer-sub" onclick="closeMenu();menuPick('${it[0]}','')">${nm}</button>`;
  }).join('')
    + `<button class="mdrawer-sub strong" onclick="closeMenu();nav('items')">전체 제품 보기</button>`;
  const d = document.createElement('div');
  d.className = 'mdrawer-scrim'; d.id = 'mdrawer';
  d.innerHTML = `<div class="mdrawer">
    <button class="mdrawer-x" onclick="closeMenu()" aria-label="닫기"><i data-lucide="x"></i></button>
    <nav class="mdrawer-nav">
      <button class="mdrawer-item" onclick="closeMenu();nav('services')">서비스 소개<i data-lucide="chevron-right" class="mdrawer-chev"></i></button>
      <button class="mdrawer-item" onclick="closeMenu();nav('inquiry')">사진으로 확인하기<i data-lucide="chevron-right" class="mdrawer-chev"></i></button>
      <button class="mdrawer-item" onclick="closeMenu();nav('items')">제품 둘러보기<i data-lucide="chevron-right" class="mdrawer-chev"></i></button>
      <button class="mdrawer-item expandable" onclick="toggleMenuGroup(this)">교체 품목<i data-lucide="chevron-down" class="mdrawer-caret"></i></button>
      <div class="mdrawer-group">${subItems}</div>
      <button class="mdrawer-item" onclick="closeMenu();nav('orders')">내 주문 · 진행현황<i data-lucide="chevron-right" class="mdrawer-chev"></i></button>
      <button class="mdrawer-item" onclick="closeMenu();nav('as')">A/S 접수<i data-lucide="chevron-right" class="mdrawer-chev"></i></button>
    </nav>
    <div class="mdrawer-foot">
      <button class="btn kkbtn btn-lg btnf" onclick="closeMenu();openKakao()">${KK} 카카오톡 상담</button>
    </div>
  </div>`;
  d.addEventListener('click', e=>{ if(e.target===d) closeMenu(); });
  document.querySelector('.scr').appendChild(d);
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(()=> d.classList.add('show'));
}
function closeMenu(){ const d=document.getElementById('mdrawer'); if(d){ d.classList.remove('show'); setTimeout(()=>d.remove(),320); } }
function toggleMenuGroup(btn){ btn.classList.toggle('open'); const g=btn.nextElementSibling; if(g) g.classList.toggle('open'); }
function toggleMenuSub(btn){ btn.classList.toggle('open'); const g=btn.nextElementSibling; if(g) g.classList.toggle('open'); }
function menuPick(cat, sub){ S.item = cat; S.subFilter = sub || ''; S.brandFilter=''; S.colorFilter=''; S.productPage = 1; nav('list'); }
function showSheet(html){
  closeSheet();
  const s = document.createElement('div');
  s.className = 'sheet-scrim'; s.id = 'sheet';
  s.innerHTML = `<div class="sheet">${html}</div>`;
  s.addEventListener('click', e=>{ if(e.target===s) closeSheet(); });
  document.querySelector('.scr').appendChild(s);
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(()=> s.classList.add('show'));
}
function closeSheet(){ const s=document.getElementById('sheet'); if(s){ s.classList.remove('show'); setTimeout(()=>s.remove(),260); } }

/* ---- shared bits ---- */
const back_btn = `<button class="iconbtn" onclick="back()"><i data-lucide="chevron-left"></i></button>`;
const menu_btn = `<button class="iconbtn" onclick="openMenu()" aria-label="메뉴"><i data-lucide="menu"></i></button>`;
const appbar = (title, right='') => `<div class="appbar bordered">${back_btn}<span class="title">${title}</span><span class="spacer"></span>${right}${menu_btn}</div>`;
const prog = (i,n=6) => `<span class="navprog">${Array.from({length:n},(_,k)=>`<i class="${k<i?'on':''}"></i>`).join('')}</span>`;
const kakaoRow = (ctx, label) => `<button class="btn kkbtn btn-lg btnf" onclick="openKakao('${ctx}')">${KK} ${label}</button>`;
function pcard(p, rec){
  const sel = productSelected(p.id);
  const recTag = rec ? `<span class="tag-rec">${p.recommendLabel||'대표'}</span>` : '';
  const label = catalogCatOf(p.id)==='샷시손잡이' ? sashSizeLabel(p.id) : '';
  const sizeLabel = label ? `<div class="psizes">${label}</div>` : '';
  return `<div class="pcard${sel?' sel':''}"${rec?' style="flex:none;width:152px"':''}>
    <div class="pimg imgph tap${p.image?' has-img':''}" onclick="openDetail('${p.id}')">${productImg(p)}${recTag}</div>
    <div class="psel" onclick="toggleProduct(event,'${p.id}')"><i data-lucide="check"></i></div>
    <div class="pinfo tap" onclick="openDetail('${p.id}')"><div class="pbrand">${p.brand}</div><div class="pname">${productDisplayName(p)}</div><div class="pprice">${won(p.price)}<small> 원</small></div>${sizeLabel}</div>
  </div>`;
}

/* ---- validation / handlers (web parity) ---- */
const contactOkM = () => S.info.phone.replace(/\D/g,'').length>=10 && (S.info.name||'').trim().length>=1 && (S.info.region||'').trim().length>=1 && (S.info.regionDetail||'').trim().length>=1 && !!S.regionOk;
const inquiryOkM = () => { ensurePhotoState(); return contactOkM() && (S.photoSets[0]||0)>=3 && !!S.privacyOkInq; };       // 사진 문의: 교체할 곳 1 사진 3장 + 동의 필수
const prebookOkM = () => contactOkM() && !!S.specCheck && !!S.privacyOk;                    // 예약정보: 제품·규격 확인 + 동의 필수
function setName(v){ S.info.name=v; refreshNext(); }
function setPhoneM(v){ S.info.phone=v; refreshNext(); }
function setRegionOk(c){ S.regionOk=c; refreshNext(); }
function setSpec(c){ S.specCheck=c; refreshNext(); }
function setPrivacy(c){ S.privacyOk=c; refreshNext(); }
function setPrivacyInq(c){ S.privacyOkInq=c; refreshNext(); }
function refreshNext(){ const b=document.getElementById('mNext'); if(b){ const ok=(S.cur==='inquiry')?inquiryOkM():prebookOkM(); b.setAttribute('aria-disabled', ok?'false':'true'); } }

/* ---- 주소 검색 (web parity) ---- */
const ADDR_DB_M = [
  {zip:'16827', road:'경기 용인시 수지구 풍덕천로 100', jibun:'경기 용인시 수지구 풍덕천동 1015'},
  {zip:'16942', road:'경기 용인시 수지구 죽전로 152', jibun:'경기 용인시 수지구 죽전동 1281'},
  {zip:'16942', road:'경기 용인시 수지구 신봉1로 30', jibun:'경기 용인시 수지구 신봉동 762'},
  {zip:'13529', road:'경기 성남시 분당구 판교역로 235', jibun:'경기 성남시 분당구 삼평동 681'},
  {zip:'13561', road:'경기 성남시 분당구 분당내곡로 131', jibun:'경기 성남시 분당구 백현동 532'},
  {zip:'16681', road:'경기 수원시 영통구 광교중앙로 145', jibun:'경기 수원시 영통구 이의동 1535'},
  {zip:'18453', road:'경기 화성시 동탄대로 537', jibun:'경기 화성시 청계동 481'},
  {zip:'16071', road:'경기 의왕시 경수대로 271', jibun:'경기 의왕시 고천동 73'},
  {zip:'15845', road:'경기 군포시 산본로 323', jibun:'경기 군포시 산본동 1146'},
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
function openAddrSearchM(){
  showSheet(`<div class="sheet-grip"></div>
    <div class="between" style="margin-bottom:12px"><div><div class="h-md">주소 검색</div><p class="p-sm mt2">도로명 주소를 선택해주세요.</p></div><button class="iconbtn" onclick="closeSheet()" aria-label="닫기"><i data-lucide="x"></i></button></div>
    <div id="mobilePostcodeFrame" class="addr-postcode-frame mobile"><div class="addr-empty">주소 검색을 불러오는 중입니다.</div></div>
    <p id="mobilePostcodeMsg" class="addr-modal-msg"></p>`);
  embedPostcode('mobilePostcodeFrame', (address)=>{
    S.info.region=address.road;
    S.info.postalCode=address.zip;
    S.info.regionDetail='';
    closeSheet();
    render();
    refreshNext();
    setTimeout(()=>{ const d=document.querySelector('.addr-detail'); if(d) d.focus(); }, 140);
  }, 'mobilePostcodeMsg');
}

/* ---- in-phone document viewer (견적서·접수증) — replaces desktop popups ---- */
let _docHtml = '', _docTitle = '';
function showDocFrame(html, title){
  _docHtml = html; _docTitle = title || '문서';
  closeDoc();
  const o = document.createElement('div'); o.className = 'docview-scrim'; o.id = 'docview';
  o.innerHTML = `<div class="docview"><div class="docview-bar"><span class="docview-title">${_docTitle}</span><button class="docview-act" onclick="closeDoc()" aria-label="닫기"><i data-lucide="x"></i></button></div><iframe class="docview-frame" title="${_docTitle}"></iframe></div>`;
  document.querySelector('.scr').appendChild(o);
  o.querySelector('.docview-frame').setAttribute('srcdoc', html);
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(()=> o.classList.add('show'));
}
function closeDoc(){ const o = document.getElementById('docview'); if(o){ o.classList.remove('show'); setTimeout(()=>o.remove(),280); } }

/* ---- 최종 견적서 (web와 동일 정보 · 별도 팝업, PDF 저장 가능) ---- */
async function openFinalEstimateM(){
  const ono=mOrderNo(); const today=new Date().toLocaleDateString('ko-KR');
  const addr=(S.info.region||'')+(S.info.regionDetail?' '+S.info.regionDetail:'');
  const dateTxt=S.date?`2026년 ${dateLabel()}${S.time?' · '+S.time:''}`:'사진 확인 후 협의';
  const logo=BC_LOGO_URI_M||await imgToDataUriM('assets/bc-logo.png');
  const uris={}; await Promise.all([...new Set(S.selected.map(id=>catalogCatOf(id)))].map(async cat=>{ uris[cat]=ITEM_IMG[cat]?await imgToDataUriM(ITEM_IMG[cat]):''; }));
  const rows=S.selected.map(id=>{const p=productById(id);const cat=catalogCatOf(id);const im=uris[cat];
    return `<tr><td class="it"><span class="thumb">${im?`<img src="${im}" alt="">`:''}</span><span class="it-tx"><b>${p.brand} ${p.name}</b><small>${cat.replace(/\s*교체$/,'')}</small></span></td><td class="c">1</td><td class="r">${won(p.price)}</td></tr>`;}).join('');
  const html=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>최종 견적서 · Build us Care</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Pretendard',-apple-system,sans-serif;color:#1d1d1f;background:#f5f5f7;padding:40px 20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:700px;margin:0 auto;background:#fff;border-radius:20px;padding:40px;box-shadow:0 10px 40px -16px rgba(0,0,0,.16)}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d1d1f;padding-bottom:22px}.q-logo{height:30px}.meta{text-align:right;font-size:12px;color:#86868b;line-height:1.7}.meta b{color:#1d1d1f}
  h1{font-size:26px;font-weight:700;letter-spacing:-.02em;margin:26px 0 4px}.sub{font-size:14px;color:#86868b;margin-bottom:24px}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e5e5ea;border:1px solid #e5e5ea;border-radius:14px;overflow:hidden;margin-bottom:26px}.info .cell{background:#fff;padding:14px 18px}.info .cell.full{grid-column:1/-1}.info .k{font-size:11px;font-weight:700;color:#86868b}.info .v{font-size:15px;font-weight:600;margin-top:3px}
  table{width:100%;border-collapse:collapse;font-size:15px}th{text-align:left;font-size:12px;font-weight:700;color:#86868b;padding:10px 0;border-bottom:1px solid #e5e5ea}th.r,td.r{text-align:right}th.c,td.c{text-align:center;width:54px;color:#6e6e73}td{padding:12px 0;border-bottom:1px solid #f0f0f2;font-weight:500;vertical-align:middle}td.it{display:flex;align-items:center;gap:12px}.thumb{width:50px;height:50px;border-radius:11px;background:#f2f2f4;overflow:hidden;flex:none;display:grid;place-items:center}.thumb img{width:100%;height:100%;object-fit:cover}.it-tx{display:flex;flex-direction:column;gap:2px}.it-tx b{font-weight:600}.it-tx small{font-size:12px;color:#86868b}
  .grp td{color:#6e6e73;font-weight:400}.tot{display:flex;justify-content:space-between;align-items:baseline;margin-top:22px;padding-top:18px;border-top:2px solid #1d1d1f}.tot .k{font-size:17px;font-weight:700}.tot .v{font-size:28px;font-weight:800;color:#245FFF}.tot .v small{font-size:14px;color:#86868b;font-weight:600}
  .note{margin-top:22px;background:#eef3ff;border-radius:14px;padding:16px 18px;font-size:13px;line-height:1.6;color:#46443d}.foot{margin-top:28px;font-size:11px;color:#a0a0a5;line-height:1.7;border-top:1px solid #e5e5ea;padding-top:18px}
  .actions{max-width:700px;margin:20px auto 0;display:flex;gap:10px;justify-content:center}.btn{border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;padding:12px 24px;border-radius:980px}.btn.p{background:#245FFF;color:#fff}.btn.s{background:#fff;color:#1d1d1f;border:1px solid #d2d2d7}
  @media (max-width:520px){body{padding:14px 10px}.sheet{padding:22px 16px;border-radius:16px}.top{flex-direction:column;align-items:flex-start;gap:12px}.meta{text-align:left}.q-logo{height:26px}h1{font-size:22px;margin:18px 0 4px}.info{grid-template-columns:1fr}.info .v{word-break:break-all}.tot .v{font-size:24px}table{font-size:14px}td.it{gap:10px}.thumb{width:44px;height:44px}.it-tx b{word-break:keep-all}.actions{flex-direction:column;margin-top:16px}.btn{width:100%}}@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}.actions{display:none}}</style></head><body>
  <div class="sheet"><div class="top"><img class="q-logo" src="${logo}" alt="build us care"><div class="meta">발행일 ${today}<br>접수번호 <b>${ono}</b><br>유효기간 발행일로부터 14일</div></div>
  <h1>최종 견적서</h1><div class="sub">선택 제품 ${S.selected.length}종 · 총 ${S.selected.length}개</div>
  <div class="info"><div class="cell"><div class="k">예약자</div><div class="v">${S.info.name||'-'}</div></div><div class="cell"><div class="k">연락처</div><div class="v">${S.info.phone||'-'}</div></div><div class="cell full"><div class="k">시공 주소</div><div class="v">${addr||'-'}</div></div><div class="cell full"><div class="k">예약 일시</div><div class="v">${dateTxt}</div></div></div>
  <table><thead><tr><th>제품</th><th class="c">수량</th><th class="r">금액 (원)</th></tr></thead><tbody>${rows}
  <tr class="grp"><td>시공비</td><td class="c">×${S.selected.length}</td><td class="r">${won(laborTotal())}</td></tr>
  <tr class="grp"><td>폐기물 처리비${S.selfDisposal?' <span style="color:#86868b">(직접 처리)</span>':''}</td><td class="c">×1</td><td class="r">${won(disposalFee())}</td></tr></tbody></table>
  <div class="tot"><span class="k">최종 합계</span><span class="v">${won(total())}<small> 원</small></span></div>
  <div class="note">설치 가능 여부와 최종 금액은 <b>사진 확인 후 확정</b>됩니다. 추가 비용과 출장비는 없으며, 본 견적서는 참고용 예상 금액입니다.</div>
  <div class="foot">주식회사 무니온 · 대표 김영태 · 경기도 용인시 포은대로59번길 37, 시그니처광교<br>사업자등록번호 601-81-39840 · 통신판매업신고 2025-용인수지-3087 · munion@mymunion.com</div></div>
  <div class="actions"><button class="btn s" onclick="window.print()">인쇄 / PDF 저장</button><button class="btn p" onclick="parent.closeDoc()">닫기</button></div>
  </body></html>`;
  showDocFrame(html, '최종 견적서');
}

/* ---- 사진 호환제품 문의 접수증 (24시간 내 안내) ---- */
async function submitInquiryM(){
  if(!inquiryOkM()) return;
  const ono=mOrderNo(); const now=new Date();
  const recv=`${now.getFullYear()}. ${now.getMonth()+1}. ${now.getDate()}. ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const addr=(S.info.region||'')+(S.info.regionDetail?' '+S.info.regionDetail:'');
  const photoTotal=(S.photoSets||[]).reduce((s,n)=>s+(n||0),0); const photoLocs=(S.photoSets||[]).filter(n=>(n||0)>0).length;
  const logo=BC_LOGO_URI_M||await imgToDataUriM('assets/bc-logo.png');
  const html=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>문의 접수증 · Build us Care</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css">
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Pretendard',-apple-system,sans-serif;color:#1d1d1f;background:#f5f5f7;padding:40px 20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:640px;margin:0 auto;background:#fff;border-radius:20px;padding:40px;box-shadow:0 10px 40px -16px rgba(0,0,0,.16)}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d1d1f;padding-bottom:22px}.q-logo{height:30px}.meta{text-align:right;font-size:12px;color:#86868b;line-height:1.7}.meta b{color:#1d1d1f}
  .badge{display:inline-flex;align-items:center;gap:7px;margin-top:26px;background:#eaf2ff;color:#245FFF;font-size:13px;font-weight:700;padding:7px 14px;border-radius:980px}.badge i{width:7px;height:7px;border-radius:50%;background:#245FFF;display:inline-block}
  h1{font-size:25px;font-weight:700;letter-spacing:-.02em;margin:14px 0 4px}.sub{font-size:14px;color:#86868b;margin-bottom:26px}
  .ono{display:flex;justify-content:space-between;align-items:center;background:#f5f5f7;border-radius:14px;padding:18px 22px;margin-bottom:26px}.ono .k{font-size:13px;font-weight:600;color:#6e6e73}.ono .v{font-size:21px;font-weight:800}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#e5e5ea;border:1px solid #e5e5ea;border-radius:14px;overflow:hidden}.info .cell{background:#fff;padding:14px 18px}.info .cell.full{grid-column:1/-1}.info .k{font-size:11px;font-weight:700;color:#86868b}.info .v{font-size:15px;font-weight:600;margin-top:3px}
  .promise{margin-top:24px;background:#eef3ff;border-radius:16px;padding:20px 22px}.promise .pt{font-size:16px;font-weight:700;display:flex;align-items:center;gap:9px}.promise .pt svg{width:22px;height:22px;stroke:#245FFF;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.promise .pd{font-size:14px;line-height:1.65;color:#46443d;margin-top:9px}.promise .pd b{color:#245FFF}
  .foot{margin-top:28px;font-size:11px;color:#a0a0a5;line-height:1.7;border-top:1px solid #e5e5ea;padding-top:18px}
  .actions{max-width:640px;margin:20px auto 0;display:flex;gap:10px;justify-content:center}.btn{border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;padding:12px 24px;border-radius:980px}.btn.p{background:#245FFF;color:#fff}.btn.s{background:#fff;color:#1d1d1f;border:1px solid #d2d2d7}
  @media (max-width:520px){body{padding:14px 10px}.sheet{padding:22px 16px;border-radius:16px}.top{flex-direction:column;align-items:flex-start;gap:12px}.meta{text-align:left}.q-logo{height:26px}h1{font-size:22px;margin:18px 0 4px}.info{grid-template-columns:1fr}.info .v{word-break:break-all}.tot .v{font-size:24px}table{font-size:14px}td.it{gap:10px}.thumb{width:44px;height:44px}.it-tx b{word-break:keep-all}.actions{flex-direction:column;margin-top:16px}.btn{width:100%}}@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}.actions{display:none}}</style></head><body>
  <div class="sheet"><div class="top"><img class="q-logo" src="${logo}" alt="build us care"><div class="meta">접수일시 <b>${recv}</b><br>접수유형 사진 호환제품 문의<br>처리예정 24시간 이내</div></div>
  <div class="badge"><i></i>접수 완료</div><h1>사진 호환제품 문의 접수증</h1><div class="sub">올려주신 사진을 매니저가 직접 확인하고 호환 제품을 찾아 안내드립니다.</div>
  <div class="ono"><span class="k">접수번호</span><span class="v">${ono}</span></div>
  <div class="info"><div class="cell"><div class="k">신청자</div><div class="v">${S.info.name||'-'}</div></div><div class="cell"><div class="k">연락처</div><div class="v">${S.info.phone||'-'}</div></div><div class="cell full"><div class="k">시공 주소</div><div class="v">${addr||'-'}</div></div><div class="cell full"><div class="k">첨부 사진</div><div class="v">교체할 곳 ${photoLocs}곳 · 총 ${photoTotal}장</div></div></div>
  <div class="promise"><div class="pt"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg>24시간 내 호환 제품을 찾아드려요</div><div class="pd">매니저가 사진 속 규격·연결부를 확인해 <b>설치 가능한 호환 제품</b>을 찾아, 접수 시각 기준 <b>24시간 이내</b>에 연락처로 후보 제품과 예상 견적을 안내드립니다. 추가 비용과 출장비는 없습니다.</div></div>
  <div class="foot">주식회사 무니온 · 대표 김영태 · 경기도 용인시 포은대로59번길 37, 시그니처광교<br>사업자등록번호 601-81-39840 · 통신판매업신고 2025-용인수지-3087 · munion@mymunion.com</div></div>
  <div class="actions"><button class="btn s" onclick="window.print()">인쇄 / PDF 저장</button><button class="btn p" onclick="parent.closeDoc()">닫기</button></div>
  </body></html>`;
  showDocFrame(html, '문의 접수증');
  showSheet(`<div class="sheet-grip"></div><div style="text-align:center"><div class="featured-icon circle" style="width:60px;height:60px;background:var(--brand-50);color:var(--brand-600);margin:0 auto"><i data-lucide="check"></i></div><div class="h-md mt12">문의가 접수됐어요</div><p class="p-sm mt4">접수번호 <b>${ono}</b><br>24시간 내 호환 제품을 찾아 연락드려요.</p><button class="btn btn-secondary btn-lg btnf mt16" onclick="closeSheet();showDocFrame(_docHtml,_docTitle)"><i data-lucide="file-text"></i> 접수증 다시 보기</button><button class="btn btn-primary btn-xl btnf mt8" onclick="closeSheet();closeDoc();goHome()">확인</button></div>`);
}

/* ---- 개인정보처리방침 (보기) ---- */
const LEGAL_M_PRIVACY = `주식회사 무니온(이하 '회사')은 「개인정보 보호법」 등 관련 법령을 준수합니다.<br><br><b>1. 수집 항목</b><br>이름, 휴대전화번호, 시공 주소, 현장 사진<br><br><b>2. 수집·이용 목적</b><br>교체 가능 여부 확인·견적 안내, 예약·시공 진행, 고객 상담 및 A/S<br><br><b>3. 보유·이용 기간</b><br>수집·이용 목적 달성 시 지체 없이 파기하며, 관련 법령에 따라 일정 기간 보관합니다.<br><br><b>4. 제3자 제공</b><br>동의 없이 제3자에게 제공하지 않으며, 시공에 필요한 범위에서 협력 시공기사에게 이름·연락처·주소를 전달합니다.<br><br><b>5. 보호책임자</b><br>김영태 (대표) · munion@mymunion.com`;
function openLegalM(){
  closeSheet();
  showSheet(`<div class="sheet-grip"></div><div class="between"><div class="h-md">개인정보처리방침</div><button class="iconbtn" onclick="closeSheet()"><i data-lucide="x"></i></button></div><div class="p-sm mt10" style="max-height:52vh;overflow:auto;line-height:1.75;color:var(--gray-700)">${LEGAL_M_PRIVACY}</div><button class="btn btn-primary btn-lg btnf mt14" onclick="closeSheet()">확인</button>`);
}

/* ---- 주문 조회 ---- */
async function lookupOrderM(){
  const no=(S.lookupNo||'').trim().toUpperCase(); const nm=(S.lookupName||'').trim();
  if(!no || !nm){ S.lookupErr=true; render('orders'); return; }
  S.lookupLoading=true; S.lookupErr=false; render('orders');
  try{
    const res = await fetch('/api/builduscare/orders/lookup', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({ orderNumber:no, name:nm })
    });
    const json = await res.json().catch(()=>null);
    if(!res.ok || !json?.ok) throw new Error(json?.error?.message || json?.message || '주문 조회에 실패했어요.');
    if(json.data?.order){
      S.lookupLoading=false;
      applyRemoteOrderM(json.data.order);
      S.lookupErr=false;
      nav('orderview');
      return;
    }
    if(S.orderNo && no===S.orderNo.toUpperCase() && nm && nm===(S.info.name||'').trim()){
      S.lookupLoading=false; S.lookupErr=false; nav('orderview'); return;
    }
    S.lookupLoading=false; S.lookupErr=true; render('orders');
  }catch(err){
    S.lookupLoading=false;
    S.lookupErr=true;
    S.submitErr = err instanceof Error ? err.message : '';
    render('orders');
  }
}

/* ============================== SCREENS ============================== */
const SCREENS = {

services: () => `
${appbar('서비스 소개')}
<div class="body scroll"><div class="pad">
  <div class="eyebrow">Build us Care 서비스</div>
  <h1 class="h-xl mt8">집 전체가 아니라,<br>바꿀 수 있는 것부터.</h1>
  <p class="p-md mt8">오래된 수전·변기·환풍기·손잡이. 방문견적 없이 사진 3장으로 우리 집에 맞는 제품인지 먼저 확인하고, 필요한 교체만 예약하는 생활 리프레시 케어 서비스예요.</p>
  <div class="col gap10 mt20">
    <div class="bcard pad svc-step"><div class="row gap12"><span class="tile" style="width:40px;height:40px"><i data-lucide="camera" style="width:20px;height:20px"></i></span><div class="grow"><div class="h-sm">① 사진 3장 먼저</div><div class="p-sm mt2">전체·문제부위·규격을 보내면 방문 없이 확인 시작.</div></div></div></div>
    <div class="bcard pad svc-step"><div class="row gap12"><span class="tile" style="width:40px;height:40px"><i data-lucide="search-check" style="width:20px;height:20px"></i></span><div class="grow"><div class="h-sm">② 가능 여부·정찰가</div><div class="p-sm mt2">교체 가능·보류 가능·상담 필요를 솔직하게 구분.</div></div></div></div>
    <div class="bcard pad svc-step"><div class="row gap12"><span class="tile" style="width:40px;height:40px"><i data-lucide="calendar-check" style="width:20px;height:20px"></i></span><div class="grow"><div class="h-sm">③ 예약·방문 교체</div><div class="p-sm mt2">제품가·시공비를 나눠 확인, 필요할 때만 방문.</div></div></div></div>
  </div>
  <div class="h-md mt24">우리가 지키는 약속</div>
  <div class="col gap10 mt12">
    <div class="bcard pad"><div class="row gap8"><i data-lucide="shield-check" style="color:var(--success-600)"></i><div class="h-sm" style="font-size:14px">교체 안 해도 됩니다</div></div><p class="p-sm mt4">청소·조임으로 해결되면 그렇게 안내해요.</p></div>
    <div class="bcard pad"><div class="row gap8"><i data-lucide="receipt-text" style="color:var(--brand-600)"></i><div class="h-sm" style="font-size:14px">제품값·시공비 분리</div></div><p class="p-sm mt4">예상 금액을 투명하게. 동의 없는 추가는 없어요.</p></div>
    <div class="bcard pad"><div class="row gap8"><i data-lucide="life-buoy" style="color:var(--brand-600)"></i><div class="h-sm" style="font-size:14px">시공 후 A/S</div></div><p class="p-sm mt4">완료 리포트와 보증으로 사후까지 케어해요.</p></div>
  </div>
</div></div>
<div class="cta-bar"><button class="btn btn-primary btn-xl btnf" onclick="nav('inquiry')"><i data-lucide="camera"></i> 사진으로 먼저 확인하기</button></div>`,

home: () => `
<div class="appbar"><img class="bc-logo" src="assets/bc-logo.png" alt="build us care" style="height:22px"><span class="spacer"></span><button class="iconbtn" onclick="openMenu()"><i data-lucide="menu"></i></button></div>
<div class="body scroll"><div class="pad">
  <div class="hero-light-m">
    <div class="hl-logo"><img src="assets/bc-logo-hero.png" alt="build us care"></div>
    <p class="hl-sub">오래된 수전·변기·환풍기, 바꿀 수 있는 것부터.</p>
    <div class="hl-cta">
      <div class="hl-row">
        <button class="hl-btn hl-pri" onclick="nav('inquiry')">사진으로 확인하기</button>
        <button class="hl-btn hl-out" onclick="nav('items')">제품 둘러보기</button>
      </div>
      <button class="hl-btn hl-kk" onclick="openKakao('guide')">${KK} 카카오로 문의하기</button>
    </div>
    <div class="hl-trust"><i data-lucide="shield-check"></i> 사진 판정 · 정찰가 안내 · A/S 접수</div>
  </div>
  <div class="mt24">
    <div class="h-md" style="font-size:25px">Build us Care에서<br>하면 쉬운 이유.</div>
    <p class="p-sm" style="color:var(--gray-500);margin-top:3px">집 전체를 고치기 전에, 먼저 바꿀 수 있는 것부터 봅니다.</p>
    <div class="mwhy-grid mt14">
      <div class="bcard pad mwhy"><div class="mwhy-eye">작은 교체부터</div><div class="h-sm mt6">집 전체보다, 낡은 것부터.</div><p class="p-sm mt8" style="color:var(--gray-600)">수전·변기·환풍기처럼 눈에 먼저 보이는 제품부터 정리합니다.</p><div class="mwhy-media"><img src="assets/whycard-faucet.png" alt="수전·도어핸들·환풍기"></div></div>
      <div class="bcard pad mwhy"><div class="mwhy-eye">정직한 비용</div><div class="h-sm mt6">추가비 견적비 0원.</div><p class="p-sm mt8" style="color:var(--gray-600)">예상 밖 작업은 먼저 설명합니다. 고객 동의 없이 진행하지 않습니다.</p><div class="mwhy-media"><img src="assets/whycard-receipt.png" alt="추가비·견적 방문비·출장비 0원 영수증"></div></div>
      <div class="bcard pad mwhy"><div class="mwhy-eye">표준가</div><div class="h-sm mt6">제품값도 설치비도, 표준가로.</div><p class="p-sm mt8" style="color:var(--gray-600)">제품 가격과 설치비를 나눠 보여드립니다. 비교하기 쉽게, 결정하기 쉽게.</p><div class="mwhy-media"><img src="assets/whycard-bag-orig.png" alt="제품값·설치비 표준가"></div></div>
      <div class="bcard pad mwhy"><div class="mwhy-eye">방문견적 없음</div><div class="h-sm mt6">견적 때문에 시간 비우지 마세요.</div><p class="p-sm mt8" style="color:var(--gray-600)">방문견적은 없습니다. 방문은 교체가 필요할 때만 진행합니다.</p><div class="mwhy-media"><img src="assets/whycard-schedule.png" alt="시간 예약 표"></div></div>
    </div>
  </div>
  <div class="lineup-band-m">
  <div class="h-md" style="font-size:25px">지금 바로<br>바꿀 수 있는 9가지</div>
  <p class="p-sm" style="color:var(--gray-500);margin-top:3px">한 번에 여러 가지를 교체할 수 있습니다.</p>
  <div class="home-lineup mt12">
    ${ITEMS.map(it=>`<div class="ml"><div class="ml-media">${LINEUP_IMG[it[0]]?`<img class="ml-img" src="${LINEUP_IMG[it[0]]}" alt="${it[0]}">`:`<span class="ml-ic"><i data-lucide="${it[1]}"></i></span>`}</div><div class="ml-tag">${it[3]||''}</div><div class="ml-name">${it[0].replace(/\s*교체$/,'')} <span class="enlabel">${ITEM_EN[it[0]]||''}</span></div><div class="ml-desc">${it[2]}</div><div class="ml-meta">사진 확인부터</div><div class="ml-cta"><button class="btn btn-primary btn-sm" onclick="S.item='${it[0]}';S.subFilter='';S.brandFilter='';S.colorFilter='';S.productPage=1;nav('list')">둘러보기</button><a class="ml-link" onclick="S.item='${it[0]}';nav('inquiry')">사진 확인 ›</a></div></div>`).join('')}
  </div>
  </div>
  <div class="m-foot">
    <div class="row gap10" style="justify-content:center">
      <a class="m-soc" href="https://www.instagram.com/builduscare" target="_blank" rel="noopener" aria-label="인스타그램"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:18px;height:18px"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"></rect><circle cx="12" cy="12" r="4.2"></circle><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"></circle></svg></a>
      <a class="m-soc" href="${KAKAO_CHANNEL_URL}" target="_blank" rel="noopener" aria-label="카카오톡"><svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px"><path d="M12 4.2C6.9 4.2 2.8 7.4 2.8 11.3c0 2.5 1.7 4.7 4.2 5.9-.2.6-.7 2.4-.8 2.7-.1.4.1.4.4.3.2-.1 2.7-1.8 3.7-2.5.5.1 1.1.1 1.7.1 5.1 0 9.2-3.2 9.2-7.1S17.1 4.2 12 4.2z"></path></svg></a>
    </div>
    <div class="m-foot-links">
      <a href="#">개인정보처리방침</a><span>·</span><a href="#">이용약관</a><span>·</span><a href="#">취소·환불</a><span>·</span><a href="#">A/S 기준</a>
    </div>
    <p>고객센터 평일 10:00–19:00 · 금 18:00까지</p>
    <p>휴무 : 토·일·법정공휴일 · munion@mymunion.com</p>
    <p>주식회사 무니온 · 대표 김영태</p>
    <p>경기도 용인시 포은대로59번길 37, 시그니처광교</p>
    <p>사업자등록번호 601-81-39840</p>
    <p>통신판매업신고 2025-용인수지-3087</p>
    <p style="margin-top:8px">ⓒ 2026 Build us Care. All rights reserved.</p>
  </div>
</div></div>`,

items: () => `
${appbar('무엇을 바꿀까요?')}
<div class="body scroll"><div class="pad">
  <h2 class="h-lg" style="margin-top:4px">여러 제품을<br>한번에 교체할 수 있어요</h2>
  <p class="p-sm" style="margin-top:3px">여러 가지를 한 번에 교체하세요!<br>여러 품목을 함께 교체해도 <b class="strong" style="color:var(--gray-900)">출장비와 견적비는 0원</b>입니다.</p>
  <div class="catgrid mt12">
    ${ITEMS.map(it=>`<div class="catcard" onclick="S.item='${it[0]}';S.subFilter='';S.brandFilter='';S.colorFilter='';S.productPage=1;nav('list')">${ITEM_IMG[it[0]]?`<span class="cat-pimg"><img src="${ITEM_IMG[it[0]]}" alt="${it[0]}"></span>`:`<span class="tile"><i data-lucide="${it[1]}"></i></span>`}<div class="cn">${it[0]}</div><div class="cc-actions"><span class="cp" onclick="event.stopPropagation();S.item='${it[0]}';nav('inquiry')">사진 확인부터</span><button class="cc-btn" onclick="event.stopPropagation();S.item='${it[0]}';S.subFilter='';S.brandFilter='';S.colorFilter='';S.productPage=1;nav('list')">더 알아보기</button></div></div>`).join('')}
  </div>
  <div class="note info mt16"><i data-lucide="info"></i><div>고르신 품목에 맞춰 <b>꼭 필요한 사진 3장</b>을 안내해 드려요.</div></div>
</div></div>`,

list: () => {
  const n = S.selected.length, all = productsList();
  const subs = SUBTYPES[S.item] || null;
  const cur = subs ? (S.subFilter||'') : '';
  const sel = cur && subs.find(x=>x[0]===cur);
  const baseList = sel ? all.filter(p=>sel[1].test(p.name)) : all;
  const brands = uniqueSorted(baseList, productBrand);
  const colors = uniqueSorted(baseList, productColor);
  if(S.brandFilter && !brands.includes(S.brandFilter)) S.brandFilter = '';
  if(S.colorFilter && !colors.includes(S.colorFilter)) S.colorFilter = '';
  const filteredList = filteredProducts(baseList, S.brandFilter, S.colorFilter);
  const list = lowestFirst(productCardList(filteredList, filteredList));
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  S.productPage = Math.min(Math.max(S.productPage || 1, 1), totalPages);
  const start = (S.productPage - 1) * pageSize;
  const paged = list.slice(start, start + pageSize);
  const subFilter = subs ? [['','전체'],...subs.map(s=>[s[0],s[0]])].map(o=>`<span class="fbtn${cur===o[0]?' on':''}" onclick="setSub('${esc(o[0])}')">${esc(o[1])}</span>`).join('') : '';
  const brandSelect = `<label class="filter-select"><span>브랜드</span><select onchange="setBrandFilter(this.value)"><option value="">전체</option>${brands.map(b=>`<option value="${esc(b)}"${S.brandFilter===b?' selected':''}>${esc(b)}</option>`).join('')}</select></label>`;
  const colorSelect = `<label class="filter-select"><span>색상</span><select onchange="setColorFilter(this.value)"><option value="">전체</option>${colors.map(c=>`<option value="${esc(c)}"${S.colorFilter===c?' selected':''}>${esc(c)}</option>`).join('')}</select></label>`;
  const resetFilter = (S.brandFilter || S.colorFilter || cur) ? `<span class="fbtn" onclick="clearProductFilters()">초기화</span>` : '';
  const filterRow = `<div class="filterbar mt8">${subFilter}<span class="fbtn on sort-chip"><i data-lucide="arrow-down-narrow-wide"></i> 최저가순</span>${brandSelect}${colorSelect}${resetFilter}</div>`;
  return `
${appbar(`${S.item.replace(/\s*교체$/,'')} <span class="enlabel">${ITEM_EN[S.item]||''}</span>`, '<button class="iconbtn"><i data-lucide="search"></i></button>')}
<div class="body scroll"><div class="pad">
  <div class="cat-nav">
    ${ITEMS.map(it=>`<button class="cat-item${it[0]===S.item?' on':''}" onclick="pickCat('${it[0]}')"><span class="cat-thumb"><img src="${CAT_ICON[it[0]]||ITEM_IMG[it[0]]}" alt="${it[0]}"></span><span class="cat-lbl">${it[0].replace(/\s*교체$/,'')}</span></button>`).join('')}
  </div>
  <div class="between mt16"><div class="h-md">전체 제품 (${list.length})</div></div>
  ${filterRow}
  <div class="shopgrid mt12">${paged.map(p=>pcard(p,false)).join('')}</div>
  ${productPager(list.length, S.productPage)}
  <button class="btn kkbtn btn-lg btnf mt16" onclick="openKakao('product')">${KK} 원하는 제품이 따로 있어요</button>
</div></div>
<div class="cartbar">
  <div class="grow"><div style="font-weight:700;color:var(--gray-900)">${n}개 선택</div><div class="p-sm">제품가 합계 ${won(subtotal())}원</div></div>
  <button class="btn btn-primary btn-lg" aria-disabled="${n?'false':'true'}" onclick="${n?"nav('info')":''}">예약 정보 입력</button>
</div>`;
},

detail: () => {
  const p = productById(S.detail), selectedVariantId = detailSashChoiceId(S.detail), display = productById(selectedVariantId) || p;
  const sel = catalogCatOf(S.detail)==='샷시손잡이' ? S.selected.includes(selectedVariantId) : productSelected(p.id);
  const sku = display.sku || display.model || '제품 정보 확인';
  const source = display.sourceSheet ? `${display.sourceSheet} 카탈로그 기준` : '제품 카탈로그 기준';
  return `
${appbar('제품 상세', '<button class="iconbtn"><i data-lucide="heart"></i></button>')}
<div class="body scroll">
  <div class="imgph detail-hero${p.image?' has-img':''}" style="height:240px">${productImg(p)}<span class="lbl">제품 대표 이미지</span></div>
  <div class="pad">
    <div class="pbrand" style="font-size:12px">${p.brand}</div>
    <div class="h-lg mt2">${productDisplayName(p)}</div>
    <div class="row gap8 mt4" style="align-items:baseline"><div style="font-size:22px;font-weight:700">${won(display.price)}원</div><span class="p-sm">제품가</span></div>
    ${detailSashSizeHtml(S.detail, selectedVariantId)}
    <span class="flabel mt20">색상</span>
    <div class="chips"><span class="chip on">${display.color || '기본'}</span></div>
    <span class="flabel mt20">제품 정보</span>
    <div class="bcard pad"><div class="prow" style="padding:8px 0"><span class="pk">브랜드</span><span class="pv">${display.brand}</span></div><div class="prow" style="padding:8px 0"><span class="pk">품번</span><span class="pv">${sku}</span></div><div class="prow" style="padding:8px 0"><span class="pk">종류</span><span class="pv">${display.categoryName || S.item}</span></div><div class="prow" style="padding:8px 0"><span class="pk">기준</span><span class="pv">${source}</span></div></div>
    ${display.note?`<div class="note info mt12"><i data-lucide="info"></i><div>${display.note}</div></div>`:''}
  </div>
</div>
<div class="cta-bar"><div class="row gap10"><button class="btn kkbtn btn-xl icononly" style="flex:none;width:56px" onclick="openKakao('product')">${KK}</button><button class="btn btn-primary btn-xl grow" onclick="detailAddContinue()">${sel?'담겼어요 · 계속':'선택 담고 계속'} <i data-lucide="arrow-right"></i></button></div></div>`;
},

photoGuide: () => `
${appbar(`${S.item.replace(/\s*교체$/,'')} <span class="enlabel">${ITEM_EN[S.item]||''}</span> · 사진 가이드`)}
<div class="body scroll"><div class="pad">
  <h2 class="h-lg">이 3장이면 충분해요</h2>
  <p class="p-md mt4">방문 없이 확인할 수 있도록, 아래처럼 찍어 주세요.</p>
  <div class="col gap12 mt16">
    <div class="bcard pad"><div class="row gap12"><div class="imgph" style="width:78px;height:78px;border-radius:12px;flex:none"><i data-lucide="image"></i></div><div class="grow"><div class="row gap6"><span class="badge badge-brand">1</span><div class="h-sm">전체 사진</div></div><p class="p-sm mt4">세면대 전체와 주변이 보이게.</p></div></div></div>
    <div class="bcard pad"><div class="row gap12"><div class="imgph" style="width:78px;height:78px;border-radius:12px;flex:none"><i data-lucide="image"></i></div><div class="grow"><div class="row gap6"><span class="badge badge-brand">2</span><div class="h-sm">문제 부위</div></div><p class="p-sm mt4">물 새는 곳·노후·흔들림을 가까이.</p></div></div></div>
    <div class="bcard pad"><div class="row gap12"><div class="imgph" style="width:78px;height:78px;border-radius:12px;flex:none"><i data-lucide="ruler"></i></div><div class="grow"><div class="row gap6"><span class="badge badge-brand">3</span><div class="h-sm">규격 · 연결부</div></div><p class="p-sm mt4">수전 아래 배관·연결 호스가 보이게.</p></div></div></div>
  </div>
  <button class="btn kkbtn btn-lg btnf mt16" onclick="openKakao('guide')">${KK} 잘 모르겠어요</button>
</div></div>
<div class="cta-bar"><button class="btn btn-primary btn-xl btnf" onclick="resetPhoto()"><i data-lucide="camera"></i> 사진 찍거나 불러오기</button></div>`,

inquiry: () => {
  ensurePhotoState();
  const labels=['전체','문제부위','규격·연결부'];
  const ok = inquiryOkM();
  const setSlots=(g)=>[0,1,2].map(i=>photoSlot((S.photoSetFiles[g]||[])[i], labels[i], `removeSetPhoto(${g},${i})`, `addSetPhoto(${g})`, i===(S.photoSets[g]||0))).join('');
  const need=`<span style="font-size:10.5px;font-weight:700;color:#245FFF;background:#eaf2ff;padding:2px 7px;border-radius:999px;margin-left:5px">필수</span>`;
  const opt=`<span style="font-size:10.5px;font-weight:600;color:var(--gray-500);background:rgba(120,120,128,.12);padding:2px 7px;border-radius:999px;margin-left:5px">선택</span>`;
  const group=(g,req)=>`<div${g>0?' style="margin-top:18px;padding-top:18px;border-top:1px solid var(--gray-100)"':''}><input id="mSetPhotoInput${g}" type="file" accept="image/*" multiple hidden onchange="handleSetPhotoFiles(${g}, this.files)"><div class="between" style="margin-bottom:9px;gap:8px"><div class="p-sm strong" style="color:var(--gray-700);white-space:nowrap">교체할 곳 ${g+1}${req?need:opt}</div><div class="p-sm" style="color:var(--gray-500);white-space:nowrap">${S.photoSets[g]||0} / 3장</div></div><div class="slots">${setSlots(g)}</div></div>`;
  return `
${appbar('사진으로 호환제품 문의')}
<div class="body scroll"><div class="pad">
  <h2 class="h-lg">사진 3장으로 먼저 확인해 드립니다</h2>
  <p class="p-md mt4">교체할 곳마다 전체·문제부위·규격/연결부를 올려주세요. 매니저가 직접 확인합니다.</p>
  <div class="bcard pad mt16">
    ${group(0,true)}${group(1,false)}${group(2,false)}
    <div class="note info mt12"><i data-lucide="info"></i><div>교체할 곳이 여러 곳이면 <b>곳마다</b> 사진을 올려주세요. <b>교체할 곳 1</b>의 사진 3장은 필수, 2·3은 선택이에요.</div></div>
    <div class="note mt12" style="background:#FEF8D6;color:#46443d;display:flex;gap:9px;padding:12px 14px;border-radius:12px;font-size:12.5px;line-height:1.6"><i data-lucide="message-circle" style="width:17px;height:17px;flex:none;color:#9a8a00"></i><div>교체할 곳이 <b>3곳보다 많다면</b> 카카오톡 <b>실시간 상담</b>으로 도와드려요.</div></div>
    <button class="btn kkbtn btn-md btnf mt12" onclick="openKakao('guide')">${KK} 카카오톡 실시간 상담</button>
  </div>
  <div class="bcard pad mt12">
    <div class="h-sm">연락 받을 정보</div>
    <div class="col gap10 mt12">
      <div class="field"><label>시공 받을 지역</label><button type="button" class="input addr-trigger${S.info.region?'':' empty'}" onclick="openAddrSearchM()"><span class="addr-trigger-txt">${S.info.region||'주소 검색'}</span><i data-lucide="search"></i></button>${S.info.postalCode?`<div class="addr-postal">우편번호 ${S.info.postalCode}</div>`:''}</div>
      ${S.info.region?`<div class="field"><label>상세 주소</label><input class="input addr-detail" autocomplete="off" placeholder="동·호수 (예: 101동 1203호)" value="${S.info.regionDetail}" oninput="S.info.regionDetail=this.value;refreshNext()"></div>`:''}
      <div class="field"><label>성함</label><input class="input" autocomplete="off" placeholder="홍길동" value="${S.info.name}" oninput="setName(this.value)"></div>
      <div class="field"><label>연락 받을 번호</label><input class="input" inputmode="numeric" autocomplete="off" placeholder="010-0000-0000" value="${S.info.phone}" oninput="setPhoneM(this.value)"></div>
    </div>
    <div class="note info mt12"><i data-lucide="map-pin"></i><div><b>예약 가능 지역</b> · 수원 · 성남(분당구) · 용인 · 의왕 · 군포 · 화성(동탄)</div></div>
    <label class="disp-opt mt12"><input type="checkbox" ${S.regionOk?'checked':''} onchange="setRegionOk(this.checked)"><span class="disp-box"></span><span class="disp-txt">우리 집이 예약 가능 지역이 맞나요? <span class="disp-sub">위 지역에 해당해야 진행할 수 있어요. 맞으면 체크해 주세요.</span></span></label>
    <label class="disp-opt mt12"><input type="checkbox" ${S.privacyOkInq?'checked':''} onchange="setPrivacyInq(this.checked)"><span class="disp-box"></span><span class="disp-txt">개인정보 수집·이용에 동의합니다 <a onclick="event.stopPropagation();event.preventDefault();openLegalM()" style="color:var(--brand-600);font-weight:600">(보기)</a> <span class="disp-sub">사진 확인·연락 목적으로 수집하며, 목적 달성 후 파기합니다. (필수)</span></span></label>
  </div>
</div></div>
<div class="cta-bar"><button id="mNext" class="btn btn-primary btn-xl btnf" aria-disabled="${ok?'false':'true'}" onclick="submitInquiryM()">사진으로 호환제품 문의접수 하기</button></div>`;
},

upload: () => {
  ensurePhotoState();
  const labels = ['전체','문제부위','규격·연결부'], done = S.photos>=3;
  const slots = [0,1,2].map(i => photoSlot(S.photoFiles[i], labels[i], `removePhoto(${i},'upload')`, 'addPhoto()', i===S.photos)).join('');
  return `
${appbar('사진 올리기')}
<div class="body scroll"><div class="pad">
  <input id="mUploadPhotoInput" type="file" accept="image/*" multiple hidden onchange="handlePhotoFiles(this.files, 'upload')">
  <div class="between"><div class="p-sm strong" style="color:var(--gray-700)">${S.photos} / 3장 완료</div><div class="dots">${[0,1,2].map(i=>`<i class="${i<S.photos?'on':''}"></i>`).join('')}</div></div>
  <div class="pbar mt8"><i style="width:${(S.photos/3*100)}%"></i></div>
  <div class="slots mt16">${slots}</div>
  ${done ? `<div class="row gap8 mt12"><button class="btn btn-tertiary btn-sm" onclick="resetPhoto()"><i data-lucide="rotate-ccw"></i> 다시 찍기</button></div>` : ''}
  <div class="note info mt16"><i data-lucide="info"></i><div>규격·연결부 사진이 있으면 <b>더욱 정확한 확인</b>이 가능해요.</div></div>
  <button class="btn kkbtn btn-md btnf mt12" onclick="openKakao('guide')">${KK} 카카오톡으로 보내기</button>
</div></div>
<div class="cta-bar"><button class="btn btn-primary btn-xl btnf" aria-disabled="${done?'false':'true'}" onclick="${done?"nav('info')":''}">${done?'다음':'사진 3장이 필요해요'}</button></div>`;
},

info: () => {
  ensurePhotoState();
  const ok = prebookOkM();
  const labels=['전체','문제부위','규격·연결부'];
  const slots=[0,1,2].map(i=>photoSlot(S.photoFiles[i], labels[i], `removePhoto(${i},'info')`, 'addBookingPhoto()', i===S.photos)).join('');
  return `
${appbar('예약정보 입력')}
<div class="body scroll"><div class="pad">
  <h2 class="h-md">예약정보를 적어주세요</h2>
  <p class="p-sm mt4">예약에 필요한 정보를 입력해 주세요. 사진은 선택사항이에요.</p>
  <div class="bcard pad mt16">
    <input id="mBookingPhotoInput" type="file" accept="image/*" multiple hidden onchange="handlePhotoFiles(this.files, 'info')">
    <div class="between"><div class="p-sm strong" style="color:var(--gray-700)">사진 ${S.photos} / 3장 <span style="color:var(--gray-400);font-weight:500">· 선택</span></div></div>
    <div class="slots mt10">${slots}</div>
    <button class="btn kkbtn btn-md btnf mt12" onclick="openKakao('guide')">${KK} 잘 모르겠어요 · 카카오톡</button>
  </div>
  <div class="bcard pad mt12">
    <div class="h-sm">연락 받을 정보</div>
    <div class="col gap10 mt12">
      <div class="field"><label>시공 받을 지역</label><button type="button" class="input addr-trigger${S.info.region?'':' empty'}" onclick="openAddrSearchM()"><span class="addr-trigger-txt">${S.info.region||'주소 검색'}</span><i data-lucide="search"></i></button>${S.info.postalCode?`<div class="addr-postal">우편번호 ${S.info.postalCode}</div>`:''}</div>
      ${S.info.region?`<div class="field"><label>상세 주소</label><input class="input addr-detail" autocomplete="off" placeholder="동·호수 (예: 101동 1203호)" value="${S.info.regionDetail}" oninput="S.info.regionDetail=this.value;refreshNext()"></div>`:''}
      <div class="field"><label>성함</label><input class="input" autocomplete="off" placeholder="홍길동" value="${S.info.name}" oninput="setName(this.value)"></div>
      <div class="field"><label>연락 받을 번호</label><input class="input" inputmode="numeric" autocomplete="off" placeholder="010-0000-0000" value="${S.info.phone}" oninput="setPhoneM(this.value)"></div>
    </div>
    <div class="note info mt12"><i data-lucide="map-pin"></i><div><b>예약 가능 지역</b> · 수원 · 성남(분당구) · 용인 · 의왕 · 군포 · 화성(동탄)</div></div>
    <label class="disp-opt mt12"><input type="checkbox" ${S.regionOk?'checked':''} onchange="setRegionOk(this.checked)"><span class="disp-box"></span><span class="disp-txt">우리 집이 예약 가능 지역이 맞나요? <span class="disp-sub">위 지역에 해당해야 예약을 진행할 수 있어요. 맞으면 체크해 주세요.</span></span></label>
    <label class="disp-opt mt12"><input type="checkbox" ${S.specCheck?'checked':''} onchange="setSpec(this.checked)"><span class="disp-box"></span><span class="disp-txt">교체할 제품과 기존 설치되어 있는 제품·규격을 확인하셨나요? <span class="disp-sub">현장 규격과 다르면 설치가 어려울 수 있어요. 확인하셨다면 체크해 주세요.</span></span></label>
    <label class="disp-opt mt12"><input type="checkbox" ${S.privacyOk?'checked':''} onchange="setPrivacy(this.checked)"><span class="disp-box"></span><span class="disp-txt">개인정보 수집·이용에 동의합니다 <a onclick="event.stopPropagation();event.preventDefault();openLegalM()" style="color:var(--brand-600);font-weight:600">(보기)</a> <span class="disp-sub">예약·연락 목적으로 이름·연락처·주소를 수집하며, 목적 달성 후 파기합니다.</span></span></label>
  </div>
</div></div>
<div class="cta-bar"><button id="mNext" class="btn btn-primary btn-xl btnf" aria-disabled="${ok?'false':'true'}" onclick="tryQuoteM()">선택한 제품으로 견적 확인하기</button></div>`;
},

quote: () => `
${appbar('예상 견적')}
<div class="body scroll"><div class="pad">
  <div class="note info"><i data-lucide="shield-check"></i><div><b>예상 금액이에요.</b> 설치 가능 여부와 최종 금액은 사진 확인 후 확정되며, <b>추가 비용은 없어요.</b></div></div>
  <div class="h-md mt16">선택한 제품 ${S.selected.length}개</div>
  <div class="bcard pad mt8">
    ${S.selected.map(id=>{const p=productById(id);return `<div class="between" style="padding:7px 0"><span class="p-sm" style="color:var(--gray-700)">${p.name}</span><span class="strong">${won(p.price)}</span></div>`;}).join('')}
  </div>
  <div class="bcard pad mt12">
    <div class="prow"><span class="pk"><i data-lucide="package" style="width:16px;height:16px"></i> 제품가 합계</span><span class="pv">${won(subtotal())}</span></div>
    <div class="prow"><span class="pk"><i data-lucide="wrench" style="width:16px;height:16px"></i> 시공비</span><span class="pv">${won(laborTotal())}</span></div>
    <div class="prow"><span class="pk"><i data-lucide="trash-2" style="width:16px;height:16px"></i> 폐기비</span><span class="pv${S.selfDisposal?' strike':''}">${won(disposalFee())}</span></div>
    <label class="disp-opt"><input type="checkbox" ${S.selfDisposal?'checked':''} onchange="toggleDisposal()"><span class="disp-box"></span><span class="disp-txt">폐기물은 직접 처리할게요 <span class="disp-sub">직접 처리 시 폐기비 제외</span></span></label>
    <div class="prow tot"><span class="pk">예상 합계</span><span class="pv">${won(total())}<span class="sub" style="font-weight:600"> 원~</span></span></div>
  </div>
</div></div>
<div class="cta-bar"><button class="btn btn-primary btn-xl btnf" onclick="nav('booking')">예약 일정 선택 <i data-lucide="arrow-right"></i></button></div>`,

booking: () => {
  const times = [['오전','오전 · 9시–12시'],['오후','오후 · 1시–4시']];
  const ok = S.date && S.time;
  const minDay = 7, holidays = [6], bookedDays = {10:'오전',18:'오후',24:'오전'};
  let cells = '<div></div>';
  for(let d=1; d<=30; d++){
    const col = d%7, wknd = (col===0?'sun':(col===6?'sat':''));
    const isHol = holidays.includes(d), isPrep = d<minDay, isBooked = d in bookedDays;
    const off = isHol || isPrep || isBooked;
    const cls = `cal-d ${wknd}${off?' dim':''}${S.date===d?' on':''}${isBooked?' booked':''}`;
    cells += `<div class="${cls}"${off?'':` onclick="selectDate(${d})"`}>${d}${isBooked?'<span class="cd-tag">마감</span>':isHol?'<span class="cd-tag">휴무</span>':''}</div>`;
  }
  const hd = ['일','월','화','수','목','금','토'].map((x,i)=>`<div class="cal-hd${i===0?' sun':i===6?' sat':''}">${x}</div>`).join('');
  return `
${appbar('예약 일정')}
<div class="body scroll"><div class="pad">
  <div class="note info"><i data-lucide="info"></i><div>제품 준비기간으로 <b>주문 후 4일 뒤부터</b> 예약할 수 있어요. 희망 일정을 고르면 사진 확인 후 확정해 연락드려요.</div></div>
  <div class="bcard pad mt16">
    <div class="between" style="margin-bottom:12px"><div class="h-md" style="font-size:18px">2026년 6월</div></div>
    <div class="calendar">${hd}${cells}</div>
    <div class="cal-legend"><span><i class="lg-dot sat"></i> 주말</span><span><i class="lg-dot off"></i> 휴무·예약 마감</span></div>
  </div>
  <div class="bcard pad mt12">
    <div class="h-md" style="font-size:18px">시간대</div>
    <div class="chips" style="margin-top:12px">${times.map(t=>`<span class="chip${S.time===t[0]?' on':''}" onclick="selectTime('${t[0]}')">${t[1]}</span>`).join('')}</div>
    <div class="note info mt12"><i data-lucide="info"></i><div>제품 교체 개수나 항목에 따라 시간이 더 걸릴 수 있습니다.</div></div>
  </div>
  <div class="bcard pad mt12"><div class="row gap10"><i data-lucide="map-pin" style="color:var(--gray-400)"></i><div class="grow"><div class="h-sm" style="font-size:14px">${S.info.region}</div><div class="p-sm">상세 주소는 예약 확정 후 입력</div></div></div></div>
</div></div>
<div class="cta-bar"><button class="btn btn-primary btn-xl btnf" aria-disabled="${ok?'false':'true'}" onclick="${ok?"nav('checkout')":''}">${ok?'다음':'날짜·시간을 골라주세요'}</button></div>`;
},

checkout: () => `
${appbar('접수 확인')}
<div class="body scroll"><div class="pad">
  <div class="bcard pad"><div class="h-sm">신청 내용</div>
    <div class="col gap8 mt10">
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">품목</span><span class="strong">${S.item}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">제품</span><span class="strong">${S.selected.length}개 선택</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">예약자</span><span class="strong">${S.info.name||'-'}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">희망 예약</span><span class="strong">${S.date?dateLabel():'-'} · ${S.time||'-'}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">사진</span><span class="strong">${S.photos>0?(S.photos+'장 첨부됨'):'미첨부 (선택)'}</span></div>
    </div>
  </div>
  <div class="bcard pad mt12">
    <div class="prow" style="padding:7px 0"><span class="pk"><i data-lucide="package" style="width:15px;height:15px"></i> 제품비</span><span class="pv">${won(subtotal())}</span></div>
    <div class="prow" style="padding:7px 0"><span class="pk"><i data-lucide="wrench" style="width:15px;height:15px"></i> 시공비</span><span class="pv">${won(laborTotal())}</span></div>
    <div class="prow" style="padding:7px 0"><span class="pk"><i data-lucide="trash-2" style="width:15px;height:15px"></i> 폐기물처리비${S.selfDisposal?' <span style="color:var(--gray-400)">(직접 처리)</span>':''}</span><span class="pv${S.selfDisposal?' strike':''}">${won(disposalFee())}</span></div>
    <div class="prow tot"><span class="pk">최종 합계</span><span class="pv">${won(total())}<span class="sub" style="font-weight:600"> 원</span></span></div>
  </div>
  <div class="note info mt12"><i data-lucide="shield-check"></i><div><b>추가 비용은 없어요.</b> 출장비도 받지 않아요. 사진과 현장이 같다면 위 금액 그대로 진행됩니다.</div></div>
  ${S.submitErr?`<div class="note mt12" style="background:#FDECEC;color:#B42318;display:flex;gap:9px;padding:12px 14px;border-radius:12px;font-size:12.5px"><i data-lucide="alert-circle" style="width:17px;height:17px;flex:none"></i><div>${esc(S.submitErr)}</div></div>`:''}
  <button class="btn btn-secondary btn-lg btnf mt12" onclick="openFinalEstimateM()"><i data-lucide="file-text"></i> 최종 견적서 보기</button>
</div></div>
<div class="cta-bar"><button class="btn btn-primary btn-xl btnf" aria-disabled="${S.submitting?'true':'false'}" onclick="submitIntake()">${S.submitting?'접수 저장 중...':'주문 접수하기'}</button></div>`,

done: () => {
  const payAmount = paymentAmountM();
  const statusLabel = paymentStatusLabelM();
  const hasTransfer = Boolean(S.remoteOrder?.transferUrl && payAmount > 0);
  const bank = localBankTransferConfigM();
  const transferData = transferGuideDataM();
  return `
<div class="appbar bordered"><span class="title" style="padding-left:8px">접수 완료</span><span class="spacer"></span>${menu_btn}</div>
<div class="body scroll"><div class="pad" style="text-align:center;padding-top:24px">
  <div class="featured-icon circle" style="width:72px;height:72px;background:var(--success-50);color:var(--success-600);margin:0 auto"><i data-lucide="check" style="width:36px;height:36px"></i></div>
  <h2 class="h-lg mt16">신청이 접수됐어요</h2>
  <p class="p-md mt4">사진 확인 후 최종 견적을 안내드려요. 매니저가 영업시간 기준 30분 내 안내드려요.</p>
  <div class="bcard pad mt20" style="text-align:left">
    <div class="between"><div class="p-sm strong" style="color:var(--gray-700)">접수번호</div><div class="p-sm strong" style="color:var(--gray-900)">${mOrderNo()}</div></div>
    <div class="between mt8"><div class="p-sm strong" style="color:var(--gray-700)">현재 상태</div><span class="badge badge-warning dot">${statusLabel}</span></div>
    ${payAmount>0?`<div class="between mt8"><div class="p-sm strong" style="color:var(--gray-700)">입금 금액</div><div class="p-sm strong" style="color:var(--gray-900)">${won(payAmount)}원</div></div>`:''}
    <div class="divline" style="margin:12px 0"></div>
    <div class="row gap10"><span class="tile" style="width:38px;height:38px"><i data-lucide="droplet" style="width:20px;height:20px"></i></span><div class="grow" style="text-align:left"><div class="h-sm" style="font-size:14px">${S.item} · ${S.selected.length}개</div><div class="p-sm">${S.info.region} · ${statusLabel}</div></div></div>
    ${hasTransfer?`
    <div class="divline" style="margin:14px 0"></div>
    <div class="row gap10"><span class="tile" style="width:38px;height:38px;background:var(--brand-50);color:var(--brand-600)"><i data-lucide="wallet" style="width:20px;height:20px"></i></span><div class="grow" style="text-align:left"><div class="h-sm" style="font-size:14px">계좌이체 안내</div><div class="p-sm">제품 금액 입금 확인 후 주문이 진행돼요.</div></div></div>
    <div class="col gap8 mt12">
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">예금주</span><span class="strong">${esc(bank.accountHolder)}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">입금 계좌</span><span class="strong">${esc(bank.bankName)} ${esc(bank.bankAccount)}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">입금자명</span><span class="strong">${esc(transferData.payerName)}</span></div>
    </div>
    <div class="note info mt12"><i data-lucide="info"></i><div>입금 확인은 영업시간 기준으로 순차 반영됩니다. 시공비와 최종 금액은 사진 확인 후 확정돼요.</div></div>`:''}
  </div>
  <button class="btn btn-secondary btn-lg btnf mt16" onclick="openFinalEstimateM()"><i data-lucide="file-text"></i> 최종 견적서 보기</button>
  <div class="kakao mt12" style="text-align:left;cursor:pointer" onclick="openKakao('guide')" role="button" tabindex="0"><span class="kk-ic"><i data-lucide="message-circle" style="width:20px;height:20px"></i></span><div class="grow"><div class="kk-t">카카오톡으로 결과 알림 받기</div><div class="kk-d">추가 질문도 톡으로 편하게</div></div><i data-lucide="chevron-right" style="color:#3C1E1E"></i></div>
</div></div>
<div class="cta-bar"><button class="btn ${hasTransfer?'btn-secondary':'btn-primary'} btn-xl btnf" onclick="nav('orderview')">주문 현황 보기</button><button class="btn btn-tertiary btn-lg btnf mt8" onclick="goHome()">홈으로</button></div>`;
},

orders: () => `
<div class="appbar"><span class="title" style="font-size:20px;font-weight:700;padding-left:8px">주문 조회</span><span class="spacer"></span><button class="iconbtn" onclick="openKakao()"><i data-lucide="message-circle"></i></button>${menu_btn}</div>
<div class="body scroll"><div class="pad">
  <p class="p-sm">주문번호와 예약자 성함을 입력하면 주문 내용을 확인할 수 있어요.</p>
  <div class="bcard pad mt14">
    <div class="field"><label>주문번호</label><input class="input" placeholder="BC-000000-000" value="${S.lookupNo||''}" oninput="S.lookupNo=this.value"></div>
    <div class="field mt12"><label>예약자 성함</label><input class="input" placeholder="홍길동" value="${S.lookupName||''}" oninput="S.lookupName=this.value"></div>
    ${S.lookupErr?`<div class="note mt12" style="background:#FDECEC;color:#B42318;display:flex;gap:9px;padding:12px 14px;border-radius:12px;font-size:12.5px"><i data-lucide="alert-circle" style="width:17px;height:17px;flex:none"></i><div>입력하신 정보와 일치하는 주문을 찾을 수 없어요. 주문번호와 성함을 다시 확인해 주세요.</div></div>`:''}
    <button class="btn btn-primary btn-lg btnf mt14" aria-disabled="${S.lookupLoading?'true':'false'}" onclick="lookupOrderM()">${S.lookupLoading?'조회 중...':'주문 조회하기'}</button>
  </div>
</div></div>
<div class="tabbar"><a onclick="goHome()"><i data-lucide="home"></i>홈</a><a class="on"><i data-lucide="clipboard-list"></i>주문조회</a><a onclick="openKakao()"><i data-lucide="message-circle"></i>상담</a><a><i data-lucide="user"></i>내정보</a></div>`,

orderview: () => {
  const remote = S.remoteOrder;
  const addr=remote ? ((remote.roadAddress||'')+(remote.detailAddress?' '+remote.detailAddress:'')) : (S.info.region||'')+(S.info.regionDetail?' '+S.info.regionDetail:'');
  const remoteDate = remote?.reservation?.date ? String(remote.reservation.date).replace(/^2026-06-/,'6월 ') + '일' : '';
  const dateTxt=remoteDate ? `${remoteDate}${remote?.reservation?.time?' · '+remote.reservation.time:''}` : (S.date?`${dateLabel()}${S.time?' · '+S.time:''}`:'사진 확인 후 협의');
  const remoteRows = Array.isArray(remote?.selected) ? remote.selected : [];
  const hasProducts=remoteRows.length>0 || S.selected.length>0;
  const statusLabel = paymentStatusLabelM();
  const productAmount = remote?.totals ? Number(remote.totals.productAmount||0) : subtotal();
  const serviceAmount = remote?.totals ? Number(remote.totals.onsitePaymentAmount||remote.totals.laborAmount||0) : laborTotal();
  const disposalAmount = remote?.totals ? 0 : disposalFee();
  const totalAmount = remote?.totals ? Number(remote.totals.totalAmount||productAmount+serviceAmount) : total();
  const rows=remoteRows.length ? remoteRows.map(p=>{
    return `<div style="display:flex;align-items:center;gap:12px"><span style="width:46px;height:46px;border-radius:11px;background:var(--gray-100);overflow:hidden;flex:none;display:grid;place-items:center"><i data-lucide="package" style="width:21px;height:21px;color:var(--gray-400)"></i></span><div style="flex:1;min-width:0"><div class="strong" style="font-size:13.5px">${p.name||p.model||'-'}</div><div class="p-sm" style="color:var(--gray-500);margin-top:1px">${p.categoryName||p.serviceCode||''} · ${p.qty||1}개</div></div><div class="strong" style="white-space:nowrap">${won((p.price||0)*(p.qty||1))}<small style="color:var(--gray-400);font-weight:600"> 원</small></div></div>`;
  }).join('') : S.selected.map(id=>{const p=productById(id);const cat=catalogCatOf(id);const im=ITEM_IMG[cat];
    return `<div style="display:flex;align-items:center;gap:12px"><span style="width:46px;height:46px;border-radius:11px;background:var(--gray-100);overflow:hidden;flex:none;display:grid;place-items:center">${im?`<img src="${im}" alt="" style="width:100%;height:100%;object-fit:cover">`:''}</span><div style="flex:1;min-width:0"><div class="strong" style="font-size:13.5px">${p.brand} ${p.name}</div><div class="p-sm" style="color:var(--gray-500);margin-top:1px">${cat.replace(/\s*교체$/,'')} · 1개</div></div><div class="strong" style="white-space:nowrap">${won(p.price)}<small style="color:var(--gray-400);font-weight:600"> 원</small></div></div>`;}).join('');
  return `
${appbar('주문 확인')}
<div class="body scroll"><div class="pad">
  <div class="bcard pad"><div class="between"><span class="badge badge-warning dot">${statusLabel}</span><span class="p-sm strong" style="color:var(--gray-600)">${remote?.orderNumber || S.orderNo}</span></div>
    <div class="atl mt16">
      <div class="atl-row done"><span class="atl-node"><i data-lucide="check"></i></span><div><div class="tlt">사진 확인 신청</div><div class="tld">방금 · 접수 완료</div></div></div>
      ${remote?.payment?.status==='pending'?`<div class="atl-row now"><span class="atl-node"></span><div><div class="tlt">제품 입금 대기</div><div class="tld">${won(paymentAmountM())}원 · 계좌이체 대기</div></div></div>`:`<div class="atl-row now"><span class="atl-node"></span><div><div class="tlt">매니저 확인 중</div><div class="tld">가능 여부·정찰가 확인</div></div></div>`}
      <div class="atl-row todo"><span class="atl-node"></span><div><div class="tlt">견적·예약 확정</div><div class="tld">동의 후 진행</div></div></div>
      <div class="atl-row todo"><span class="atl-node"></span><div><div class="tlt">방문 교체</div><div class="tld">희망 일정 기준</div></div></div>
      <div class="atl-row todo"><span class="atl-node"></span><div><div class="tlt">완료 · 보증 시작</div><div class="tld">완료 리포트 · A/S</div></div></div>
    </div>
  </div>
  <div class="bcard pad mt12">
    <div class="h-sm">예약 정보</div>
    <div class="col gap8 mt10">
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">예약자</span><span class="strong">${remote?.customerName||S.info.name||'-'}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">연락처</span><span class="strong">${remote?.phone||S.info.phone||'-'}</span></div>
      <div class="between" style="align-items:flex-start"><span class="p-sm" style="color:var(--gray-600)">시공 주소</span><span class="strong" style="text-align:right;max-width:62%">${addr||'-'}</span></div>
      <div class="between"><span class="p-sm" style="color:var(--gray-600)">예약 일시</span><span class="strong">${dateTxt}</span></div>
    </div>
    ${hasProducts?`
    <div class="divline" style="margin:14px 0"></div>
    <div class="h-sm">선택 제품 <span class="p-sm" style="color:var(--gray-400);font-weight:500">${S.selected.length}개</span></div>
    <div class="col gap12 mt12">${rows}</div>
    <div class="divline" style="margin:14px 0"></div>
    <div class="prow" style="padding:6px 0"><span class="pk"><i data-lucide="package" style="width:15px;height:15px"></i> 제품비</span><span class="pv">${won(productAmount)}</span></div>
    <div class="prow" style="padding:6px 0"><span class="pk"><i data-lucide="wrench" style="width:15px;height:15px"></i> 시공·현장 결제 예정</span><span class="pv">${won(serviceAmount)}</span></div>
    ${disposalAmount>0?`<div class="prow" style="padding:6px 0"><span class="pk"><i data-lucide="trash-2" style="width:15px;height:15px"></i> 폐기물처리비</span><span class="pv${S.selfDisposal?' strike':''}">${won(disposalAmount)}</span></div>`:''}
    <div class="prow tot"><span class="pk">예상 합계</span><span class="pv">${won(totalAmount)}<span class="sub" style="font-weight:600"> 원</span></span></div>`:`
    <div class="divline" style="margin:14px 0"></div>
    <div class="note info"><i data-lucide="info"></i><div>사진 호환제품 문의 접수예요. 매니저가 사진을 확인해 호환 제품과 견적을 안내드려요.</div></div>`}
  </div>
  ${hasProducts?`<button class="btn btn-secondary btn-lg btnf mt12" onclick="openFinalEstimateM()"><i data-lucide="file-text"></i> 최종 견적서 보기</button>`:''}
  <button class="btn btn-secondary btn-lg btnf mt8" onclick="openTransferM()"><i data-lucide="wallet"></i> 계좌이체 안내</button>
  <div class="row gap8 mt8"><button class="btn btn-secondary btn-lg grow" onclick="openKakao('rebook')"><i data-lucide="calendar"></i> 예약 변경</button><button class="btn btn-secondary btn-lg grow" onclick="nav('as')"><i data-lucide="headphones"></i> A/S 접수</button></div>
</div></div>`;
},

as: () => `
${appbar('A/S 접수')}
<div class="body scroll"><div class="pad">
  <div class="bcard pad"><div class="row gap12"><span class="tile" style="background:var(--gray-100);color:var(--gray-500)"><i data-lucide="droplet"></i></span><div class="grow"><div class="h-sm" style="font-size:14px">${S.item}</div><div class="p-sm">BC-240602-118</div></div></div></div>
  <span class="flabel mt20">어떤 문제인가요?</span>
  <div class="chips"><span class="chip on">물 샘</span><span class="chip">고정 불량</span><span class="chip">작동 불량</span><span class="chip">기타</span></div>
  <span class="flabel mt20">증상 사진 (선택)</span>
  <div class="slots"><div class="slot" onclick="addPhoto()"><i data-lucide="plus" class="sl-ic"></i><span class="sl-t">추가</span></div><div class="slot" style="visibility:hidden"></div><div class="slot" style="visibility:hidden"></div></div>
  <div class="field mt20"><label>내용</label><input class="input" placeholder="증상을 적어주세요"></div>
  <div class="note info mt16"><i data-lucide="shield-check"></i><div>시공 하자·고정 불량·누수는 <b>보증 범위</b>예요. 빠르게 확인해 드릴게요.</div></div>
</div></div>
<div class="cta-bar"><button class="btn btn-primary btn-xl btnf" onclick="submitAS()">A/S 접수하기</button></div>`,

};

/* boot */
mWireBrowserRouter();
render(mScreenFromPath(mRouterPath()));
