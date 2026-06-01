# Dashboard Drag & Drop Reflow Skill - Draft

## 1. 문서 목적

이 문서는 대시보드 카드형 위젯을 드래그 앤 드롭으로 재배치할 때 사용하는 알고리즘 기준을 정리한 초안이다.

현재 구현은 완전히 최종 확정된 상태가 아니다.
따라서 이 문서는 "최종 스킬"이 아니라 "현재까지 안정화한 기준과 주의할 예외를 기록한 스킬 초안"으로 사용한다.

이 문서의 목적은 다음과 같다.

1. 대시보드 카드 재배치 작업의 기준을 보존한다.
2. 이후 수정 시 같은 시행착오를 반복하지 않도록 한다.
3. 오픈클로 또는 다른 실행 모델에게 작업을 지시할 때 기준 문서로 활용한다.
4. 드래그 앤 드롭 알고리즘에서 건드리면 안 되는 부분과 조심해야 할 부분을 명확히 구분한다.

---

## 2. 기본 전제

현재 대시보드 편집 화면은 6컬럼 그리드 기반으로 구성한다.

기본 전제는 다음과 같다.

1. 전체 grid column 수는 6이다.
2. 각 카드는 `x`, `y`, `w`, `h` 값을 가진다.
3. `x`, `y`는 grid 좌표이다.
4. `w`, `h`는 grid 단위 크기이다.
5. 실제 화면 렌더링은 grid 좌표를 픽셀 위치로 변환해 absolute 배치한다.
6. 드래그 중에는 preview layout을 사용한다.
7. 실제 drop 후 최종 layout은 정수 grid 좌표로 확정한다.
8. 저장은 사용자가 저장 버튼을 눌렀을 때만 한다.

---

## 3. 핵심 파일

현재 주요 구현 파일은 다음과 같다.

```text
screens/DashboardEditScreen.js
constants/widgetCatalog.js
utils/dashboardLayout.js
```

가장 중요한 파일은 `screens/DashboardEditScreen.js`이다.
이 파일 안에 다음 로직이 들어 있다.

- 대시보드 layout 로드
- 저장된 layout 겹침 repair
- grid item frame 계산
- drag gesture 처리
- previewLayout 계산
- calculateReflowLayout
- addGraph / removeGraph
- 저장 버튼 처리
- drag overlay / placeholder 표시

---

## 4. 그리드 좌표계 기준

세로 좌표계는 다음 기준을 사용한다.

```js
GRID_ROW_HEIGHT = 90
GRID_ROW_GAP = 10
```

세로 1칸 = `GRID_ROW_HEIGHT + GRID_ROW_GAP` = 100

**중요 기준:**

- `onUpdate`의 `dY` 계산은 `event.translationY / (GRID_ROW_HEIGHT + GRID_ROW_GAP)` 기준이어야 한다.
- `onEnd` fallback의 `deltaY`도 같은 기준이어야 한다.
- 세로 좌표에 `130` 같은 임시값을 사용하면 안 된다.
- 실제 카드 height는 `getGridItemHeight(h)`로 계산한다.
- placeholder와 실제 카드 frame은 같은 `getGridItemFrame` 계열 기준을 사용해야 한다.

---

## 5. 드래그 중 preview와 최종 drop의 분리

드래그 중 preview와 최종 drop은 분리해야 한다.

### 5.1 드래그 중 preview

드래그 중에는 previewLayout을 사용한다.

preview 목적:

- 사용자가 카드를 움직이는 동안 주변 카드가 미리 비키게 한다.
- 실제 layout state를 즉시 확정하지 않는다.
- hover 좌표를 활용해 더 자연스럽게 충돌을 판단한다.

### 5.2 최종 drop

손을 떼면 onEnd에서 최종 drop 위치를 확정한다.

**최종 drop 기준:**

- 최종 layout은 정수 x, y 좌표로 확정한다.
- hoverX / hoverY 같은 소수점 좌표가 저장 layout에 들어가면 안 된다.
- 최신 기준에서는 onEnd에서 정수 x/y와 함께 stableHoverX/stableHoverY를 moveGraph에 전달한다.
- 다만 hoverX/hoverY는 최종 저장 좌표가 아니라 calculateReflowLayout이 preview와 final drop을 같은 기준으로 판단하기 위한 보조값이다.
- 최종 layout의 x/y는 반드시 정수 grid 좌표로 유지한다.
- `moveGraph(widgetId, { type: 'drop', x, y, hoverX, hoverY })` 경로를 사용한다.
- 최종 layout은 `calculateReflowLayout` 결과로 setLayout 된다.

