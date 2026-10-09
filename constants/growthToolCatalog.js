import { CHALLENGE_TYPE } from '../utils/challengeType';

export const GROWTH_TOOL_CONTENT_TYPES = Object.freeze({ STANDARD: 'standard', LAB: 'lab', DESIGN: 'design' });
export const GROWTH_TOOL_CATEGORIES = Object.freeze({ CONSISTENCY: 'consistency', GROWTH: 'growth', RHYTHM: 'rhythm', ACHIEVEMENT: 'achievement', BALANCE: 'balance', RELATION: 'relation' });
export const GROWTH_TOOL_CATEGORY_LABELS = Object.freeze({ consistency: '꾸준함', growth: '성장', rhythm: '리듬', achievement: '성취·목표', balance: '균형', relation: '관계' });
export const GROWTH_TOOL_SCOPES = Object.freeze({ RECORD_ROOM: 'record_room', ACTIVITY: 'activity', BOTH: 'both' });
export const GROWTH_TOOL_ACQUISITIONS = Object.freeze({ INITIAL_FREE: 'initial_free', EXPERIENCE_REWARD: 'experience_reward', STARS: 'stars' });
export const GROWTH_TOOL_RENDERER_FAMILIES = Object.freeze(['line', 'bar', 'stacked_bar', 'area', 'calendar_heatmap', 'matrix_heatmap', 'histogram', 'donut', 'progress', 'scatter', 'timeline', 'network', 'stat']);
export const GROWTH_TOOL_DATA_SUFFICIENCY = Object.freeze(['insufficient', 'moderate', 'sufficient']);
export const GROWTH_TOOL_ACTIVITY_TYPES = Object.freeze({ ...CHALLENGE_TYPE, FOCUS: 'focus', RECORD_ROOM: 'record_room' });

