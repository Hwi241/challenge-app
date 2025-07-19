import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView, View, Text, FlatList, Image, StyleSheet, TouchableOpacity,
  Dimensions, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export default function EntryListScreen({ route, navigation }) {
  const { challengeId, title, startDate, targetScore = 7, currentScore = 0 } = route.params;
  const insets = useSafeAreaInsets();
  const scrollRef = useRef();
  const isFocused = useIsFocused();

  const [entries, setEntries] = useState([]);
  const [weeksData, setWeeksData] = useState([]);

  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const raw = await AsyncStorage.getItem(`entries_${challengeId}`);
      const list = raw ? JSON.parse(raw) : [];
      setEntries(list);
      buildWeeks(list);
    })().catch(console.error);
  }, [isFocused, challengeId]);

  function buildWeeks(list) {
    if (!startDate) return;
    const start = new Date(startDate);
    const sd = start.getDay() === 0 ? 7 : start.getDay();
    start.setDate(start.getDate() - (sd - 1));
    const today = new Date();
    const td = today.getDay() === 0 ? 7 : today.getDay();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() + (7 - td));

    const weeks = [];
    let cursor = new Date(start);
    while (cursor <= lastSunday) {
      const ws = new Date(cursor);
      weeks.push({ ws });
      cursor.setDate(cursor.getDate() + 7);
    }
    setWeeksData(weeks);

    const todayIdx = weeks.findIndex(({ ws }) => {
      const diff = Math.floor((today - ws) / 86400000);
      return diff >= 0 && diff < 7;
    });
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: (todayIdx >= 0 ? todayIdx : weeks.length - 1) * SCREEN_WIDTH, animated: false });
    }, 0);
  }

  const overallPct = Math.min(Math.round((currentScore / targetScore) * 100), 100);

  const Header = () => (
    <>
      <Text style={styles.heading}>{title} 인증 목록</Text>
      <View style={{ height: 160 }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {weeksData.map(renderWeek)}
        </ScrollView>
      </View>

      <View style={styles.overallBlock}>
        <Text style={styles.overallTitle}>전체 진행률</Text>
        <View style={styles.progressBg}>
          <View style={[styles.progressFg, { width: `${overallPct}%` }]} />
        </View>
        <Text style={styles.overallPct}>{overallPct}%</Text>
      </View>
    </>
  );

  const renderWeek = ({ ws }, idx) => {
    const maxBarHeight = 60;
    const max = Math.max(...entries.map(e => e.duration || 0), 1);

    const dailyStats = Array(7).fill(null).map((_, i) => {
      const dayStart = new Date(ws);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dailyEntries = entries.filter(e => {
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
                style={[
                  styles.bar,
                  {
                    height: stat.duration > 0
                      ? Math.min((stat.duration / max) * maxBarHeight + 10, maxBarHeight + 10)
                      : 0,
                    marginVertical: 2,
                  },
                ]}
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
      <Text style={styles.number}>{entries.length - index}</Text>
      {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />}
      <View style={styles.textContainer}>
        <Text style={styles.text}>{item.text}</Text>
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
        data={entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))}
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
    marginBottom: 20,
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
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: '#fafafa',
    borderRadius: 8,
  },
  overallTitle: { fontWeight: 'bold', marginBottom: 20 },
  progressBg: {
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
  },
  progressFg: { height: 10, backgroundColor: '#000' },
  overallPct: { textAlign: 'center', marginTop: 10 },
  entry: { flexDirection: 'row', padding: 12 },
  number: { width: 24, fontWeight: 'bold' },
  thumbnail: { width: 50, height: 50 },
  textContainer: { flex: 1, paddingHorizontal: 8 },
  text: { fontSize: 14 },
  time: { fontSize: 12, color: '#666' },
  duration: { fontSize: 12, color: '#007bff', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' },
});
