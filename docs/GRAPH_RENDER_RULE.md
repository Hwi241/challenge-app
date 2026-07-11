# Graph Render Rule

## 1. 목적

이 문서는 실제 대시보드 그래프 렌더링의 공식 기준이다.

기존 docs/GRAPH_PREVIEW_RULE.md와 constants/graphPreviewRules.js는 그래프 상점/편집 화면의 미리보기 기준이다.

이 문서는 실제 대시보드에서 사용자가 보는 그래프 카드의 색상, 형태, 크기, 라벨, 강조 상태, 그리고 미래 사용자 색상 커스텀 구조를 정의한다.

---

## 2. 기준 분리

그래프 관련 기준은 아래처럼 분리한다.

```
constants/graphCatalog.js
  = 어떤 그래프가 있는가
  = 그래프 상품, 카테고리, 가격, 지원 대상, preview 메타데이터

constants/graphPreviewRules.js
  = 상점/편집 화면의 미리보기 그래프는 어떻게 보일 것인가
  = GraphPreviewIcon이 참조하는 작은 아이콘용 실행 기준

constants/graphRenderRules.js
  = 실제 대시보드 그래프가 실제 화면에서 어떻게 렌더링되는가
  = EntryListScreen.js 실제 대시보드 카드 렌더링에 연결된 공식 기준

docs/GRAPH_RENDER_RULE.md
  = 실제 그래프 렌더링 기준 설명 문서
```

중요 원칙:

1. 미리보기 기준과 실제 그래프 기준은 직접 연결하지 않는다.

2. 두 기준은 같은 디자인 언어를 공유하되, 각각 독립적으로 관리한다.

3. 실제 그래프는 데이터, 상호작용, 애니메이션, 사용자 커스텀을 고려해야 하므로 미리보기보다 더 넓은 기준이 필요하다.

---

## 3. 1차 기준 대상 그래프

1차 기준 대상은 현재 실제 대시보드에서 사용하는 graph family 5종이다. 실제 graphId는 이 family 중 하나에 매핑한다.

- overall_progress
  = overallProgress family

- month_calendar
  = calendar family

- weekly_bar
  = weeklyBar family

- line_count_cumulative
line_minutes
health_steps_trend
  = line family

- grass_graph
  = grass family

- health_steps_weekly
  = weeklyBar family

즉, 기준은 5개 그래프만을 위한 것이 아니라 현재와 미래의 graphId를 family에 태우기 위한 분류 체계다.

현재 확인된 Health Connect 그래프 중 health_steps_weekly, health_steps_trend도 1차 매핑에 포함한다.

---

## 4. 색상 기준의 핵심 원칙

실제 그래프 기준은 색상값을 직접 의미로 쓰지 않는다.

나쁜 예:

```
lineColor: '#0A0A0A'
barColor: '#0A0A0A'
```

좋은 예:

```
line: 'primary'
durationBar: 'primary'
countBar: 'axis'
text: 'secondary'
```

즉, 그래프 렌더링 코드는 색상값이 아니라 색상 역할을 기준으로 한다.

이렇게 해야 미래에 사용자가 그래프 색상을 바꿔도 구조를 갈아엎지 않아도 된다.

---

## 5. 기본 색상 역할

constants/graphRenderRules.js는 아래 기본 역할을 가진다.

이 값은 앱 디자인 기준과 같은 방향의 시작 숫자값이지만, styles/common.js를 직접 import하지 않는다.

```javascript
GRAPH_RENDER_COLOR_ROLES = {
  primary: '#0A0A0A',
  secondary: '#525252',
  tertiary: '#737373',
  axis: '#D4D4D4',
  track: '#E5E5E5',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F5F5',
  empty: '#FAFAFA',
  inverse: '#FFFFFF',
  highlight: '#0A0A0A',
  grassLevel0: '#F3F4F6',
  grassLevel1: '#E5E7EB',
  grassLevel2: '#A0A0A0',
  grassLevel3: '#555555',
  grassLevel4: '#111111',
  grassMonthLabel: '#6B7280',
  grassArrow: '#111111',
  calendarCertified: '#111111',
  calendarCertifiedText: '#FFFFFF',
  calendarActiveDateText: '#111111',
  calendarFutureDateText: '#777777',
  calendarEmptyDateText: '#D1D5DB',
  calendarTodayUncertifiedFill: '#D1D5DB',
  calendarTodayUncertifiedText: '#000000',
  calendarHighlight: '#FFD700',
  overallProgressFill: '#111111',
  overallProgressTrack: '#D1D5DB',
  overallProgressCenterFill: '#111111',
  overallProgressLabelText: '#FFFFFF',
}
```

