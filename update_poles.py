"""
update_poles.py
전주 데이터 업데이트 + 버전 갱신 + git push

사용법:
  python update_poles.py
"""
import json, time, subprocess
from pathlib import Path

ROOT = Path(__file__).parent

# 1. 버전 갱신
version = str(int(time.time()))
with open(ROOT / 'poles_version.json', 'w', encoding='utf-8') as f:
    json.dump({'v': version}, f)
print(f'버전 갱신: {version}')

# 2. poles_output_poll.json 확인
poll_json = ROOT / 'poles_output_poll.json'
if not poll_json.exists():
    print('❌ poles_output_poll.json 없음')
    exit(1)

with open(poll_json, encoding='utf-8') as f:
    data = json.load(f)
print(f'전주 데이터: {len(data.get("nodes", [])):,}개')

# 3. git add + commit + push
subprocess.run(['git', 'add', 'poles_output_poll.json', 'poles_version.json'], cwd=ROOT)
subprocess.run(['git', 'commit', '-m', f'update: poles data v{version}'], cwd=ROOT)
subprocess.run(['git', 'push', 'origin', 'main'], cwd=ROOT)
print('✅ GitHub push 완료')
