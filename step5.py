import re
path = 'screens/EntryListScreen.js'
content = open(path).read()

# HeaderWithCountMemo 바로 아래 삽입 지점 매칭
old_insertion = r'        <HeaderWithCountMemo HeaderCard=\{HeaderCard\} />\s+\{/\* 보상 박스'

new_layout = """        <HeaderWithCountMemo HeaderCard={HeaderCard} />

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

        <TouchableOpacity style={styles.sectionBox} onPress={() => grassTapRef.current && grassTapRef.current()} activeOpacity={0.85}>
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

if re.search(old_insertion, content):
    content = re.sub(old_insertion, new_layout, content)
    with open(path, 'w') as f:
        f.write(content)
    print('STEP 5: SUCCESS')
else:
    print('STEP 5: FAIL')
