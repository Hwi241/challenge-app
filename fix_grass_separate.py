import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. HeaderCard useMemo 내의 GrassGraph 블록을 플레이스홀더로 교체 (두 군데 모두 적용)
# 인덴트를 유연하게 맞추기 위해 regex 사용
pattern = r"""      <TouchableOpacity style={styles\.sectionBox} onPress=\{\(\) => grassTapRef\.current && grassTapRef\.current\(\)\} activeOpacity={0\.85}>
        <GrassGraph
          entries={entries}
          startDate={meta\.startDate}
          endDate={meta\.endDate}
          onTap=\{\(fn\) => \{ grassTapRef\.current = fn; \}\}
        />
      </TouchableOpacity>"""

new_placeholder = "      {/* GRASS_PLACEHOLDER */}"

# 두 번의 출현을 모두 교체
new_content = re.sub(pattern, new_placeholder, content, flags=re.DOTALL)

if new_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Done: Replaced GrassGraph with placeholders")
else:
    print("Fail: Could not find GrassGraph pattern")
