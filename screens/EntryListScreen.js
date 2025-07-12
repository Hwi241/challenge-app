// screens/EntryListScreen.js

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default function EntryListScreen({ route, navigation }) {
  const { challengeId, title, startDate, targetScore = 7, currentScore = 0 } =
    route.params;
  const [entries, setEntries] = useState([]);
  const [weeksData, setWeeksData] = useState([]);
  const scrollRef = useRef();
  const isFocused = useIsFocused();

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
    // 시작일을 해당 주 월요일로 맞추기
    const start = new Date(startDate);
    const sd = start.getDay() === 0 ? 7 : start.getDay();
    start.setDate(start.getDate() - (sd - 1));

    // 오늘 기준 마지막 일요일 계산
    const today = new Date();
    const td = today.getDay() === 0 ? 7 : today.getDay();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() + (7 - td));

    // 주별 counts 계산
    const weeks = [];
    let cursor = new Date(start);
    while (cursor <= lastSunday) {
      const counts = Array(7).fill(0);
      const ws = new Date(cursor);
      list.forEach((e) => {
        const d = new Date(e.timestamp);
        const diff = Math.floor((d - ws) / 86400000);
        if (diff >= 0 && diff < 7) counts[diff]++;
      });
      weeks.push({ ws, counts });
      cursor.setDate(cursor.getDate() + 7);
    }
    setWeeksData(weeks);

    // 오늘이 속한 주 인덱스 찾기 (없으면 마지막 주)
    const todayIdx = weeks.findIndex(({ ws }) => {
      const diff = Math.floor((today - ws) / 86400000);
      return diff >= 0 && diff < 7;
    });
    const scrollToIdx = todayIdx >= 0 ? todayIdx : weeks.length - 1;

    // 해당 주로 스크롤
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: scrollToIdx * SCREEN_WIDTH,
        animated: false,
      });
    }, 0);
  }

  const overallPct = Math.round((currentScore / targetScore) * 100);

  function renderWeek({ ws, counts }, idx) {
    const max = Math.max(...counts, 1);
    return (
      <View key={idx} style={styles.weekBlock}>
        <View style={styles.labelsRow}>
          {counts.map((_, i) => {
            const d = new Date(ws);
            d.setDate(d.getDate() + i);
            return (
              <View key={i} style={styles.labelItem}>
                <Text style={styles.dateLabel}>
                  {d.getMonth() + 1}/{d.getDate()}
                </Text>
                <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.barsRow}>
          {counts.map((c, i) => (
            <View key={i} style={styles.barItem}>
              {c > 0 && (
                <View
                  style={[
                    styles.bar,
                    { height: `${(c / max) * 60 + 10}%` },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderEntry({ item, index }) {
    return (
      <TouchableOpacity
        style={styles.entry}
        onPress={() =>
          navigation.navigate("EntryDetail", {
            challengeId,
            entryId: item.id,
          })
        }
      >
        <Text style={styles.num}>{entries.length - index}</Text>
        {item.imageUri && (
          <Image source={{ uri: item.imageUri }} style={styles.thumb} />
        )}
        <View style={styles.textWrap}>
          <Text style={styles.text} numberOfLines={1}>
            {item.text}
          </Text>
          <Text style={styles.time}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={entries.sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )}
        keyExtractor={(it) => it.id}
        renderItem={renderEntry}
        ListEmptyComponent={
          <Text style={styles.empty}>등록된 인증이 없습니다.</Text>
        }
        ListHeaderComponent={
          <>
            <Text style={styles.heading}>{title} 인증 목록</Text>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartContainer}
            >
              {weeksData.map(renderWeek)}
            </ScrollView>
            <View style={styles.progressBlock}>
              <Text style={styles.progressTitle}>전체 진행률</Text>
              <View style={styles.progressBg}>
                <View
                  style={[styles.progressFg, { width: `${overallPct}%` }]}
                />
              </View>
              <Text style={styles.progressNum}>{overallPct}%</Text>
            </View>
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  heading: { fontSize: 18, fontWeight: "bold", margin: 12 },

  // 차트
  chartContainer: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  weekBlock: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  labelItem: { alignItems: "center" },
  dateLabel: { fontSize: 10, color: "#666", marginBottom: 2 },
  dayLabel: { fontSize: 9, color: "#333" },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 60,
    marginTop: 2,
  },
  barItem: { width: 16, alignItems: "center" },
  bar: { width: 16, backgroundColor: "#000", borderRadius: 3 },

  // 전체 진행률
  progressBlock: {
    marginHorizontal: 12,
    marginTop: 0,
    marginBottom: 6,
    paddingVertical: 4,
    backgroundColor: "#fafafa",
    borderRadius: 6,
  },
  progressTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
  progressBg: {
    height: 10,
    backgroundColor: "#eee",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFg: { height: 10, backgroundColor: "#000" },
  progressNum: { textAlign: "center", fontSize: 14, marginTop: 2 },

  // 엔트리
  entry: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginVertical: 6,
  },
  num: {
    width: 24,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  thumb: { width: 50, height: 50, borderRadius: 4, marginHorizontal: 8 },
  textWrap: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingBottom: 8,
  },
  text: { fontSize: 14 },
  time: { fontSize: 12, color: "#666", marginTop: 2 },

  empty: { textAlign: "center", marginTop: 50, color: "#999" },
});