역할 의미:
- primary = 가장 강한 그래프 색
- secondary = 보조 텍스트, 보조 그래프 요소
- tertiary = 약한 보조 텍스트, 오늘 빈 상태, 중간 단계
- axis = 축, 빈 점, 약한 막대, 비활성 점
- track = 진행률 배경, 빈 칸, 약한 배경
- surface = 카드/마커 내부 흰색
- surfaceMuted = 약한 배경
- empty = 가장 약한 빈 상태
- inverse = 어두운 배경 위 글씨
- highlight = 선택 강조, 오늘 강조, 사용자 강조색
- grass*, calendar*, overallProgress* = 기존 실제 화면 색상을 1:1 보존하기 위해 family별로 분리한 전용 기본 역할

---

## 6. 사용자 색상 커스텀 우선순위

미래 색상 설정 기능은 아래 우선순위를 따른다.

1. 개별 카드 인스턴스 색상
2. graphId별 색상
3. family별 색상
4. global 그래프 색상
5. GRAPH_RENDER_COLOR_ROLES 기본값

예시:

```
graph_color_settings_v1 = {
  global: {
    primary: '#0A0A0A',
  },
  byFamily: {
    line: {
      line: '#2563EB',
    },
  },
  byGraphId: {
    weekly_bar: {
      durationBar: '#111111',
      countBar: '#A3A3A3',
      text: '#525252',
    },
  },
  byInstanceId: {
    'dashboard-item-abc123': {
      durationBar: '#DC2626',
    },
  },
}
```

원칙:

1. 사용자는 그래프 하나당 3~4개 색상 슬롯만 직접 바꾼다.

2. 모든 세부 색상을 사용자에게 노출하지 않는다.

3. 사용자가 바꾸지 않은 색상은 기본 역할값을 따른다.

4. 같은 family의 그래프라도 graphId 또는 instanceId로 개별 override 가능해야 한다.

5. 같은 그래프를 대시보드에 여러 개 배치하는 미래 구조를 고려해 instanceId override를 마지막 목표로 둔다.

---

## 7. 편집 가능한 색상 슬롯 원칙

각 그래프는 사용자가 직접 바꿀 수 있는 색상 슬롯을 가진다.

슬롯은 화면에 노출될 수 있는 이름과 내부 역할명을 함께 가진다.

예시:

```
durationBar: {
  label: '시간 막대',
  defaultRole: 'primary',
}
```

구조 원칙:

- slot key
  = 코드 내부에서 쓰는 안정적인 이름

- label
  = 사용자 화면에 보일 이름

- defaultRole
  = 사용자가 색을 바꾸지 않았을 때 참조할 기본 색상 역할

- description
  = 설정 화면 또는 문서에서 설명할 짧은 문장

---

## 8. 전체 진행률 기준

대상: overall_progress

사용자 편집 가능 색상 슬롯:
```javascript
overallProgress: {
  progress: {
    label: '진행률',
    defaultRole: 'overallProgressFill',
  },
  track: {
    label: '남은 영역',
    defaultRole: 'overallProgressTrack',
  },
  centerFill: {
    label: '중앙 원',
    defaultRole: 'overallProgressCenterFill',
  },
  label: {
    label: '숫자',
    defaultRole: 'overallProgressLabelText',
  },
}
```

형태 기준:
```javascript
overallProgress: {
  bodyBaseHeight: 146,
  baseSize: 104,
  baseStroke: 11,
  minScale: 0.75,
  maxScale: 1.45,
  safePadBase: 4,
  safePadMin: 3,
  safePadMax: 8,
  minStroke: 3,
  labelBaseFontSize: 20,
  labelMinFontSize: 11,
  labelMaxFontSize: 21,
  labelLineGap: 2,
  innerRadiusFactor: 1.25,
  minInnerRadius: 2,
}
```

원칙:
- 진행률의 핵심 색은 progress 슬롯이다.
- 남은 원형 트랙은 track 슬롯이다.
- 숫자 뒤 중앙 원은 centerFill 슬롯이다.
- 숫자 텍스트는 label 슬롯을 따른다.
- 기존 도넛 화면 색상과 크기 기준을 유지하면서 graphRenderRules 기준으로 연결한다.

---

## 9. 달력 기준

대상: month_calendar

사용자 편집 가능 색상 슬롯:
```javascript
calendar: {
  certifiedDay: {
    label: '인증일 배경',
    defaultRole: 'calendarCertified',
  },
  certifiedText: {
    label: '인증일 글씨',
    defaultRole: 'calendarCertifiedText',
  },
  activeDateText: {
    label: '활성 날짜 글씨',
    defaultRole: 'calendarActiveDateText',
  },
  futureDateText: {
    label: '미래 날짜 글씨',
    defaultRole: 'calendarFutureDateText',
  },
  emptyDateText: {
    label: '빈 날짜 글씨',
    defaultRole: 'calendarEmptyDateText',
  },
  today: {
    label: '오늘 배경',
    defaultRole: 'calendarTodayUncertifiedFill',
  },
  todayText: {
    label: '오늘 글씨',
    defaultRole: 'calendarTodayUncertifiedText',
  },
  highlight: {
    label: '선택 강조',
    defaultRole: 'calendarHighlight',
  },
}
```

