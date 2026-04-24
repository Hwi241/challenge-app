import os

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# HeaderCard useMemo 안에서 introK -> introKRef.current 교체
# Donut progress
content = content.replace(
    "<Donut targetPercent={overallPct} progress={introK} />",
    "<Donut targetPercent={overallPct} progress={introKRef.current} />"
)

# WeekView introProgress
content = content.replace(
    "introProgress={introK}",
    "introProgress={introKRef.current}"
)

# LineChartsPager introProgress (일반 모드)
content = content.replace(
    "introProgress={introK} interactive",
    "introProgress={introKRef.current} interactive"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
