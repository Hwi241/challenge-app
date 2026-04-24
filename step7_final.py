import re
path = 'screens/EntryListScreen.js'
content = open(path).read()

# HeaderCardForShare useMemo 내부 (1742~1744라인 부근)의 플레이스홀더 제거
pattern = r'\{/\* DONUT_CALENDAR_WEEK_PLACEHOLDER \*/\}\s+\{/\* GRASS_PLACEHOLDER \*/\}\s+\{/\* LINECHART_PLACEHOLDER \*/\}'
content = re.sub(pattern, "", content)

# HeaderCardForShare useMemo 내부 (1745라인 이후)에 남은 중복 코드들 정밀 타격하여 제거
# 1) 달력 row
p1 = r'      <View style=\{\[styles\.row, \{ marginTop: 16 \}\]\}>.*?<\/View>\s+<\/View>'
content = re.sub(p1, "", content, flags=re.DOTALL)

# 2) 주간뷰 View
p2 = r'      <View style=\{styles\.sectionBox\}>\s+<WeekView.*?\/?>\s+<\/View>'
content = re.sub(p2, "", content, flags=re.DOTALL)

# 3) 라인차트 TouchableOpacity
p3 = r'      <TouchableOpacity style=\{\[styles\.sectionBox, \{ paddingHorizontal: EDGE, alignItems:\'center\' \}\]\} onPress=\{\(\) => \{ setIntroK\(0\); runIntro\(\); \}\} activeOpacity=\{0\.85\}>.*?<\/TouchableOpacity>'
content = re.sub(p3, "", content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('STEP 7: SUCCESS')
