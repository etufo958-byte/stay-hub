# stay-hub

숙소 쇼츠용 링크 허브(채널 "오늘은 여기서" @oneul.yeogiseo). 상단 제목은 "오늘은 여기서", 안내 문구는 영상 CTA "프로필 링크에서 001 검색"과 맞춘다. `entries/` 또는 `media/`를 push하면 GitHub Actions가 빌드해 GitHub Pages에 배포한다. 비밀값 없음.

- 허브: https://etufo958-byte.github.io/stay-hub/
- 직링크: https://etufo958-byte.github.io/stay-hub/go/001/

## 엔트리 형식 (`entries/001.json`)

```json
{"no":"001","alias":"노을수영장숙소","region":"남해안","deeplink":"https://link.coupang.com/a/...","image":"001.jpg"}
```

- 화면에 나가는 필드는 `no`, `alias`, `region`, `deeplink`, `image` 다섯 개뿐이다. `name` 등 다른 필드는 있어도 출력하지 않는다.
- `deeplink`가 비었거나 `TODO`면 목록·직링크 모두 만들지 않는다. 쿠팡 도메인(https)만 허용.
- `region`은 광역·권역만(예: 남해안, 제주, 강원). `통영시`처럼 시·군·구로 끝나면 그 엔트리는 빠진다.
- 이미지는 `media/`에 같은 파일명으로. 없으면 빈 칸으로 표시한다.
- 빠진 엔트리와 이유는 Actions 로그의 `node build.js` 단계에 나온다.

## 영상 PC에서 엔트리 추가

`entries/003.json`, `media/003.jpg`를 저장소 폴더에 넣은 뒤:

```
git pull --rebase
git add entries media
git commit -m "add 003" && git push
```

## 로컬 확인

```
node --test test/build.test.js
node build.js
```

## 설정

- GA4: `config.json`의 `ga4MeasurementId`에 `G-XXXXXXX`를 넣으면 켜진다(기본 꺼짐). 버튼 클릭은 `deeplink_click` 이벤트로 보낸다. 편별 클릭·수익은 쿠팡 파트너스 리포트로 본다.
- 개인 도메인: Settings → Pages → Custom domain에 도메인을 입력하고, DNS에 CNAME `etufo958-byte.github.io`를 추가한다(Actions 배포라 CNAME 파일은 필요 없음).
