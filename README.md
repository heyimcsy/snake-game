# 숲속 길잇기 (Forest Path)

`game-prd.md`를 구현한 React 기반 두뇌 퍼즐 게임입니다.
N×N 격자에서 **모든 칸을 한 번씩** 지나며 **숫자를 순서대로(1→2→3…)** 이어
하나의 연속된 길을 완성하면 클리어됩니다.

## 규칙
- 격자는 N×N (4×4 ~ 10×10).
- 모든 칸을 정확히 한 번씩 방문.
- 숫자 칸은 오름차순으로 통과 (1번 표지판에서 출발).
- 상하좌우로만 이동, 하나의 끊기지 않은 길.
- 일부 단계는 칸 사이 **벽**으로 이동이 막힘.
- 모든 칸을 채우고 숫자를 순서대로 지나면 해결.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm run build      # 프로덕션 빌드 -> dist/
npm run preview    # 빌드 결과 미리보기
```

## 조작
- **모바일:** 1번 표지판을 누른 뒤 손가락으로 드래그해 길을 잇습니다.
- **PC:** 마우스로 드래그. 왔던 길로 되돌아가면 지워집니다.
- 이미 지난 칸을 탭하면 그 지점까지 되돌아갑니다.
- 하단 `↩︎ 한 칸` / `⟲ 다시` 버튼으로 되돌리기/초기화.

## 구조
```
src/
  App.jsx                 화면 전환(시작/단계선택/게임) + 진행도 저장(localStorage + Supabase)
  game/
    logic.js              규칙 엔진 + useGame 훅 (이동/벽/순서 검증)
    stages.js             자동 생성된 1~60단계 데이터 (유일해 검증됨)
  components/
    StartScreen.jsx
    StageSelect.jsx
    GameScreen.jsx
    Board.jsx             격자 + SVG 오버레이(벽/경로) + 부드러운 그리기 애니메이션
  styles.css              숲속 테마
tools/
  generate.mjs            퍼즐 생성기 (실제 해밀턴 경로 → 숫자/벽 배치 → 유일해 검증)
  verify.mjs              60단계 정답 재생 검증
  browsertest.mjs         헤드리스 브라우저로 실제 플레이 후 클리어 확인
```

## 퍼즐 재생성 / 검증
```bash
npm run gen        # tools/generate.mjs -> src/game/stages.js 재생성
node tools/verify.mjs   # 모든 단계가 규칙에 맞는 정답을 갖는지 검증
```

각 단계는 실제 해밀턴 경로에서 역으로 생성되어 **항상 풀 수 있으며**, 백트래킹
솔버로 **유일해**임을 확인했습니다.
