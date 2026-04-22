import re
import os

file_path = 'components/WidgetDonutCapture1x1.js'
with open(file_path, 'r') as f:
    content = f.read()

# 1. JSX 교체: React Native Text를 SVG Text로 교체
# 템플릿 리터럴 `${Math.round(pct)}%`을 포함하는 블록을 찾음
pattern = r'\{\/\* 퍼센트 텍스트\(크게, 굵게\) \*\/\}\s*<Text[\s\S]+?<\/Text>'

# size * 0.26 등을 변수로 쓰는 로직은 이미 JS 코드에 있으므로, 
# 텍스트 내용만 정확히 교체함. 
# R 변수는 컴포넌트 내부에서 size / 2 로 정의되어 있음.

new_jsx = """      {/* 퍼센트 텍스트(크게, 굵게) - SVG Text 사용 */}
      <SvgText
        x={R}
        y={R + Math.round(size * 0.26) * 0.35}
        textAnchor="middle"
        fontSize={Math.round(size * 0.26)}
        fontWeight="800"
        fill={textColor}
      >
        {`${Math.round(pct)}%`}
      </SvgText>"""

if re.search(pattern, content):
    content = re.sub(pattern, new_jsx, content)
    print("JSX replacement success via Python script")
else:
    print("JSX pattern not found")

with open(file_path, 'w') as f:
    f.write(content)
