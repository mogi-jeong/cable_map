// ============================================================
//  cable_map_gongga_agent.js — 공가 행 계산 에이전트 (JS 규칙 엔진)
//
//  역할: generateApplicationFromRange가 추출한 agentData를 받아
//        1차/2차 전주를 결정하고 gonggaBuildFromAIRows로 Excel 출력
//
//  agentData 구조:
//    범위내전주[]: { id, 선로명, 선로번호, 관리구, 번호, 전산화번호,
//                   connRoutes[]: { connId, prevPoleId, nextPoleId,
//                                   cores, lineType, fromNodeId, fromNodeType } }
//    _allPoleMap:  { poleId → poleRef } — 범위 밖 전주 조회용
//    함체목록[]:   { id, portConns, inLastPole }
//    장비매핑:     { poleId → [{type, 기기코드, id, name}] }
//
//  규칙:
//    - 기본: connRoute의 prevPoleId/nextPoleId → 1차/2차전주
//    - 함체(junction) 시작 케이블: prevPoleId===null 이면
//      함체 IN 포트 케이블의 마지막 전주(inLastPole)를 1차전주로 사용
//    - prevPoleId/nextPoleId 없으면 99999/999
// ============================================================

(function () {

    // ── 메인 진입점 ──────────────────────────────────────────

    window.gonggaAgentProcess = function (agentData) {
        var _show = (typeof showStatus === 'function') ? showStatus : function (m) { console.log(m); };
        console.log('[공가 디버그]', JSON.stringify(agentData, null, 2));

        var rows = gonggaComputeRows(agentData);

        if (rows.length === 0) {
            alert('추출할 행이 없습니다.\n범위 내 전주와 케이블을 확인하세요.');
            return;
        }

        _show('공가 계산 완료 (' + rows.length + '행) — 장표 로딩 중...');

        gonggaLoadInvs(function (invsData) {
            gonggaBuildFromAIRows(rows, invsData);
        });
    };

    // ── 행 계산 규칙 엔진 ────────────────────────────────────

    function gonggaComputeRows(agentData) {
        var rows = [];
        var allPoleMap = agentData._allPoleMap || {};

        // poleRef 조회: 범위내전주 먼저, 없으면 _allPoleMap
        var inRangeMap = {};
        agentData.범위내전주.forEach(function(p){ inRangeMap[p.id] = p; });

        function getPoleRef(poleId) {
            if (!poleId) return null;
            return inRangeMap[poleId] || allPoleMap[poleId] || null;
        }

        var EMPTY_POLE = { 관리구: '99999', 번호: '999', 선로명: '', 선로번호: '' };

        agentData.범위내전주.forEach(function (pole) {
            var routes = pole.connRoutes || [];
            var equips = agentData.장비매핑[pole.id] || [];

            // 케이블 없이 장비만 있는 전주 → 99999/999 행
            if (routes.length === 0) {
                var hasNearJunction = agentData.함체목록.some(function(j) {
                    return j.nearPoleId === pole.id;
                });
                if (equips.length > 0 || hasNearJunction) {
                    rows.push({
                        현전주: pole, '1차전주': EMPTY_POLE, '2차전주': EMPTY_POLE,
                        케이블규격: '', 통신선종류: 'O', 장비목록: equips, 케이블id: null
                    });
                }
                return;
            }

            // ── 이 전주에 인접한 함체 탐색 ──
            var nearJunction = agentData.함체목록.find(function(j) {
                return j.nearPoleId === pole.id;
            });

            // 병합 처리된 connId 추적
            var mergedIds = {};

            if (nearJunction) {
                var pc = nearJunction.portConns || {};
                var inConnId  = pc['IN']  || null;
                var outConnId = pc['OUT'] || null;
                var inRoute   = inConnId  ? routes.find(function(r){ return r.connId === inConnId;  }) : null;
                var outRoute  = outConnId ? routes.find(function(r){ return r.connId === outConnId; }) : null;

                // IN + OUT 동시 존재 → 1행으로 병합
                if (inRoute && outRoute) {
                    var prevPole = getPoleRef(inRoute.prevPoleId);
                    var nextPole = getPoleRef(outRoute.nextPoleId);
                    // inLastPole 폴백 (IN 앞쪽이 또 다른 junction인 경우)
                    if (!prevPole && inRoute.fromNodeType === 'junction') {
                        var jj = agentData.함체목록.find(function(j){ return j.id === inRoute.fromNodeId; });
                        if (jj && jj.inLastPole) prevPole = jj.inLastPole;
                    }
                    // outFirstPole 폴백: outRoute.nextPoleId가 null인 경우
                    if (!nextPole && nearJunction.outFirstPole) nextPole = nearJunction.outFirstPole;
                    rows.push({
                        현전주:    pole,
                        '1차전주': prevPole  || EMPTY_POLE,
                        '2차전주': nextPole  || EMPTY_POLE,
                        케이블규격: String(inRoute.cores || outRoute.cores || ''),
                        통신선종류: inRoute.cableType === 'coax' ? 'C' : 'O',
                        장비목록:  equips,
                        케이블id:  inConnId + '+' + outConnId
                    });
                    mergedIds[inConnId]  = true;
                    mergedIds[outConnId] = true;
                }
                // IN만 있고 OUT 없음 → outFirstPole로 2차전주 시도
                else if (inRoute && !outRoute) {
                    var prevPole2 = getPoleRef(inRoute.prevPoleId);
                    var nextPole2 = nearJunction.outFirstPole || EMPTY_POLE;
                    rows.push({
                        현전주:    pole,
                        '1차전주': prevPole2 || EMPTY_POLE,
                        '2차전주': nextPole2,
                        케이블규격: String(inRoute.cores || ''),
                        통신선종류: inRoute.cableType === 'coax' ? 'C' : 'O',
                        장비목록:  equips,
                        케이블id:  inConnId + (outConnId ? '+' + outConnId : '')
                    });
                    mergedIds[inConnId] = true;
                    if (outConnId) mergedIds[outConnId] = true;
                }
            }

            // 병합되지 않은 나머지 케이블 (BR 포함, 단독 OUT 등)
            routes.forEach(function (route) {
                if (mergedIds[route.connId]) return;

                var prevPole = getPoleRef(route.prevPoleId);
                // 함체 OUT/BRL/BRR 시작: 1차전주 = 함체 IN의 마지막 전주
                if (!prevPole && route.fromNodeType === 'junction') {
                    var junction = agentData.함체목록.find(function(j){ return j.id === route.fromNodeId; });
                    if (junction && junction.inLastPole) prevPole = junction.inLastPole;
                }
                var nextPole = getPoleRef(route.nextPoleId);

                rows.push({
                    현전주:    pole,
                    '1차전주': prevPole || EMPTY_POLE,
                    '2차전주': nextPole || EMPTY_POLE,
                    케이블규격: String(route.cores || ''),
                    통신선종류: route.cableType === 'coax' ? 'C' : 'O',
                    장비목록:  equips,
                    케이블id:  route.connId
                });
            });
        });

        // ── 정렬: 선로번호 숫자 → connRoute 순서 ──
        rows.sort(function (a, b) {
            var numA = parseInt((String(a.현전주.선로번호).match(/\d+/) || ['0'])[0]);
            var numB = parseInt((String(b.현전주.선로번호).match(/\d+/) || ['0'])[0]);
            if (numA !== numB) return numA - numB;
            // 같은 전주면 1차전주 선로번호 기준 추가 정렬
            var prevA = parseInt((String(a['1차전주'].선로번호).match(/\d+/) || ['0'])[0]);
            var prevB = parseInt((String(b['1차전주'].선로번호).match(/\d+/) || ['0'])[0]);
            return prevA - prevB;
        });

        return rows;
    }

})();
