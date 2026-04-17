import re

file_path = 'screens/ChallengeListScreen.js'
with open(file_path, 'r') as f:
    content = f.read()

# 쉼표가 비어있는 비정상적인 호출을 찾아 정확한 백틱 코드로 교체
pattern = r"AsyncStorage\.setItem\(, JSON\.stringify\(\[\]\)\)"
# 파이썬에서 JS 백틱(`)과 ${}를 포함한 문자열을 안전하게 전달
replacement = "AsyncStorage.setItem(`entries_${copy.id}`, JSON.stringify([]))"

if re.search(pattern, content):
    content = re.sub(pattern, replacement, content)
    print("Fix applied successfully")
else:
    print("Pattern not found - checking current line content")
    # 라인 510 근처를 직접 확인하기 위한 로직
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if "AsyncStorage.setItem(," in line:
            print(f"Found on line {i+1}: {line}")
            lines[i] = line.replace("AsyncStorage.setItem(,", "AsyncStorage.setItem(`entries_${copy.id}`,")
            content = '\n'.join(lines)
            print("Fixed via direct line replacement")
            break

with open(file_path, 'w') as f:
    f.write(content)
