import re
path = 'screens/EntryListScreen.js'
content = open(path).read()

# HeaderCardForShare 이후 삽입 지점 매칭
old_share_insertion = r'\{HeaderCardForShare\}\s+\n\s+<View style=\{\[styles\.sectionPadNarrow, styles\.rewardBlockSpacing\]\}>'

new_share_layout = """{HeaderCardForShare}

        <View style={[styles.row, { marginTop: 16, paddingHorizontal: EDGE, backgroundColor: '#fff' }]}>
          <View style={styles.donutArea}>
            <Text style={[styles.sectionLabel, styles.progressLabel, { textAlign:'center', marginBottom: 8 }]}>전체 진행률</Text>
            <View style={{ marginTop: 24 }}>
              <Donut targetPercent={overallPct} progress={1} />
            </View>
          </View>
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

        <View style={[styles.sectionBox, { backgroundColor: '#fff' }]}>
          <WeekView weeksData={weeksData} currentIndex={weekIndex} onIndexChange={setWeekIndex} introProgress={1} />
        </View>

        <View style={[styles.sectionBox, { backgroundColor: '#fff' }]}>
          <GrassGraph
            entries={entries}
            startDate={meta.startDate}
            endDate={meta.endDate}
          />
        </View>

        <View style={[styles.sectionBox, { paddingHorizontal: EDGE, alignItems:'center', backgroundColor: '#fff' }]}>
          {meta.startDate ? (
            <LineChartsPager startDate={meta.startDate} entries={entries} introProgress={1} interactive={false} />
          ) : (
            <Text style={{ textAlign:'center', color:textGrey }}>시작일이 없습니다.</Text>
          )}
        </View>

        <View style={[styles.sectionPadNarrow, styles.rewardBlockSpacing]}>"""

if re.search(old_share_insertion, content):
    content = re.sub(old_share_insertion, new_share_layout, content)
    with open(path, 'w') as f:
        f.write(content)
    print('STEP 6: SUCCESS')
else:
    print('STEP 6: FAIL')
