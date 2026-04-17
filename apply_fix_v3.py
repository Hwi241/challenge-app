import re
import os

file_path = 'screens/ChallengeListScreen.js'
with open(file_path, 'r') as f:
    content = f.read()

# 1. 이전 에러로 인해 깨진 코드가 있는지 확인 및 복구
# 예: AsyncStorage.setItem(, JSON.stringify([]))
broken_pattern = r"AsyncStorage\.setItem\(, JSON\.stringify\(\[\]\)\)"
if re.search(broken_pattern, content):
    content = re.sub(broken_pattern, "AsyncStorage.setItem(`entries_${copy.id}`, JSON.stringify([]))", content)
    print("Broken code recovered.")

# 2. 정상적인 위치에 로직 삽입 (이미 존재하지 않을 경우)
if 'entries_${copy.id}' not in content:
    pattern = r"(try\s*\{\s*await\s*persistChallenges\(nextArr,\s*\'duplicate\'\);\s*\}\s*catch\s*\{\s*\})"
    replacement = r"\1\n    try { await AsyncStorage.setItem(`entries_${copy.id}`, JSON.stringify([])); } catch {}"
    
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
        print("Duplicate logic inserted successfully.")
    else:
        print("Pattern for insertion not found.")
else:
    print("Logic already exists or was partially recovered.")

with open(file_path, 'w') as f:
    f.write(content)