내부 파생 역할:
- certifiedFill = certifiedDay
- certifiedText = certifiedText
- activeDateText = activeDateText
- futureDay = futureDateText
- emptyDay = emptyDateText
- todayFill = today
- todayText = todayText
- activeTodayText = certifiedText
- highlightBorder = highlight

형태 기준:
```javascript
calendar: {
  bodyBaseHeight: 142,
  dowHeight: 14,
  dowFontSize: 10.5,
  gridTopGap: 3,
  bottomPad: 4,
  badgeRadius: 8,
  highlightBorderWidth: 2,
  todayBorderWidth: 2,
}
```

원칙:
- 기존 월간 달력 실제 화면 색상을 1:1 보존한다.
- 인증일, 인증일 글씨, 일반 날짜, 미래 날짜, 빈 날짜, 오늘, 선택 강조를 분리한다.
- 오늘이 인증된 경우처럼 내부 상태에 따라 필요한 색은 internal color map에서 연결한다.
- 하이라이트의 기존 노란색 기준은 calendarHighlight 역할로 분리한다.

---

## 10. 주간 막대그래프 기준

대상:

- weekly_bar

사용자 편집 가능 색상 슬롯:

```
weeklyBar: {
  durationBar: {
    label: '시간 막대',
    defaultRole: 'primary',
  },
  countBar: {
    label: '횟수 막대',
    defaultRole: 'axis',
  },
  text: {
    label: '글씨',
    defaultRole: 'secondary',
  },
  accent: {
    label: '오늘/강조',
    defaultRole: 'primary',
  },
}
```

형태 기준:

```
weeklyBar: {
  barWidth: 16,
  barRadius: 4,
  segmentGap: 2,
  emptyDotSize: 4,
  pagerDotSize: 5,
  pagerDotActiveSize: 6,
}
```

원칙:

1. 시간 막대와 횟수 막대는 서로 다른 슬롯으로 둔다.

2. 글씨 색은 막대 색과 독립적으로 바꿀 수 있어야 한다.

3. 오늘 날짜, 오늘 요일, 현재 주 페이저 등은 accent 슬롯을 기준으로 한다.

4. 사용자가 한 그래프에서 시간 막대, 횟수 막대, 글씨 색을 각각 다르게 설정할 수 있어야 한다.

---

## 11. 선형그래프 기준

대상:

- line_count_cumulative
- line_minutes

사용자 편집 가능 색상 슬롯:

```
line: {
  line: {
    label: '선',
    defaultRole: 'primary',
  },
  marker: {
    label: '점',
    defaultRole: 'primary',
  },
  text: {
    label: '글씨',
    defaultRole: 'secondary',
  },
  tooltip: {
    label: '선택 라벨',
    defaultRole: 'primary',
  },
}
```

형태 기준:

```
line: {
  strokeWidth: 1.6,
  axisStrokeWidth: 1,
  markerRadius: 3.2,
  selectedMarkerRadius: 3.8,
  tooltipRadius: 6,
  tooltipFontSize: 10,
  touchRadius: 16,
}
```

내부 파생 역할:

- axis = axis
- tooltipText = inverse
- markerFill = surface
- pagerActive = line slot
- pagerInactive = axis

원칙:

1. 선 색과 점 색은 분리할 수 있어야 한다.

2. 글씨 색은 선 색과 독립적으로 바꿀 수 있어야 한다.

3. 선택 라벨 배경은 tooltip 슬롯으로 둔다.

4. 라벨 내부 글씨는 자동으로 inverse를 사용한다.

5. 누적 선형과 시간 선형은 같은 family 기준을 공유하되 graphId별 override를 허용한다.

---

## 12. 잔디그래프 기준

대상: grass_graph

사용자 편집 가능 색상 슬롯:
```javascript
grass: {
  level0: {
    label: '빈 칸',
    defaultRole: 'grassLevel0',
  },
  level1: {
    label: '약한 칸',
    defaultRole: 'grassLevel1',
  },
  level2: {
    label: '기록 1단계',
    defaultRole: 'grassLevel2',
  },
  level3: {
    label: '기록 2단계',
    defaultRole: 'grassLevel3',
  },
  level4: {
    label: '기록 3단계',
    defaultRole: 'grassLevel4',
  },
  monthLabel: {
    label: '월 글씨',
    defaultRole: 'grassMonthLabel',
  },
  arrow: {
    label: '화살표',
    defaultRole: 'grassArrow',
  },
}
```

형태 기준:
```javascript
grass: {
  baseHeight: 168,
  rows: 7,
  topLabelHeight: 18,
  topLabelGap: 4,
  minCellSize: 8,
  maxCellSize: 18,
  minCellGap: 2,
  maxCellGap: 4,
  cellRadius: 2,
  monthFontSize: 10.5,
  monthLineHeight: 13,
  arrowSize: 15,
  waveWidth: 4,
  waveSpeed: 0.02,
  waveDiagonal: 0.6,
}
```

