# 🎮 우리들의 게임 세상

유화, 리하, 아빠(바다)가 함께 만든 브라우저 게임 모음입니다. 별도의 설치나 빌드 없이 최신 브라우저에서 바로 실행되는 HTML/CSS/JavaScript 정적 사이트입니다.

배포 사이트: https://self-game.onrender.com/index.html

## 게임 목록

| 제작자 | 게임 | 시작 파일 | 주요 조작 |
| --- | --- | --- | --- |
| 유화 | 나 잡아 봐라! 메~롱~ | `99days_survival_v16.html` | 방향키/WASD, 스페이스, 모바일 버튼 |
| 리하 | 낚시 게임 | `fishing_game_full.html` | 방향키, 스페이스, 모바일 버튼 |
| 리하 | 햄버거를 피해라! 1 | `hamburger_full_game.html` | 좌우 방향키, 모바일 버튼 |
| 리하 | 햄버거를 피해라! 2 | `hamburger_game_human_faststage.html` | 좌우 방향키, 모바일 버튼 |
| 유화 | 토끼를 잡아서 부자가 되자! | `rabbit_game_with_audio.html` | 포인터/터치, 단축키 |
| 유화 | 쥐를 피하자! | `wnlfmf.html` | 좌우 방향키, 모바일 드래그 |
| 유화 | 99일의 생존 — 펭귄의 얼음 모험 | `99day/index.html` | 방향키/WASD, D-PAD, 스와이프 |
| 리하 | 리하의 토끼 키우기 | `ryha_rabbit/index.html` | 클릭/터치 |
| 리하 | 나 잡아봐라~ 먹여줘!! | `feed_me_game/index.html` | 드래그 |
| 유화 | 그림자를 보고 맞춰라! | `shadow_quiz/index.html` | 클릭/터치 |
| 유화 | 코끼리를 피해라! | `elephant_dodge/index.html` | 방향키/WASD, 포인터/터치 |
| 리하 | 손님들의 무한 편의점 | `convenience_store/index.html` | 클릭/터치, 키보드 |
| 가족 | 우리 가족 할리갈리 (1인용 · 컴퓨터 대결) | `halli_galli/index.html` | 클릭/터치, 스페이스로 종치기 |

## 로컬에서 실행하기

파일을 직접 열어도 대부분 동작하지만, 오디오·저장 기능과 상대 경로를 정확히 확인하려면 로컬 서버 사용을 권장합니다.

```bash
cd /Users/hongseung-yong/Documents/Codex/2026-09-08/self_game
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000/index.html`을 엽니다.

## 폴더 구조

```text
self_game/
├── index.html                  # 전체 게임 목록과 필터
├── *.html                     # 한 파일로 만든 초기 게임들
├── 99day/                     # HTML/CSS/JS 분리형 게임
├── convenience_store/
├── elephant_dodge/
├── feed_me_game/
├── halli_galli/
├── ryha_rabbit/
├── shadow_quiz/
├── shared/
│   ├── game-shell.css         # 공통 홈 버튼·모바일 조작 UI
│   └── game-shell.js          # 공통 접근성·모바일·음소거 동작
└── docs/
    └── ADDING_A_GAME.md       # 새 게임 추가 절차
```

## 공통 기능

- 모든 게임에 고정된 `🏠 게임 목록으로` 버튼 제공
- 버튼의 키보드 포커스 표시와 기본 의미 보정
- 캔버스에 보조기기용 이름 자동 부여
- 필요한 게임에 모바일 방향키와 동작 버튼 제공
- 일부 Web Audio 게임에 공통 음소거 설정 제공
- 편의점·코끼리 게임은 WebP 이미지를 우선 사용

## 수정할 때 확인할 사항

1. PC에서 게임 시작, 재시작, 주요 조작을 확인합니다.
2. 모바일 너비에서 버튼이 화면을 가리거나 너무 작지 않은지 확인합니다.
3. 음소거 상태가 새로고침 후에도 유지되는지 확인합니다.
4. 게임에서 `게임 목록으로`를 눌러 메인 화면으로 돌아오는지 확인합니다.
5. 새 이미지가 크다면 WebP로 변환하고 `alt` 문구를 작성합니다.

새 게임을 추가하는 자세한 방법은 [`docs/ADDING_A_GAME.md`](docs/ADDING_A_GAME.md)를 참고하세요.
게임별 모바일·접근성·오디오 점검 결과는 [`docs/QUALITY_AUDIT.md`](docs/QUALITY_AUDIT.md)에 정리되어 있습니다.

## 개인정보 주의

이 저장소와 배포 사이트에는 가족 사진이 포함되어 있습니다. 저장소를 공개 상태로 운영할 경우 사진 파일도 누구나 내려받을 수 있으므로 공개 범위를 정기적으로 확인하세요.
