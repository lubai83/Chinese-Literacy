import os
import re
import json
import glob
try:
    from pypdf import PdfReader
except ImportError:
    import sys
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pypdf'])
    from pypdf import PdfReader

input_dir = r"C:\Users\lubai\Downloads\shengzi"
output_dir = r"C:\Users\lubai\.gemini\antigravity\scratch\chinese-flashcards\js\data"

os.makedirs(output_dir, exist_ok=True)
pdf_files = sorted(glob.glob(os.path.join(input_dir, "*.pdf")))

for filepath in pdf_files:
    filename = os.path.basename(filepath)
    match = re.search(r'(\d+)', filename)
    if not match: continue
    grade = int(match.group(1))
    
    reader = PdfReader(filepath)
    text = ""
    for page in reader.pages: text += page.extract_text() + "\n"
    
    current_lesson_title = "未分类"
    lines = text.split('\n')
    vocab_list = []
    
    for line in lines:
        line = line.strip()
        if not line: continue
        # Matches 一、《眼睛》(18) or 1、《眼睛》 etc.
        m = re.search(r'《(.*?)》', line)
        if m:
            current_lesson_title = m.group(1)
            continue
        if "单元" in line or "生字表" in line or "累计" in line: continue
        
        # It's characters
        chars = line.replace(" ", "")
        for char in chars:
            if '\u4e00' <= char <= '\u9fff':
                vocab_list.append({
                    "id": f"g{grade}_{len(vocab_list)}",
                    "char": char,
                    "lesson": current_lesson_title
                })
                
    js_content = f"window.MaLiPingVocab = window.MaLiPingVocab || {{}};\n"
    js_content += f"window.MaLiPingVocab.grade{grade} = {json.dumps(vocab_list, ensure_ascii=False, indent=2)};\n"
    
    out_path = os.path.join(output_dir, f"grade{grade}.js")
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"Generated grade{grade}.js with {len(vocab_list)} characters.")