색상 단계 원칙:
- level0 = 기존 빈 칸 색
- level1 = 기존 약한 칸 색
- level2 = 기존 기록 1단계 색
- level3 = 기존 기록 2단계 색
- level4 = 기존 기록 3단계 색
- waveLow = level1
- waveMid = level2
- waveHigh = level3
- wavePeak = level4

원칙:
- 기존 잔디그래프의 단계별 색상 차이를 유지한다.
- 초기 계획처럼 base/empty만 노출하면 기존 단계감이 무너질 수 있으므로 현재 구현은 level0~level4를 명시 슬롯으로 둔다.
- 월 라벨과 화살표 색상도 실제 화면 기준에 맞춰 별도 슬롯으로 둔다.
- 웨이브 애니메이션은 단계 색상을 기준으로 움직인다.

---

## 13. graphRenderRules.js 현재 구현 구조

현재 constants/graphRenderRules.js는 생성 예정 파일이 아니라 실제 화면 렌더링에 연결된 공식 기준 파일이다.

현재 구조:
- GRAPH_RENDER_GRAPH_IDS
- GRAPH_RENDER_FAMILIES
- GRAPH_RENDER_GRAPH_FAMILY_BY_ID
- GRAPH_RENDER_COLOR_ROLES
- GRAPH_RENDER_EDITABLE_COLOR_SLOTS
- GRAPH_RENDER_LAYOUT_RULES
- GRAPH_RENDER_INTERNAL_COLOR_MAP
- GRAPH_RENDER_COLOR_SETTING_PRIORITY
- GRAPH_RENDER_COLOR_SETTING_STORAGE_KEY
- getExplicitGraphRenderFamilyForGraphId()
- isKnownGraphRenderGraphId()
- getGraphRenderFamilyForGraphId()
- shouldCreateNewGraphRenderFamily()
- getGraphRenderEditableColorSlots()
- getGraphRenderLayoutRules()
- getGraphRenderRoleColor()
- getGraphRenderSlotDefaultRole()
- getGraphRenderSlotDefaultColor()
- resolveGraphRenderColorSlot()
- resolveGraphRenderColors()
- resolveGraphRenderRule()

현재 실제 화면 연결 상태:
- line family: line_count_cumulative / line_minutes / health_steps_trend
- weeklyBar family: weekly_bar / health_steps_weekly
- grass family: grass_graph
- calendar family: month_calendar
- overallProgress family: overall_progress

현재 연결된 주요 실제 화면 컴포넌트:
- DashboardLineChart / LineGradientChart / HealthLinkedRecordsLineWidget
- WeekView / HealthStepsWeeklyWidget
- GrassGraph
- MonthCalendar
- Donut / DashboardProgressWidget

주의:
- 사용자 색상 커스텀 UI는 아직 연결하지 않았다.
- graphRenderRules는 실제 화면 기준이고, graphPreviewRules는 상점/편집 미리보기 기준이다.
- 두 기준은 직접 import로 묶지 않는다.

---

## 14. 새 그래프와 새 family 확장 기준

그래프 종류는 계속 늘어날 수 있다.

새 그래프가 생기면 먼저 기존 family로 표현 가능한지 판단한다.

1. 기존 family로 표현 가능한 그래프인가?
 = 기존 family에 graphId만 매핑한다.

2. 기존 family로 표현하면 억지인가?
 = 새 family를 만든다.

3. 새 family를 만들면 아래 기준을 반드시 함께 추가한다.
 - GRAPH_RENDER_FAMILIES
 - GRAPH_RENDER_GRAPH_FAMILY_BY_ID
 - GRAPH_RENDER_EDITABLE_COLOR_SLOTS
 - GRAPH_RENDER_LAYOUT_RULES
 - GRAPH_RENDER_INTERNAL_COLOR_MAP

기존 family를 재사용하는 예:

- health_steps_trend = line family
- health_steps_weekly = weeklyBar family
- 새로운 월별 추이 그래프 = line family
- 새로운 주간 비교 막대 그래프 = weeklyBar 또는 bar 계열 family

새 family가 필요한 예:

- 카테고리 비율 원형 그래프 = pie 또는 donut family 필요 가능
- 분포 그래프 = distribution family 필요 가능
- 목표별 비교형 가로 막대 그래프 = compareBar family 필요 가능
- 네트워크 관계 그래프 = network family 필요 가능

알 수 없는 graphId가 들어오면 기본 fallback은 line family로 둔다.

단, fallback은 임시 안전장치다.

새 그래프가 실제 상품으로 등록되면 반드시 명시적으로 GRAPH_RENDER_GRAPH_FAMILY_BY_ID에 매핑해야 한다.

---

