import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  SafeAreaView, View, Text, FlatList, Image, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// 'latest' = 항상 최신 주로 열기 / 'today' = 오늘이 포함된 주로 열기
const SCROLL_MODE = 'latest';

export default function EntryListScreen({ route, navigation }) {
  const {
    challengeId,
    title,
    startDate: startDateFromRoute,
    targetScore = 7,
    endDate: endDateFromRoute,
    rewardTitle: rewardTitleFromRoute,
    reward: rewardFromRoute,
  } = route.params;

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const scrollRef = useRef();

  const [entries, setEntries] = useState([]);
  const [weeksData, setWeeksData] = useState([]);
  const [currentScore, setCurrentScore] = useState(0);

  // 기간/보상 메타: route에 없으면 AsyncStorage에서 보충
  const [meta, setMeta] = useState({
    startDate: startDateFromRoute ?? null,
    endDate: endDateFromRoute ?? null,
    rewardTitle: rewardTitleFromRoute ?? null,
    reward: rewardFromRoute ?? null,
  });

  // 데이터 로드
  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      // 1) 인증 목록
      const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
      const list = raw ? JSON.parse(raw) : [];
      setEntries(list);
      setCurrentScore(list.length);

      // 2) 도전 메타 보충
      let loadedMeta = { ...meta };
      try {
        const oneRaw = await AsyncStorage.getItem(`challenge_${challengeId}`);
        if (oneRaw) {
          const one = JSON.parse(oneRaw);
          loadedMeta = {
            startDate: loadedMeta.startDate ?? one.startDate ?? null,
            endDate:   loadedMeta.endDate   ?? one.endDate   ?? null,
            rewardTitle: loadedMeta.rewardTitle ?? one.rewardTitle ?? null,
            reward:      loadedMeta.reward      ?? one.reward      ?? null,
          };
        } else {
          const listRaw = await AsyncStorage.getItem('challenges');
          if (listRaw) {
            const arr = JSON.parse(listRaw);
            const found = Array.isArray(arr) ? arr.find(c => c.id === challengeId) : null;
            if (found) {
              loadedMeta = {
                startDate: loadedMeta.startDate ?? found.startDate ?? null,
                endDate:   loadedMeta.endDate   ?? found.endDate   ?? null,
                rewardTitle: loadedMeta.rewardTitle ?? found.rewardTitle ?? null,
                reward:      loadedMeta.reward      ?? found.reward      ?? null,
              };
            }
          }
        }
      } catch (_) {}
      setMeta(loadedMeta);

      // 3) 주간 데이터 구성
      buildWeeks(list, loadedMeta.startDate ?? startDateFromRoute);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, challengeId]);

  // 주간 데이터 구성 (월~일)
  function buildWeeks(list, startDateStr) {
    if (!startDateStr) {
      setWeeksData([]);
      return;
    }
    const start = new Date(startDateStr);
    const sd = start.getDay() === 0 ? 7 : start.getDay(); // 1~7 (월~일)
    start.setDate(start.getDate() - (sd - 1)); // 해당 주 월요일로 보정

    const today = new Date();
    const td = today.getDay() === 0 ? 7 : today.getDay();
    const thisSunday = new Date(today);
    thisSunday.setDate(today.getDate() + (7 - td)); // 이번 주 일요일(포함)

    const weeks = [];
    let cursor = new Date(start);
    while (cursor <= thisSunday) {
      const ws = new Date(cursor); // 월요일

      const dailyStats = Array(7).fill(null).map((_, i) => {
        const dayStart = new Date(ws);
        dayStart.setDate(dayStart.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const dailyEntries = list.filter(e => {
          const d = new Date(e.timestamp);
          return d >= dayStart && d < dayEnd;
        });

        const durationSum = dailyEntries.reduce(
          (sum, e) => sum + (typeof e.duration === 'number' ? e.duration : 0),
          0
        );

        return {
          date: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`,
          duration: durationSum,
          count: dailyEntries.length,
        };
      });

      weeks.push({ ws, dailyStats });
      cursor.setDate(cursor.getDate() + 7);
    }
    setWeeksData(weeks);
  }

  // 오늘 주 인덱스
  const todayWeekIndex = useMemo(() => {
    if (!weeksData || weeksData.length === 0) return 0;
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (let i = 0; i < weeksData.length; i++) {
      const ws = new Date(weeksData[i].ws);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7); // 다음 주 월요일(미포함)
      if (t0 >= ws && t0 < we) return i;
    }
    return Math.max(weeksData.length - 1, 0);
  }, [weeksData]);

  // 최신 주 인덱스
  const latestWeekIndex = useMemo(() => Math.max(weeksData.length - 1, 0), [weeksData]);

  // 이번 렌더에서 사용할 대상 인덱스
  const targetIndex = useMemo(() => {
    return (SCROLL_MODE === 'today') ? todayWeekIndex : latestWeekIndex;
  }, [todayWeekIndex, latestWeekIndex]);

  // 초기 오프셋 (처음부터 해당 페이지로 시작)
  const initialOffsetX = useMemo(() => targetIndex * SCREEN_WIDTH, [targetIndex]);

  // 백업 스크롤 (혹시 초기 오프셋이 안 먹을 때)
  const backupScroll = useCallback(() => {
    if (!scrollRef.current) return;
    try {
      scrollRef.current.scrollTo({ x: initialOffsetX, y: 0, animated: false });
    } catch {}
  }, [initialOffsetX]);

  const overallPct = Math.min(Math.round((currentScore / targetScore) * 100), 100);

  // 정렬은 사본으로 계산
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [entries]
  );

  // 상단 기간/보상 박스
  function renderPeriodAndReward() {
    const startStr = meta.startDate ? new Date(meta.startDate) : null;
    const endStr = meta.endDate ? new Date(meta.endDate) : null;

    const fmt = (d) => {
      if (!d) return '-';
      const y = d.getFullYear();
      const m = `${d.getMonth() + 1}`.padStart(2, '0');
      const day = `${d.getDate()}`.padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const periodText = `기간  ${fmt(startStr)}  ~  ${fmt(endStr)}`;
    const rewardText = meta.rewardTitle
      ? `보상  ${meta.rewardTitle}`
      : (meta.reward ? `보상  ${meta.reward}` : '보상  -');

    return (
      <View style={styles.infoBlock}>
        <Text style={styles.infoLine}>{periodText}</Text>
        <Text style={styles.infoLine}>{rewardText}</Text>
      </View>
    );
  }

  const Header = () => (
    <>
      <Text style={styles.heading}>{title} 인증 목록</Text>

      {/* 기간/보상 요약 */}
      {renderPeriodAndReward()}

      {/* 주간 진행(가로 스크롤) */}
      <View style={{ height: 160 }}>
        <ScrollView
          // 핵심: weeksData/targetIndex가 바뀔 때 리마운트 → 초기 contentOffset 보장
          key={`sv-${weeksData.length}-${targetIndex}`}
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentOffset={{ x: initialOffsetX, y: 0 }}   // 초기 오프셋
          onLayout={backupScroll}                        // 백업 스크롤 1
          onContentSizeChange={backupScroll}            // 백업 스크롤 2
        >
          {weeksData.map(renderWeek)}
        </ScrollView>
      </View>

      {/* 전체 진행률 */}
      <View style={styles.overallBlock}>
        <Text style={styles.overallTitle}>전체 진행률</Text>
        <View style={styles.progressBg}>
          <View style={[styles.progressFg, { width: `${overallPct}%` }]} />
        </View>
        <Text style={styles.overallPct}>{overallPct}%</Text>
      </View>
    </>
  );

  const renderWeek = ({ ws, dailyStats }, idx) => {
    const maxBarHeight = 60;
    const max = Math.max(...dailyStats.map(stat => stat.duration || 0), 1);

    return (
      <View key={idx} style={styles.weekBlock}>
        <View style={styles.labelRow}>
          {dailyStats.map((stat, i) => (
            <View key={i} style={{ alignItems: 'center', width: SCREEN_WIDTH / 7 }}>
              <Text style={styles.dateLabel}>{stat.date}</Text>
              <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
            </View>
          ))}
        </View>

        <View style={styles.barRow}>
          {dailyStats.map((stat, i) => (
            <View key={i} style={styles.barContainer}>
              <Text style={styles.barText}>
                {stat.duration > 0 ? `${stat.duration}분` : ' '}
              </Text>
              <View
                style={[styles.bar, {
                  height: stat.duration > 0
                    ? Math.min((stat.duration / max) * maxBarHeight + 10, maxBarHeight + 10)
                    : 1,
                  opacity: stat.duration > 0 ? 1 : 0,
                  marginVertical: 2,
                }]}
              />
              <Text style={styles.countLabel}>{stat.count}회</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderEntry = ({ item, index }) => (
    <TouchableOpacity
      style={styles.entry}
      onPress={() => navigation.navigate('EntryDetail', { challengeId, entryId: item.id })}
    >
      <Text style={styles.number}>{sortedEntries.length - index}</Text>
      {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />}
      <View style={styles.textContainer}>
        <Text style={styles.text} numberOfLines={2}>{item.text}</Text>
        <Text style={styles.time}>{new Date(item.timestamp).toLocaleString()}</Text>
        {typeof item.duration === 'number' && (
          <Text style={styles.duration}>소요 시간: {item.duration}분</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={sortedEntries}
        keyExtractor={(it) => it.id}
        renderItem={renderEntry}
        ListHeaderComponent={<Header />}
        ListEmptyComponent={<Text style={styles.empty}>등록된 인증이 없습니다.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 12,
  },

  // 기간/보상 요약
  infoBlock: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoLine: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },

  weekBlock: {
    width: SCREEN_WIDTH,
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    height: 120,
  },
  barContainer: {
    width: SCREEN_WIDTH / 7,
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 120,
    paddingVertical: 2,
  },
  barText: {
    fontSize: 10,
    color: '#666',
  },
  dateLabel: { fontSize: 10, color: '#666' },
  dayLabel: { fontSize: 9, color: '#333' },
  bar: { width: 16, backgroundColor: '#000', borderRadius: 4 },
  countLabel: {
    fontSize: 10,
    color: '#333',
    marginTop: 2,
  },

  overallBlock: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: '#fafafa',
    borderRadius: 8,
  },
  overallTitle: { fontWeight: 'bold', marginBottom: 12 },
  progressBg: {
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
  },
  progressFg: { height: 10, backgroundColor: '#000' },
  overallPct: { textAlign: 'center', marginTop: 10 },

  entry: { flexDirection: 'row', padding: 12 },
  number: { width: 24, fontWeight: 'bold' },
  thumbnail: { width: 50, height: 50, borderRadius: 6, backgroundColor: '#f2f2f2' },
  textContainer: { flex: 1, paddingHorizontal: 8 },
  text: { fontSize: 14 },
  time: { fontSize: 12, color: '#666' },
  duration: { fontSize: 12, color: '#007bff', marginTop: 4 },

  empty: { textAlign: 'center', marginTop: 50, color: '#999' },
});
