import os

path = '/home/hwi/challenge-app/screens/EntryListScreen.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 중복된 return 문구와 끊긴 useEffect 구문 해결
# 예상 오염 형태:
# useEffect(() => { ... }); return ( return ( <View ...
# 올바른 형태:
# useEffect(() => { ... return () => cancelAnimationFrame(id); }, [initialOffsetX]); return ( <View ...

# 1) 중복 return 제거
c = c.replace('return (  return (', 'return (')

# 2) useEffect 마감 보정 (만약 끊겨있다면)
# initialOffsetX 이후에 useEffect가 닫히지 않고 바로 return이 오는지 확인
if '}, [initialOffsetX]);' not in c and 'return (' in c.split('[initialOffsetX]')[1]:
    c = c.replace('[initialOffsetX]);', '[initialOffsetX]);\n    return () => cancelAnimationFrame(id);\n  }, [initialOffsetX]);')

# 3) 더 확실하게, 문제가 발생한 846~855행 부근을 통째로 교체 (패턴 매칭)
import re
pattern = r'useEffect\(\(\) => \{.*?return \(  return \('
# 이 패턴은 줄바꿈을 포함해야 함
replacement = """  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try { scrollRef.current?.scrollTo({ x: initialOffsetX, y: 0, animated: false }); } catch {}
    });
    return () => cancelAnimationFrame(id);
  }, [initialOffsetX]);

  return ("""

c = re.sub(r'useEffect\(\(\) => \{.*?return \(  return \(', replacement, c, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