## 15. 669 적용 완료 상태

669 단계에서 실제 화면 연결은 아래 순서로 완료됐다.

- 669-7 = line family 실제 화면 연결 완료 = line_count_cumulative / line_minutes / health_steps_trend
- 669-10 = weeklyBar family 실제 화면 연결 완료 = weekly_bar / health_steps_weekly
- 669-13 = grass family 실제 화면 연결 완료 = grass_graph = 기존 잔디 색상 단계 1:1 복원 포함
- 669-15 = calendar family 실제 화면 연결 완료 = month_calendar = 기존 달력 색상 1:1 보존
- 669-17 = overallProgress family 실제 화면 연결 완료 = overall_progress = Donut / DashboardProgressWidget 연결 = donutSize 선언 전 참조 위험 제거

현재 원칙:
- 실제 대시보드 그래프 5개 family는 graphRenderRules 기준으로 연결 완료됐다.
- 연결 후 기본값은 기존 실제 화면과 최대한 같게 유지한다.
- 사용자 색상 커스텀 기능은 아직 만들지 않는다.
- 다음 단계에서 색상 커스텀 UI를 만들 경우 이 문서와 constants/graphRenderRules.js를 기준으로 진행한다.
- 새 그래프가 늘어나면 기존 family 재사용 가능 여부를 먼저 판단한다.
- 새 family가 필요하면 색상 슬롯, 레이아웃, 내부 색상 매핑을 세트로 추가한다.

---

## 16. 금지 기준

아래 방식은 금지한다.

1. 실제 그래프가 graphPreviewRules.js를 직접 참조하는 구조
2. 미리보기와 실제 그래프 기준을 한 파일로 합치는 구조
3. 사용자가 모든 세부 색을 직접 고르게 만드는 구조
4. 색상값을 의미 없이 컴포넌트 안에 계속 하드코딩하는 구조
5. graphId별/instanceId별 override를 고려하지 않는 구조
6. 앱 common.js 토큰을 직접 import해 그래프 기준을 종속시키는 구조

---

## 17. 다음 작업자가 먼저 읽어야 할 파일

실제 그래프 기준 작업자는 아래 순서로 읽는다.

1. docs/GRAPH_RENDER_RULE.md
2. constants/graphRenderRules.js
3. screens/EntryListScreen.js
4. constants/widgetCatalog.js
5. constants/graphCatalog.js
6. docs/GRAPH_PREVIEW_RULE.md
7. constants/graphPreviewRules.js

constants/graphRenderRules.js는 이미 생성되어 있으며, 실제 화면 연결 기준으로 유지 관리한다.

---

## 17. 실제 대시보드 카드 family 분류와 색상 커스텀 준비 기준

이 섹션은 ACTUAL_DASHBOARD_GRAPH_WIDGET_IDS 기준 실제 challenge/habit 대시보드 카드 전체를 graphRenderRules family 기준으로 정리한다.

목적은 단순한 색상 하드코딩 제거가 아니라, 이후 사용자 색상 커스텀 기능에서 아래 단위가 모두 가능하도록 사전에 구조를 맞추는 것이다.

- byInstanceId
 = 같은 graphId라도 특정 배치 카드 1개만 색상 변경

- byGraphId
 = 특정 카드 종류 전체 색상 변경

- byFamily
 = 같은 형태 family 전체 색상 변경

- global
 = 모든 그래프/대시보드 카드 공통 색상 변경

- default
 = 앱 기본값

핵심 원칙:

1. family는 그래프의 형태 문법이다.

2. graphId는 사용자 색상 커스텀의 카드 종류 단위다.

3. 같은 family를 쓰더라도 graphId는 카드별로 고유하게 유지한다.

4. 렌더 컴포넌트는 가능하면 graphId prop을 받아 resolveGraphRenderRule({ graphId })를 호출해야 한다.

5. 여러 카드가 같은 컴포넌트를 공유하더라도 하나의 graphId로 뭉개지 않는다.

6. 현재 실제 카드가 없는 미래 family는 코드에 미리 만들지 않는다.

7. 현재 실제 카드 때문에 필요한 family만 추가한다.

8. recordRoom 전용 그래프는 이번 670 흐름의 범위에서 제외하고 별도 단계에서 판단한다.

---

### 17-1. 기존 family 유지 대상

아래 카드들은 이미 존재하는 family를 그대로 사용한다.

| graphId | family | 기준 |
|---|---|---|
| overall_progress | overallProgress | 원형 도넛 진행률 |
| month_calendar | calendar | 월간 달력 |
| weekly_bar | weeklyBar | 도전/습관 주간 인증 막대 |
| line_count_cumulative | line | 누적 횟수 선형 추세 |
| line_minutes | line | 시간 선형 추세 |
| grass_graph | grass | 잔디/히트맵 |
| health_steps_weekly | weeklyBar | 걸음 수 주간 리듬 |
| health_steps_trend | line | 걸음 수 선형 추세 |

