"""
extract_poles.py  최종
정선.dxf 실측 구조:
  CN_L_Pole_Pole-Joint / Pole-Joint-TRS  INSERT
    └ ATTRIB tag='ID'      → 전산화번호 (8516X422)
    └ ATTRIB tag='SUB_ID'  → 전주번호   (나전-S6L3)
  CN_L_Pole_Line_Aerial  TEXT → 거리(m)

사용법:
  python extract_poles.py 정선.dxf
  python extract_poles.py                    전체
  python extract_poles.py --span-snap 50     경간 반경 조정
"""
import ezdxf, csv, json, re, sys, math, argparse, time
from pyproj import Transformer

# EPSG:2097 (한국 중부원점 TM) → WGS84 변환기
_tm2wgs = Transformer.from_crs('EPSG:2097', 'EPSG:4326', always_xy=True)
from pathlib import Path

DEFAULT_DIR = r"C:\도면\dxf"
POLE_LAYERS = {"CN_L_Pole_Pole-Joint", "CN_L_Pole_Pole-Joint-TRS"}
DIST_LAYER  = "CN_L_Pole_Line_Aerial"
SPAN_SNAP   = 30.0
RE_DIST     = re.compile(r'^[0-9]{1,4}(\.[0-9]{1,2})?$')

def dist(a, b):
    return math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2)

