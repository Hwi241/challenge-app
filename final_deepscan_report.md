# [최종 딥스캔 분석 보고서] - Project: Challenge App

본 보고서는 사용자(hwi)의 지시에 따라 수행된 3단계 딥스캔 결과를 종합하여 작성되었습니다. 소스코드의 구문 오류, 수학적 결함, 그리고 스토리지 취약점을 전수 조사하였습니다.

---

## 1. 1단계: 구문 및 참조 오류 (Syntax & Reference Errors)
*참조: scan_report_1.md*

### 주요 발견 사항
- **미정의 변수 참조 (Critical)**:
    - `WidgetDonutCapture1x1.js`: `setTimeout`, `console` 미정의 (전역 환경 설정 누락).
    - `EntryListScreen.js`: `require`, `requestAnimationFrame`, `performance` 등 노드/브라우저 전역 변수 참조 오류 다수 발생.
    - `HallOfFameScreen.js`: `clearTimeout`, `setTimeout` 미정의.
    - `UploadScreen.js`: `MAX_MINUTES` 상수가 정의되지 않은 채 사용됨.
- **미사용 변수 (Warning)**:
    - `AddChallengeScreen.js`를 포함한 거의 모든 파일에서 `React`, `useMemo`, `BackHandler` 등이 정의되었으나 사용되지 않음 (코드 비대화 및 가독성 저하).

---

## 2. 2단계: 수학 및 로직 결함 (Math & Logic Defects)
*참조: scan_report_2.md*

### 주요 발견 사항
- **수치 안전성 문제**:
    - `ChallengeListScreen.js`: `currentScore`가 `undefined`일 경우 `NaN` 발생 가능성.
    - `EntryListScreen.js`: 빈 배열에 `Math.max(...arr)` 사용 시 인자 전달 구조에 따라 의도치 않은 결과 초래 가능 (현재는 `1`을 기본값으로 넣어 방어 중).
- **날짜 처리 취약점**:
    - `AddChallengeScreen.js`: 날짜 문자열 `split('-')` 후 유효성 검사 전 `Date` 객체 생성 시 `Invalid Date` 발생 가능성.

---

## 3. 3단계: 스토리지 취약점 (Storage & JSON Vulnerabilities)
*신규 분석 결과*

### [발견 3-1] JSON 파싱 에러 방어 미흡 (Crash Risk)
- **현황**: `utils/challengeStore.js`의 `loadChallenges`, `loadChallengeById` 함수는 `JSON.parse()` 호출 시 `try-catch` 블록이 없습니다.
- **위험**: 스토리지 데이터가 손상되거나(예: 비정상 종료로 인한 파편화) 예기치 못한 문자열이 저장된 경우, 앱이 구동 직후 크래시될 수 있습니다. (`utils/trash.js`는 방어 중이나 핵심 스토어는 누락됨)

### [발견 3-2] 데이터 중복 주입 및 원자성 결여
- **현황**: `upsertChallenge` 및 `restoreFromTrash`에서 `filter` 후 `unshift` 하는 패턴을 사용합니다.
- **위험**: 비동기 실행 환경에서 동일한 ID에 대해 거의 동시에 작업이 수행될 경우, `setItem` 직전에 데이터가 꼬여 중복 항목이 발생하거나 최신 업데이트가 소실될 가능성(Race Condition)이 존재합니다.
- **로직 파편화**: `ChallengeListScreen.js` 등 여러 화면에서 `challengeStore.js` 유틸을 쓰지 않고 직접 `AsyncStorage`를 조작하는 코드가 발견되어 데이터 일관성 유지가 어렵습니다.

### [발견 3-3] 저장 데이터 타입 불일치
- **현황**: 어떤 파일은 설정을 `'true'`/`'false'` 문자열로 저장하고, 다른 파일은 `JSON.stringify`를 통해 객체로 저장합니다.
- **위험**: 통합 백업/복구 로직 구현 시 각 키마다 별도의 파싱 규칙이 필요하여 유지보수 비용이 증가합니다.

---

## 4. 종합 결론 및 권장 조치

### 결론
앱은 전반적으로 방어적인 코딩 스타일을 유지하고 있으나, **전역 변수 참조 오류(Phase 1)**와 **스토리지 파싱 크래시 위험(Phase 3)**이 가장 시급한 수정 사항으로 판단됩니다. 특히 `EntryListScreen.js`의 참조 오류는 특정 환경에서 런타임 에러를 유발할 수 있습니다.

### 권장 조치 사항 (Priority)
1. **[P0] 전역 환경 설정**: `eslint-env` 또는 전역 선언을 통해 `console`, `setTimeout`, `requestAnimationFrame` 등의 참조 오류를 해결하십시오.
2. **[P0] 스토리지 안전장치**: `utils/challengeStore.js`의 모든 `JSON.parse` 호출부에 `try-catch`를 도입하고, `normalizeChallenge`를 통해 반환값을 보증하십시오.
3. **[P1] 상수 정의**: `UploadScreen.js`의 `MAX_MINUTES` 등 누락된 상수를 정의하거나 import 하십시오.
4. **[P2] 로직 단일화**: `AsyncStorage` 직접 호출을 지양하고 모든 데이터 조작을 `utils/challengeStore.js`로 캡슐화하여 중복 주입 및 데이터 불일치를 방지하십시오.

---
**보고자: Codex (OpenClaw DeepScan Engine)**
**대상 파일: /home/hwi/challenge-app/**
