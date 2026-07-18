# Graph Preview Rule

## 1. 목적

그래프 미리보기는 개별 PNG, JPG, WebP 이미지로 만들지 않는다.
모든 실제 그래프는 `constants/graphCatalog.js`의 `preview` 메타데이터와
`constants/graphPreviewRules.js`의 실행 규칙을 기준으로
`components/GraphPreviewIcon.js`가 자동 렌더링한다.

그래프 상점, 보유 그래프, 대시보드 편집 화면은 모두 같은 메타데이터와 같은 렌더러를 사용한다.
이 문서는 그래프 미리보기의 공식 정책 기준이다.

---

## 2. 공식 구조

```
constants/graphCatalog.js
  └─ graphId
       └─ preview.family
       └─ preview.variant
       └─ preview.metricType
       └─ preview.seed
       └─ preview.features

constants/graphPreviewRules.js
  └─ 공통 프레임
  └─ 색상 역할
  └─ metric 라벨
  └─ family별 크기·좌표·굵기
  └─ 특수 variant 실행 규칙

components/GraphPreviewIcon.js
  └─ graph 또는 preview 입력
  └─ family·variant 분기
  └─ react-native-svg 렌더링

components/dashboard/DashboardWidgetPreview.js
  ├─ graphCatalog에 등록된 graphId
  │    └─ getGraphById(graphId)
  │    └─ graphCatalog.preview
  │    └─ GraphPreviewIcon
  └─ graphCatalog에 없는 비그래프 위젯
       └─ 기존 전용 미리보기 렌더러

정책 문서: docs/GRAPH_PREVIEW_RULE.md
실행 기준: constants/graphPreviewRules.js / constants/graphCatalog.js / components/GraphPreviewIcon.js
```

## 3. 단일 원본 원칙

실제 그래프 미리보기의 단일 원본은 `graphCatalog.preview`이다.

graphId → graphCatalog.preview → GraphPreviewIcon → graphPreviewRules

다음 화면에서 서로 다른 family·variant를 별도로 추측하지 않는다.

- 그래프 상점
- 보유 그래프
- 대시보드 편집 화면

DashboardWidgetPreview는 실제 그래프의 family, variant, metricType, seed를 추측하지 않는다.
실제 그래프 여부는 getGraphById(widgetId)로 판단한다.

## 4. preview 메타데이터

모든 실제 그래프는 아래 필드를 가진다.

| 필드 | 역할 |
|------|------|
| family | 그래프의 큰 시각적 형태 |
| variant | 같은 family 안에서의 고유 형태 |
| metricType | 데이터 의미와 미리보기 라벨 |
| seed | 샘플 데이터 패턴 차이 |
| features | 검색·설명에 사용하는 보조 특징 |

예시:
```js
preview: {
  family: GRAPH_PREVIEW_FAMILIES.BAR,
  variant: 'weeklyGoal',
  metricType: GRAPH_METRIC_TYPES.STEPS,
  seed: 501,
  features: ['Health Connect', '걸음 수', '8,000보 목표'],
}
```

## 5. 지원 family

GraphPreviewIcon이 지원하는 family는 9개이다.

| family | 설명 |
|--------|------|
| line | 선형 그래프 |
| bar | 일반·누적·목표선·세그먼트 막대 |
| pie | 원형·도넛 그래프 |
| distribution | 분포·열감·박스 플롯 |
| network | 관계망 그래프 |
| calendar | 월간 달력 |
| infoCard | 목표·보상 정보 카드 |
| progress | 가로 진행률 |
| grass | 잔디형 기록 그리드 |

현재 23개 그래프 카탈로그에서 실제 사용 중인 family는 7개이다.

| family | graphId 개수 |
|--------|-------------|
| line | 11 |
| bar | 7 |
| pie | 1 |
| calendar | 1 |
| infoCard | 1 |
| progress | 1 |
| grass | 1 |
| **합계** | **23** |

distribution과 network 렌더러는 향후 그래프를 위해 지원하지만 현재 23개 카탈로그에는 사용하지 않는다.

## 6. 지원 variant

