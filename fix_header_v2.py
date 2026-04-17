import re

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r') as f:
    content = f.read()

# 템플릿 리터럴 복구 및 공유용 헤더 최종 수정
# 이전 실행에서 {} 로 깨진 부분을 복구함
broken_pattern = r"<Text style=\{\[styles\.period, \{ textAlign:'center' \}\]\}>\{\}<\/Text>"
correct_text = "<Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>"

content = re.sub(broken_pattern, correct_text, content)

# 공유용 헤더 부분 재검증 및 교체
# ShadowIcon forShare={true} 가 들어있는 블록
share_block_pattern = r'<View style=\{styles\.headerTop\}>\s*<View style=\{\{ position:\'absolute\', left:0, top:0 \}\}>\s*<ShadowIcon forShare=\{true\} \/>\s*<\/View>[\s\S]+?<\/View>\s*<\/View>'

new_share = """      <View style={styles.headerTop}>
        <View style={styles.headerInfoBtn}>
           <ShadowIcon forShare={true} />
        </View>
        <View style={styles.headerTitleWrap}>
          <TitleTwoLine text={title} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
          <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
        </View>
        <View style={styles.headerInfoBtn} />
      </View>"""

if re.search(share_block_pattern, content):
    content = re.sub(share_block_pattern, new_share, content)
    print("공유용 헤더 교체 성공")
else:
    # 이미 절반쯤 교체된 상태일 수 있으므로 (이전 에러로 인해)
    print("패턴 미매칭, 내용 확인 필요")

with open(file_path, 'w') as f:
    f.write(content)
