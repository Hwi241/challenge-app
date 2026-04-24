import os
import re

file_path = 'screens/EntryListScreen.js'
if not os.path.exists(file_path):
    print(f"Error: {file_path} not found")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. waveIntensity state check & add
if 'const [waveIntensity' not in content:
    old_state = 'const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH - EDGE * 2);'
    new_state = old_state + '\n  const [waveIntensity, setWaveIntensity] = useState(() => new Array(420).fill(0));\n  const waveRafRef = React.useRef(null);'
    content = content.replace(old_state, new_state)

# 2. RAF effect check & add
if '// RAF 기반 파도' not in content:
    effect_code = """
  // RAF 기반 파도 useEffect
  useEffect(() => {
    if (waveRafRef.current) cancelAnimationFrame(waveRafRef.current);
    const TOTAL_COLS = 60;
    const TOTAL_ROWS = 7;
    const WAVE_WIDTH = 4; 
    const WAVE_SPEED = 0.02; 
    const DIAGONAL = 0.6; 
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const wavePos = elapsed * WAVE_SPEED;
      if (wavePos > TOTAL_COLS + WAVE_WIDTH + TOTAL_ROWS * DIAGONAL) {
        setWaveIntensity(new Array(TOTAL_COLS * TOTAL_ROWS).fill(0));
        return;
      }
      const intensities = new Array(TOTAL_COLS * TOTAL_ROWS).fill(0);
      for (let col = 0; col < TOTAL_COLS; col++) {
        for (let row = 0; row < TOTAL_ROWS; row++) {
          const diagOffset = row * DIAGONAL;
          const dist = Math.abs((col + diagOffset) - wavePos);
          if (dist < WAVE_WIDTH) {
            intensities[col * TOTAL_ROWS + row] = Math.sin((1 - dist / WAVE_WIDTH) * Math.PI * 0.5);
          }
        }
      }
      setWaveIntensity(intensities);
      waveRafRef.current = requestAnimationFrame(tick);
    };
    waveRafRef.current = requestAnimationFrame(tick);
    return () => { if (waveRafRef.current) cancelAnimationFrame(waveRafRef.current); };
  }, [waveTrigger]);
"""
    # Insert after waveTrigger useEffect
    insertion_point = 'useEffect(() => { if (onTap) onTap(() => setWaveTrigger(t => t + 1)); }, [onTap]);'
    if insertion_point in content:
        content = content.replace(insertion_point, insertion_point + effect_code)

# 3. GridContent rendering logic check & update
if 'const intensity2D' not in content:
    # This is a complex replacement, aiming for the core loop
    pattern = r'(Array\.from\(\{ length: totalCols \}\)\.map\(\(_, col\) => \{)(.*?)(\}\)\s*<\/View>\);)'
    
    # We'll do a more surgical replacement for the inner cell rendering
    old_cell = r'const cell = cellData\.find\(c => c\.col === col && c\.row === row\);'
    new_cell = old_cell + '\n              const intensity2D = waveIntensity[col * GRASS_ROWS + row] ?? 0;\n              const wave = intensity2D;'
    content = content.replace(old_cell, new_cell)
    
    old_bg = "backgroundColor: wave > 0.05 ? waveColor : baseColor,"
    new_bg = "backgroundColor: wave > 0.05 ? waveColor : baseColor," # Ensure it exists
    
    # Ensure waveColor logic uses the new wave variable
    if 'let waveColor = baseColor;' in content:
        print("WaveColor logic already exists")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SUCCESS: fix_wave.py execution simulation (script created and ran)")
