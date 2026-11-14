'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('../build.js');

function fixture(entries, media = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stayhub-'));
  fs.mkdirSync(path.join(root, 'entries')); fs.mkdirSync(path.join(root, 'media'));
  for (const [f, e] of Object.entries(entries)) fs.writeFileSync(path.join(root, 'entries', f), typeof e === 'string' ? e : JSON.stringify(e));
  for (const m of media) fs.writeFileSync(path.join(root, 'media', m), 'x');
  return root;
}
const L = 'https://link.coupang.com/a/abc';

test('TODO·빈 deeplink는 목록과 /go/에 없다', () => {
  const root = fixture({ '001.json': { no: '001', alias: 'A숙소', region: '남해안', deeplink: L, image: '001.jpg' }, '002.json': { no: '002', alias: 'B숙소', region: '제주', deeplink: 'TODO' }, '003.json': { no: '003', alias: 'C숙소', region: '제주', deeplink: '' } }, ['001.jpg']);
  const r = build(root);
  assert.deepStrictEqual(r.entries.map((e) => e.no), ['001']);
  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  assert.ok(html.includes('[001] A숙소')); assert.ok(!html.includes('B숙소')); assert.ok(!html.includes('C숙소'));
  assert.ok(fs.existsSync(path.join(root, 'dist/go/001/index.html')));
  assert.ok(!fs.existsSync(path.join(root, 'dist/go/002')));
});

test('name 등 허용 외 필드는 출력하지 않는다', () => {
  const root = fixture({ '001.json': { no: '001', alias: 'A숙소', region: '남해안', deeplink: L, name: '비밀호텔이름', city: '통영시' } });
  build(root);
  for (const f of ['dist/index.html', 'dist/go/001/index.html']) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(!html.includes('비밀호텔이름')); assert.ok(!html.includes('통영시'));
  }
});

test('시·군·구 단위 region과 허용 외 도메인은 제외', () => {
  const root = fixture({ '001.json': { no: '001', alias: 'A', region: '통영시', deeplink: L }, '002.json': { no: '002', alias: 'B', region: '부산광역시', deeplink: L }, '003.json': { no: '003', alias: 'C', region: '제주', deeplink: 'https://evil.example/x' }, '004.json': { no: '004', alias: 'D', region: '제주', deeplink: 'javascript:alert(1)' } });
  const r = build(root);
  assert.deepStrictEqual(r.entries.map((e) => e.no), ['002']);
});

test('최신 번호가 위, 버튼 속성, 상대 경로, 외부 폰트 없음', () => {
  const root = fixture({ 'a.json': { no: '009', alias: 'A', region: '강원', deeplink: L }, 'b.json': { no: '010', alias: 'B', region: '강원', deeplink: L }, 'c.json': { no: '1000', alias: 'C', region: '강원', deeplink: L } });
  build(root);
  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  assert.ok(html.indexOf('[1000]') < html.indexOf('[010]') && html.indexOf('[010]') < html.indexOf('[009]'));
  assert.ok(html.includes('target="_blank" rel="sponsored nofollow noopener"'));
  assert.ok(html.includes('쿠팡 파트너스 활동의 일환으로 일정 수수료를 제공받습니다'));
  assert.ok(!/fonts\.googleapis|@font-face/.test(html));
  assert.ok(!/(src|href)="\//.test(html), '루트 절대 경로 금지');
  assert.ok(!html.includes('googletagmanager'), 'GA4 기본 꺼짐');
  const go = fs.readFileSync(path.join(root, 'dist/go/010/index.html'), 'utf8');
  assert.ok(go.includes('http-equiv="refresh"') && go.includes('href="../../"'));
  // 이동 스크립트는 안내·수동 링크가 그려진 뒤(본문 끝)에 있어야 느린 인앱 브라우저에서 흰 화면이 아니다
  assert.ok(go.indexOf('location.replace') > go.indexOf('class="btn"'));
});

test('같은 입력이면 같은 출력', () => {
  const root = fixture({ '001.json': { no: '001', alias: 'A', region: '강원', deeplink: L } });
  build(root); const a = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  build(root); const b = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  assert.strictEqual(a, b);
});

test('GA4 ID를 넣으면 켜진다', () => {
  const root = fixture({ '001.json': { no: '001', alias: 'A', region: '강원', deeplink: L } });
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ ga4MeasurementId: 'G-TEST1234' }));
  build(root);
  assert.ok(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8').includes('gtag/js?id=G-TEST1234'));
});

test('상단 제목은 채널 이름 "오늘은 여기서", 안내는 영상 CTA(프로필 링크에서 번호 검색)와 맞춘다', () => {
  const root = fixture({ '001.json': { no: '001', alias: 'A숙소', region: '남해안', deeplink: L } });
  build(root);
  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  assert.ok(html.includes('<title>오늘은 여기서</title>'));
  assert.ok(html.includes('<h1>오늘은 여기서</h1>'));
  assert.ok(html.includes('번호(예: 001)를 검색하세요'));
  assert.ok(html.indexOf('class="disc"') < html.indexOf('<h1>'), '광고 고지가 제목보다 먼저');
});
