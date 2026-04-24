import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# ScrollView 안에서 HeaderWithCountMemo 바로 아래에 GrassGraph 독립 삽입
# 보상 박스 주석이 포함된 패턴을 정확히 매칭
old_pattern = r"""        <HeaderWithCountMemo HeaderCard=\{HeaderCard\} />

        \{/\* 보상 박스"""

new_insertion = """        <HeaderWithCountMemo HeaderCard={HeaderCard} />

        <TouchableOpacity style={styles.sectionBox} onPress={() => grassTapRef.current && grassTapRef.current()} activeOpacity={0.85}>
          <GrassGraph
            entries={entries}
            startDate={meta.startDate}
            endDate={meta.endDate}
            onTap={onGrassTap}
          />
        </TouchableOpacity>

        {/* 보상 박스"""

if re.search(old_pattern, content):
    content = re.sub(old_pattern, new_insertion, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done: Inserted GrassGraph outside HeaderCard")
else:
    print("Fail: Could not find the insertion point after HeaderWithCountMemo")
