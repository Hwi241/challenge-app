import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1) 도넛 + 달력 + 주간뷰 영역 통합 교체
# 인덴트와 속성 차이를 고려한 regex 매칭
donut_week_pattern = r"""\s+<View style=\{\[styles\.row, \{ marginTop: 16 \}\]\}>.*?<Donut targetPercent=\{overallPct\} progress=\{introK\} />\s+<\/View>\s+<\/TouchableOpacity>.*?<MonthCalendar.*?highlightDate=\{highlightDate\}\s+\/>\s+<\/View>\s+<\/View>.*?<TouchableOpacity style=\{styles\.sectionBox\} onPress=\{\(\) => \{ introKRef\.current = 0; setIntroK\(0\); runIntro\(\); \}\} activeOpacity=\{0\.85\}>.*?<WeekView.*?onPressDay=\{handlePressDay\}\s+\/>\s+<\/TouchableOpacity>"""

# 수동 문자열 찾기 및 교체 (정규식이 까다로울 경우 대비)
old1 = """      <View style={[styles.row, { marginTop: 16 }]}>
        <TouchableOpacity style={styles.donutArea} onPress={() => { introKRef.current = 0; setIntroK(0); runIntro(); }} activeOpacity={0.8}>
          <Text style={[styles.sectionLabel, styles.progressLabel, { textAlign:'center', marginBottom: 8 }]}>전체 진행률</Text>
          <View style={{ marginTop: 24 }}>
            <Donut targetPercent={overallPct} progress={introK} />
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
            highlightDate={highlightDate}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.sectionBox} onPress={() => { introKRef.current = 0; setIntroK(0); runIntro(); }} activeOpacity={0.85}>
        <WeekView 
          weeksData={weeksData} 
          currentIndex={weekIndex} 
          onIndexChange={setWeekIndex} 
          introProgress={introK} 
          onPressDay={handlePressDay}
        />
      </TouchableOpacity>"""

# 현재 bak3 복구 후 수정한 파일의 실제 상태를 반영하여 교체
# (setIntroK(0) -> introKRef.current = 0; setIntroK(0); 가 적용된 상태임)

def smart_replace(text, old_snippet, new_snippet):
    # 공백 정규화 후 찾기
    normalized_old = " ".join(old_snippet.split())
    if normalized_old in " ".join(text.split()):
        # 실제 텍스트에서 유사한 블록을 찾아서 교체 (라인 단위 보존을 위해 find 사용)
        # 여기서는 단순히 replace 시도
        return text.replace(old_snippet, new_snippet)
    return text

new1 = "      {/* DONUT_CALENDAR_WEEK_PLACEHOLDER */}"

# 2) 라인차트 영역 교체
old2 = """      {/* 전체일정 라인 그래프 */}
      <TouchableOpacity style={[styles.sectionBox, { paddingHorizontal: EDGE, alignItems:'center' }]} onPress={() => { introKRef.current = 0; setIntroK(0); runIntro(); }} activeOpacity={0.85}>
        {meta.startDate ? (
          <LineChartsPager startDate={meta.startDate} entries={entries} introProgress={introK} interactive />
        ) : (
          <Text style={{ textAlign:'center', color:textGrey }}>시작일이 없습니다.</Text>
        )}
      </TouchableOpacity>"""

new2 = "      {/* LINECHART_PLACEHOLDER */}"

# 실제 파일 내용 기반으로 정밀 타격
# (introKRef.current = 0; setIntroK(0); 로직 포함됨을 확인)

# Step 1: 도넛~주간뷰
content = content.replace(old1, new1)
# Step 2: 라인차트
content = content.replace(old2, new2)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done: Replaced components with placeholders")