const ALL = ['challenge', 'habit', 'rotation', 'focus', 'record_room'];
const ACTIVITY = ['challenge', 'habit', 'rotation', 'focus'];
const RR = ['record_room'];
const price = (level) => ({ 1: 20, 5: 40, 10: 60, 15: 90, 20: 130, 30: 200 }[level] ?? 0);
const min = (kind, value, label) => ({ kind, ...(value == null ? {} : { value }), label });
const tool = (id, title, analysisCategory, scope, acquisition, recommendedLevel, rendererFamily, minimumData, supportedActivityTypes, extra = {}) => ({
  id, title, description: `${title} 분석으로 기록에서 확인 가능한 흐름을 보여줍니다.`, contentType: 'standard', analysisCategory, scope, acquisition,
  recommendedLevel, basePrice: acquisition === 'stars' ? price(recommendedLevel) : 0, rendererFamily, supportedActivityTypes,
  minimumData, insightQuestion: `${title}에서 어떤 패턴이 보이나요?`, associationOnly: analysisCategory === 'relation',
  ...(analysisCategory === 'relation' ? { sufficiencyStates: GROWTH_TOOL_DATA_SUFFICIENCY, interpretationRule: 'association_not_causation' } : {}),
  sortOrder: 0, ...extra,
});
const PREVIEW_BY_ID={
consistency_record_calendar:{renderer:'calendarHeatmap',variant:'activityCalendar',data:[[0,0,1,1,0,2,1],[0,1,2,0,1,3,2],[1,0,1,2,2,3,1],[0,1,2,3,1,2,3],[1,2,3,2,1,3,2]]},
consistency_streak:{renderer:'intervalStrip',variant:'streakCompare',current:6,longest:14,max:14},consistency_scheduled_rate:{renderer:'bar',variant:'scheduledCompletion',planned:[1,1,1,1,1,1,1],actual:[0,1,1,0,1,1,1]},consistency_completion_ratio:{renderer:'donut',variant:'completionRatio',data:[58,27,15],centerText:'58%'},consistency_change_curve:{renderer:'line',variant:'consistencyCurve',data:[52,58,54,61,65,63,71,74]},consistency_interval_distribution:{renderer:'histogram',variant:'intervalDistribution',data:[12,7,3,2,1],labels:['1','2','3','4','5+']},consistency_streak_distribution:{renderer:'histogram',variant:'streakDistribution',data:[5,8,4,2],labels:['1-2','3-6','7-13','14+']},consistency_recovery_time:{renderer:'intervalStrip',variant:'recoveryIntervals',data:[1,2,4,2,3]},
growth_weekly_trend:{renderer:'line',variant:'weeklyTrend',data:[68,42,48,46,55,59,61],pointMarkers:true},growth_cumulative:{renderer:'area',variant:'cumulative',data:[3,7,11,17,24,32,41]},growth_moving_average_7d:{renderer:'line',variant:'movingAverage',raw:[30,60,35,70,45,80,55,65,50,90,70,85],average:[45,47,50,52,55,59,61,64,67,70,73,77]},growth_week_vs_previous:{renderer:'bar',variant:'pairedWeek',previous:[3,4,5,3,6,4,2],current:[6,5,4,6,7,5,3]},growth_month_vs_previous:{renderer:'bar',variant:'twoPeriod',previous:[64],current:[82]},growth_start_vs_now:{renderer:'intervalStrip',variant:'dumbbell',start:38,current:72},growth_best_worst_period:{renderer:'bar',variant:'bestWorst',data:[56,78,49,69,85,61],highestIndex:4,lowestIndex:2},growth_long_term_trend:{renderer:'line',variant:'longTermTrend',data:[28,31,30,35,37,41,39,45,48,52,50,58]},
rhythm_weekday_rate:{renderer:'bar',variant:'weekday',data:[53,62,75,58,82,69,44]},rhythm_time_of_day_rate:{renderer:'bar',variant:'timeOfDay',data:[28,46,77,39]},rhythm_weekday_weekend:{renderer:'bar',variant:'weekdayWeekend',data:[71,54]},rhythm_start_time_distribution:{renderer:'histogram',variant:'startTime',data:[3,8,15,11,5,2]},rhythm_focus_duration_distribution:{renderer:'histogram',variant:'focusDuration',data:[5,10,14,7,3]},rhythm_weekday_time_heatmap:{renderer:'matrixHeatmap',variant:'weekdayTime',data:[[0,0,1,0,1,1,0],[1,1,1,2,1,2,1],[1,2,3,2,3,3,2],[2,1,2,1,2,2,1]]},rhythm_planned_actual_time:{renderer:'scatter',variant:'plannedActual',points:[[7,7.2],[9,9.5],[12,11.5],[18,18.8],[20,19.4],[22,22.5]],reference:'y=x'},rhythm_stability:{renderer:'intervalStrip',variant:'rhythmAlignment',data:[19.1,19.4,18.9,19.2,19,19.6,19.1]},
achievement_goal_progress:{renderer:'progress',variant:'ring',value:72,centerText:'72%'},achievement_cumulative:{renderer:'area',variant:'achievementCumulative',data:[2,5,9,14,20,27]},achievement_target_pace:{renderer:'line',variant:'targetVsActual',target:[10,20,30,40,50,60],actual:[8,17,27,39,47,58]},achievement_milestone_timeline:{renderer:'timeline',variant:'milestones',positions:[20,45,70,100]},achievement_personal_best:{renderer:'line',variant:'stepBest',data:[30,30,42,42,42,55,55,63],step:true},achievement_period_goal_rate:{renderer:'bar',variant:'goalRate',data:[75,92,104,88,110],target:100},achievement_projected_goal:{renderer:'line',variant:'projection',actual:[20,31,43,55],projection:[55,68,81,94,100],projectionStart:3},
balance_activity_composition:{renderer:'donut',variant:'activityComposition',data:[35,25,20,12,8]},balance_type_distribution:{renderer:'stackedBar',variant:'activityTypes',data:[30,45,25]},balance_focus_by_activity:{renderer:'bar',variant:'horizontalRanked',orientation:'horizontal',data:[95,70,45,30]},balance_weekly_composition_change:{renderer:'stackedBar',variant:'weeklyComposition',data:[[40,35,25],[35,40,25],[30,45,25],[25,50,25]]},balance_concentration_index:{renderer:'bar',variant:'concentration',orientation:'horizontal',data:[62,18,10,6,4]},
relation_cooccurrence:{renderer:'donut',variant:'overlap',a:62,b:55,overlap:38},relation_conditional_success:{renderer:'bar',variant:'conditionalComparison',data:[74,49]},relation_matrix:{renderer:'matrixHeatmap',variant:'relationMatrix',data:[[null,.7,.3,.5],[.7,null,.4,.2],[.3,.4,null,.6],[.5,.2,.6,null]]},relation_next_day:{renderer:'intervalStrip',variant:'nextDayArrows',rows:4},relation_focus_success:{renderer:'scatter',variant:'focusSuccess',points:[[20,42],[25,55],[35,51],[45,67],[55,63],[65,78],[75,74],[90,86]],trendLine:true},relation_behavior_network:{renderer:'network',variant:'behaviorNetwork',nodes:[{id:'a',x:.18,y:.48,size:7},{id:'b',x:.38,y:.22,size:8},{id:'c',x:.55,y:.5,size:10},{id:'d',x:.78,y:.25,size:7},{id:'e',x:.82,y:.7,size:8},{id:'f',x:.35,y:.76,size:7}],edges:[['a','b',1],['a','c',2],['b','c',3],['c','d',2],['c','e',3],['c','f',2],['f','e',1]]}}

