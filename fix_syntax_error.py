import os

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r') as f:
    content = f.read()

# 쉼표가 비어있는 비정상적인 호출(이전 셸 스크립트 실행 오류로 발생)을 찾아 정확한 코드로 교체
# 1509라인: const primaryKey = ; -> const primaryKey = `entries_${chCID}`;
broken_line = "const primaryKey = ;"
fixed_line = "const primaryKey = `entries_${chCID}`;"

if broken_line in content:
    content = content.replace(broken_line, fixed_line)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Fix: Restored primaryKey with JS template literal.")
else:
    print("Broken line not found. Manual check required.")