| family | variant |
|--------|---------|
| LINE | basic, dotLine, smoothLine, dualLine, curveWithBreak, forecastLine |
| BAR | solidBars, compareBars, stackedBars, weeklyGoal, cumulativeBars, stackedSegment |
| PIE | donut, segmentedPie |
| DISTRIBUTION | basic, heatGrid, heatmap, boxPlot |
| NETWORK | basic, clusterNetwork |
| 독립 family | calendar/calendar, infoCard/infoCard, progress/horizontalProgress, grass/grassGrid |

## 7. 현재 23개 graphId 연결표

| graphId | family | variant |
|---------|--------|---------|
| overall_progress | pie | donut |
| month_calendar | calendar | calendar |
| goal_black_box | infoCard | infoCard |
| health_steps_weekly | bar | weeklyGoal |
| health_steps_trend | line | smoothLine |
| health_exercise_minutes_trend | line | smoothLine |
| health_distance_trend | line | smoothLine |
| health_steps_goal_rate | progress | horizontalProgress |
| health_steps_cumulative | bar | cumulativeBars |
| health_exercise_weekly_minutes | bar | solidBars |
| health_distance_weekly | bar | solidBars |
| health_distance_cumulative | bar | cumulativeBars |
| health_active_calories_trend | line | smoothLine |
| health_sleep_hours_trend | line | smoothLine |
| health_sleep_rhythm | bar | stackedSegment |
| health_heart_rate_trend | line | smoothLine |
| health_weight_trend | line | smoothLine |
| health_body_fat_trend | line | smoothLine |
| health_bmi_trend | line | smoothLine |
| weekly_bar | bar | solidBars |
| line_count_cumulative | line | smoothLine |
| line_minutes | line | smoothLine |
| grass_graph | grass | grassGrid |

## 8. 실제 형태를 반영하는 특수 미리보기

다음 그래프는 일반 family 기본형이 아니라 실제 그래프의 고유 형태를 반영한다.

| graphId | 표현 |
|---------|------|
| month_calendar | 7열 월간 달력과 오늘 강조 |
| goal_black_box | 목표·보상 정보 카드 |
| health_steps_weekly | 주간 막대와 목표선 |
| health_steps_goal_rate | 가로 진행률 |
| health_steps_cumulative | 누적 증가 막대 |
| health_distance_cumulative | 누적 증가 막대 |
| health_sleep_rhythm | 수면 단계 세그먼트 |
| grass_graph | 5단계 잔디 그리드와 오늘 강조 |

대표 8종은 상점·보유 그래프·대시보드 편집 화면에서 사용자 육안 확인을 완료했다.

## 9. metricType

현재 그래프 카탈로그와 미리보기 규칙에서 사용하는 주요 metricType은 다음과 같다.

| metricType | 표시 | 의미 |
|------------|------|------|
| count | 횟수 | |
| minute | 분 | |
| duration | 기간 | |
| date | 날짜 | |
| score | 점수 | |
| percent | 퍼센트 | |
| relation | 관계 | |
| steps | 보 | |
| distance | km | |
| exercise | 운동 | |
| calories | kcal | |
| sleep | 수면 | |
| heartRate | bpm | |
| weight | kg | |
| bodyFat | % | |
| bmi | BMI | |

metric 라벨은 GRAPH_PREVIEW_METRIC_LABELS에서 관리한다.

## 10. graphPreviewRules 원칙

시각적 상수는 components/GraphPreviewIcon.js 내부에 임의로 추가하지 않는다.
다음 항목은 constants/graphPreviewRules.js에서 관리한다.

- 프레임 크기와 모서리
- 배경과 테두리
- 공통 색상 역할
- metric 태그
- 축과 선 굵기
- 막대 폭과 간격
- 달력 셀 크기
- 정보 카드 구성
- 가로 진행률 구성
- 수면 세그먼트 구성
- 목표선 구성
- 누적 막대 구성
- 잔디 셀 구성
- 화면 크기별 미리보기 프리셋

새로운 미리보기 형태가 필요하면 먼저 실행 규칙을 추가한 후 렌더러를 연결한다.