주의:

- health_steps_weekly는 Health 카드지만 형태가 기존 weeklyBar와 맞으므로 새 family를 만들지 않는다.
- health_steps_trend는 Health 카드지만 형태가 기존 line과 맞으므로 새 family를 만들지 않는다.

---

### 17-2. line family로 추가 매핑할 Health 추세형 카드

아래 카드들은 새 family가 아니라 기존 line family를 사용한다.

| graphId | family | 기준 |
|---|---|---|
| health_exercise_minutes_trend | line | 운동 시간 선형 추세 |
| health_distance_trend | line | 운동 거리 선형 추세 |
| health_active_calories_trend | line | 운동 칼로리 선형 추세 |
| health_sleep_hours_trend | line | 수면 시간 선형 추세 |
| health_heart_rate_trend | line | 평균 심박 선형 추세 |
| health_weight_trend | line | 체중 선형 추세 |
| health_body_fat_trend | line | 체지방률 선형 추세 |
| health_bmi_trend | line | BMI 선형 추세 |

중요:

현재 HealthLinkedRecordsLineWidget은 여러 metricType을 처리하지만, 모든 추세형 카드를 하나의 health_steps_trend graphId로 처리하면 나중에 graphId별 색상 커스텀이 불가능하다.

따라서 다음 코드 연결 단계에서는 HealthLinkedRecordsLineWidget이 graphId prop을 받도록 하고, 각 렌더 분기에서 고유 graphId를 전달해야 한다.

예상 연결 방향:

- health_exercise_minutes_trend
 = GRAPH_RENDER_GRAPH_IDS.HEALTH_EXERCISE_MINUTES_TREND

- health_distance_trend
 = GRAPH_RENDER_GRAPH_IDS.HEALTH_DISTANCE_TREND

- health_active_calories_trend
 = GRAPH_RENDER_GRAPH_IDS.HEALTH_ACTIVE_CALORIES_TREND

- health_sleep_hours_trend
 = GRAPH_RENDER_GRAPH_IDS.HEALTH_SLEEP_HOURS_TREND

- health_heart_rate_trend
 = GRAPH_RENDER_GRAPH_IDS.HEALTH_HEART_RATE_TREND

- health_weight_trend
 = GRAPH_RENDER_GRAPH_IDS.HEALTH_WEIGHT_TREND

- health_body_fat_trend
 = GRAPH_RENDER_GRAPH_IDS.HEALTH_BODY_FAT_TREND

- health_bmi_trend
 = GRAPH_RENDER_GRAPH_IDS.HEALTH_BMI_TREND

---

### 17-3. 신규 progressBar family

대상:

| graphId | family | 기준 |
|---|---|---|
| health_steps_goal_rate | progressBar | 숫자 + 가로 진행률 바 |

progressBar는 overallProgress와 다르다.

- overallProgress
 = 원형 도넛, 원형 track, 중앙 원, 숫자

- progressBar
 = 큰 숫자, 가로 bar, track, 목표 달성 색, 보조 설명

예상 색상 슬롯:

| slot | 의미 |
|---|---|
| progressFill | 채워진 진행 바 |
| trackFill | 남은 영역 배경 |
| successFill | 목표 달성 상태 색 |
| valueText | 큰 숫자 |
| captionText | 보조 설명 |
| emptyText | 데이터 없음 글씨 |

예상 내부 색상 map:

| internal key | slot |
|---|---|
| progressFill | progressFill |
| trackFill | trackFill |
| successFill | successFill |
| valueText | valueText |
| captionText | captionText |
| emptyText | emptyText |

예상 layout 기준:

| key | value | 의미 |
|---|---:|---|
| bodyBaseHeight | 96 | 기본 본문 높이 |
| valueFontSize | 28 | 큰 숫자 기준 크기 |
| captionFontSize | 10 | 보조 설명 기준 크기 |
| barHeight | 6 | 진행 바 높이 |
| barRadius | 3 | 진행 바 반경 |
| barWidthRatio | 0.8 | 카드 폭 대비 바 폭 |
| gapAfterValue | 4 | 값 아래 간격 |
| gapBeforeBar | 8 | 바 위 간격 |

적용 기준:

- 목표 대비 달성률을 가로 진행 바와 숫자로 보여주면 progressBar를 사용한다.
- 원형 도넛이면 overallProgress를 사용한다.
- 목표 달성 여부에 따라 색이 바뀌면 successFill을 사용한다.

---

### 17-4. 신규 metricBar family

대상:

| graphId | family | 기준 |
|---|---|---|
| health_steps_cumulative | metricBar | 누적 걸음수 막대 |
| health_exercise_weekly_minutes | metricBar | 주간 운동시간 막대 |
| health_distance_weekly | metricBar | 주간 이동거리 막대 |
| health_distance_cumulative | metricBar | 누적 운동거리 막대 |

