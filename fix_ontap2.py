import os

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. onGrassTap useCallback 추가 (grassTapRef 선언 바로 아래)
# bak3 복구 이후의 상태를 가정 (const grassTapRef = useRef(null); 만 있는 상태)
old_ref = "  const grassTapRef = useRef(null);"
new_logic = "  const grassTapRef = useRef(null);\n  const onGrassTap = useCallback((fn) => { grassTapRef.current = fn; }, []);"

if old_ref in content:
    # 이미 추가되어 있는지 체크
    if "const onGrassTap =" not in content:
        content = content.replace(old_ref, new_logic)
        print("Done: Added onGrassTap useCallback")
    else:
        print("Done: onGrassTap already exists")
else:
    print("Fail: Could not find grassTapRef declaration")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
