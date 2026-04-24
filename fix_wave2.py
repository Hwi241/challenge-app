import os

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. useState waveIntensity를 useRef로 교체 (앞선 단계에서 추가된 60/420 혼용 대응)
# 현재 파일 상태 확인 결과 987라인 근처: const [waveIntensity, setWaveIntensity] = useState(() => new Array(60).fill(0));
old1 = "const [waveIntensity, setWaveIntensity] = useState(() => new Array(60).fill(0));"
new1 = "const waveIntensity = useRef(new Array(60 * 7).fill(0));"
if old1 in content:
    content = content.replace(old1, new1)
    print("SUCCESS: Changed useState to useRef")
else:
    # 혹시 이미 420으로 바뀌었을 경우 대비
    old1_v2 = "const [waveIntensity, setWaveIntensity] = useState(() => new Array(420).fill(0));"
    if old1_v2 in content:
        content = content.replace(old1_v2, new1)
        print("SUCCESS: Changed useState(420) to useRef")
    else:
        print("FAIL: Could not find useState pattern")

# 2. setWaveIntensity(new Array...) 를 ref 직접 할당으로 교체
old2 = "setWaveIntensity(new Array(TOTAL_COLS * TOTAL_ROWS).fill(0));"
new2 = "waveIntensity.current = new Array(TOTAL_COLS * TOTAL_ROWS).fill(0);"
if old2 in content:
    content = content.replace(old2, new2)
    print("SUCCESS: Updated array reset logic")

# 3. setWaveIntensity(intensities) 를 ref 직접 할당으로 교체
old3 = "setWaveIntensity(intensities);"
new3 = "waveIntensity.current = intensities;"
if old3 in content:
    content = content.replace(old3, new3)
    print("SUCCESS: Updated intensity update logic")

# 4. intensity2D 참조를 ref.current로 교체
old4 = "const intensity2D = waveIntensity[col * GRASS_ROWS + row] ?? 0;"
new4 = "const intensity2D = waveIntensity.current[col * GRASS_ROWS + row] ?? 0;"
if old4 in content:
    content = content.replace(old4, new4)
    print("SUCCESS: Updated rendering reference")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Final status: Done")
