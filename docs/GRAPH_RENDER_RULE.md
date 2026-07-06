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
  = 실제 대시보드 그래프는 어떻게 보일 것인가
  = 이 문서의 다음 구현 대상

docs/GRAPH_RENDER_RULE.md
  = 실제 그래프 렌더링 기준 설명 문서
```

중요 원칙:

1. 미리보기 기준과 실제 그래프 기준은 직접 연결하지 않는다.

2. 두 기준은 같은 디자인 언어를 공유하되, 각각 독립적으로 관리한다.

3. 실제 그래프는 데이터, 상호작용, 애니메이션, 사용자 커스텀을 고려해야 하므로 미리보기보다 더 넓은 기준이 필요하다.

---

## 3. 1차 기준 대상 그래프

1차 기준 대상은 현재 실제 대시보드에서 사용하는 아래 5종이다.

- overall_progress
  = 전체 진행률

- month_calendar
  = 달력

- weekly_bar
  = 주간 막대그래프

- line_count_cumulative / line_minutes
  = 선형그래프

- grass_graph
  = 잔디그래프

Health Connect 그래프와 기록실 그래프는 이후 단계에서 이 기준을 확장해 적용한다.

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

```
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
}
```

역할 의미:

- primary
  = 가장 강한 그래프 색

- secondary
  = 보조 텍스트, 보조 그래프 요소

- tertiary
  = 약한 보조 텍스트, 오늘 빈 상태, 중간 단계

- axis
  = 축, 빈 점, 약한 막대, 비활성 점

- track
  = 진행률 배경, 빈 칸, 약한 배경

- surface
  = 카드/마커 내부 흰색

- surfaceMuted
  = 약한 배경

- empty
  = 가장 약한 빈 상태

- inverse
  = 어두운 배경 위 글씨

- highlight
  = 선택 강조, 오늘 강조, 사용자 강조색

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

대상:

- overall_progress

사용자 편집 가능 색상 슬롯:

```
overallProgress: {
  progress: {
    label: '진행률',
    defaultRole: 'primary',
  },
  track: {
    label: '남은 영역',
    defaultRole: 'track',
  },
  label: {
    label: '숫자',
    defaultRole: 'primary',
  },
}
```

형태 기준:

```
overallProgress: {
  baseSize: 104,
  baseStroke: 11,
  minScale: 0.75,
  maxScale: 1.45,
}
```

원칙:

1. 진행률의 핵심 색은 progress 슬롯이다.

2. 남은 원형 트랙은 track 슬롯이다.

3. 숫자 텍스트는 기본적으로 label 슬롯을 따른다.

4. 사용자가 진행률 색만 바꿔도 전체 진행률의 인상이 자연스럽게 바뀌어야 한다.

---

## 9. 달력 기준

대상:

- month_calendar

사용자 편집 가능 색상 슬롯:

```
calendar: {
  certifiedDay: {
    label: '인증일',
    defaultRole: 'primary',
  },
  dateText: {
    label: '날짜 글씨',
    defaultRole: 'secondary',
  },
  today: {
    label: '오늘',
    defaultRole: 'track',
  },
  highlight: {
    label: '선택 강조',
    defaultRole: 'highlight',
  },
}
```

내부 파생 역할:

- futureDay = tertiary
- emptyDay = axis 또는 track
- certifiedText = inverse
- todayText = primary

형태 기준:

```
calendar: {
  badgeRadius: 8,
  todayBorderWidth: 2,
}
```

원칙:

1. 사용자는 인증일, 날짜 글씨, 오늘, 선택 강조 정도만 바꾸면 된다.

2. 미래일, 빈칸, 인증일 내부 글씨는 기준에서 자동 파생한다.

3. 하이라이트는 별도 슬롯으로 둔다.

4. 현재의 노란 강조색 같은 값도 미래에는 highlight 슬롯으로 흡수한다.

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

대상:

- grass_graph

사용자 편집 가능 색상 슬롯:

```
grass: {
  base: {
    label: '기록 색',
    defaultRole: 'primary',
  },
  empty: {
    label: '빈 칸',
    defaultRole: 'track',
  },
  text: {
    label: '월 글씨',
    defaultRole: 'secondary',
  },
  accent: {
    label: '강조 효과',
    defaultRole: 'primary',
  },
}
```

형태 기준:

```
grass: {
  rows: 7,
  minCellSize: 8,
  maxCellSize: 18,
  minCellGap: 2,
  maxCellGap: 4,
  cellRadius: 2,
  monthFontSize: 10.5,
}
```

색상 단계 원칙:

- level0 = empty
- level1 = track
- level2 = tertiary
- level3 = secondary
- level4 = base

원칙:

1. 사용자가 5단계 색을 모두 직접 고르게 하지 않는다.

2. 사용자는 기록 색인 base와 빈 칸인 empty 정도를 고른다.

3. 중간 단계는 기준에서 자동 파생하거나 기본 역할을 사용한다.

4. 웨이브 애니메이션은 accent와 단계 색상을 기준으로 움직인다.

---

## 13. graphRenderRules.js 예상 구조

다음 구현 단계에서 만들 파일 구조는 아래를 기준으로 한다.

```javascript
export const GRAPH_RENDER_COLOR_ROLES = Object.freeze({
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
});

