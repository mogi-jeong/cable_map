"""
split_poles.py
poles_output_poll.json을 구역별로 분할하여 저장 + poles_index.json 생성
"""
import json, time, os
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent
src  = ROOT / 'poles_output_poll.json'

if not src.exists():
    print('❌ poles_output_poll.json 없음')
    exit(1)

print('JSON 로드 중...')
with open(src, encoding='utf-8') as f:
    data = json.load(f)

nodes = data.get('nodes', [])
print(f'전체 전주: {len(nodes):,}개')

# 구역별 분류
buckets = defaultdict(list)
for n in nodes:
    nid    = n.get('id', '')
    region = nid.split('_')[1] if nid and '_' in nid else '기타'
    buckets[region].append(n)

version = str(int(time.time()))
file_list = []

for region, poles in buckets.items():
    fname = f'poles_{region}.json'
    out   = ROOT / fname
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'nodes': poles, 'v': version}, f, ensure_ascii=False)
    size_mb = out.stat().st_size / 1024 / 1024
    print(f'  {fname}: {len(poles):,}개  ({size_mb:.1f} MB)')
    file_list.append(fname)

# poles_index.json 생성
index = {'v': version, 'files': sorted(file_list)}
with open(ROOT / 'poles_index.json', 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)

# poles_version.json도 같이 갱신
with open(ROOT / 'poles_version.json', 'w', encoding='utf-8') as f:
    json.dump({'v': version}, f)

print(f'\n✅ 분할 완료 — 버전 {version}')
print(f'   poles_index.json 생성됨: {sorted(file_list)}')