---

## 6. hover 좌표 기준

드래그 중 preview 계산에는 hover 좌표를 사용한다.

기준:

```js
hoverX = originX + translationX / slotWidth
hoverY = originY + translationY / rowUnit
rowUnit = GRID_ROW_HEIGHT + GRID_ROW_GAP
```

다만 hover 원값을 그대로 `previewTargetRef` 비교에 사용하면 너무 민감하다.
그래서 preview 안정화를 위해 0.25칸 단위로 묶는다.

```js
stableHoverX = Math.round(hoverX * 4) / 4
stableHoverY = Math.round(hoverY * 4) / 4
```

**적용 기준:**

- `previewTargetRef` 비교는 `stableHoverX` / `stableHoverY` 기준으로 한다.
- `calculateReflowLayout`의 preview target에도 `stableHoverX` / `stableHoverY`를 전달한다.
- onEnd에서도 lastDropTargetRef 또는 fallback 계산을 통해 stableHoverX / stableHoverY를 moveGraph에 전달한다.
- 단, 이 값은 저장 layout에 들어가지 않고 reflow 판단에만 사용한다.
- **저장 layout에는 hover 좌표가 들어가면 안 된다.**

---

## 7. calculateReflowLayout 핵심 원칙

`calculateReflowLayout`은 카드 재배치의 핵심 함수이다.

이 함수의 기본 역할:

1. moving item을 target 위치에 둔다.
2. 충돌한 카드를 찾는다.
3. 충돌 비율을 계산한다.
4. 같은 크기 카드끼리는 swap을 허용한다.
5. 다른 크기 카드는 vacated-space first 방식으로 비킨다.
6. 필요한 경우 collision group을 함께 이동시킨다.
7. 마지막에 빈 행을 compact한다.

---

## 8. 충돌 판단 기준

충돌 판단은 단순히 한 픽셀이라도 겹쳤는지가 아니라, 겹침 비율을 본다.

현재 기준:

```js
stationaryCoverage = overlapArea / stationaryArea
movingCoverage = overlapArea / movingArea
coverageScore = Math.max(stationaryCoverage, movingCoverage)
```

**반응 후보 조건:**

- `stationaryCoverage >= 0.5`
- 또는 `movingCoverage >= 0.5`

**주의사항:**

- `stationaryCoverage`만 보면 큰 카드가 작은 카드를 덮을 때 반응이 늦다.
- `movingCoverage`만 보면 작은 카드가 큰 카드를 살짝 지나도 과하게 반응할 수 있다.
- 두 기준을 OR로 조합하면 2x2, 6x1, 6x2 조합에서 더 자연스럽다.
- 하지만 2x2 / 4x2 / 6x2 복합 조합에서는 예외가 남을 수 있다.

---

## 9. same-size swap 기준

같은 크기 카드끼리는 swap이 가능하다.

**기준:**

```js
item.w === movingW && item.h === movingH
```

**주의사항:**

- width만 같다고 swap하면 안 된다.
- 6x2와 6x1은 같은 width라도 height가 다르므로 swap 대상이 아니다.
- 6x2 ↔ 6x2는 swap 가능하다.
- 2x2 ↔ 2x2는 swap 가능하다.
- 4x2 ↔ 4x2는 swap 가능하다.

---

## 10. 다른 크기 카드의 vacated-space first 원칙

다른 크기의 카드가 충돌했을 때는 바로 swap하지 않는다.

대신 다음 원칙을 사용한다.

- primaryCollisionItem을 movingOriginal이 비운 자리로 먼저 이동 시도한다.

**의도:**

1. 드래그 중인 카드가 원래 있던 자리를 비운다.
2. 충돌한 카드가 그 빈자리로 먼저 들어가려고 한다.
3. 들어갈 수 없으면 다음 빈 위치를 찾는다.

이렇게 하면 다른 크기 카드끼리도 자연스럽게 자리를 바꾸는 느낌이 난다.

