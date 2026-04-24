import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. waveIntensity 선언부에 forceUpdate 추가
# 현재 상태: const waveIntensity = useRef(new Array(60 * 7).fill(0));
old1 = "  const waveIntensity = useRef(new Array(60 * 7).fill(0));"
new1 = "  const waveIntensity = useRef(new Array(60 * 7).fill(0));\n  const [, forceUpdate] = useState(0);"

if old1 in content:
    content = content.replace(old1, new1)
    print("STEP1 SUCCESS: Added forceUpdate state")
else:
    # 혹시 useState 버전인 경우 대응
    old1_v2 = "const [waveIntensity, setWaveIntensity] = useState(() => new Array(60).fill(0));"
    if old1_v2 in content:
        content = content.replace(old1_v2, new1)
        print("STEP1 SUCCESS: Replaced useState with Ref + forceUpdate")
    else:
        print("STEP1 FAIL: Could not find declaration pattern")

# 2. 강도 업데이트 로직에 forceUpdate 연결
# 현재 상태: waveIntensity.current = intensities;
old2 = "      waveIntensity.current = intensities;"
new2 = "      waveIntensity.current = intensities;\n      forceUpdate(n => n + 1);"
if old2 in content:
    content = content.replace(old2, new2)
    print("STEP2 SUCCESS: Linked update to forceUpdate")

# 3. 초기화 로직에 forceUpdate 연결
# 현재 상태: waveIntensity.current = new Array(TOTAL_COLS * TOTAL_ROWS).fill(0);
old3 = "        waveIntensity.current = new Array(TOTAL_COLS * TOTAL_ROWS).fill(0);"
new3 = "        waveIntensity.current = new Array(TOTAL_COLS * TOTAL_ROWS).fill(0);\n        forceUpdate(n => n + 1);"
if old3 in content:
    content = content.replace(old3, new3)
    print("STEP3 SUCCESS: Linked reset to forceUpdate")

# 4. 렌더링 참조 확인 (이미 ref.current 인지 체크)
# 현재 이미 fix_wave2.py에 의해 waveIntensity.current로 되어 있음
if "waveIntensity.current[" in content:
    print("STEP4 SUCCESS: Rendering reference already uses .current")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