def process(dxf_path, span_snap):
    print(f"\n▶  {dxf_path.name}")
    try:
        doc = ezdxf.readfile(str(dxf_path))
    except Exception as e:
        print(f"   읽기 실패: {e}"); return [], []

    msp = doc.modelspace()

    # ── 1. 전주 위치 + ATTRIB에서 ID/SUB_ID 직접 추출 ──
    poles = []
    seen  = set()

    for ent in msp.query("INSERT"):
        lay = ent.dxf.layer.strip()
        if not any(lay.upper() == t.upper() for t in POLE_LAYERS): continue
        try:
            p = ent.dxf.insert
            x, y = float(p.x), float(p.y)
        except: continue

        key = (round(x,1), round(y,1))
        if key in seen: continue
        seen.add(key)

        kind   = "변압주" if "TRS" in lay.upper() else "일반"
        pole_id, sub_id = "", ""

        if hasattr(ent, "attribs"):
            for att in ent.attribs:
                tag = att.dxf.tag.strip().upper()
                val = att.dxf.text.strip()
                if tag == "ID":     pole_id = val
                elif tag == "SUB_ID": sub_id  = val

        # EPSG:5186 → WGS84 변환
        lat, lng = _tm2wgs.transform(x, y)
        poles.append({
            "file":    dxf_path.stem,
            "전산화번호": pole_id,
            "전주번호":  sub_id,
            "전주종류":  kind,
            "lat": round(lat, 7),
            "lng": round(lng, 7),
            "_x": x, "_y": y,
        })

    total = len(poles)
    m = sum(1 for p in poles if p["전산화번호"] or p["전주번호"])
    print(f"   전주:  {total:,}개  (일반 {sum(1 for p in poles if p['전주종류']=='일반'):,}  변압 {sum(1 for p in poles if p['전주종류']=='변압주'):,})")
    print(f"   매칭:  {m:,}개 / {total:,}개  ({m/total*100:.0f}%)" if total else "")

    # ── 2. 거리 텍스트 수집 ──
    dist_texts = []
    for ent in msp.query("TEXT MTEXT"):
        if ent.dxf.layer.strip().upper() != DIST_LAYER.upper(): continue
        try:
            p = ent.dxf.insert
            x, y = float(p.x), float(p.y)
        except: continue
        t = ent.text if ent.dxftype()=="MTEXT" else ent.dxf.text
        t = t.strip()
        if RE_DIST.match(t):
            v = float(t)
            if 1 <= v <= 9999:
                dist_texts.append((x, y, v))

    print(f"   거리:  {len(dist_texts):,}개")

    # ── 3. 경간 매칭 (격자 인덱스로 고속화) ──
    from collections import defaultdict
    CELL = span_snap  # 격자 셀 크기

    # 전주를 격자에 등록
    grid = defaultdict(list)
    for i, p in enumerate(poles):
        cx = int(p["_x"] // CELL)
        cy = int(p["_y"] // CELL)
        grid[(cx, cy)].append(i)

    def nearby_poles(sx, sy):
        cx = int(sx // CELL)
        cy = int(sy // CELL)
        candidates = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in grid[(cx+dx, cy+dy)]:
                    d = dist((sx, sy), (poles[i]["_x"], poles[i]["_y"]))
                    if d <= span_snap:
                        candidates.append((d, i))
        return sorted(candidates)

    spans = []
    used  = set()

    for sx, sy, dm in dist_texts:
        near = nearby_poles(sx, sy)
        if len(near) < 2: continue
        i1, i2 = near[0][1], near[1][1]
        key = (min(i1,i2), max(i1,i2))
        if key in used: continue
        used.add(key)
        p1, p2 = poles[i1], poles[i2]
        spans.append({
            "file":       dxf_path.stem,
            "from_전주번호": p1["전주번호"] or f"({p1['_x']:.0f},{p1['_y']:.0f})",
            "to_전주번호":   p2["전주번호"] or f"({p2['_x']:.0f},{p2['_y']:.0f})",
            "from_전산화":  p1["전산화번호"],
            "to_전산화":    p2["전산화번호"],
            "거리(m)":      dm,
        })

    print(f"   경간:  {len(spans):,}개")
    return poles, spans


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files",       nargs="*")
    ap.add_argument("--dir",       default=DEFAULT_DIR)
    ap.add_argument("--out",       default="poles_output")
    ap.add_argument("--span-snap", type=float, default=SPAN_SNAP)
    args = ap.parse_args()

    dxf_dir = Path(args.dir)

    if args.files:
        files = []
        for f in args.files:
            p = Path(f)
            if not p.is_absolute(): p = dxf_dir / p
            files.append(p) if p.exists() else print(f"없음: {p}")
    else:
        files = sorted(dxf_dir.glob("*.dxf"))
        if not files: print(f"DXF 없음: {dxf_dir}"); sys.exit(1)

    print(f"처리: {[f.name for f in files]}")

    all_poles, all_spans = [], []
    for f in files:
        poles, spans = process(f, args.span_snap)
        all_poles.extend(poles)
        all_spans.extend(spans)

    if not all_poles: print("추출 없음"); sys.exit(1)

    out  = dxf_dir if dxf_dir.exists() else Path(".")
    stem = args.out

    # 전주 CSV
    with open(out/f"{stem}.csv","w",newline="",encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["file","전산화번호","전주번호","전주종류","_x","_y"])
        w.writeheader()
        for p in all_poles:
            w.writerow({k:p[k] for k in ["file","전산화번호","전주번호","전주종류","_x","_y"]})
    print(f"\n✅ 전주 CSV  → {out/f'{stem}.csv'}  ({len(all_poles):,}행)")

    # 경간 CSV
    if all_spans:
        with open(out/f"{stem}_spans.csv","w",newline="",encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=["file","from_전주번호","to_전주번호","from_전산화","to_전산화","거리(m)"])
            w.writeheader(); w.writerows(all_spans)
        print(f"✅ 경간 CSV  → {out/f'{stem}_spans.csv'}  ({len(all_spans):,}행)")

    # JSON
    ts = int(time.time()*1000)
    nodes = [{"id":f"pole_{p['file']}_{ts}_{i}","type":"pole_existing",
              "name":p["전주번호"],
              "memo":("전산화번호: "+p["전산화번호"]) if p["전산화번호"] else "",
              "lat":p["lat"],"lng":p["lng"],"_rawX":p["_x"],"_rawY":p["_y"],
              "fiberType":"","ofds":[],"ports":[],"rns":[],"inOrder":[],"connDirections":{}}
             for i,p in enumerate(all_poles)]
    with open(out/f"{stem}_poll.json","w",encoding="utf-8") as f:
        json.dump({"nodes":nodes,"spans":all_spans},f,ensure_ascii=False,indent=2)
    print(f"✅ JSON      → {out/f'{stem}_poll.json'}  ({len(nodes):,}개)")

    print(f"\n── 요약 {'─'*40}")
    by = {}
    for p in all_poles: by.setdefault(p["file"],[]).append(p)
    for fn in sorted(by):
        rows = by[fn]
        m  = sum(1 for r in rows if r["전산화번호"] or r["전주번호"])
        sp = sum(1 for s in all_spans if s["file"]==fn)
        print(f"  {fn:10s}: 전주 {len(rows):,}개  매칭 {m:,}개 ({m/len(rows)*100:.0f}%)  경간 {sp:,}개")

if __name__ == "__main__":
    main()