**주의사항:**

- primaryCollisionItem의 x는 원래 x를 최대한 유지해야 한다.
- y는 `movingOriginal.y` 기준으로 이동한다.
- 이 로직은 같은 크기 swap보다 우선하면 안 된다.
- 같은 크기면 기존 same-size swap을 사용한다.

---

## 11. collisionGroup 원칙

6x2 카드가 아래의 [2x2][4x2] 행으로 이동할 때, 2x2와 4x2가 함께 움직여야 자연스럽다.

그래서 primaryCollisionItem 하나만 이동시키지 않고, 같은 y밴드에 걸린 `coveredCollisionItems`를 묶어 collisionGroup으로 처리한다.

**기준:**

1. primaryCollisionItem의 y밴드를 구한다.
2. coveredCollisionItems 중 같은 y밴드에 걸린 카드를 group으로 묶는다.
3. group 안의 각 카드는 원래 x를 유지한다.
4. group 안의 각 카드는 primaryCollisionItem과의 상대 y 간격을 유지한다.
5. group 전체가 movedItem과 충돌하지 않으면 함께 이동한다.
6. group 이동이 불가능하면 primaryCollisionItem 단일 이동 fallback을 사용한다.

**예시:**

```
기존:
[잔디그래프 6x2]
  [2x2]  [달력 4x2]

잔디그래프를 아래로 이동

기대:
  [2x2]  [달력 4x2]
[잔디그래프 6x2]
```

**주의사항:**

- collisionGroup은 전체 테트리스 정렬이 아니다.
- 직접 충돌한 같은 행/밴드 카드만 묶는다.
- collisionGroup 로직은 일부 예외에서 형제 카드와 충돌할 수 있으므로 추후 안정화가 필요하다.
- 마지막에 시도했던 staticBlockingItems 방식은 동작이 어색해져 되돌린 상태이다.

---

## 11-1. pass-through 예외 처리 원칙

현재 구현은 모든 충돌을 collisionGroup으로 처리하지 않는다.
카드가 다른 카드를 실제로 교환하려는 상황과, 특정 카드를 지나 아래/위 빈 위치로 들어가려는 상황을 구분한다.

현재 안정화된 pass-through 케이스는 다음과 같다.

### 1. partial-width 카드가 full-width 6x2 아래로 지나가는 경우

- 예: 4x2 또는 2x2가 6x2 아래로 이동
- 6x2는 제자리에 두고 이동 중인 카드만 6x2 아래로 보낸다.
- `collidingItems`에서 full-width (w >= GRID_COLUMNS) & h > 1인 카드를 찾는다.
- `hoverY >= itemY + 0.25` 조건으로 진입 판단한다.

### 2. thin full-width 카드가 아래 카드들 사이로 내려가는 경우

- 예: 6x1 도전목표박스가 4x2/2x2 또는 6x2 아래로 이동
- 아래 카드들을 위로 끌어올리지 않고 6x1만 아래로 보낸다.
- `collidingItems`에서 movingH === 1보다 큰 taller 카드를 찾는다.
- `hoverY >= itemY + 0.25` 조건으로 진입 판단한다.

### 3. tall full-width 카드가 thin full-width 카드 아래로 지나가는 경우

- 예: 6x2가 6x1 아래로 이동
- 6x1은 제자리에 두고 6x2만 6x1 아래로 보낸다.
- `collidingItems`에서 full-width이고 itemH < movingH인 카드를 찾는다.
- `hoverY + movingH >= itemY + 0.5` 조건으로 진입 판단한다. (아랫변 기준)

### 4. non-adjacent full-width group pass-through

- 예: 6x2와 4x2/2x2 사이에 6x1 같은 중간 카드가 있는 경우
- 4x2/2x2를 맨 위로 끌어올리지 않고 6x2만 해당 행 아래로 보낸다.
- `coveredCollisionItems[0]`이 partial-width이고 group top이 movingOriginal 아래끝보다 아래일 때 발동한다.

### 5. thin full-width upward partial group

- 예: 6x1을 위로 올려 4x2/2x2 행에 넣는 경우
- 4x2와 2x2를 하나의 row group으로 묶어 함께 아래로 민다.
- 4x2와 2x2가 서로 다른 y로 갈라지면 안 된다.
- partial width 합이 GRID_COLUMNS 이상일 때만 group으로 처리한다.