const DISCOVERY_HEADLINES={
  consistency_record_calendar:'나는 얼마나 자주 기록하고 있을까?',consistency_streak:'얼마나 오래 이어가고 있을까?',consistency_scheduled_rate:'계획한 만큼 실제로 해내고 있을까?',consistency_completion_ratio:'완벽하게 한 날과 놓친 날은 얼마나 될까?',consistency_change_curve:'꾸준함은 점점 좋아지고 있을까?',consistency_interval_distribution:'나는 얼마나 규칙적인 간격으로 하고 있을까?',consistency_streak_distribution:'한번 시작하면 보통 얼마나 이어갈까?',consistency_recovery_time:'한번 놓친 뒤 얼마나 빨리 돌아올까?',
  growth_weekly_trend:'이번 주의 흐름은 어떻게 변하고 있을까?',growth_cumulative:'지금까지 얼마나 쌓였을까?',growth_moving_average_7d:'짧은 기복을 걷어내면 성장 흐름은 어떨까?',growth_week_vs_previous:'지난주보다 이번 주는 달라졌을까?',growth_month_vs_previous:'지난달보다 이번 달은 얼마나 달라졌을까?',growth_start_vs_now:'처음과 지금은 얼마나 달라졌을까?',growth_best_worst_period:'언제 가장 잘했고, 언제 가장 어려웠을까?',growth_long_term_trend:'오랫동안 보면 나는 어떻게 변해왔을까?',
  rhythm_weekday_rate:'어느 요일에 가장 잘 움직일까?',rhythm_time_of_day_rate:'하루 중 언제 가장 잘 움직일까?',rhythm_weekday_weekend:'평일과 주말의 나는 얼마나 다를까?',rhythm_start_time_distribution:'나는 보통 몇 시쯤 시작할까?',rhythm_focus_duration_distribution:'한번 집중하면 보통 얼마나 오래 할까?',rhythm_weekday_time_heatmap:'나는 언제 가장 잘 움직일까?',rhythm_planned_actual_time:'계획한 시간과 실제 시작 시간은 얼마나 비슷할까?',rhythm_stability:'내 생활 리듬은 얼마나 일정할까?',
  achievement_goal_progress:'목표에 얼마나 가까워졌을까?',achievement_cumulative:'지금까지 얼마나 달성했을까?',achievement_target_pace:'지금 속도는 목표에 맞을까?',achievement_milestone_timeline:'지금까지 어떤 순간들을 넘어왔을까?',achievement_personal_best:'나의 최고 기록은 어떻게 높아졌을까?',achievement_period_goal_rate:'목표를 얼마나 자주 달성하고 있을까?',achievement_projected_goal:'지금 속도가 이어지면 언제쯤 목표에 닿을까?',
  balance_activity_composition:'나는 무엇에 가장 많은 시간을 쓰고 있을까?',balance_type_distribution:'도전·습관·루틴 중 어디에 가장 집중하고 있을까?',balance_focus_by_activity:'집중시간은 어떤 활동에 가장 많이 쓰고 있을까?',balance_weekly_composition_change:'요즘 내가 집중하는 활동은 어떻게 바뀌고 있을까?',balance_concentration_index:'한 가지 활동에 너무 몰려 있지는 않을까?',
  relation_cooccurrence:'두 행동은 얼마나 자주 함께 나타날까?',relation_conditional_success:'A를 한 날에는 B도 더 자주 했을까?',relation_matrix:'내 행동들은 서로 어떻게 함께 나타날까?',relation_next_day:'오늘의 행동과 다음 날의 행동은 어떤 관계가 있을까?',relation_focus_success:'집중한 시간과 도전 성공은 함께 움직일까?',relation_behavior_network:'내 행동 전체는 어떻게 연결되어 있을까?',
};
const DISCOVERY_SUMMARIES={consistency:'이어온 기록의 모양을 다른 각도에서 살펴봐요.',growth:'시간에 따라 달라진 흐름을 천천히 살펴봐요.',rhythm:'요일과 시간에 따라 나타나는 패턴을 살펴봐요.',achievement:'목표를 향해 지나온 흐름을 살펴봐요.',balance:'내 기록이 어디에 모여 있는지 살펴봐요.',relation:'함께 나타나는 행동의 흐름을 살펴봐요.'};

