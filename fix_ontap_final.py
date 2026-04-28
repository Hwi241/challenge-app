import os

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. onGrassTap useCallback 정의 추가 (이미 분리된 구조를 가정하여 grassTapRef 바로 아래 삽입)
if 'const onGrassTap =' not in content:
    old_ref = "  const grassTapRef = useRef(null);"
    new_logic = "  const grassTapRef = useRef(null);\n  const onGrassTap = useCallback((fn) => { grassTapRef.current = fn; }, []);"
    content = content.replace(old_ref, new_logic)

# 2. 인라인 onTap 함수를 onGrassTap 변수로 교체 (모든 발생 지점)
content = content.replace(
    "onTap={(fn) => { grassTapRef.current = fn; }}",
    "onTap={onGrassTap}"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