### 주의사항

- 직접 맞닿은 6x2 → 4x2/2x2 행 이동은 기존 collisionGroup을 유지한다.
- 중간 카드가 끼어 있는 경우에는 collisionGroup이 아니라 pass-through로 보는 것이 자연스럽다.
- pass-through는 기능 예외가 아니라 드래그 의도 해석 기준이다.
- 모든 pass-through 분기는 기존 collisionGroup보다 먼저 평가되어야 한다.
- early return 조건에도 각 pass-through 플래그 예외가 추가되어야 한다.

---

## 12. 추가/삭제 후 compact 원칙

카드 추가와 삭제는 드래그 reflow와 별개로 처리한다.

### 12.1 카드 삭제

카드를 삭제하면 빈칸이 생길 수 있다.
삭제 후에는 남은 카드들을 위쪽/왼쪽 기준으로 다시 compact한다.

**기준:**

- 최소 1개 카드는 남긴다.
- 삭제 후 layout을 normalize한다.
- `repairDashboardLayoutOverlaps`를 통과시킨다.
- `compactDashboardLayoutSpaces`를 통과시킨다.

### 12.2 카드 추가

카드 추가 시 단순히 `maxY + 1`을 쓰면 안 된다.
카드 높이 h를 고려하지 않아 겹침이 생길 수 있다.

**금지:** `y: maxY + 1`

**권장:**

1. 새 카드를 seed item으로 만든다.
2. 현재 layout + 새 카드를 normalize한다.
3. `repairDashboardLayoutOverlaps`를 통과시킨다.
4. `compactDashboardLayoutSpaces`를 통과시킨다.
5. 첫 번째 빈 위치에 들어가게 한다.

---

## 13. 초기 layout repair 원칙

저장된 layout이 이미 겹쳐 있을 수 있다.

**예시:**

```
goal_black_box y:1
overall_progress h:2
month_calendar h:2
```

이 경우 widgetCatalog 기본값을 고쳐도, AsyncStorage에 저장된 old layout이 우선 적용되면 계속 겹친다.

따라서 `loadLayout` 단계에서 다음을 적용한다.

1. 저장된 layout을 불러온다.
2. `normalizeLayout`을 적용한다.
3. `repairDashboardLayoutOverlaps`를 적용한다.
4. 화면 표시에는 repair된 layout을 사용한다.
5. 자동 저장은 하지 않는다.
6. 사용자가 저장 버튼을 누르면 현재 layout이 저장된다.

---

## 14. 짧은 터치 깜빡임 방지 원칙

`Gesture.Pan`의 `onBegin`은 touch down 직후 실행된다.
따라서 `onBegin`에서 시각 효과를 켜면 짧은 터치에도 카드가 깜빡인다.

**onBegin:** dragOriginRef 저장 등 기준점 처리만 수행

**onStart:** 실제 long press 이후 드래그가 활성화될 때 시각 효과 시작

**구조:**

- `activateAfterLongPress(300)`는 유지한다.
- `onBegin`에서는 `gestureDraggingWidgetId`를 설정하지 않는다.
- `onBegin`에서는 `dragOverlayItem`을 설정하지 않는다.
- `onStart`에서 `gestureDraggingWidgetId`를 설정한다.
- `onStart`에서 `dragOverlayItem`을 설정한다.
- `onStart`에서 `dragOverlayStart`를 설정한다.

---

## 15. 드롭 순간 깜빡임 완화 원칙

손을 놓을 때 `previewLayout`을 즉시 지우면 다음 전환이 발생할 수 있다.

```
previewLayout → 기존 layout → 최종 layout
```

이 때문에 카드 전체가 한 번 위로 살짝 튀는 것처럼 보일 수 있다.

**완화 방식:**

1. `dragCleanupTimerRef`를 둔다.
2. `onEnd`에서 moveGraph 호출 후 시각 상태 cleanup을 즉시 하지 않는다.
3. `scheduleDragVisualCleanup`으로 약 32ms 뒤 cleanup한다.
4. `onFinalize`도 같은 cleanup 스케줄을 사용한다.
5. `onBegin`/`onStart`에서는 예약된 cleanup을 취소한다.
6. unmount 시 timer를 clear한다.

