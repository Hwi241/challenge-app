import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. introK state 선언부에 introKRef 추가
old1 = "  const [introK, setIntroK] = useState(0);"
new1 = "  const [introK, setIntroK] = useState(0);\n  const introKRef = useRef(0);"
if old1 in content:
    content = content.replace(old1, new1)
    print("STEP1 SUCCESS: Added introKRef")

# 2. setIntroK 호출 시 ref 동시 업데이트
old2 = "        setIntroK(k);"
new2 = "        setIntroK(k);\n        introKRef.current = k;"
if old2 in content:
    content = content.replace(old2, new2)
    print("STEP2 SUCCESS: Updated setIntroK with Ref")

# 3. HeaderCard useMemo deps에서 introK 제거 (정규식 사용)
# 여러 줄에 걸친 deps 리스트에서 introK, 부분을 찾아서 제거
pattern3 = r"(introK,\s+)"
if re.search(pattern3, content):
    content = re.sub(pattern3, "", content)
    print("STEP3 SUCCESS: Removed introK from useMemo deps")
else:
    # 혹시 끝에 있거나 콤마 없는 경우 대응
    pattern3_alt = r"(,\s+introK)"
    if re.search(pattern3_alt, content):
        content = re.sub(pattern3_alt, "", content)
        print("STEP3 SUCCESS: Removed introK from useMemo deps (alt)")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
