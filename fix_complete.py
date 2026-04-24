import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. HeaderCard useMemo 분리 및 최적화 버전 준비
new_header_code = """  const HeaderCard = useMemo(()=>(<View style={styles.card}>
    <View style={styles.headerTop}>
      <TouchableOpacity
        onPress={() => navigation.navigate('ChallengeList')}
        style={styles.headerBackBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Text style={styles.headerBackArrow}>‹</Text>
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <TitleTwoLine text={title} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
        <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
      </View>
      <TouchableOpacity
        onPress={()=>setShowInfo(true)}
        activeOpacity={0.9}
        style={styles.headerInfoBtn}
      >
        <ShadowIcon forShare={false} />
      </TouchableOpacity>
    </View>
    {/* 컴포넌트 분리를 위해 내부 그래프는 ScrollView로 이동됨 */}
  </View>
  ), [
    title, meta.startDate, meta.endDate
  ]);"""

# 기존 HeaderCard useMemo 블록 찾기 및 교체
pattern = r"const HeaderCard = useMemo\(.*?\), \[\s+title, meta\.startDate, meta\.endDate,.*?highlightDate\s+\]\);"
if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, new_header_code, content, flags=re.DOTALL)
    print("STEP1 SUCCESS: Updated HeaderCard definition")
else:
    print("STEP1 FAIL: Could not find HeaderCard pattern")

# 2. ScrollView 내부에 독립 컴포넌트 배치
# HeaderWithCountMemo 바로 뒤에 삽입
insertion_point = r"        <HeaderWithCountMemo HeaderCard=\{HeaderCard\} />\s+\{/\* 보상 박스"
new_scroll_content = """        <HeaderWithCountMemo HeaderCard={HeaderCard} />

        <View style={[styles.row, { marginTop: 16, paddingHorizontal: EDGE }]}>
          <TouchableOpacity style={styles.donutArea} onPress={() => { setIntroK(0); runIntro(); }} activeOpacity={0.8}>
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

        <TouchableOpacity style={styles.sectionBox} onPress={() => { setIntroK(0); runIntro(); }} activeOpacity={0.85}>
          <WeekView 
            weeksData={weeksData} 
            currentIndex={weekIndex} 
            onIndexChange={setWeekIndex} 
            introProgress={introK} 
            onPressDay={handlePressDay}
          />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.sectionBox, {marginHorizontal: EDGE}]} onPress={() => grassTapRef.current && grassTapRef.current()} activeOpacity={0.85}>
          <GrassGraph
            entries={entries}
            startDate={meta.startDate}
            endDate={meta.endDate}
            onTap={onGrassTap}
          />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.sectionBox, { paddingHorizontal: EDGE, alignItems:'center' }]} onPress={() => { setIntroK(0); runIntro(); }} activeOpacity={0.85}>
          {meta.startDate ? (
            <LineChartsPager startDate={meta.startDate} entries={entries} introProgress={introK} interactive />
          ) : (
            <Text style={{ textAlign:'center', color:textGrey }}>시작일이 없습니다.</Text>
          )}
        </TouchableOpacity>

        {/* 보상 박스"""

if re.search(insertion_point, content):
    content = re.sub(insertion_point, new_scroll_content, content)
    print("STEP2 SUCCESS: Inserted independent components into ScrollView")
else:
    print("STEP2 FAIL: Could not find ScrollView insertion point")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