**주의사항:**

- moveGraph 호출은 유지한다.
- drop/fallback 계산은 수정하지 않는다.
- cleanup 지연은 시각 상태에만 적용한다.
- layout 저장이나 최종 좌표에는 영향을 주면 안 된다.

### 15.1 previewLayout 중복 업데이트 방지

드래그 중 previewResult가 계산되더라도 이전 previewLayout과 실제 배치 결과가 같으면 setPreviewLayout을 다시 호출하지 않는다.

**구현 방식:**

- `previewLayoutSignatureRef`에 이전 signature를 저장한다.
- previewResult 배열을 widgetId/x/y/w/h 기준 문자열 signature로 변환한다.
- signature가 이전과 다를 때만 `setPreviewLayout(previewResult)`를 호출한다.
- cleanup / onBegin 시 signature를 초기화한다.

이렇게 하면 같은 배치 결과에 대한 불필요한 state 갱신과 re-render를 방지할 수 있다.

---

## 16. 방향키 UI 원칙

드래그 앤 드롭이 안정화되면 카드 내부 방향키 UI는 제거한다.

**삭제 대상:**

- `moveControls`
- `moveBtn`
- `moveText`
- ↑ ↓ ← → TouchableOpacity

**주의사항:**

- 방향키 UI는 제거해도 된다.
- `moveGraph` 함수 자체는 삭제하면 안 된다.
- `moveGraph`는 drop 처리에서 계속 사용된다.
- 방향키용 up/down/left/right 분기는 당장 삭제하지 않는 것이 안전하다.

---

## 17. 디버그 state 제거 원칙

최신 기준에서는 화면에 표시되지 않는 debug state도 제거한다.
드래그 중 debug state setter가 반복 호출되면 React re-render가 발생해 미세한 반짝임을 만들 수 있다.

**제거된 항목:**

- `gestureTestInfo` / `setGestureTestInfo`
- `dragTargetDebug` / `setDragTargetDebug`
- `previewLayoutDebug` / `setPreviewLayoutDebug`
- moveGraph 내부 debug msg / console.log / setTimeout debug setter 블록
- onBegin / onUpdate / onEnd / onFinalize의 모든 debug setter 호출

**유지된 항목:**

- `previewLayout` / `setPreviewLayout` (preview 표시용, 유지)
- `dragPlaceholder` / `dragOverlay` (드래그 시각 효과, 유지)
- `lastDropTargetRef` / `previewTargetRef` (드래그 상태 추적, 유지)

**주의사항:**

- debug 제거는 기능 로직 수정이 아니다.
- 드래그 로직과 함께 제거하지 않는다.
- previewLayout 기능 자체는 유지한다.

---

## 18. 아직 주의해야 할 예외

현재 구현은 e40dfb6 기준으로 주요 이슈가 일단락된 상태이다.
다만 다음은 계속 주의한다.

1. pass-through 분기가 많아졌으므로 새 케이스를 추가할 때 기존 케이스를 깨지 않는지 확인해야 한다.
2. 아주 미세한 preview 반짝임은 기기 성능이나 React render 타이밍에 따라 남을 수 있다.
3. placeholder 위치와 실제 preview result item 위치가 완전히 일치하지 않는 예외는 추후 별도 안정화 후보이다.
4. 안정화 작업은 기능 로직 변경과 분리해서 진행해야 한다.
5. pass-through 조건값을 조정할 때는 한 번에 하나만 바꾼다.

---

## 19. 수정 시 절대 한 번에 건드리면 안 되는 것

아래 항목은 한 번에 같이 수정하면 위험하다.

- `calculateReflowLayout`
- `onUpdate` hover 계산
- `onEnd` drop/fallback 계산
- `moveGraph`
- `previewLayout` / `displayLayout`
- `addGraph` / `removeGraph` compact
- `renderDragOverlay` / `renderDragPlaceholderOverlay`
- `saveLayout`
- AsyncStorage 저장 로직

수정은 항상 작은 단위로 진행한다.

---

## 20. 오픈클로 지침 작성 시 금지사항

오픈클로에게 작업을 시킬 때 다음을 금지한다.

