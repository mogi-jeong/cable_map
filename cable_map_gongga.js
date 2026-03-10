// ==================== 공가 신청서 생성 (gongga.js) ====================
// cable_map_ui.js에서 분리된 공가 신청서 자동생성 로직
// 의존: XLSX(SheetJS), showStatus(), _cachedInvsData(window)

var _cachedInvsData = null; // 세션 동안 장표 캐시

// ── 유틸 ──

function _gongga_v(x) {
    if (x == null) return '';
    var s = String(x).trim();
    return (s.toLowerCase() === 'nan' || s.toLowerCase() === 'none') ? '' : s;
}

function _gongga_numStr(n) {
    try { return String(parseInt(n)); } catch(e) { return String(n); }
}

// ── 전주 파싱 ──

function gonggaParsePoles(poleList, cableInfo) {
    var cInfo = cableInfo || {};
    var 케이블규격 = String(cInfo.cores || '');
    var 통신선종류 = cInfo.lineType === 'coax' ? 'C' : 'O';
    var equipByPoleId = cInfo.equipByPoleId || {};
    // 장비 타입 → 기기코드 매핑
    var EQUIP_CODE = { 'onu': '3', 'junction': '6' };
    var poles = [];
    for (var i = 0; i < poleList.length; i++) {
        var node = poleList[i];
        var rawNum = (node.memo || '').replace('자가주:true', '').replace('전산화번호: ', '').trim();
        var m1 = rawNum.match(/^(.{5})(\d{3})$/);
        var 관리구 = m1 ? m1[1] : rawNum;
        var 번호 = m1 ? m1[2] : '';
        var poleName = node.name || '';
        var m2 = poleName.match(/^(.+)-(\d+[A-Za-z0-9]*)$/);
        var 선로명 = m2 ? m2[1] : poleName;
        var 선로번호 = m2 ? m2[2] : '';
        var 전산화번호 = (관리구 + (번호 ? String(parseInt(번호)).padStart(3, '0') : '')).toUpperCase();
        // 장비 목록 (최대 3개)
        var equipList = (equipByPoleId[node.id] || [])
            .map(function(eq) { return { 기기코드: EQUIP_CODE[eq.type] || '', 관리번호: eq.name || '' }; })
            .filter(function(e) { return e.기기코드; })
            .slice(0, 3);
        poles.push({ 관리구: 관리구, 번호: 번호, 선로명: 선로명, 선로번호: 선로번호, 전산화번호: 전산화번호, 케이블규격: 케이블규격, 통신선종류: 통신선종류, 장비목록: equipList });
    }
    // 정렬 (sort_key)
    poles.sort(function(a, b) {
        var sa = String(a.선로번호), sb = String(b.선로번호);
        var hasBrA = /[A-Za-z]/.test(sa), hasBrB = /[A-Za-z]/.test(sb);
        var numsA = sa.match(/\d+/g) || [], numsB = sb.match(/\d+/g) || [];
        var baseA = numsA.length ? parseInt(numsA[0]) : 0;
        var baseB = numsB.length ? parseInt(numsB[0]) : 0;
        if (baseA !== baseB) return baseA - baseB;
        var brA = hasBrA ? 0 : 1, brB = hasBrB ? 0 : 1;
        if (brA !== brB) return brA - brB;
        return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    return poles;
}

// ── 장표 로딩 ──

function gonggaLoadInvs(onLoaded) {
    if (_cachedInvsData) {
        onLoaded(_cachedInvsData);
        return;
    }
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.xlsx,.xls';
    inp.onchange = function(ev) {
        var file = ev.target.files[0];
        if (!file) return;
        showStatus('장표 파일 읽는 중...');
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = new Uint8Array(e.target.result);
                var wb = XLSX.read(data, { type: 'array' });
                var ws = wb.Sheets[wb.SheetNames[0]];
                var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                var byId = {}, byName = {};
                rows.forEach(function(r) {
                    var row = {};
                    Object.keys(r).forEach(function(k) { row[k.trim()] = r[k]; });
                    var key = String(row['시작전산화번호'] || '').trim().toUpperCase();
                    if (!key) return;
                    if (!byId[key]) byId[key] = [];
                    byId[key].push(row);
                    var nm = _gongga_v(row['현전주 선로명']);
                    var nb = _gongga_v(row['현전주 선로번호']);
                    if (nm) {
                        var nk = nm + '|' + nb;
                        if (!byName[nk]) byName[nk] = [];
                        byName[nk].push(row);
                    }
                });
                _cachedInvsData = { byId: byId, byName: byName };
                showStatus('장표 로드 완료 (' + rows.length + '행)');
                onLoaded(_cachedInvsData);
            } catch (ex) {
                alert('장표 파일 읽기 실패: ' + ex.message);
            }
        };
        reader.readAsArrayBuffer(file);
    };
    inp.click();
}

