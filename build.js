#!/usr/bin/env node
// stay-hub 정적 빌드: entries/*.json + media/ → dist/
// 의존성 없음. 같은 입력이면 같은 출력(시각·난수 없음).
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const DISCLOSURE = '쿠팡 파트너스 활동의 일환으로 일정 수수료를 제공받습니다';

// 렌더하는 필드는 이 다섯 개뿐이다. name 등 다른 필드는 읽지도 출력하지도 않는다.
const ALLOWED_DEEPLINK_HOSTS = ['link.coupang.com', 'www.coupang.com', 'coupang.com'];
const IMAGE_RE = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i;
const NO_RE = /^\d{3,}$/;
// 지역은 광역·권역만. 시·군·구·읍·면·동으로 끝나면 세부 지역으로 보고 거절한다(광역시·특별시·도는 허용).
const REGION_DETAIL_RE = /(?<!광역|특별|특별자치)(시|군|구|읍|면|동|리)$/;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function loadConfig(root) {
  const f = path.join(root, 'config.json');
  const c = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const ga = typeof c.ga4MeasurementId === 'string' ? c.ga4MeasurementId.trim() : '';
  if (ga && !/^G-[A-Z0-9]{4,}$/.test(ga)) throw new Error(`config.json ga4MeasurementId 형식 오류: ${ga}`);
  return { ga4MeasurementId: ga };
}

// 엔트리 하나를 검사한다. 렌더할 수 없으면 { skip: 이유 }.
function normalizeEntry(raw, file, mediaDir) {
  if (!raw || typeof raw !== 'object') return { skip: 'JSON 객체가 아님' };
  const no = String(raw.no ?? '').trim();
  const alias = String(raw.alias ?? '').trim();
  const region = String(raw.region ?? '').trim();
  const deeplink = String(raw.deeplink ?? '').trim();
  const image = String(raw.image ?? '').trim();
  if (!NO_RE.test(no)) return { skip: `no 형식 오류(${no})` };
  if (!deeplink || /^todo$/i.test(deeplink)) return { skip: 'deeplink 비어 있음/TODO' };
  let u;
  try { u = new URL(deeplink); } catch { return { skip: 'deeplink URL 아님' }; }
  if (u.protocol !== 'https:' || !ALLOWED_DEEPLINK_HOSTS.includes(u.hostname)) return { skip: `deeplink 허용 도메인 아님(${u.hostname})` };
  if (!alias) return { skip: 'alias 비어 있음' };
  if (!region) return { skip: 'region 비어 있음' };
  if (REGION_DETAIL_RE.test(region)) return { skip: `region이 시·군·구 단위로 보임(${region})` };
  let img = null;
  if (image) {
    if (!IMAGE_RE.test(image)) return { skip: `image 파일명 오류(${image})` };
    if (fs.existsSync(path.join(mediaDir, image))) img = image;
    else console.warn(`  경고 ${file}: media/${image} 없음 - 이미지 없이 렌더`);
  }
  return { entry: { no, alias, region, deeplink: u.href, image: img } };
}

function loadEntries(root) {
  const dir = path.join(root, 'entries');
  const mediaDir = path.join(root, 'media');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  const entries = []; const skipped = []; const seen = new Set();
  for (const f of files) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '')); } catch (e) { skipped.push({ file: f, reason: `JSON 파싱 실패: ${e.message}` }); continue; }
    const r = normalizeEntry(raw, f, mediaDir);
    if (r.skip) { skipped.push({ file: f, reason: r.skip }); continue; }
    if (seen.has(r.entry.no)) { skipped.push({ file: f, reason: `no 중복(${r.entry.no})` }); continue; }
    seen.add(r.entry.no); entries.push(r.entry);
  }
  // 최신 번호가 위
  entries.sort((a, b) => (b.no.length - a.no.length) || (b.no < a.no ? -1 : b.no > a.no ? 1 : 0));
  return { entries, skipped };
}