1. 전체 파일 재작성 금지
2. `git reset --hard` 금지
3. `git checkout` 금지
4. `git restore` 금지
5. 자동 복구 금지
6. 불필요한 커밋/푸시 금지
7. 긴 전체 파일 출력 금지
8. 거대한 diff 출력 금지
9. 임의로 Reanimated 도입 금지
10. `yStep` 재도입 금지
11. `hoverX`/`hoverY`를 최종 저장 layout에 넣는 것 금지
12. AsyncStorage 자동 삭제 금지

---

## 21. 오픈클로 지침 작성 시 권장사항

오픈클로에게 작업을 시킬 때는 다음을 포함한다.

1. 수정 대상 파일
2. 수정할 함수명
3. 수정할 정확한 분기
4. 수정하지 말아야 할 항목
5. 정적 검증
6. Babel parse 확인
7. `git diff --stat`
8. 짧은 grep 결과
9. 커밋/푸시 여부 명시

수정 지침은 항상 작은 단위로 작성한다.

---

## 22. 현재까지 안정화된 핵심 구현 목록

현재까지 안정화된 것으로 보는 항목:

1. 6컬럼 grid 기반 absolute 배치
2. `getGridItemFrame` 기준 통일
3. dY / deltaY 기준을 rowUnit으로 통일
4. `dragOriginRef`로 드래그 시작점 고정
5. `previewLayout` 기반 실시간 비킴
6. `hoverX`/`hoverY` 기반 preview collision 판단
7. `stableHoverX`/`stableHoverY` 0.25칸 단위 안정화
8. same-size swap
9. 다른 크기 카드의 vacated-space first
10. collisionGroup 묶음 이동
11. partial-width → full-width 아래 pass-through (케이스 1)
12. thin full-width 아래 이동 pass-through (케이스 2)
13. tall full-width → thin full-width 아래 pass-through (케이스 3)
14. non-adjacent full-width group pass-through (케이스 4)
15. thin full-width upward partial group 이동 (케이스 5)
16. `targetPositionHasCollision` 기반 빈칸 이동 허용
17. preview `reservedRows`로 드래그 중 compact 지연
18. hoverX/hoverY drop 객체 전달로 preview/final 일관성 확보
19. 초기 저장 layout repair
20. addGraph / removeGraph compact
21. 짧은 터치 깜빡임 방지
22. 드롭 순간 cleanup delay
23. 방향키 UI 제거
24. debug state 완전 제거
25. `previewLayoutSignatureRef` 중복 업데이트 방지

---

## 23. 추후 개선 후보

1. pass-through 분기들을 별도 helper 함수로 분리
2. calculateReflowLayout을 pure function으로 분리해 단위 테스트 가능하게 만들기
3. placeholder를 raw target이 아니라 previewLayout result item 기준으로 표시
4. 남은 미세 반짝임이 있으면 render memoization 또는 card component 분리 검토
5. moveGraph 내부 방향키용 up/down/left/right 분기 정리

> previewLayoutDebug / dragTargetDebug state 정리는 완료됨 (커밋 610c161).

---

## 24. 핵심 판단 요약

이 드래그 앤 드롭 구조에서 가장 중요한 기준:

1. 드래그 중 preview와 최종 drop은 분리한다.
2. preview는 hover 좌표를 볼 수 있지만, 최종 layout은 정수 좌표만 사용한다.
3. 같은 크기 카드는 swap한다.
4. 다른 크기 카드는 드래그 카드가 비운 자리로 먼저 이동시킨다.
5. 여러 카드가 같은 행에서 함께 충돌하면 group으로 함께 이동시킨다.
6. 추가/삭제 후에는 compact를 적용한다.
7. 시각적 깜빡임은 알고리즘이 아니라 gesture lifecycle / cleanup timing 문제일 수 있다.
8. 최종 결과가 정상이라면 preview 안정화만 따로 수정한다.
9. 잘 되던 알고리즘을 한 번에 많이 바꾸지 않는다.
10. collisionGroup은 직접 맞닿은 행 교환에만 신중하게 사용한다.
11. 중간 카드 너머로 지나가는 이동은 pass-through로 해석하는 것이 자연스럽다.
12. 드래그 안정화는 기능 로직 변경보다 re-render 감소, cleanup 타이밍, preview 중복 업데이트 방지를 먼저 본다.
13. 문서 기준 최신 안정화 커밋은 e40dfb6이다.

