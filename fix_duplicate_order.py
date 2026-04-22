import re
import os

file_path = 'screens/ChallengeListScreen.js'
with open(file_path, 'r') as f:
    content = f.read()

# [수정] 복제 로직 순서 변경
# 대상: onDuplicate 함수 내부의 저장 및 초기화 로직
# 기존 순서:
# 509: setData(nextArr);
# 510: try { await persistChallenges(nextArr, 'duplicate'); } catch {}
# 511: // 복제된 도전의 인증 목록을 빈 배열로 명시적 초기화
# 512: try { await AsyncStorage.setItem(`entries_${copy.id}`, JSON.stringify([])); } catch {}

old_block = """    setData(nextArr);
    try { await persistChallenges(nextArr, 'duplicate'); } catch {}
    // 복제된 도전의 인증 목록을 빈 배열로 명시적 초기화
    try { await AsyncStorage.setItem(`entries_${copy.id}`, JSON.stringify([])); } catch {}"""

new_block = """    setData(nextArr);
    // 복제된 도전의 인증 목록을 빈 배열로 먼저 초기화 (전수스캔 폴백 방지)
    try { await AsyncStorage.setItem(`entries_${copy.id}`, JSON.stringify([])); } catch {}
    try { await persistChallenges(nextArr, 'duplicate'); } catch {}"""

if old_block in content:
    content = content.replace(old_block, new_block)
    print("SUCCESS: Duplication logic order updated.")
else:
    # 탭/스페이스 차이가 있을 경우를 대비한 유연한 처리
    lines = content.split('\n')
    found_start = -1
    for i, line in enumerate(lines):
        if "setData(nextArr);" in line and "onDuplicate" in "".join(lines[max(0, i-50):i]):
            found_start = i
            break
    
    if found_start != -1:
        # 순서 재배치 (509~512라인 영역)
        set_data_line = lines[found_start]
        persist_line = lines[found_start + 1]
        comment_line = lines[found_start + 2]
        storage_line = lines[found_start + 3]
        
        if "persistChallenges" in persist_line and "AsyncStorage.setItem" in storage_line:
            lines[found_start + 1] = storage_line
            lines[found_start + 2] = persist_line
            # 주석 위치 조정
            lines.insert(found_start + 1, "    // 복제된 도전의 인증 목록을 빈 배열로 먼저 초기화 (전수스캔 폴백 방지)")
            # 기존 511라인(기존 주석) 제거
            del lines[found_start + 4] 
            content = '\n'.join(lines)
            print("SUCCESS: Duplication logic order updated via line manipulation.")
        else:
            print("FAIL: Expected lines not found at index.")
    else:
        print("FAIL: onDuplicate start not found.")

with open(file_path, 'w') as f:
    f.write(content)
