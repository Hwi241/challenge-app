import re
import os

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r') as f:
    content = f.read()

# [1단계] 변수 정의부 수정 (LEFT_LABEL_W = 0)
# 유연한 매칭을 위해 re.sub 사용
pattern_vars = r"const LEFT_LABEL_W = (36|0);\s*const CELL_GAP = 3;\s*const availableW = containerWidth - LEFT_LABEL_W;"
new_vars = "const LEFT_LABEL_W = 0;\n  const CELL_GAP = 3;\n  const availableW = containerWidth;"

if re.search(pattern_vars, content):
    content = re.sub(pattern_vars, new_vars, content)
    print('변수 정의부 수정 성공')

# [2단계] ScrollView 설정 수정
# 이전 턴의 수정 사항을 고려하여 패턴 정의
pattern_scroll = r"nestedScrollEnabled\s+scrollEnabled=\{graphWidth (\+ LEFT_LABEL_W )?> containerWidth\}\s+contentContainerStyle=\{\{[\s\S]*?\}\}\s+style=\{\{ overflow: 'hidden' \}\}"
new_scroll = """nestedScrollEnabled
        scrollEnabled={graphWidth > containerWidth}
        contentContainerStyle={{}}
        style={{ overflow: 'hidden' }}"""

if re.search(pattern_scroll, content):
    content = re.sub(pattern_scroll, new_scroll, content)
    print('ScrollView 설정 수정 성공')

# [3단계] 요일 라벨 View 블록 제거
# ShadowIcon이나 다른 요소들과 섞이지 않도록 DOW_SHOW.map을 키워드로 블록 제거
pattern_dow = r"<View style=\{\{\s*position:\s*'absolute',\s*left:\s*0,\s*top:\s*TOP_LABEL_H\s*\+\s*4,\s*width:\s*LEFT_LABEL_W,[\s\S]+?\{DOW_SHOW\.map[\s\S]+?\}\)\}\s*<\/View>"

if re.search(pattern_dow, content):
    content = re.sub(pattern_dow, "", content)
    print('요일 라벨 View 블록 제거 성공')
else:
    print('요일 라벨 View 블록 미발견 (이미 제거됨)')

with open(file_path, 'w') as f:
    f.write(content)