export const GRAPH_RENDER_EDITABLE_COLOR_SLOTS = Object.freeze({
  overallProgress: Object.freeze({
    progress: Object.freeze({ label: '진행률', defaultRole: 'primary' }),
    track: Object.freeze({ label: '남은 영역', defaultRole: 'track' }),
    label: Object.freeze({ label: '숫자', defaultRole: 'primary' }),
  }),

  calendar: Object.freeze({
    certifiedDay: Object.freeze({ label: '인증일', defaultRole: 'primary' }),
    dateText: Object.freeze({ label: '날짜 글씨', defaultRole: 'secondary' }),
    today: Object.freeze({ label: '오늘', defaultRole: 'track' }),
    highlight: Object.freeze({ label: '선택 강조', defaultRole: 'highlight' }),
  }),

  weeklyBar: Object.freeze({
    durationBar: Object.freeze({ label: '시간 막대', defaultRole: 'primary' }),
    countBar: Object.freeze({ label: '횟수 막대', defaultRole: 'axis' }),
    text: Object.freeze({ label: '글씨', defaultRole: 'secondary' }),
    accent: Object.freeze({ label: '오늘/강조', defaultRole: 'primary' }),
  }),

  line: Object.freeze({
    line: Object.freeze({ label: '선', defaultRole: 'primary' }),
    marker: Object.freeze({ label: '점', defaultRole: 'primary' }),
    text: Object.freeze({ label: '글씨', defaultRole: 'secondary' }),
    tooltip: Object.freeze({ label: '선택 라벨', defaultRole: 'primary' }),
  }),

  grass: Object.freeze({
    base: Object.freeze({ label: '기록 색', defaultRole: 'primary' }),
    empty: Object.freeze({ label: '빈 칸', defaultRole: 'track' }),
    text: Object.freeze({ label: '월 글씨', defaultRole: 'secondary' }),
    accent: Object.freeze({ label: '강조 효과', defaultRole: 'primary' }),
  }),
});
```

---

## 14. 적용 순서

안전한 적용 순서는 아래와 같다.

- 669-1 = 이 문서 생성
- 669-2 = constants/graphRenderRules.js 생성 (아직 화면 연결 없음)
- 669-3 = 선형그래프 기준 연결 (LineGradientChart부터 적용)
- 669-4 = 주간막대그래프 기준 연결
- 669-5 = 잔디그래프 기준 연결
- 669-6 = 달력 기준 연결
- 669-7 = 전체 진행률 기준 연결

원칙:

1. 한 단계에서 한 그래프 family만 연결한다.

2. 연결 전후 시각 변화가 크지 않게 기본값을 현재 앱 디자인 기준에 맞춘다.

3. 사용자 색상 커스텀 기능은 아직 만들지 않는다.

4. 하지만 모든 기준 이름은 미래 커스텀 기능에서 그대로 재사용할 수 있게 만든다.

---

## 15. 금지 기준

아래 방식은 금지한다.

1. 실제 그래프가 graphPreviewRules.js를 직접 참조하는 구조
2. 미리보기와 실제 그래프 기준을 한 파일로 합치는 구조
3. 사용자가 모든 세부 색을 직접 고르게 만드는 구조
4. 색상값을 의미 없이 컴포넌트 안에 계속 하드코딩하는 구조
5. graphId별/instanceId별 override를 고려하지 않는 구조
6. 앱 common.js 토큰을 직접 import해 그래프 기준을 종속시키는 구조

---

## 16. 다음 작업자가 먼저 읽어야 할 파일

실제 그래프 기준 작업자는 아래 순서로 읽는다.

1. docs/GRAPH_RENDER_RULE.md
2. constants/graphRenderRules.js
3. screens/EntryListScreen.js
4. constants/widgetCatalog.js
5. constants/graphCatalog.js
6. docs/GRAPH_PREVIEW_RULE.md
7. constants/graphPreviewRules.js

constants/graphRenderRules.js가 아직 없다면 이 문서를 기준으로 먼저 생성한다.