## Current implementation status — gesture-drag-prototype / fd86358

Last updated from project work through:

- Branch: gesture-drag-prototype
- Latest commit: fd86358 — Improve edit challenge keyboard handling
- Working tree at last report: clean

### 1. Dashboard drag / resize behavior

Current dashboard editing behavior is based on screens/DashboardEditScreen.js.

Confirmed implementation state:

- Drag and resize are handled inside the dashboard edit screen.
- Resize snapping uses a lighter threshold than the earlier prototype.
- Current resize snap threshold:
 - RESIZE_GRID_STEP_THRESHOLD = 0.45
- Current drag movement threshold is preserved:
 - GRID_DRAG_STEP_THRESHOLD = 0.62
- The resize threshold was changed in:
 - d9534ac — Tune dashboard resize snap threshold

Design intent:

- Resizing should not require dragging almost a full grid cell.
- Around 45% of a cell is enough to snap to the next size.
- This feels lighter on mobile touch while avoiding overly sensitive snapping.

### 2. Latest layout save behavior

The dashboard edit screen now saves the most recent layout even when the user taps save immediately after moving or resizing a card.

Confirmed implementation state:

- layoutRef is used to keep the latest dashboard layout outside React state timing.
- setDashboardLayoutImmediate updates both:
 - React layout state
 - layoutRef.current
- saveLayout uses layoutToSave from layoutRef.current first.
- dashboardEditLayout route param also receives the latest layoutToSave.
- This prevents stale layout saves after immediate drag/resize followed by save.

Related commit:

- a8856d9 — Ensure latest dashboard layout is saved

Reason this matters:

- React state updates can lag behind the final gesture frame.
- Without layoutRef, saving immediately after a drag/resize can sometimes persist the previous layout.
- The current approach keeps the gesture result and saved value aligned.

### 3. Known fixed issue: moveGraph callback closure

A syntax/closure issue was found around the moveGraph update path.

Confirmed fix:

- setDashboardLayoutImmediate((current) => { ... }) is now correctly closed with });
- useCallback dependency array is separately closed with:
 - }, [dashboardTarget, setDashboardLayoutImmediate]);

Reason this matters:
- The previous malformed closure could make the parser treat the following const styles = StyleSheet.create({ ... }) as if it were still inside an object/function context.
- Metro then reported a misleading error near the styles block.

This fix was included before the save timing commit was finalized.

### 4. Dashboard edit return behavior

Recent dashboard return animation work stabilized the transition from edit screen back to entry list.

Relevant prior commits:

- 743b243 — Stabilize dashboard return animations
- 7c11ded — Prevent duplicate dashboard intro animation frames
- 30d30aa — Unify dashboard intro animation progress
- 7a482c8 — Smooth dashboard intro animation timing
- b1889ea — Start dashboard save return animation from zero
- a14da2b — Delay dashboard save return after params update

Current behavior:

- Save return passes updated dashboard layout through route params.
- Return animation starts after params update delay.
- Duplicate intro frames are prevented.
- Dashboard return animation progress is unified through introK.

### 5. Entry list intro animation speed

Entry list dashboard intro animation duration was adjusted.

Current value:

- DUR = 900

Relevant commit:

- 992d18b — Speed up entry list intro animation

Previous tested values:

- 1500
- 1200
- 900

Current decision:

- 900ms is the active value.
- It is intended to feel less slow when entering the entry list screen.

### 6. Dashboard calendar compact badge adjustment

The compact month calendar badge was adjusted for 2-row/two-cell-height dashboard layouts.

Relevant commit:

- 5b310dc — Center compact calendar certification badge

Current behavior:

- Compact calendar mode uses:
 - isCompactCalendar = CALENDAR_SCALE <= 0.85
- Certification badge height is fixed in compact mode.
- Badge text uses matching lineHeight.
- textAlignVertical: 'center' is applied for better Android centering.
- Previous text-adjust style was removed:
 - compactCertBadgeTextAdjustStyle should not exist.

Design intent:

- Only compact/two-row calendar cards are corrected.
- Larger calendar layouts should remain visually unchanged.

### 7. Goal black box widget behavior

The dashboard goal/reward black box widget was updated.

Relevant commit:

- 6601e79 — Improve goal marquee and keyboard input handling

