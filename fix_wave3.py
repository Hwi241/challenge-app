import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. waveIntensity ref 선언 제거
content = content.replace("  const waveIntensity = useRef(new Array(60 * 7).fill(0));", "")

# 2. waveTrigger state 제거
content = content.replace("  const [waveTrigger, setWaveTrigger] = useState(0);", "")

# 3. sparkTimersRef 및 waveRafRef 제거
content = content.replace("  const sparkTimersRef = React.useRef([]);", "")
content = content.replace("  const waveRafRef = React.useRef(null);", "")

# 4. onTap useEffect 제거 (다양한 인덴트 대응)
content = re.sub(r'  useEffect\(\(\) => \{ if \(onTap\) onTap\(\(\) => setWaveTrigger\(t => t \+ 1\)\); \}, \[onTap\]\);', '', content)

# 5. 파도 useEffect 전체 제거
content = re.sub(
    r'  // RAF 기반 파도 useEffect.*?\n\s*useEffect\(\(\) => \{.*?\}, \[waveTrigger\]\);',
    '',
    content,
    flags=re.DOTALL
)

# 6. intensity2D를 0으로 고정
content = content.replace(
    "              const intensity2D = waveIntensity.current[col * GRASS_ROWS + row] ?? 0;",
    "              const intensity2D = 0;"
)

# 7. 남아있는 waveIntensity.current 할당 제거
content = content.replace("        waveIntensity.current = new Array(TOTAL_COLS * TOTAL_ROWS).fill(0);", "")
content = content.replace("      waveIntensity.current = intensities;", "")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