metricBar는 weeklyBar와 다르다.

- weeklyBar
 = 도전/습관 인증 리듬, 요일, 시간/횟수 구분, 오늘 강조, 주간 페이저

- metricBar
 = 수치형 metric, 최신값, 단위, 누적 여부, 목표선 가능

예상 색상 슬롯:

| slot | 의미 |
|---|---|
| barFill | 일반 막대 |
| latestBarFill | 최신 막대 |
| goalLine | 목표선 |
| valueText | 최신값 글씨 |
| captionText | 보조 글씨 |
| emptyText | 데이터 없음 글씨 |

예상 내부 색상 map:

| internal key | slot |
|---|---|
| barFill | barFill |
| latestBarFill | latestBarFill |
| goalLine | goalLine |
| valueText | valueText |
| captionText | captionText |
| emptyText | emptyText |

예상 layout 기준:

| key | value | 의미 |
|---|---:|---|
| bodyBaseHeight | 120 | 기본 본문 높이 |
| chartMinHeight | 40 | 최소 차트 높이 |
| chartBottomReserved | 40 | 하단 텍스트 예약 높이 |
| barWidth | 14 | 일반 막대 폭 |
| cumulativeBarWidth | 20 | 누적 막대 폭 |
| barRadius | 4 | 막대 반경 |
| minBarHeight | 6 | 최소 막대 높이 |
| valueFontSize | 11 | 값 글씨 크기 |
| captionFontSize | 10 | 보조 글씨 크기 |

적용 기준:

- 여러 날짜/항목을 막대 높이로 비교하면 metricBar를 사용한다.
- 최신값 텍스트가 붙는 수치형 카드면 metricBar를 사용한다.
- Health 전용으로 묶지 않고, 향후 다른 수치형 막대 카드에도 재사용한다.

---

### 17-5. 신규 stackedSegment family

대상:

| graphId | family | 기준 |
|---|---|---|
| health_sleep_rhythm | stackedSegment | 수면 단계 비율 조각 바 |

stackedSegment는 metricBar와 다르다.

- metricBar
 = 각 막대 높이가 값

- stackedSegment
 = 한 줄 전체가 100%, 각 조각 너비가 비율

예상 색상 슬롯:

| slot | 의미 |
|---|---|
| trackFill | 전체 배경 |
| segmentPrimary | 강한 구간 |
| segmentSecondary | 중간 구간 |
| segmentTertiary | 약한 구간 |
| segmentMuted | 흐린 구간 |
| valueText | 값 글씨 |
| captionText | 보조 글씨 |
| emptyText | 데이터 없음 글씨 |

예상 내부 색상 map:

| internal key | slot |
|---|---|
| trackFill | trackFill |
| segmentPrimary | segmentPrimary |
| segmentSecondary | segmentSecondary |
| segmentTertiary | segmentTertiary |
| segmentMuted | segmentMuted |
| valueText | valueText |
| captionText | captionText |
| emptyText | emptyText |

예상 layout 기준:

| key | value | 의미 |
|---|---:|---|
| bodyBaseHeight | 96 | 기본 본문 높이 |
| segmentHeight | 18 | 조각 바 높이 |
| segmentRadius | 9 | 조각 바 반경 |
| labelGap | 8 | 라벨 간격 |
| legendGap | 6 | 범례 간격 |
| captionFontSize | 10 | 보조 글씨 크기 |
| valueFontSize | 12 | 값 글씨 크기 |
| legendFontSize | 9 | 범례 글씨 크기 |

적용 기준:

- 전체 대비 구성 비율을 한 줄의 조각으로 보여주면 stackedSegment를 사용한다.
- 수면 단계, 활동 구성, 시간 배분 같은 구조에 재사용할 수 있다.
- 막대 높이 비교가 아니므로 metricBar에 넣지 않는다.

---

### 17-6. 신규 infoCard family

대상:

| graphId | family | 기준 |
|---|---|---|
| goal_black_box | infoCard | 목표/보상 설명 카드 |

infoCard는 그래프 family가 아니라 대시보드 정보 카드 family다.

goal_black_box는 ACTUAL_DASHBOARD_GRAPH_WIDGET_IDS에 포함되어 있지만, 데이터 시각화가 아니라 목표와 보상을 보여주는 카드다.

그래도 나중에 사용자가 카드별 색상을 바꿀 수 있게 하려면 graphRenderRules 기준에 포함한다.

예상 색상 슬롯:

| slot | 의미 |
|---|---|
| titleText | 제목 |
| bodyText | 본문 |
| captionText | 보조 설명 |
| accentText | 강조 글씨 |
| surfaceFill | 카드 내부 배경 |
| divider | 구분선 |
| emptyText | 빈 상태 글씨 |

예상 내부 색상 map:

