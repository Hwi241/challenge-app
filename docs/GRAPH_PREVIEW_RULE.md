# Graph Preview Rule

## 1. 목적

그래프 미리보기 이미지는 개별 이미지 파일로 만들지 않는다.

그래프 카탈로그의 preview 메타데이터를 기준으로
components/GraphPreviewIcon.js가 자동 생성한다.

이 문서가 그래프 미리보기의 공식 기준이다.

---

## 2. 공식 구조

```
constants/graphCatalog.js
 └─ preview.family
 └─ preview.variant
 └─ preview.metricType
 └─ preview.seed
 └─ preview.features

constants/graphPreviewRules.js
 └─ frame / color / stroke / metricTag / family / size 실행 규칙
 └─ GraphPreviewIcon이 참조할 코드 기준

components/GraphPreviewIcon.js
 └─ preview 메타데이터와 graphPreviewRules 실행 규칙을 받아 react-native-svg로 자동 미리보기 렌더링
```

**정책 문서:** docs/GRAPH_PREVIEW_RULE.md (이 파일)
**실행 규칙:** constants/graphPreviewRules.js

GraphPreviewIcon이 참조하는 시각적 상수(색상, 크기, 간격, 좌표 등)는
graphPreviewRules.js에서 관리한다.

---

## 3. preview.family

family는 그래프의 기본 형태를 정한다.

현재 기준:

- LINE: 선형 그래프
- BAR: 막대 그래프
- PIE: 원형/도넛 그래프
- DISTRIBUTION: 분포 그래프
- NETWORK: 관계망 그래프

새 그래프를 추가할 때는 먼저 family를 정한다.

---

## 4. preview.variant

variant는 같은 family 안에서 형태 차이를 만든다.

예시: dotLine, smoothLine, solidBars, donut

같은 LINE 그래프라도 dotLine, smoothLine처럼 서로 다른 인상을 줄 수 있다.

---

## 5. preview.metricType

metricType은 그래프가 표현하는 데이터의 의미를 정한다.

현재 기준:

- COUNT: 횟수
- MINUTE: 시간/분
- SCORE: 점수
- PERCENT: 비율/퍼센트
- DURATION: 기간
- RELATION: 관계

GraphPreviewIcon은 metricType에 따라 라벨과 디테일을 다르게 표현한다.

---

## 6. preview.seed

seed는 같은 family/variant라도 그래프마다 패턴이 달라지게 만드는 값이다.

예시: seed: 101, seed: 203, seed: 905

그래프가 많아져도 미리보기가 모두 똑같아 보이지 않게 한다.

---

## 7. preview.features

features는 그래프의 세부 특징을 보조로 전달한다.

예시: features: ['averageLine'], features: ['targetLine'], features: ['nodes']

필수 값은 아니며, 그래프별 추가 표현이 필요할 때 사용한다.

---

## 8. 공식 사용 원칙

1. 그래프 미리보기는 GraphPreviewIcon을 기준으로 만든다.
2. 새 그래프는 graphCatalog.js에 preview 메타데이터를 추가한다.
3. 개별 PNG/JPG/WebP 미리보기 이미지는 만들지 않는다.
4. 그래프가 늘어나도 family, variant, metricType, seed 조합으로 같은 결을 유지한다.
5. DashboardWidgetPreview 자체 규칙은 공식 기준이 아니다.
6. DashboardWidgetPreview는 최종적으로 GraphPreviewIcon을 감싸는 wrapper가 되어야 한다.
7. 이 문서는 설명 기준이며, 코드에서 직접 사용하는 실행 기준은 constants/graphPreviewRules.js에 둔다.
8. 전체 미리보기의 색상/선두께/프레임/태그/크기 규칙은 graphPreviewRules.js를 우선 기준으로 한다.

---

## 9. 현재 연결 상태

현재 구조:

```
GraphShopScreen / MyGraphScreen
 → graphCatalog.preview
 → GraphPreviewIcon
 → graphPreviewRules.js 실행 규칙

DashboardEditScreen
 → widgetCatalog.previewFamily
 → DashboardWidgetPreview
 → GraphPreviewIcon 위임 대상은 graphPreviewRules.js 실행 규칙
```

최종 목표:

```
DashboardEditScreen
 → widgetCatalog 또는 graphCatalog에서 preview 객체 확보
 → DashboardWidgetPreview가 GraphPreviewIcon을 감싸서 렌더링
```

즉, 대시보드 수정화면도 최종적으로는 GraphPreviewIcon 기준을 따라야 한다.

---

## 10. 금지 기준

아래 구조는 공식 기준이 아니다.

- DashboardWidgetPreview 자체 규칙만으로 미리보기 생성
- widgetCatalog.previewFamily만으로 최종 그래프 미리보기 확정
- 상점/대시보드/보유그래프가 서로 다른 미리보기 생성 규칙 사용
- GraphPreviewIcon 내부에 새 룩앤필 값을 계속 하드코딩해서 graphPreviewRules.js와 분리되는 구조
- 개별 이미지 파일을 수동으로 추가

---

## 11. 다음 작업자가 먼저 읽어야 할 파일

다른 AI 또는 다른 작업자가 이어받을 때는 아래 순서로 읽는다.

1. docs/GRAPH_PREVIEW_RULE.md
2. constants/graphPreviewRules.js
3. constants/graphCatalog.js
4. components/GraphPreviewIcon.js
5. components/dashboard/DashboardWidgetPreview.js
6. screens/DashboardEditScreen.js

---

## 12. 코드 파일에서 확인하는 방법

아래 파일 상단에 공식 기준 경로 주석을 둔다.

- constants/graphPreviewRules.js: GraphPreviewIcon이 참조할 실행 규칙 파일
- components/GraphPreviewIcon.js: OFFICIAL_GRAPH_PREVIEW_RULE: docs/GRAPH_PREVIEW_RULE.md
- components/dashboard/DashboardWidgetPreview.js: OFFICIAL_GRAPH_PREVIEW_RULE: docs/GRAPH_PREVIEW_RULE.md

따라서 다른 AI가 코드를 먼저 보더라도
docs/GRAPH_PREVIEW_RULE.md를 확인해야 한다는 사실을 알 수 있다.
