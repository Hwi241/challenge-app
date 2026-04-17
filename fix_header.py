import re
import os

file_path = 'screens/EntryListScreen.js'
with open(file_path, 'r') as f:
    content = f.read()

# 1. JSX 교체
# BackButton부터 TitleTwoLine 블록을 포함하는 headerTop 내부를 타겟
pattern_jsx = r'<View style=\{styles\.headerTop\}>[\s\S]+?<BackButton[\s\S]+?<TitleTwoLine[\s\S]+?<\/View>\s*<\/View>'

new_jsx = """      <View style={styles.headerTop}>
        <BackButton onPress={() => navigation.navigate('ChallengeList')} />
        <View style={styles.headerTitleWrap}>
          <TitleTwoLine text={title} style={styles.title} containerWidth={SCREEN_WIDTH - 120} />
          <Text style={[styles.period, { textAlign:'center' }]}>{`${fmtDate(meta.startDate)} ~ ${fmtDate(meta.endDate)}`}</Text>
        </View>
        <TouchableOpacity
          onPress={()=>setShowInfo(true)}
          activeOpacity={0.9}
          style={styles.headerInfoBtn}
        >
          <ShadowIcon forShare={false} />
        </TouchableOpacity>
      </View>"""

if re.search(pattern_jsx, content):
    content = re.sub(pattern_jsx, new_jsx, content)
    print('JSX 교체 성공')
else:
    print('JSX 패턴 매칭 실패')

# 2. 스타일 교체
pattern_style = r"headerTop: \{[\s\S]+?marginBottom: 6 \},"
new_style = """headerTop: { flexDirection: 'row', alignItems: 'center', height: 52, marginBottom: 6 },
  headerTitleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerInfoBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },"""

if re.search(pattern_style, content):
    content = re.sub(pattern_style, new_style, content, count=1)
    print('스타일 교체 성공')
else:
    print('스타일 패턴 매칭 실패')

with open(file_path, 'w') as f:
    f.write(content)
