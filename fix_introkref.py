import os

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. introKRef 추가 (이미 있는지 체크)
if 'const introKRef = useRef(0);' not in content:
    old = "  const [introK, setIntroK] = useState(0);"
    new = "  const [introK, setIntroK] = useState(0);\n  const introKRef = useRef(0);"
    content = content.replace(old, new)

# 2. introKRef 동기화
old2_full = "        setIntroK(k);\n        introKRef.current = k;"
if old2_full not in content:
    content = content.replace(
        "        setIntroK(k);",
        "        setIntroK(k);\n        introKRef.current = k;"
    )

# 3. Donut progress={introKRef.current} -> {introK} 교체
# 도넛은 상태값을 직접 구독하여 확실하게 그려지도록 변경
content = content.replace(
    "progress={introKRef.current}",
    "progress={introK}"
)

# 4. WeekView 및 LineChartsPager도 동일하게 introK 참조로 복구 (동기화 보장)
content = content.replace(
    "introProgress={introKRef.current}",
    "introProgress={introK}"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
