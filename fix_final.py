import re

with open('screens/EntryListScreen.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. HeaderCard useMemo 안의 GrassGraph 제거 (유연한 매칭)
# Note: bak3 상태에서는 grassTapRef.current && grassTapRef.current() 로직이 있음
old1_pattern = r"      <TouchableOpacity style=\{styles\.sectionBox\} onPress=\{\(\) => grassTapRef\.current && grassTapRef\.current\(\)\} activeOpacity=\{0\.85\}>\s+<GrassGraph\s+entries=\{entries\}\s+startDate=\{meta\.startDate\}\s+endDate=\{meta\.endDate\}\s+onTap=\{\(fn\) => \{ grassTapRef\.current = fn; \}\}\s+/>\s+</TouchableOpacity>\s+\{/\* 전체일정 라인 그래프 \*/\}"
new1 = "      {/* 전체일정 라인 그래프 */}"

if re.search(old1_pattern, content, re.DOTALL):
    content = re.sub(old1_pattern, new1, content, flags=re.DOTALL)
    print("STEP1 SUCCESS: Removed GrassGraph from HeaderCard")
else:
    # Try more direct replacement if regex fails
    old1_fallback = """      <TouchableOpacity style={styles.sectionBox} onPress={() => grassTapRef.current && grassTapRef.current()} activeOpacity={0.85}>
        <GrassGraph
          entries={entries}
          startDate={meta.startDate}
          endDate={meta.endDate}
          onTap={(fn) => { grassTapRef.current = fn; }}
        />
      </TouchableOpacity>

      {/* 전체일정 라인 그래프 */}"""
    if old1_fallback in content:
        content = content.replace(old1_fallback, "      {/* 전체일정 라인 그래프 */}")
        print("STEP1 SUCCESS: Removed GrassGraph (Direct)")
    else:
        print("STEP1 FAIL: Could not find GrassGraph in HeaderCard")

# 2. HeaderCard deps에서 introK 제거
old2 = "    weekIndex, introK, entries, overallPct, highlightDate\n  ]);"
new2 = "    weekIndex, entries, overallPct, highlightDate\n  ]);"
if old2 in content:
    content = content.replace(old2, new2)
    print("STEP2 SUCCESS: Removed introK from deps")
else:
    print("STEP2 FAIL")

# 3. ScrollView 안 HeaderWithCountMemo 아래에 GrassGraph 독립 배치
old3 = """        <HeaderWithCountMemo HeaderCard={HeaderCard} />

        {/* 보상 박스"""
new3 = """        <HeaderWithCountMemo HeaderCard={HeaderCard} />

        <TouchableOpacity style={[styles.sectionBox, {marginHorizontal: EDGE}]} onPress={() => grassTapRef.current && grassTapRef.current()} activeOpacity={0.85}>
          <GrassGraph
            entries={entries}
            startDate={meta.startDate}
            endDate={meta.endDate}
            onTap={useCallback((fn) => { grassTapRef.current = fn; }, [])}
          />
        </TouchableOpacity>

        {/* 보상 박스"""

if old3 in content:
    content = content.replace(old3, new3)
    print("STEP3 SUCCESS: Inserted GrassGraph into ScrollView")
else:
    print("STEP3 FAIL")

with open('screens/EntryListScreen.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
