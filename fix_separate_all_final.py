import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target position: after <HeaderWithCountMemo HeaderCard={HeaderCard} />
old_insertion_point = r"        <HeaderWithCountMemo HeaderCard=\{HeaderCard\} />\s+\{/\* 보상 박스"

new_components = """        <HeaderWithCountMemo HeaderCard={HeaderCard} />

        <View style={[styles.row, { marginTop: 16, paddingHorizontal: EDGE }]}>
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
        </TouchableOpacity>

        <TouchableOpacity style={styles.sectionBox} onPress={() => grassTapRef.current && grassTapRef.current()} activeOpacity={0.85}>
          <GrassGraph
            entries={entries}
            startDate={meta.startDate}
            endDate={meta.endDate}
            onTap={onGrassTap}
          />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.sectionBox, { paddingHorizontal: EDGE, alignItems:'center' }]} onPress={() => { introKRef.current = 0; setIntroK(0); runIntro(); }} activeOpacity={0.85}>
          {meta.startDate ? (
            <LineChartsPager startDate={meta.startDate} entries={entries} introProgress={introK} interactive />
          ) : (
            <Text style={{ textAlign:'center', color:textGrey }}>시작일이 없습니다.</Text>
          )}
        </TouchableOpacity>

        {/* 보상 박스"""

if re.search(old_insertion_point, content):
    content = re.sub(old_insertion_point, new_components, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Components separated and placed in ScrollView")
else:
    print("FAIL: Could not find insertion point")