## 11. DashboardWidgetPreview 역할

DashboardWidgetPreview는 두 종류의 위젯을 구분한다.

### 실제 그래프 위젯
widgetId → resolveDashboardGraphCatalogItem(widgetId) → getGraphById(widgetId) → GraphPreviewIcon graph prop

이 경로에서는 제목이나 문자열로 family·variant를 추측하지 않는다.

### 비그래프 위젯
다음과 같은 graphCatalog 미등록 위젯은 기존 전용 렌더러를 유지한다.
- KPI
- 일반 진행 위젯
- 프로필
- 배터리
- 연결 상태
- 메모
- 기록실 보드
- 테마
- 펄스
- 준비 중 placeholder

비그래프 위젯의 previewFamily와 resolveWidgetPreviewFamily는 계속 사용할 수 있다.

## 12. 새 그래프 추가 절차

새 실제 그래프를 추가할 때는 다음 순서를 따른다.

1. graphCatalog.js에 고유 graphId를 등록한다.
2. preview.family를 정한다.
3. 기존 variant로 표현 가능한지 확인한다.
4. 가능하면 기존 variant를 사용한다.
5. 불가능하면 graphPreviewRules.js에 실행 규칙을 먼저 추가한다.
6. GraphPreviewIcon.js에 renderer 또는 variant 분기를 연결한다.
7. widgetCatalog.js의 실제 그래프 ID 목록과 일치시킨다.
8. 상점·보유 그래프·대시보드 편집 화면에서 확인한다.
9. Babel과 Expo export를 검증한다.
10. 이 문서의 연결표를 갱신한다.

## 13. 금지 기준

아래 구조는 공식 기준이 아니다.

- 실제 그래프의 family를 widget 제목에서 추측
- graphId 문자열을 분석해 variant 결정
- 대시보드 편집 화면에서 별도 seed 생성
- widgetCatalog.previewFamily만으로 실제 그래프 미리보기 확정
- 상점·보유·대시보드가 서로 다른 preview 객체 사용
- 실제 그래프마다 별도 PNG/JPG/WebP 미리보기 제작
- GraphPreviewIcon 내부에 새로운 크기·색상값을 계속 하드코딩
- graphCatalog에 없는 임시 실제 그래프 추가
- 비그래프 위젯을 graphCatalog 그래프로 위장

## 14. 검증 기준

미리보기 파트 완료 조건은 다음과 같다.

- graphCatalog graphId 23개 유지
- widgetCatalog 실제 그래프 ID 23개와 일치
- 모든 실제 그래프에 preview 존재
- 모든 preview에 family·variant·metricType·seed 존재
- 지원하지 않는 family·variant 없음
- 그래프 상점에서 동일 기준 사용
- 보유 그래프에서 동일 기준 사용
- 대시보드 편집에서 동일 기준 사용
- 비그래프 위젯 전용 미리보기 유지
- Babel 통과
- Expo Android export 통과
- 대표 8종 육안 확인 완료

## 15. 다음 작업자가 먼저 읽을 파일

다른 AI 또는 작업자가 이어받을 때는 아래 순서로 읽는다.

1. docs/GRAPH_PREVIEW_RULE.md
2. constants/graphCatalog.js
3. constants/graphPreviewRules.js
4. components/GraphPreviewIcon.js
5. components/dashboard/DashboardWidgetPreview.js
6. constants/widgetCatalog.js
7. screens/DashboardEditScreen.js

## 16. 현재 완료 상태

현재 완료된 항목:

- 공식 미리보기 엔진 구축
- 특수 미리보기 표현 7종 추가
- 23개 graphId preview metadata 연결
- 실제 형태와 달랐던 8개 그래프 수정
- 상점·보유·대시보드 편집 단일 기준 통일
- 그래프 추측 로직 제거
- 비그래프 렌더러 보존
- 대표 8종 사용자 육안 확인
- Babel 검증
- Expo Android export 검증

따라서 그래프 미리보기 파트의 구현과 화면 검증은 완료된 상태이다.