export const GROWTH_TOOL_CATALOG = [
  tool('consistency_record_calendar','기록 캘린더','consistency','both','initial_free',1,'calendar_heatmap',min('days',1,'1일'),ALL),
  tool('consistency_streak','현재·최장 연속 기록','consistency','both','experience_reward',1,'stat',min('records',2,'유효 기록 2회'),ALL),
  tool('consistency_scheduled_rate','예정 대비 수행률','consistency','both','stars',1,'progress',min('days',7,'7일'),['challenge','habit'],{ tags:['일정'] }),
  tool('consistency_completion_ratio','완벽·부분·미수행 비율','consistency','both','stars',1,'stacked_bar',min('days',7,'7일'),[],{ tags:['부분 수행 판별 가능 데이터 전용'] }),
  tool('consistency_change_curve','꾸준함 변화곡선','consistency','both','stars',5,'line',min('days',14,'14일'),ALL),
  tool('consistency_interval_distribution','수행 간격 분포','consistency','activity','stars',5,'histogram',min('records',10,'유효 수행 10회'),ACTIVITY),
  tool('consistency_streak_distribution','연속 기록 길이 분포','consistency','both','stars',10,'histogram',min('custom',null,'연속 구간 3개 이상'),ALL),
  tool('consistency_recovery_time','실패 후 회복시간','consistency','activity','stars',15,'histogram',min('custom',null,'실패→재개 사례 5회'),['challenge','habit']),

  tool('growth_weekly_trend','주간 성장 추세','growth','both','initial_free',1,'line',min('days',7,'7일'),ALL),
  tool('growth_cumulative','누적 수행량','growth','both','stars',1,'area',min('records',3,'유효 기록 3회'),ALL),
  tool('growth_moving_average_7d','7일 이동평균','growth','both','stars',5,'line',min('days',14,'14일'),ALL),
  tool('growth_week_vs_previous','이번 주 vs 지난주','growth','both','stars',5,'bar',min('days',14,'14일'),ALL),
  tool('growth_month_vs_previous','이번 달 vs 지난달','growth','both','stars',10,'bar',min('months',2,'2개월'),ALL),
  tool('growth_start_vs_now','시작 시점 vs 현재','growth','both','stars',10,'line',min('days',30,'30일'),ALL),
  tool('growth_best_worst_period','최고·최저 기간 비교','growth','both','stars',15,'bar',min('days',60,'60일'),ALL),
  tool('growth_long_term_trend','장기 성장 추세','growth','both','stars',20,'line',min('days',90,'90일'),ALL),

  tool('rhythm_weekday_rate','요일별 수행률','rhythm','both','experience_reward',1,'bar',min('days',14,'14일'),ALL),
  tool('rhythm_time_of_day_rate','시간대별 수행률','rhythm','both','stars',5,'bar',min('records',10,'시간정보가 있는 유효 기록 10회'),ALL),
  tool('rhythm_weekday_weekend','주중 vs 주말','rhythm','both','stars',5,'bar',min('days',14,'14일'),ALL),
  tool('rhythm_start_time_distribution','수행 시작시간 분포','rhythm','activity','stars',10,'histogram',min('records',15,'시간정보가 있는 유효 기록 15회'),ACTIVITY),
  tool('rhythm_focus_duration_distribution','집중시간 길이 분포','rhythm','both','stars',10,'histogram',min('sessions',15,'집중 세션 15회'),['focus','record_room']),
  tool('rhythm_weekday_time_heatmap','요일×시간대 히트맵','rhythm','both','stars',15,'matrix_heatmap',min('days',30,'30일'),ALL),
  tool('rhythm_planned_actual_time','예정시간 vs 실제시간','rhythm','activity','stars',15,'scatter',min('records',15,'예정시간과 실제시간이 모두 있는 기록 15회'),['rotation']),
  tool('rhythm_stability','생활 리듬 안정성','rhythm','record_room','stars',20,'stat',min('records',30,'시간정보가 있는 유효 기록 30회'),RR),

  tool('achievement_goal_progress','목표 진행률','achievement','activity','initial_free',1,'progress',min('custom',null,'목표 존재'),['challenge']),
  tool('achievement_cumulative','누적 달성량','achievement','activity','stars',1,'area',min('records',2,'유효 기록 2회'),ACTIVITY),
  tool('achievement_target_pace','목표 대비 실제 페이스','achievement','activity','stars',5,'line',min('custom',null,'기간형 목표 존재'),['challenge']),
  tool('achievement_milestone_timeline','마일스톤 타임라인','achievement','both','stars',5,'timeline',min('milestones',2,'마일스톤 2개 이상'),ALL),
  tool('achievement_personal_best','개인 최고기록 변화','achievement','activity','stars',10,'line',min('records',5,'비교 가능한 숫자 기록 5회'),['rotation','focus']),
  tool('achievement_period_goal_rate','기간별 목표 달성률','achievement','activity','stars',10,'bar',min('periods',4,'비교 가능한 기간 4개'),['challenge']),
  tool('achievement_projected_goal','현재 페이스 기반 목표 도달선','achievement','activity','stars',15,'line',min('custom',null,'충분한 기간형 목표 기록'),['challenge'],{ insightQuestion:'현재 평균 페이스가 이어진다면 목표 흐름은 어떻게 보이나요?' }),

  tool('balance_activity_composition','활동 구성 비율','balance','record_room','experience_reward',1,'donut',min('activities',2,'서로 다른 활동 2개 이상'),RR),
  tool('balance_type_distribution','도전·습관·루틴별 수행 비중','balance','record_room','stars',5,'stacked_bar',min('activity_types',2,'활동 유형 2종 이상'),RR),
  tool('balance_focus_by_activity','집중시간 활동별 비중','balance','record_room','stars',10,'bar',min('records',10,'활동에 연결 가능한 집중 기록 10회'),RR),
  tool('balance_weekly_composition_change','주간 활동 구성 변화','balance','record_room','stars',15,'stacked_bar',min('weeks',4,'4주'),RR),
  tool('balance_concentration_index','활동 편중도','balance','record_room','stars',20,'stat',min('activities',3,'서로 다른 활동 3개 이상'),RR,{ insightQuestion:'어느 활동에 얼마나 집중되어 있나요?' }),

  tool('relation_cooccurrence','두 행동 동시 수행률','relation','record_room','stars',15,'bar',min('days',20,'공통 관찰일 20일 이상'),RR),
  tool('relation_conditional_success','A 수행일 vs 미수행일의 B 성공률','relation','record_room','stars',20,'bar',min('custom',null,'두 조건 모두 충분한 표본'),RR),
  tool('relation_matrix','행동 관계 매트릭스','relation','record_room','stars',20,'matrix_heatmap',min('custom',null,'활동 3개 이상 + 충분한 공통 기록'),RR),
  tool('relation_next_day','전날 행동 ↔ 다음날 행동','relation','record_room','stars',30,'scatter',min('days',30,'30일 이상'),RR),
  tool('relation_focus_success','집중시간 ↔ 도전 성공 관계','relation','record_room','stars',30,'scatter',min('records',30,'비교 가능한 기록 30건 이상'),RR),
  tool('relation_behavior_network','전체 행동 관계 네트워크','relation','record_room','stars',30,'network',min('custom',null,'활동 4개 이상 + 장기 기록'),RR),
].map((item, index) => Object.freeze({ ...item, sortOrder: index + 1, preview:PREVIEW_BY_ID[item.id], discovery:Object.freeze({ headline:DISCOVERY_HEADLINES[item.id], summary:DISCOVERY_SUMMARIES[item.analysisCategory] }) }));

