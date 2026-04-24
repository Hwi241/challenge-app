import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. HeaderCardForShare 최적화
new_share_header = """  const HeaderCardForShare = useMemo(()=>(<View style={styles.card}>
    <View style={styles.headerTop}>
      <View style={styles.headerInfoBtn}>
        <ShadowIcon forShare={true} />
      </View>
      <View style={styles.headerTitleWrap}>
        <TitleTwoLine text={title} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
        <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
      </View>
      <View style={styles.headerInfoBtn} />
    </View>
    {/* 공유용 이미지 생성을 위해 내부 그래프는 ViewShot 내부로 이동됨 */}
  </View>
  ), [
    title, meta.startDate, meta.endDate
  ]);"""

# 기존 HeaderCardForShare useMemo 블록 찾기 및 교체
pattern = r"const HeaderCardForShare = useMemo\(.*?\), \[\s+title, meta\.startDate, meta\.endDate,.*?overallPct\s+\]\);"
if re.search(pattern, content, re.DOTALL):
    content = re.sub(pattern, new_share_header, content, flags=re.DOTALL)
    print("STEP1 SUCCESS: Updated HeaderCardForShare definition")
else:
    print("STEP1 FAIL: Could not find HeaderCardForShare pattern")

# 2. ViewShot 내부 레이아웃 동기화
# {HeaderCardForShare} 바로 뒤에 삽입
insertion_point = r"\{HeaderCardForShare\}\s+\n\s+<View style=\{\[styles\.sectionPadNarrow, styles\.rewardBlockSpacing\]\}>"

new_share_components = """{HeaderCardForShare}

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

if re.search(insertion_point, content):
    content = re.sub(insertion_point, new_share_components, content)
    print("STEP2 SUCCESS: Synced Share components in ViewShot")
else:
    print("STEP2 FAIL: Could not find ViewShot insertion point")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
