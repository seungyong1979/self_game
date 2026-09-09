# 새 게임 추가 방법

## 1. 저장 위치 정하기

작은 게임은 루트에 하나의 HTML 파일로 추가할 수 있습니다.

```text
my_game.html
```

이미지, 음원, CSS, JavaScript 파일이 여러 개라면 게임별 폴더를 만듭니다.

```text
my_game/
├── index.html
├── css/style.css
├── js/game.js
└── assets/
    ├── img/
    └── sound/
```

폴더와 파일 이름은 영문 소문자와 밑줄을 사용하고 공백은 피합니다.

## 2. 공통 게임 UI 연결하기

루트에 있는 단일 HTML 게임은 `<head>` 안에 다음 코드를 추가합니다.

```html
<link rel="stylesheet" href="shared/game-shell.css">
<script defer src="shared/game-shell.js"></script>
```

`<body>`에는 메인 화면 경로를 지정합니다.

```html
<body data-home-href="index.html">
```

게임 폴더 안의 `index.html`에서는 한 단계 위 경로를 사용합니다.

```html
<link rel="stylesheet" href="../shared/game-shell.css">
<script defer src="../shared/game-shell.js"></script>
<body data-home-href="../index.html">
```

키보드 전용 게임에 모바일 방향키와 동작 버튼이 필요하면 다음 속성을 추가합니다.

```html
<body data-home-href="../index.html" data-mobile-controls="dpad-action">
```

공통 음소거 버튼을 사용할 경우 `data-audio-toggle`을 추가하고, 효과음을 내기 전에 다음 상태를 확인합니다.

```js
if (document.documentElement.dataset.soundMuted === 'true') return;
```

## 3. 메인 화면에 게임 카드 추가하기

루트 `index.html`의 `#gameGrid` 안에 기존 카드 하나를 복사한 뒤 아래 항목을 변경합니다.

- `href`: 게임 시작 파일
- `data-theme`: 카드 색상
- `data-tags`: 필터에 사용할 영문 태그
- `data-author`: `yuha`, `riha`, `bada` 중 하나
- 게임 제목, 설명, 태그, 제작자 문구

새 카드를 추가한 뒤 `#visibleCount`의 전체 게임 수도 함께 변경합니다.

## 4. 모바일과 접근성 확인하기

- 뷰포트에서 `user-scalable=no`를 사용하지 않습니다.
- 클릭 동작은 가능하면 `<div>` 대신 `<button type="button">`을 사용합니다.
- 이미지는 내용이 보이도록 `alt`를 작성합니다. 장식 이미지는 `alt=""`로 둡니다.
- 아이콘만 있는 버튼에는 `aria-label`을 작성합니다.
- 키보드의 Tab, Enter, Space로 시작·재시작·설정 버튼을 사용할 수 있어야 합니다.
- 터치 대상은 가급적 가로·세로 44px 이상으로 만듭니다.
- 방향키와 스페이스를 처리할 때 페이지 스크롤을 막되, 게임에 필요한 키만 제한합니다.

## 5. 오디오 확인하기

- 오디오는 사용자가 시작 버튼이나 화면을 누른 뒤 재생합니다.
- 음소거 버튼을 제공하고 상태를 화면과 `aria-pressed`에 함께 반영합니다.
- 탭이 백그라운드로 갔을 때 긴 배경음이 계속 재생되지 않는지 확인합니다.
- 같은 배경음이 중복 실행되지 않도록 타이머와 재생 상태를 관리합니다.

## 6. 이미지 최적화하기

- 사진과 큰 배경 이미지는 WebP를 우선 사용합니다.
- 투명 배경이 필요한 작은 UI 이미지는 원본과 WebP 결과를 비교합니다.
- 변환 후 HTML, CSS, JavaScript 안의 파일 확장자도 `.webp`로 바꿉니다.
- 브라우저 개발자 도구에서 404 오류와 깨진 이미지를 확인합니다.

## 7. 완료 전 테스트

1. 메인 화면에서 새 카드가 나타나는지 확인합니다.
2. 제작자·장르 필터가 올바르게 동작하는지 확인합니다.
3. 게임 시작, 핵심 조작, 게임 오버, 재시작을 확인합니다.
4. 모바일 세로·가로 화면을 확인합니다.
5. 홈 버튼과 음소거 버튼을 확인합니다.
6. GitHub Desktop에서 변경 파일을 검토한 후 의미가 드러나는 메시지로 커밋합니다.