export const getGrowthToolById = (id) => GROWTH_TOOL_CATALOG.find((toolItem) => toolItem.id === String(id)) ?? null;
export const getGrowthToolsByCategory = (category) => GROWTH_TOOL_CATALOG.filter((item) => item.analysisCategory === category);
export const getGrowthToolsByScope = (scope) => GROWTH_TOOL_CATALOG.filter((item) => item.scope === scope || (scope !== 'both' && item.scope === 'both'));
export const getInitialFreeGrowthTools = () => GROWTH_TOOL_CATALOG.filter((item) => item.acquisition === 'initial_free');
export const getExperienceRewardGrowthTools = () => GROWTH_TOOL_CATALOG.filter((item) => item.acquisition === 'experience_reward');
export const getStarPurchaseGrowthTools = () => GROWTH_TOOL_CATALOG.filter((item) => item.acquisition === 'stars');
export const getGrowthToolCategoryCounts = () => Object.fromEntries(Object.values(GROWTH_TOOL_CATEGORIES).map((category) => [category, getGrowthToolsByCategory(category).length]));
export const searchGrowthTools = (query) => {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return GROWTH_TOOL_CATALOG;
  return GROWTH_TOOL_CATALOG.filter((item) => [item.title, item.description, GROWTH_TOOL_CATEGORY_LABELS[item.analysisCategory], ...(item.tags || [])].join(' ').toLocaleLowerCase().includes(needle));
};
export const getGrowthToolBasePrice = (toolItem) => Math.max(0, Number(toolItem?.basePrice) || 0);
export const getGrowthToolPricing = (toolItem, currentLevel = 1) => {
  const basePrice = getGrowthToolBasePrice(toolItem);
  const recommendedLevel = Math.max(1, Number(toolItem?.recommendedLevel) || 1);
  const earlyPurchase = toolItem?.acquisition === 'stars' && Number(currentLevel || 1) < recommendedLevel;
  return { basePrice, currentPrice: earlyPurchase ? Math.ceil(basePrice * 1.5) : basePrice, recommendedLevel, earlyPurchase };
};
export const getGrowthToolCurrentPrice = (toolItem, currentLevel) => getGrowthToolPricing(toolItem, currentLevel).currentPrice;
export const getGrowthToolInterpretationRule = (toolItem) => toolItem?.associationOnly
  ? { associationOnly:true, prohibitedMeaning:'causation', guidance:'함께 나타난 차이 또는 관계로만 표현합니다.' }
  : { associationOnly:false };
