import os

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. onTap 인라인 함수를 변수로 교체 (두 군데 모두 적용)
old1 = "onTap={(fn) => { grassTapRef.current = fn; }}"
new1 = "onTap={onGrassTap}"
if old1 in content:
    content = content.replace(old1, new1)
    print("STEP1 SUCCESS: Replaced inline onTap with variable")
else:
    print("STEP1 FAIL: Could not find inline onTap pattern")

# 2. onGrassTap 정의 추가 (grassTapRef 바로 아래)
# 현재 위치: const grassTapRef = useRef(null); (1379라인 근처)
old2 = "  const grassTapRef = useRef(null);"
new2 = "  const grassTapRef = useRef(null);\n  const onGrassTap = useCallback((fn) => { grassTapRef.current = fn; }, []);"

if old2 in content:
    content = content.replace(old2, new2)
    print("STEP2 SUCCESS: Added onGrassTap definition")
else:
    print("STEP2 FAIL: Could not find grassTapRef pattern")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Final status: Done")
