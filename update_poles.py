"""
update_poles.py
poles_output_poll.json -> 구역별 분할 -> git push

사용법:
  python update_poles.py
"""
import json, time, subprocess, sys
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent

# 1. poles_output_poll.json 로드
poll_json = ROOT / 'poles_output_poll.json'
if not poll_json.exists():
    print('poles_output_poll.json 없음')
    exit(1)

print('JSON 로드 중...')
with open(poll_json, encoding='utf-8') as f:
    data = json.load(f)

nodes = data.get('nodes', [])
print(f'전체 전주: {len(nodes):,}개')

# 2. 버전 갱신
version = str(int(time.time()))

# 3. 구역별 분할 저장
buckets = defaultdict(list)
for n in nodes:
    nid    = n.get('id', '')
    region = nid.split('_')[1] if nid and '_' in nid else '기타'
    buckets[region].append(n)

file_list = []
git_files = []

for region, poles in buckets.items():
    fname = f'poles_{region}.json'
    out   = ROOT / fname
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'nodes': poles, 'v': version}, f, ensure_ascii=False)
    size_mb = out.stat().st_size / 1024 / 1024
    print(f'  {fname}: {len(poles):,}개  ({size_mb:.1f} MB)')
    file_list.append(fname)
    git_files.append(fname)

# 4. poles_index.json + poles_version.json 갱신
index = {'v': version, 'files': sorted(file_list)}
with open(ROOT / 'poles_index.json', 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)
with open(ROOT / 'poles_version.json', 'w', encoding='utf-8') as f:
    json.dump({'v': version}, f)

git_files += ['poles_index.json', 'poles_version.json']

# 5. git add + commit + push
subprocess.run(['git', 'add'] + git_files, cwd=ROOT)
subprocess.run(['git', 'commit', '-m', f'update: poles data v{version}'], cwd=ROOT)
subprocess.run(['git', 'push', 'origin', 'main'], cwd=ROOT)
print(f'GitHub push 완료 (v{version})')
