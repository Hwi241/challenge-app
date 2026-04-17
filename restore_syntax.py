import sys

file_path = '/home/hwi/challenge-app/screens/EntryListScreen.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

# 1141라인 근처의 dangling tags와 brackets를 정리
# 1140:         </View>
# 1141:       </ScrollView>
# 1142: 
# 1143:         ))}
# 1144:       </View>
# 1145:     </View>
# 1146:   );
# 1147: });

# GrassGraph 컴포넌트의 return 문을 추적하여 깨진 부분을 복구함
# GridContent 이후 </View>와 </ScrollView>는 정상임.
# 그 다음 나타나는 불필요한 코드들을 삭제해야 함.

start_idx = -1
for i, line in enumerate(lines):
    if '{GridContent}' in line:
        start_idx = i
        break

if start_idx != -1:
    new_lines = lines[:start_idx+1]
    new_lines.append('        </View>\n')
    new_lines.append('      </ScrollView>\n')
    new_lines.append('    </View>\n')
    new_lines.append('  );\n')
    new_lines.append('});\n')
    
    # 그 다음 EntryRow 정의를 찾아 이어붙임
    entry_row_idx = -1
    for i in range(start_idx, len(lines)):
        if '/* ───────── 리스트 행 ───────── */' in lines[i]:
            entry_row_idx = i
            break
            
    if entry_row_idx != -1:
        new_lines.append('\n')
        new_lines.extend(lines[entry_row_idx:])
        
        with open(file_path, 'w') as f:
            f.writelines(new_lines)
        print("Success: Restored EntryListScreen.js syntax")
    else:
        print("Error: Could not find EntryRow start")
else:
    print("Error: Could not find GridContent")
