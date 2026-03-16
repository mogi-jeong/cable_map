// ============================================================
//  cable_map_jakdo.js  —  이음 v2 작도 에이전트
//  
//  역할: 두 장비(노드) 사이 경유 전주를 자동 탐색하여
//        connection.waypoints[] 를 자동으로 채워줌
//
//  사용법:
//    <script src="cable_map_jakdo.js"></script>
//    → 자동으로 이음 UI에 "작도" 버튼이 추가됨
//
//  나중에 동축 추가할 때:
//    autoRouteConfig.coax.corridorM 값만 조정하면 됨
// ============================================================

(function () {

    // ──────────────────────────────────────────────
    //  설정값 (나중에 동축 추가 시 coax 섹션만 수정)
    // ──────────────────────────────────────────────
    var autoRouteConfig = {
        fiber: {
            corridorM: 25,      // 직선 경로에서 ±25m 이내 전주만 탐색
            minSegM:   5,       // 시작/끝 노드에서 5m 이내 전주 제외
            snapR:     10       // 전주 스냅 반경 (cable_map_ui.js의 SNAP_RADIUS_M과 동일)
        },
        coax: {
            corridorM: 20,      // 동축은 더 좁은 복도 (나중에 튜닝)
            minSegM:   5,
            snapR:     15       // COAX_SNAP_RADIUS_M과 동일하게 맞출 것
        }
    };

    // ──────────────────────────────────────────────
    //  유틸: 두 좌표 사이 거리 (미터)
    // ──────────────────────────────────────────────
    function distM(lat1, lng1, lat2, lng2) {
        var R = 6371000;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ──────────────────────────────────────────────
    //  핵심: 직선 경로 위 전주 탐색
    //  반환: waypoints 배열 [{ lat, lng, snappedPole }]
    // ──────────────────────────────────────────────
    function findPolesAlongPath(startLat, startLng, endLat, endLng, cfg) {
        var allNodes = window.nodes || [];

        // 전주 타입 판별 (cable_map_data.js의 isPoleType과 동일)
        function isPole(n) {
            return n.type === 'pole' || n.type === 'pole_existing' ||
                   n.type === 'pole_new'  || n.type === 'pole_removed';
        }

        var poles = allNodes.filter(isPole);
        if (poles.length === 0) return [];

        // 직선 전체 길이
        var totalDist = distM(startLat, startLng, endLat, endLng);
        if (totalDist < 1) return []; // 너무 가까우면 스킵

        // 각도 방향 벡터 (lat/lng 단위)
        var dLat = endLat - startLat;
        var dLng = endLng - startLng;
        var len  = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
        var uLat = dLat / len;
        var uLng = dLng / len;

        // 위도 1도 ≈ 111320m 기준으로 미터 → 도 변환
        var mToDeg = 1 / 111320;
        var corridorDeg = cfg.corridorM * mToDeg;
        var minSegDeg   = cfg.minSegM   * mToDeg;

        var result = [];

        poles.forEach(function (pole) {
            // 전주 → 직선 위에 투영 (내적)
            var px = pole.lat - startLat;
            var py = pole.lng - startLng;
            var t  = px * uLat + py * uLng; // 투영 파라미터 (0=start, len=end)

            // 직선 밖(앞/뒤)은 제외
            if (t < minSegDeg || t > len - minSegDeg) return;

            // 수직 거리 (직선까지의 최단 거리)
            var perpLat = startLat + t * uLat - pole.lat;
            var perpLng = startLng + t * uLng - pole.lng;
            var perpDist = Math.sqrt(perpLat * perpLat + perpLng * perpLng);

            // 복도(corridor) 밖 전주 제외
            if (perpDist > corridorDeg) return;

            result.push({
                pole: pole,
                t:    t,          // 정렬용 투영값
                perpDist: perpDist
            });
        });

        // 투영값 기준 정렬 (start → end 방향)
        result.sort(function (a, b) { return a.t - b.t; });

        // 중복 전주 제거 (같은 전주 ID가 두 번 들어오는 경우)
        var seen = {};
        result = result.filter(function (r) {
            if (seen[r.pole.id]) return false;
            seen[r.pole.id] = true;
            return true;
        });

        // waypoints 형식으로 변환
        return result.map(function (r) {
            return {
                lat:         r.pole.lat,
                lng:         r.pole.lng,
                snappedPole: r.pole.id
            };
        });
    }

    // ──────────────────────────────────────────────
    //  단일 connection 자동 경로 적용
    // ──────────────────────────────────────────────
    function autoRouteConnection(connId) {
        var connections = window.connections || [];
        var nodes       = window.nodes       || [];

        var conn = connections.find(function (c) { return c.id === connId; });
        if (!conn) return { ok: false, msg: '연결을 찾을 수 없습니다.' };

        // 시작/끝 노드
        var fromId   = typeof connFrom === 'function' ? connFrom(conn) : conn.nodeA;
        var toId     = typeof connTo   === 'function' ? connTo(conn)   : conn.nodeB;
        var fromNode = nodes.find(function (n) { return n.id === fromId; });
        var toNode   = nodes.find(function (n) { return n.id === toId;   });

        if (!fromNode || !toNode) return { ok: false, msg: '노드를 찾을 수 없습니다.' };

        // 케이블 타입에 따른 설정 선택
        var cfg = conn.cableType === 'coax'
            ? autoRouteConfig.coax
            : autoRouteConfig.fiber;

        // 경유 전주 탐색
        var waypoints = findPolesAlongPath(
            fromNode.lat, fromNode.lng,
            toNode.lat,   toNode.lng,
            cfg
        );

        // 기존 waypoints가 있으면 snappedPole 없는 수동 경유점은 유지
        // (사용자가 직접 추가한 꺾임점 보존)
        var manualWPs = (conn.waypoints || []).filter(function (wp) {
            return !wp.snappedPole;
        });

        // 자동 탐색 결과 + 수동 경유점 병합 (순서: 자동 전주 → 수동은 순서대로 삽입)
        // 단순하게: 자동 결과를 우선, 수동 경유점은 뒤에 추가
        // 추후 필요시 더 정교한 병합 로직으로 교체 가능
        conn.waypoints = waypoints.concat(manualWPs);

        return {
            ok:    true,
            count: waypoints.length,
            msg:   '전주 ' + waypoints.length + '기 자동 경유 완료'
        };
    }

    // ──────────────────────────────────────────────
    //  전체 connection 일괄 자동 경로
    // ──────────────────────────────────────────────
    function autoRouteAll(cableTypeFilter) {
        var connections = window.connections || [];
        var total = 0, done = 0, skipped = 0;

        connections.forEach(function (conn) {
            // 필터: 'fiber' | 'coax' | undefined(전체)
            if (cableTypeFilter === 'fiber' && conn.cableType === 'coax') return;
            if (cableTypeFilter === 'coax'  && conn.cableType !== 'coax') return;

            total++;
            var result = autoRouteConnection(conn.id);
            if (result.ok && result.count > 0) done++;
            else skipped++;
        });

        // 저장 + 렌더링
        if (typeof saveData === 'function') saveData();
        if (typeof renderAllConnections === 'function') renderAllConnections();

        return { total: total, done: done, skipped: skipped };
    }

    // ──────────────────────────────────────────────
    //  선택된 케이블 단일 자동 경로 (케이블 정보 패널에서 호출)
    // ──────────────────────────────────────────────
    function autoRouteSingle(connId) {
        var result = autoRouteConnection(connId);
        if (!result.ok) {
            if (typeof showStatus === 'function') showStatus('작도 실패: ' + result.msg);
            return;
        }
        if (typeof saveData === 'function') saveData();
        if (typeof renderAllConnections === 'function') renderAllConnections();
        if (typeof showStatus === 'function') {
            showStatus(result.count > 0
                ? '✅ ' + result.msg
                : '⚠️ 경유 전주를 찾지 못했습니다 (복도 범위 조정 필요)');
        }
    }

    // ──────────────────────────────────────────────
    //  현재 활성 ONU 셀의 동축 케이블 전체 작도
    // ──────────────────────────────────────────────
    function autoRouteActiveOnuCell() {
        var onuNode = window._coaxActiveOnu;
        if (!onuNode) {
            if (typeof showStatus === 'function') showStatus('⚠️ 활성 ONU가 없습니다');
            return;
        }

        var connections = window.connections || [];
        var nodes       = window.nodes       || [];

        // 이 ONU 셀에 속한 노드 ID 목록
        var cellNodeIds = [onuNode.id];
        nodes.forEach(function (n) {
            if (n.parentOnu === onuNode.id) cellNodeIds.push(n.id);
        });

        // 이 셀에 연결된 동축 케이블만 필터
        var coaxConns = connections.filter(function (c) {
            if (c.cableType !== 'coax') return false;
            var fromId = typeof connFrom === 'function' ? connFrom(c) : c.nodeA;
            var toId   = typeof connTo   === 'function' ? connTo(c)   : c.nodeB;
            return cellNodeIds.indexOf(fromId) !== -1 || cellNodeIds.indexOf(toId) !== -1;
        });

        if (coaxConns.length === 0) {
            if (typeof showStatus === 'function') showStatus('⚠️ 이 ONU 셀에 동축 케이블이 없습니다');
            return;
        }

        var done = 0;
        coaxConns.forEach(function (conn) {
            var result = autoRouteConnection(conn.id);
            if (result.ok && result.count > 0) done++;
        });

        if (typeof saveData === 'function') saveData();
        if (typeof renderAllConnections === 'function') renderAllConnections();
        if (typeof showStatus === 'function') {
            showStatus('✅ ' + onuNode.name + ' 셀 작도 완료 (' + done + '/' + coaxConns.length + '개 케이블)');
        }
    }

    // ──────────────────────────────────────────────
    //  showCoaxEquipMenu 후킹 → 메뉴 하단에 작도 항목 추가
    //  (cable_map_coax.js의 showCoaxEquipMenu를 래핑)
    // ──────────────────────────────────────────────
    function hookCoaxEquipMenu() {
        var _origMenu = window.showCoaxEquipMenu;
        if (typeof _origMenu !== 'function') return; // coax.js 아직 안 로드됨

        window.showCoaxEquipMenu = function (screenX, screenY, lat, lng) {
            // 원본 메뉴 먼저 표시
            _origMenu(screenX, screenY, lat, lng);

            // 메뉴 DOM이 생성된 직후 작도 항목 추가
            setTimeout(function () {
                var menu = document.getElementById('coaxEquipMenu');
                if (!menu) return;

                // 구분선
                var sep = document.createElement('div');
                sep.style.cssText = 'height:1px; background:#eee; margin:4px 0;';
                menu.appendChild(sep);

                // 작도 항목
                var item = document.createElement('div');
                item.style.cssText = 'padding:7px 12px 7px 16px; cursor:pointer; display:flex; align-items:center; gap:8px;';
                item.onmouseenter = function () { item.style.background = '#f0f7ff'; };
                item.onmouseleave = function () { item.style.background = 'white'; };

                // 아이콘
                var icon = document.createElement('span');
                icon.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; width:22px; height:20px; font-size:15px;';
                icon.textContent = '🔄';
                item.appendChild(icon);

                // 텍스트
                var txt = document.createElement('span');
                txt.textContent = '이 셀 작도';
                txt.style.cssText = 'color:#1a6fd4; font-weight:700; font-size:12px;';
                item.appendChild(txt);

                item.onclick = function () {
                    if (typeof closeCoaxEquipMenu === 'function') closeCoaxEquipMenu();
                    autoRouteActiveOnuCell();
                };
                menu.appendChild(item);

                // 화면 밖 넘침 재보정
                var rect = menu.getBoundingClientRect();
                if (rect.bottom > window.innerHeight) {
                    menu.style.top = (parseInt(menu.style.top) - (rect.bottom - window.innerHeight) - 8) + 'px';
                }
            }, 0);
        };
    }

    // ──────────────────────────────────────────────
    //  UI 버튼 주입 — 메뉴 모달 안에 추가
    //  (cable_map_ui.js가 로드된 후 실행)
    // ──────────────────────────────────────────────
    function injectAutoRouteUI() {
        // ── 동축 우클릭 메뉴 후킹 ──
        // cable_map_coax.js 로드 타이밍이 다를 수 있으므로 재시도
        var _hookTry = 0;
        function _tryHookCoax() {
            if (typeof window.showCoaxEquipMenu === 'function') {
                hookCoaxEquipMenu();
            } else if (_hookTry++ < 20) {
                setTimeout(_tryHookCoax, 300); // 최대 6초 재시도
            }
        }
        _tryHookCoax();

        // 케이블 정보 패널에 버튼 주입 (showCableInfoPanel 후킹)
        var _origShowCableInfo = window.showCableInfoPanel;
        if (typeof _origShowCableInfo === 'function') {
            window.showCableInfoPanel = function (connId, fromNode, toNode, connection, e) {
                _origShowCableInfo(connId, fromNode, toNode, connection, e);

                // 패널 DOM이 생성된 직후 버튼 추가
                setTimeout(function () {
                    var panel = document.getElementById('cableInfoPanel');
                    if (!panel) return;
                    if (panel.querySelector('.autoroute-btn')) return; // 중복 방지

                    var btn = document.createElement('button');
                    btn.className = 'autoroute-btn';
                    btn.textContent = '🔄 작도 재계산';
                    btn.style.cssText = [
                        'width:100%',
                        'margin-top:8px',
                        'padding:9px 0',
                        'background:#1a6fd4',
                        'color:white',
                        'border:none',
                        'border-radius:8px',
                        'font-size:13px',
                        'font-weight:bold',
                        'cursor:pointer'
                    ].join(';');
                    btn.addEventListener('click', function () {
                        autoRouteSingle(connId);
                    });
                    panel.appendChild(btn);
                }, 50);
            };
        }

        // 메뉴 모달에 "전체 작도" 버튼 추가
        var menuModal = document.getElementById('menuModal');
        if (menuModal) {
            var allBtn = document.createElement('button');
            allBtn.id = 'autoRouteAllBtn';
            allBtn.textContent = '🗺️ 전체 작도';
            allBtn.title = '모든 케이블의 경유 전주를 자동으로 탐색합니다';
            allBtn.style.cssText = [
                'display:block',
                'width:calc(100% - 32px)',
                'margin:8px 16px 0',
                'padding:10px 0',
                'background:#2e7d32',
                'color:white',
                'border:none',
                'border-radius:8px',
                'font-size:13px',
                'font-weight:bold',
                'cursor:pointer'
            ].join(';');
            allBtn.addEventListener('click', function () {
                var result = autoRouteAll('fiber'); // 지금은 광케이블만
                alert(
                    '작도 완료\n' +
                    '처리: ' + result.total + '개\n' +
                    '성공: ' + result.done  + '개\n' +
                    '스킵: ' + result.skipped + '개'
                );
            });
            menuModal.appendChild(allBtn);
        }
    }

    // ──────────────────────────────────────────────
    //  초기화 — DOM 준비 후 UI 주입
    // ──────────────────────────────────────────────
    function init() {
        // cable_map_ui.js 완전 로드 후 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectAutoRouteUI);
        } else {
            // 이미 로드됨 — 약간 지연 후 실행 (다른 스크립트 초기화 완료 대기)
            setTimeout(injectAutoRouteUI, 500);
        }
    }

    // ──────────────────────────────────────────────
    //  전역 노출 (외부에서 직접 호출 가능)
    // ──────────────────────────────────────────────
    window.autoRoute = {
        single:    autoRouteSingle,     // autoRoute.single(connId)
        all:       autoRouteAll,        // autoRoute.all('fiber' | 'coax' | undefined)
        config:    autoRouteConfig,     // autoRoute.config.fiber.corridorM = 30
        _findPoles: findPolesAlongPath  // 테스트용 직접 접근
    };

    init();

})();

/*
 * ──────────────────────────────────────────────────
 *  나중에 동축 추가할 때 이 부분만 수정/추가:
 *
 *  1. autoRouteConfig.coax 값 튜닝
 *
 *  2. autoRouteAll() 호출 시 'coax' 인자 전달:
 *     autoRoute.all('coax')
 *
 *  3. 동축 장비(TBA, TDA, EA 등) 특수 처리 필요 시
 *     findPolesAlongPath() 아래에 후처리 훅 추가:
 *
 *     window.autoRoute.postProcess = function(conn, waypoints) {
 *         // 동축 장비 위치 기준 경로 보정
 *         return waypoints;
 *     };
 *
 *  4. 공가 집계 연동:
 *     autoRoute.all() 후 autoRoute.countPerPole() 호출
 *     → 전주별 통과 케이블 조수 집계 → 공가 신청서 자동 생성
 * ──────────────────────────────────────────────────
 */
