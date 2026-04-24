import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. introK 선언부 강제 복구 (setIntroK가 숫자로 치환된 경우 대응)
# 예: const [introK, 0] = useState(0); -> const [introK, setIntroK] = useState(0);
content = re.sub(
    r'const \[introK,\s*\d+\]\s*=\s*useState\(0\);',
    'const [introK, setIntroK] = useState(0);',
    content
)

# 2. setIntroK 호출부 복구 (0(k) 등으로 망가진 경우 대응)
# 0(k) -> setIntroK(k)
content = re.sub(
    r'\b0\(k\);',
    'setIntroK(k);',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
