import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# HeaderCardForShare 내부의 컴포넌트들도 플레이스홀더로 교체
# start: <View style={[styles.row, { marginTop: 16 }]}> (line 1790 부근)
# end: </TouchableOpacity> (line 1823 부근)
old3 = """      <View style={[styles.row, { marginTop: 16 }]}>
        <TouchableOpacity style={styles.donutArea} onPress={() => { introKRef.current = 0; setIntroK(0); runIntro(); }} activeOpacity={0.8}>
          <Text style={[styles.sectionLabel, styles.progressLabel, { textAlign:'center', marginBottom: 8 }]}>전체 진행률</Text>
          <View style={{ marginTop: 24 }}>
            <Donut targetPercent={overallPct} progress={1} />
          </View>
        </TouchableOpacity>

        <View style={styles.calendarArea}>
          <MonthCalendar
            startDate={meta.startDate || new Date()}
            endDate={meta.endDate || new Date()}
            entriesByDaySet={entriesByDaySet}
            monthDate={monthDate}
            onPrev={prevMonth}
            onNext={nextMonth}
            canPrev={canPrevMonth}
            canNext={canNextMonth}
          />
        </View>
      </View>

      <View style={styles.sectionBox}>
        <WeekView weeksData={weeksData} currentIndex={weekIndex} onIndexChange={setWeekIndex} introProgress={1} />
      </View>

      {/* GRASS_PLACEHOLDER */}

      <TouchableOpacity style={[styles.sectionBox, { paddingHorizontal: EDGE, alignItems:'center' }]} onPress={() => { introKRef.current = 0; setIntroK(0); runIntro(); }} activeOpacity={0.85}>
        {meta.startDate ? (
          <LineChartsPager startDate={meta.startDate} entries={entries} introProgress={1} interactive={false} />
        ) : (
          <Text style={{ textAlign:'center', color:textGrey }}>시작일이 없습니다.</Text>
        )}
      </TouchableOpacity>"""

new3 = """      {/* DONUT_CALENDAR_WEEK_PLACEHOLDER */}
      {/* GRASS_PLACEHOLDER */}
      {/* LINECHART_PLACEHOLDER */}"""

# Note: bak3 롤백 후 setIntroK(0) -> introKRef.current = 0; setIntroK(0); 로직을 제가 아직 안 넣었으므로
# bak3 원본 상태(setIntroK(0))와 일치하는지 확인 필요.
# 하지만 이전 fix_setintrok.py에서 수정했었으므로 현재 상태를 다시 체크.

if old3 in content:
    content = content.replace(old3, new3)
    print("STEP3: SUCCESS")
else:
    # Try more generic pattern
    pattern3 = r"const HeaderCardForShare = useMemo\(.*?<View style=\{\[styles\.row, \{ marginTop: 16 \}\]\}>.*?<LineChartsPager.*?\/?>\s+<\/TouchableOpacity>"
    if re.search(pattern3, content, re.DOTALL):
        # HeaderCardForShare 전체 내부를 교체하지 않고 컴포넌트 영역만 정밀 타격
        inner_pattern = r"\s+<View style=\{\[styles\.row, \{ marginTop: 16 \}\]\}>.*?<\/TouchableOpacity>"
        content = re.sub(inner_pattern, "\n" + new3, content, flags=re.DOTALL)
        print("STEP3: SUCCESS (Regex)")
    else:
        print("STEP3: FAIL")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