const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#f4f4f5;color:#18181b}
.top{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid #e4e4e7}
.disc{margin:0;padding:6px 12px;font-size:12px;line-height:1.4;background:#18181b;color:#fff;text-align:center}
.sw{padding:8px 12px}.sw input{width:100%;font-size:16px;padding:10px 12px;border:1px solid #d4d4d8;border-radius:10px;background:#fafafa;outline:none}.sw input:focus{border-color:#2563eb;background:#fff}
main{max-width:520px;margin:0 auto;padding:12px}.card{background:#fff;border-radius:14px;overflow:hidden;margin:0 0 14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ph{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#e4e4e7}.body{padding:12px 14px 14px}
h2{margin:0;font-size:17px;line-height:1.35}.rg{margin:4px 0 12px;font-size:13px;color:#71717a}
.btn{display:block;text-align:center;padding:13px;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;text-decoration:none;font-size:15px}
.empty{text-align:center;color:#71717a;padding:40px 0;font-size:14px}[hidden]{display:none!important}`;

function gaSnippet(id) {
  if (!id) return '';
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(id)}');</script>`;
}

function renderIndex(entries, cfg) {
  const cards = entries.map((e, i) => {
    const title = `[${e.no}] ${e.alias}`;
    const img = e.image
      ? `<img class="ph" src="media/${esc(e.image)}" alt="${esc(title)}" width="520" height="390" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
      : '<div class="ph" role="img" aria-label="이미지 준비 중"></div>';
    return `<article class="card" data-no="${esc(e.no)}" data-k="${esc((e.no + ' ' + e.alias).toLowerCase().replace(/\s+/g, ''))}">${img}<div class="body"><h2>${esc(title)}</h2><p class="rg">${esc(e.region)}</p><a class="btn" href="${esc(e.deeplink)}" target="_blank" rel="sponsored nofollow noopener" data-no="${esc(e.no)}">예약 확인하기</a></div></article>`;
  }).join('\n');
  const js = `(function(){var q=document.getElementById('q'),cs=[].slice.call(document.querySelectorAll('.card')),em=document.getElementById('empty');
function f(){var v=q.value.toLowerCase().replace(/\\s+/g,''),n=0;var d=/^\\d+$/.test(v)?String(parseInt(v,10)):null;
cs.forEach(function(c){var ok=!v||c.getAttribute('data-k').indexOf(v)>-1||(d!==null&&String(parseInt(c.getAttribute('data-no'),10))===d);c.hidden=!ok;if(ok)n++});em.hidden=n>0}
q.addEventListener('input',f);q.addEventListener('compositionend',f);
var h=location.hash.slice(1);if(h){q.value=decodeURIComponent(h);f()}
${cfg.ga4MeasurementId ? "document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a.btn');if(a&&window.gtag)gtag('event','deeplink_click',{entry_no:a.getAttribute('data-no'),transport_type:'beacon'})});" : ''}})();`;
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>숙소 링크 모음</title><meta name="description" content="영상에 나온 숙소 예약 링크 모음"><style>${CSS}</style>${gaSnippet(cfg.ga4MeasurementId)}</head>
<body><header class="top"><p class="disc">${DISCLOSURE}</p><div class="sw"><input id="q" type="search" inputmode="search" placeholder="번호(001) 또는 이름으로 찾기" aria-label="숙소 검색" autocomplete="off"></div></header>
<main>${cards}
<p id="empty" class="empty"${entries.length ? ' hidden' : ''}>찾는 숙소가 없습니다. 번호를 다시 확인해 주세요.</p></main>
<script>${js}</script></body></html>
`;
}

function renderGo(e) {
  const href = esc(e.deeplink);
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="referrer" content="no-referrer-when-downgrade"><title>[${esc(e.no)}] ${esc(e.alias)}</title><meta http-equiv="refresh" content="0;url=${href}"><style>${CSS}</style></head>
<body><header class="top"><p class="disc">${DISCLOSURE}</p></header><main><div class="card"><div class="body"><h2>[${esc(e.no)}] ${esc(e.alias)}</h2><p class="rg">예약 페이지로 이동하고 있습니다.</p><a class="btn" href="${href}" rel="sponsored nofollow noopener">이동하지 않으면 여기를 누르세요</a><p class="rg" style="margin-top:12px;text-align:center"><a href="../../">숙소 목록 보기</a></p></div></div></main><script>location.replace(${JSON.stringify(e.deeplink).replace(/</g, '\\u003c')})</script></body></html>
`;
}

function build(root = ROOT, out = path.join(root, 'dist')) {
  const cfg = loadConfig(root);
  const { entries, skipped } = loadEntries(root);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'media'), { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), renderIndex(entries, cfg));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  for (const e of entries) {
    if (e.image) fs.copyFileSync(path.join(root, 'media', e.image), path.join(out, 'media', e.image));
    fs.mkdirSync(path.join(out, 'go', e.no), { recursive: true });
    fs.writeFileSync(path.join(out, 'go', e.no, 'index.html'), renderGo(e));
  }
  return { entries, skipped };
}

if (require.main === module) {
  const { entries, skipped } = build();
  console.log(`렌더 ${entries.length}건: ${entries.map((e) => e.no).join(', ') || '-'}`);
  for (const s of skipped) console.log(`  제외 ${s.file}: ${s.reason}`);
}

module.exports = { build, normalizeEntry, loadEntries, renderIndex, renderGo, DISCLOSURE };