// ── 신청서 빌드 (핵심 로직) ──

function gonggaBuildApplication(poles, invs, fromNode, toNode) {
    var JUMP_THRESHOLD = 2;
    var defaults = { 설치단: '2', 사업자: 'A000042286', 용도: '4', 통신선: 'O', 규격: '12' };

    var NCOLS = 34;
    var HEADER_ROW3 = [
        '','',
        '현전주','현전주','현전주','현전주',
        '1차전주','1차전주','1차전주','1차전주',
        '2차전주','2차전주','2차전주','2차전주',
        '통신케이블','통신케이블','통신케이블','통신케이블','통신케이블',
        '통신케이블','통신케이블','통신케이블','통신케이블','통신케이블',
        '통신기기1','통신기기1','통신기기1',
        '통신기기2','통신기기2','통신기기2',
        '통신기기3','통신기기3','통신기기3',
        ''
    ];
    var HEADER_ROW4 = [
        '','',
        '선로명','선로번호','관리구','번호',
        '선로명','선로번호','관리구','번호',
        '선로명','선로번호','관리구','번호',
        '설치단','사업자','설치일자','케이블번호','용도',
        '통선선종류','규격','승인코드','고객공급선종류','봉인번호',
        '기기코드','사업자','관리번호',
        '기기코드','사업자','관리번호',
        '기기코드','사업자','관리번호',
        ''
    ];
    var C = {
        순번:0, 접수구분:1,
        현선로명:2, 현선로번호:3, 현관리구:4, 현번호:5,
        '1차선로명':6, '1차선로번호':7, '1차관리구':8, '1차번호':9,
        '2차선로명':10, '2차선로번호':11, '2차관리구':12, '2차번호':13,
        설치단:14, 사업자:15, 설치일자:16, 케이블번호:17,
        용도:18, 통선선종류:19, 규격:20, 승인코드:21,
        고객공급선종류:22, 봉인번호:23,
        '기기1코드':24, '기기1사업자':25, '기기1관리번호':26,
        '기기2코드':27, '기기2사업자':28, '기기2관리번호':29,
        '기기3코드':30, '기기3사업자':31, '기기3관리번호':32,
        비고:33
    };

    // 자가주 체크
    function checkJaga(pole, prev, nxt) {
        var notes = [];
        try {
            var cur = parseInt(pole.선로번호);
            if (isNaN(cur)) return '';
            if (prev) { var p = parseInt(prev.선로번호); if (!isNaN(p) && Math.abs(cur - p) > JUMP_THRESHOLD) notes.push('1차 전주 자가주'); }
            if (nxt)  { var n = parseInt(nxt.선로번호);  if (!isNaN(n) && Math.abs(n - cur) > JUMP_THRESHOLD) notes.push('2차 전주 자가주'); }
        } catch(e) {}
        return notes.join(' / ');
    }

    // 장표 → 접수3 행
    function invsToRow3(r, seq, note) {
        var row = new Array(NCOLS).fill('');
        row[C.순번] = seq;
        row[C.접수구분] = '3';
        row[C.현선로명] = _gongga_v(r['현전주 선로명']);
        row[C.현선로번호] = _gongga_v(r['현전주 선로번호']);
        row[C.현관리구] = _gongga_v(r['현전주 관리구']);
        row[C.현번호] = _gongga_v(r['현전주 번호']);
        row[C['1차선로명']] = _gongga_v(r['1차전주 선로명']);
        row[C['1차선로번호']] = _gongga_v(r['1차전주 선로번호']);
        row[C['1차관리구']] = _gongga_v(r['1차전주 관리구']);
        row[C['1차번호']] = _gongga_v(r['1차전주 번호']);
        row[C['2차선로명']] = _gongga_v(r['2차전주 선로명']);
        row[C['2차선로번호']] = _gongga_v(r['2차전주 선로번호']);
        row[C['2차관리구']] = _gongga_v(r['2차전주 관리구']);
        row[C['2차번호']] = _gongga_v(r['2차전주 번호']);
        row[C.설치단] = _gongga_v(r['설치단']);
        row[C.사업자] = _gongga_v(r['사업자']);
        row[C.설치일자] = _gongga_v(r['설치일자']);
        row[C.케이블번호] = _gongga_v(r['케이블번호']);
        row[C.용도] = _gongga_v(r['용도']);
        row[C.통선선종류] = _gongga_v(r['통신선종류']);
        row[C.규격] = _gongga_v(r['규격']);
        row[C.승인코드] = _gongga_v(r['승인코드']);
        row[C.고객공급선종류] = _gongga_v(r['고객공급선종류']);
        row[C.봉인번호] = _gongga_v(r['봉인번호']);
        row[C.비고] = note || '';
        return row;
    }

    // 전주 → 접수2 행
    function poleToRow2(pole, prev, nxt, seq, invsRow, note) {
        var row = new Array(NCOLS).fill('');
        row[C.순번] = seq;
        row[C.접수구분] = '2';
        row[C.현선로명] = pole.선로명;
        row[C.현선로번호] = pole.선로번호;
        row[C.현관리구] = pole.관리구;
        row[C.현번호] = _gongga_numStr(pole.번호);
        // 1차/2차 전주: 자가주면 99999/999
        var jaga1 = false, jaga2 = false;
        try {
            var curNum = parseInt(pole.선로번호);
            if (prev && !isNaN(curNum)) { var p = parseInt(prev.선로번호); if (!isNaN(p) && Math.abs(curNum - p) > JUMP_THRESHOLD) jaga1 = true; }
            if (nxt && !isNaN(curNum))  { var n = parseInt(nxt.선로번호);  if (!isNaN(n) && Math.abs(n - curNum) > JUMP_THRESHOLD) jaga2 = true; }
        } catch(e) {}
        if (prev && !jaga1) {
            row[C['1차선로명']] = prev.선로명;
            row[C['1차선로번호']] = prev.선로번호;
            row[C['1차관리구']] = prev.관리구;
            row[C['1차번호']] = _gongga_numStr(prev.번호);
        } else {
            row[C['1차관리구']] = '99999'; row[C['1차번호']] = '999';
        }
        if (nxt && !jaga2) {
            row[C['2차선로명']] = nxt.선로명;
            row[C['2차선로번호']] = nxt.선로번호;
            row[C['2차관리구']] = nxt.관리구;
            row[C['2차번호']] = _gongga_numStr(nxt.번호);
        } else {
            row[C['2차관리구']] = '99999'; row[C['2차번호']] = '999';
        }
        row[C.설치단] = defaults.설치단;
        row[C.사업자] = defaults.사업자;
        row[C.용도] = defaults.용도;
        row[C.통선선종류] = pole.통신선종류 || defaults.통신선;
        row[C.규격] = invsRow ? _gongga_v(invsRow['규격']) : (pole.케이블규격 || defaults.규격);
        // 통신기기1~3
        var equips = pole.장비목록 || [];
        for (var ei = 0; ei < equips.length && ei < 3; ei++) {
            row[C['기기' + (ei + 1) + '코드']] = equips[ei].기기코드;
            row[C['기기' + (ei + 1) + '사업자']] = defaults.사업자;
            row[C['기기' + (ei + 1) + '관리번호']] = equips[ei].관리번호;
        }
        row[C.비고] = note || '';
        return row;
    }

    // 분류
    var 신규 = [], 정비_신설 = [], 정비_해제 = [];
    var seq = 1;
    for (var i = 0; i < poles.length; i++) {
        var pole = poles[i];
        var prev = i > 0 ? poles[i - 1] : null;
        var nxt = i < poles.length - 1 ? poles[i + 1] : null;
        var invsRows = invs.byId[pole.전산화번호];
        if (!invsRows) {
            var nameKey = pole.선로명 + '|' + pole.선로번호;
            invsRows = invs.byName[nameKey];
        }
        var jaga = checkJaga(pole, prev, nxt);

        if (invsRows) {
            // 신설(접수2): 첫 번째 광(O) 행의 규격만 참조 (동축 제외)
            var optRow = null;
            for (var j = 0; j < invsRows.length; j++) {
                if (String(_gongga_v(invsRows[j]['통신선종류'])).toUpperCase() === 'O') { optRow = invsRows[j]; break; }
            }
            정비_신설.push(poleToRow2(pole, prev, nxt, seq, optRow, jaga));
            // 해지(접수3): 장표 전체 그대로 (광+동축 모두)
            invsRows.forEach(function(ir) {
                정비_해제.push(invsToRow3(ir, seq, jaga));
            });
        } else {
            신규.push(poleToRow2(pole, prev, nxt, seq, null, jaga));
        }
        seq++;
    }

    // 본/조 계산
    function countBonJo(dataRows) {
        var poleKeys = new Set();
        dataRows.forEach(function(r) { poleKeys.add(r[C.현선로명] + '-' + r[C.현선로번호]); });
        return { bon: poleKeys.size, jo: dataRows.length };
    }

    // 구간명 생성
    function makeRangeName(dataRows) {
        if (dataRows.length === 0) return '';
        var first = dataRows[0], last = dataRows[dataRows.length - 1];
        var firstName = first[C.현선로명], firstNum = first[C.현선로번호];
        var lastName = last[C.현선로명], lastNum = last[C.현선로번호];
        if (firstName === lastName) return firstName + firstNum + '-' + lastNum;
        return firstName + firstNum + '-' + lastName + lastNum;
    }

    // 시트 빌드
    var COL_WIDTHS = [6,7, 9,8,8,5, 9,8,8,5, 9,8,8,5, 5,13,11,18,5, 5,5,7,7,8, 7,7,7, 7,7,7, 7,7,7, 20];

    function buildSheet(dataRows, sheetTitle) {
        var aoa = [];
        var titleRow = new Array(NCOLS).fill('');
        titleRow[0] = sheetTitle || '공가 가공설비 시설계획서';
        aoa.push(titleRow);
        aoa.push(new Array(NCOLS).fill(''));
        var row3 = HEADER_ROW3.slice();
        row3[0] = '순번'; row3[1] = '접수구분'; row3[33] = '비고';
        aoa.push(row3);
        aoa.push(HEADER_ROW4);
        dataRows.forEach(function(item) {
            if (Array.isArray(item)) {
                aoa.push(item);
            } else if (item.type === 'sep') {
                var sepRow = new Array(NCOLS).fill('');
                sepRow[0] = '\u25b6  ' + item.label;
                aoa.push(sepRow);
            } else {
                aoa.push(item.data);
            }
        });

        var ws = XLSX.utils.aoa_to_sheet(aoa);
        var merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } },
            { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
            { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
            { s: { r: 2, c: 2 }, e: { r: 2, c: 5 } },
            { s: { r: 2, c: 6 }, e: { r: 2, c: 9 } },
            { s: { r: 2, c: 10 }, e: { r: 2, c: 13 } },
            { s: { r: 2, c: 14 }, e: { r: 2, c: 23 } },
            { s: { r: 2, c: 24 }, e: { r: 2, c: 26 } },
            { s: { r: 2, c: 27 }, e: { r: 2, c: 29 } },
            { s: { r: 2, c: 30 }, e: { r: 2, c: 32 } },
            { s: { r: 2, c: 33 }, e: { r: 3, c: 33 } }
        ];
        var rowIdx = 4;
        dataRows.forEach(function(item) {
            if (!Array.isArray(item) && item.type === 'sep') {
                merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: NCOLS - 1 } });
            }
            rowIdx++;
        });
        ws['!merges'] = merges;
        ws['!cols'] = COL_WIDTHS.map(function(w) { return { wch: w }; });
        return ws;
    }

    // 시트 생성
    var ws1 = buildSheet(신규, '공가 가공설비 시설계획서 (신규)');

    var 정비data = [];
    if (정비_해제.length > 0 || 정비_신설.length > 0) {
        정비data.push({ type: 'sep', label: '해제  (접수구분 3)' });
        정비_해제.forEach(function(r) { 정비data.push({ type: 'row3', data: r }); });
        정비data.push({ type: 'sep', label: '신설  (접수구분 2)' });
        정비_신설.forEach(function(r) { 정비data.push({ type: 'row2', data: r }); });
    }
    var ws2 = buildSheet(정비data, '공가 가공설비 시설계획서 (정비)');
    var ws3 = buildSheet([], '공가 가공설비 시설계획서 (해지)');

    // 날짜 문자열
    var today = new Date();
    var dateStr = String(today.getFullYear()).slice(2) +
                  String(today.getMonth() + 1).padStart(2, '0') +
                  String(today.getDate()).padStart(2, '0');

    // 신규 파일
    if (신규.length > 0) {
        var nWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(nWb, ws1, '시설계획서_신규');
        XLSX.utils.book_append_sheet(nWb, buildSheet([], '공가 가공설비 시설계획서 (정비)'), '시설계획서_정비');
        XLSX.utils.book_append_sheet(nWb, buildSheet([], '공가 가공설비 시설계획서 (해지)'), '시설계획서_해지');
        var nInfo = countBonJo(신규);
        var nRange = makeRangeName(신규);
        var fn1 = dateStr + '_LGHV_공가신규_' + nRange + '_' + nInfo.bon + '본' + nInfo.jo + '조.xlsx';
        XLSX.writeFile(nWb, fn1);
    }

    // 정비 파일
    if (정비_신설.length > 0) {
        var jWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(jWb, buildSheet([], '공가 가공설비 시설계획서 (신규)'), '시설계획서_신규');
        XLSX.utils.book_append_sheet(jWb, ws2, '시설계획서_정비');
        XLSX.utils.book_append_sheet(jWb, buildSheet([], '공가 가공설비 시설계획서 (해지)'), '시설계획서_해지');
        var jInfo = countBonJo(정비_신설);
        var jRange = makeRangeName(정비_신설);
        var fn2 = dateStr + '_LGHV_공가정비_' + jRange + '_' + jInfo.bon + '본' + jInfo.jo + '조.xlsx';
        XLSX.writeFile(jWb, fn2);
    }

    // 둘 다 없으면 빈 파일
    if (신규.length === 0 && 정비_신설.length === 0) {
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, '시설계획서_신규');
        XLSX.utils.book_append_sheet(wb, ws2, '시설계획서_정비');
        XLSX.utils.book_append_sheet(wb, ws3, '시설계획서_해지');
        var fileName = dateStr + '_LGHV_공가신청서_' + ((fromNode?.name || 'A') + '-' + (toNode?.name || 'B')).slice(0, 20) + '.xlsx';
        XLSX.writeFile(wb, fileName);
    }

    var msgs = [];
    if (신규.length > 0) msgs.push('신규 ' + 신규.length + '행');
    if (정비_신설.length > 0) msgs.push('정비 해제 ' + 정비_해제.length + '행 + 신설 ' + 정비_신설.length + '행');
    showStatus('공가 신청서 생성 완료 — ' + (msgs.length ? msgs.join(', ') : '데이터 없음'));
}