Current behavior:

- Goal text size is fixed:
 - GOAL_FONT_SIZE = 18
 - GOAL_LINE_HEIGHT = 22
- Text no longer scales with card height.
- Short text remains centered.
- Long text scrolls horizontally as a marquee.
- Marquee text uses full sentence rendering, not ellipsis.
- Marquee text uses:
 - ellipsizeMode="clip"
 - marqueeGoalTextStyle
 - Animated.loop

Design intent:

- The goal box should keep a strong, large-text identity regardless of card size.
- If the text does not fit, the full sentence should move horizontally instead of becoming ....

### 8. Keyboard handling related to dashboard-adjacent edit flows

Keyboard avoidance has been applied to add/edit/upload flows, not directly to dashboard drag logic.

Relevant commits:

- 6601e79 — Improve goal marquee and keyboard input handling
- fd86358 — Improve edit challenge keyboard handling

Current screens using the shared keyboard handling pattern:

- screens/AddChallengeScreen.js
- screens/UploadScreen.js
- screens/EditChallengeScreen.js

Current pattern:

- KeyboardAvoidingView
- dynamic bottom padding using keyboard height
- measureInWindow input position check
- Keyboard.addListener('keyboardDidShow', ...)
- Keyboard.addListener('keyboardDidChangeFrame', ...)
- scroll correction uses:
 - animated: false

Avoided older approaches:

- scrollToEnd
- findNodeHandle
- scrollResponderScrollNativeHandleToKeyboard
- repeated multi-delay timers

### 9. Files currently important for dashboard drag/drop work

Primary files:

- screens/DashboardEditScreen.js
 - drag/resize/edit/save behavior
- screens/EntryListScreen.js
 - dashboard rendering, intro animation, compact widget rendering
- constants/widgetCatalog.js
 - widget definitions, grid sizing constraints
- utils/dashboardLayout.js
 - layout persistence and target resolution

Related screens:

- screens/AddChallengeScreen.js
- screens/UploadScreen.js
- screens/EditChallengeScreen.js

### 10. Current recommended next checks before further drag/drop changes

Before making new drag/drop logic changes, verify:

1. screens/DashboardEditScreen.js
 - current GRID_DRAG_STEP_THRESHOLD
 - current RESIZE_GRID_STEP_THRESHOLD
 - layoutRef
 - setDashboardLayoutImmediate
 - saveLayout
 - moveGraph
 - resize handler logic

2. screens/EntryListScreen.js
 - dashboard render slot height behavior
 - widget rendering by kind
 - introK
 - compact widget-specific adjustments

3. constants/widgetCatalog.js
 - widget size constraints
 - fixed size definitions
 - grid column assumptions

### 11. Current caution

Do not rewrite the drag/drop system broadly.

Preferred workflow:

- Make one small behavior change at a time.
- Keep existing dashboard widget UI stable.
- Preserve working save behavior.
- Preserve layoutRef-based latest layout persistence.
- Do not remove dashboard return animation guards.
- Do not change unrelated widget rendering unless explicitly requested.

### 12. Graph tap animation behavior after step 415

Step 415 corrected the graph tap behavior after the earlier introK unification.

Current behavior:

- introK remains the shared entry/return intro animation value.
- Dashboard first entry still animates graph widgets together through introK.
- The overall progress widget has an independent tap animation:
 - donutK
- The weekly bar widget has an independent tap animation:
 - weekK
- Line charts do not run tap replay animations.
- Line charts use introK only for the first entry animation.
- Tapping a line chart selects the nearest date/value point only:
 - setSelectedIdx(best)
 - selectedLabel
 - selPoint

Important correction:

- lineCountK
- lineMinutesK
- runLineCount
- runLineMinutes
- onGraphTap

These were intentionally removed after step 415 because line charts should not replay animation on tap. Their tap behavior is date/value inspection, not graph replay.

Current intended interaction:

- Entry list first load:
 - all dashboard graphs animate smoothly together
- Overall progress tap:
 - only overall progress replays
- Weekly bar tap:
 - only weekly bar replays
- Line count tap:
 - graph does not replay
 - selected date/value label appears
- Line minutes tap:
 - graph does not replay
 - selected date/value label appears
- Grass graph:
 - existing wave behavior remains separate