| internal key | slot |
|---|---|
| titleText | titleText |
| bodyText | bodyText |
| captionText | captionText |
| accentText | accentText |
| surfaceFill | surfaceFill |
| divider | divider |
| emptyText | emptyText |

예상 layout 기준:

| key | value | 의미 |
|---|---:|---|
| bodyBaseHeight | 72 | 기본 본문 높이 |
| titleFontSize | 13 | 제목 크기 |
| bodyFontSize | 12 | 본문 크기 |
| captionFontSize | 10 | 보조 글씨 크기 |
| titleLineHeight | 17 | 제목 줄높이 |
| bodyLineHeight | 16 | 본문 줄높이 |
| verticalGap | 5 | 세로 간격 |
| horizontalPadding | 12 | 좌우 여백 |

적용 기준:

- 축, 선, 막대, 달력, 잔디, segment가 없고 설명/목표/보상 정보 중심이면 infoCard를 사용한다.
- goal_black_box는 graph가 아니지만 실제 대시보드 카드이므로 infoCard family로 관리한다.
- recordRoom의 메모/상태 카드로 확장할지는 별도 단계에서 판단한다.

---

### 17-7. 최종 ACTUAL_DASHBOARD_GRAPH_WIDGET_IDS 분류표

| graphId | family | 이번 670 흐름 처리 |
|---|---|---|
| overall_progress | overallProgress | 완료 |
| goal_black_box | infoCard | 신규 family 필요 |
| month_calendar | calendar | 완료 |
| weekly_bar | weeklyBar | 완료 |
| line_count_cumulative | line | 완료 |
| line_minutes | line | 완료 |
| grass_graph | grass | 완료 |
| health_steps_weekly | weeklyBar | 완료 |
| health_steps_trend | line | 완료 |
| health_exercise_minutes_trend | line | graphId 추가 필요 |
| health_distance_trend | line | graphId 추가 필요 |
| health_steps_goal_rate | progressBar | 신규 family 필요 |
| health_steps_cumulative | metricBar | 신규 family 필요 |
| health_exercise_weekly_minutes | metricBar | 신규 family 필요 |
| health_distance_weekly | metricBar | 신규 family 필요 |
| health_distance_cumulative | metricBar | 신규 family 필요 |
| health_active_calories_trend | line | graphId 추가 필요 |
| health_sleep_hours_trend | line | graphId 추가 필요 |
| health_sleep_rhythm | stackedSegment | 신규 family 필요 |
| health_heart_rate_trend | line | graphId 추가 필요 |
| health_weight_trend | line | graphId 추가 필요 |
| health_body_fat_trend | line | graphId 추가 필요 |
| health_bmi_trend | line | graphId 추가 필요 |

---

### 17-8. 다음 코드 작업 순서

670-3:

- constants/graphRenderRules.js에 누락 graphId와 신규 family 4개를 추가한다.
- GRAPH_RENDER_GRAPH_IDS 추가
- GRAPH_RENDER_FAMILIES 추가
- GRAPH_RENDER_GRAPH_FAMILY_BY_ID 추가
- GRAPH_RENDER_COLOR_ROLES 추가
- GRAPH_RENDER_EDITABLE_COLOR_SLOTS 추가
- GRAPH_RENDER_LAYOUT_RULES 추가
- GRAPH_RENDER_INTERNAL_COLOR_MAP 추가
- 문서와 코드 매핑을 검증한다.
- 아직 EntryListScreen.js 렌더 연결은 최소화한다.

670-4:

- Health 추세형 line 카드들이 각자의 고유 graphId로 resolveGraphRenderRule을 타도록 연결한다.
- HealthLinkedRecordsLineWidget에 graphId prop을 추가한다.
- 기존 health_steps_trend 하나로 뭉개진 구조를 해소한다.

670-5:

- progressBar, metricBar, stackedSegment 실제 렌더 컴포넌트를 graphRenderRules 기준으로 연결한다.
- health_steps_goal_rate
- health_steps_cumulative
- health_exercise_weekly_minutes
- health_distance_weekly
- health_distance_cumulative
- health_sleep_rhythm

670-6:

- goal_black_box를 infoCard 기준으로 연결한다.
- DashboardGoalWidget이 infoCard family의 colors/layout을 사용하도록 한다.

---

### 17-9. 금지 기준

1. 새 카드를 하나의 기존 graphId로 뭉개지 않는다.

2. Health 추세형 카드를 모두 health_steps_trend로 처리하지 않는다.

3. family 이름을 데이터 출처 기준으로 만들지 않는다.

4. Health 전용 family를 불필요하게 만들지 않는다.

5. 실제 카드가 없는 미래 family를 코드에 미리 만들지 않는다.

6. 색상 커스텀 UI가 아직 없더라도 byGraphId, byFamily, byInstanceId 확장을 막는 구조로 만들지 않는다.

7. 하드코딩 색을 새로 추가하지 않는다.

8. recordRoom 그래프는 이번 670 흐름에서 섞지 않는다.
