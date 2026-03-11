        async function initMap() {
            // ── Canvas 전주 레이어 변수 ──
            var _poleCanvas = null;
            var _poleCtx = null;
            var _poleCanvasReady = false;

            function initPoleCanvas() {
                var mapEl = document.getElementById('map');
                _poleCanvas = document.createElement('canvas');
                _poleCanvas.id = 'poleCanvas';
                _poleCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;';
                mapEl.appendChild(_poleCanvas);
                _poleCtx = _poleCanvas.getContext('2d');
                _poleCanvasReady = true;
                resizePoleCanvas();
            }
            function resizePoleCanvas() {
                if (!_poleCanvas) return;
                var mapEl = document.getElementById('map');
                _poleCanvas.width  = mapEl.offsetWidth;
                _poleCanvas.height = mapEl.offsetHeight;
            }
            initPoleCanvas();
            window.addEventListener('resize', resizePoleCanvas);
            window._poleCanvas = _poleCanvas;
            window._poleCtx    = _poleCtx;
            window._poleCanvasReady = true;

            // 전주 라벨 스타일 주입 (하위호환용 CSS — Canvas에서 직접 그리지만 유지)
            (function() {
                var s = document.createElement('style');
                s.textContent = [
                    '.pole-marker { position: relative; }',
                    '.pole-label {',
                    '    position: absolute; top: -6px;',
                    '    white-space: nowrap; font-size: 12px;',
                    "    font-family: 'Malgun Gothic', sans-serif; font-weight: bold;",
                    '    color: #1a1a1a; background: rgba(255,255,255,0.92);',
                    '    padding: 2px 5px; border-radius: 3px; border: 1px solid #aaa;',
                    '    line-height: 1.4; pointer-events: none; display: none;',
                    '}',
                    '.pole-label-visible { display: block !important; }'
                ].join('\n');
                document.head.appendChild(s);
            })();
            try {
                // 카카오맵 로드 확인
                if (typeof kakao === "undefined" || !kakao.maps) {
                    console.error('카카오맵이 로드되지 않았습니다.');
                    return;
                }
                
                // 마지막 위치 복원 (없으면 강원도 원주 기본값)
                const _sv = localStorage.getItem('mapView');
                const _mv = _sv ? JSON.parse(_sv) : {lat:37.3422, lng:127.9202, zoom:13};
                map = L.map('map').setView([_mv.lat, _mv.lng], _mv.zoom);

                // ── 커서 관리자 ─────────────────────────────────────
                // 카카오맵은 내부 div에 cursor:grab 을 인라인으로 세팅하므로
                // 직접 mapEl.style.cursor 변경만으로는 자식 레이어에 안 먹힘.
                // → CSS !important + 100ms 보정으로 카카오 내부 cursor 억제.
                // 드래그 중(mousedown+mousemove)에만 grabbing 표시.
                (function() {
                    var _style = document.createElement('style');
                    _style.id = 'map-cursor-override';
                    document.head.appendChild(_style);

                    var _dragging   = false;
                    var _curMode    = 'default'; // 현재 모드: 'default' | 'crosshair'
                    var _mapEl      = document.getElementById('map');

                    function _apply(cur) {
                        // ① CSS rule — #map 하위 전체 override
                        _style.textContent =
                            '#map { cursor: ' + cur + ' !important; }\n' +
                            '#map > div, #map > div > div { cursor: ' + cur + ' !important; }\n' +
                            '#map canvas { cursor: ' + cur + ' !important; }';
                        // ② 카카오맵 최상위 내부 노드 inline 직접 override (상속 실패 대비)
                        if (map && map._m) {
                            var node = map._m.getNode();
                            if (node) {
                                node.style.setProperty('cursor', cur, 'important');
                                var c1 = node.firstElementChild;
                                if (c1) {
                                    c1.style.setProperty('cursor', cur, 'important');
                                    var c2 = c1.firstElementChild;
                                    if (c2) c2.style.setProperty('cursor', cur, 'important');
                                }
                            }
                        }
                    }

                    _apply('default');

                    _mapEl.addEventListener('mousedown', function(e) {
                        if (e.button === 0) _dragging = false;
                    });
                    _mapEl.addEventListener('mousemove', function(e) {
                        if (e.buttons === 1 && !_dragging) {
                            _dragging = true;
                            _apply('grabbing');
                        }
                    });
                    document.addEventListener('mouseup', function() {
                        if (_dragging) {
                            _dragging = false;
                            _apply(_curMode);
                        }
                    });

                    // 카카오맵이 내부적으로 cursor를 재설정할 수 있으므로 100ms 보정
                    setInterval(function() {
                        if (!_dragging) _apply(_curMode);
                    }, 100);

                    // 외부(ui.js 등)에서 crosshair / default 전환 시 이 함수로 통일
                    window._mapCursorMode = _curMode;
                    window._setMapCursorMode = function(mode) {
                        _curMode = mode;
                        window._mapCursorMode = mode;
                        if (!_dragging) _apply(mode);
                    };
                })();
                // ── 커서 관리자 끝 ────────────────────────────────────

                // 카카오맵 자체 타일 사용
                
                // 1단계: 전주 제외하고 빠르게 로드 (localStorage만)
                await loadData({ polesLater: true });

                // 뷰포트 전주 로딩 — 시퀀스 번호로 오래된 쿼리 결과 폐기
                var _refreshSeq = 0;
                var _refreshTimer = null;
                function scheduleRefreshPoles() {
                    if (_refreshTimer) clearTimeout(_refreshTimer);
                    _refreshTimer = setTimeout(function() {
                        _refreshTimer = null;
                        refreshPoles();
                    }, 80);
                }
                function refreshPoles() {
                    if (!map || !map._m) return;
                    const z = map.getZoom();
                    if (z < 14) { drawPoleCanvas(); return; }
                    const b = map._m.getBounds();
                    const sw = b.getSouthWest(), ne = b.getNorthEast();
                    const dLat = (ne.getLat() - sw.getLat()) * 0.2;
                    const dLng = (ne.getLng() - sw.getLng()) * 0.2;
                    const mySeq = ++_refreshSeq;
                    loadPolesInBounds({
                        minLat: sw.getLat() - dLat, maxLat: ne.getLat() + dLat,
                        minLng: sw.getLng() - dLng, maxLng: ne.getLng() + dLng
                    }).then(function(result) {
                        if (mySeq !== _refreshSeq) return; // 더 최신 쿼리가 있으면 폐기
                        nodes = nodes.filter(function(n) { return !isPoleType(n.type); });
                        nodes = nodes.concat(result);
                        drawPoleCanvas();
                    });
                }

                // 드래그 중 캔버스 실시간 재그리기 (rAF throttle)
                var _rafPending = false;
                function _rafDraw() {
                    if (_rafPending) return;
                    _rafPending = true;
                    requestAnimationFrame(function() {
                        _rafPending = false;
                        drawPoleCanvas();
                    });
                }
                map.on('move', _rafDraw);

                // 줌 애니메이션 동안 canvas 재그리기 (300ms 동안 타이머 분산)
                map.on('zoomend', function() {
                    [50, 100, 150, 200, 250, 300].forEach(function(t) {
                        setTimeout(drawPoleCanvas, t);
                    });
                    scheduleRefreshPoles();
                });

                // moveend: 위치 저장 + pole 재로드 (디바운스)
                map.on('moveend', function() {
                    if (!map || !map._m) return;
                    const c = map._m.getCenter();
                    if (!c) return;
                    const z = map.getZoom();
                    localStorage.setItem('mapView', JSON.stringify({lat:c.getLat(), lng:c.getLng(), zoom:z}));
                    map.closePopup();
                    scheduleRefreshPoles();
                });

                // 함체/연결 즉시 표시
                renderAllNodes();
                renderAllConnections();
                initPoleCanvasEvents();

                // 2단계: 자동 전주 로드 (GitHub Pages — 버전 변경 시 재다운로드)
                const _autoLoaded = await autoLoadPolesIfNeeded(function(phase, cur, tot) {
                    if (phase === 'fetch') {
                        document.getElementById('importProgressTitle').textContent = '전주 데이터 다운로드 중...';
                        document.getElementById('importProgressFill').style.width = '0%';
                        document.getElementById('importProgressLabel').textContent = '잠시 기다려 주세요...';
                        document.getElementById('importProgressOverlay').classList.add('active');
                    } else if (phase === 'import') {
                        var pct = Math.round(cur / tot * 100);
                        document.getElementById('importProgressTitle').textContent = '전주 데이터 로드 중...';
                        document.getElementById('importProgressFill').style.width = pct + '%';
                        document.getElementById('importProgressLabel').textContent =
                            cur.toLocaleString() + ' / ' + tot.toLocaleString() + '  (' + pct + '%)';
                    } else if (phase === 'done') {
                        document.getElementById('importProgressOverlay').classList.remove('active');
                    }
                });

                // 3단계: 뷰포트 전주 로드
                showStatus('전주 로딩 중...');
                refreshPoles();
                showStatus('');
                
                // Ctrl+Z 되돌리기
                document.addEventListener('keydown', function(e) {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                        e.preventDefault();
                        // 케이블 그리기 중이면 마지막 경유점 취소
                        if (connectingMode && typeof undoLastWaypoint === 'function') {
                            undoLastWaypoint();
                            return;
                        }
                        performUndo();
                        return;
                    }
                });

                // ESC / SPACE 키 이벤트
                document.addEventListener('keydown', function(e) {
                    // SPACE: 케이블 그리기 일시정지
                    if (e.key === ' ' && connectingMode) {
                        e.preventDefault();
                        if (typeof pauseConnecting === 'function') pauseConnecting();
                        return;
                    }
                    if (e.key === 'Escape' || e.keyCode === 27) {
                        // 1) 확인 다이얼로그
                        var confirmDlg = document.getElementById('confirmDialog');
                        if (confirmDlg && confirmDlg.style.display !== 'none') {
                            var noBtn = document.getElementById('confirmNoBtn');
                            if (noBtn) noBtn.click();
                            return;
                        }
                        // 2) RN 팝업
                        var rnPopup = document.getElementById('rnPopup');
                        if (rnPopup) { rnPopup.remove(); return; }
                        // 3) 모달 (최상위부터 닫기)
                        var modals = [
                            { id: 'coreChangeModal', fn: typeof closeCoreChangeModal === 'function' ? closeCoreChangeModal : null },
                            { id: 'ofdDetailModal',  fn: typeof closeOFDDetailModal === 'function' ? closeOFDDetailModal : null },
                            { id: 'ofdModal',        fn: typeof closeOFDModal === 'function' ? closeOFDModal : null },
                            { id: 'rnModal',         fn: typeof closeRNModal === 'function' ? closeRNModal : null },
                            { id: 'wireMapModal',    fn: typeof closeWireMap === 'function' ? closeWireMap : null },
                            { id: 'connectionModal', fn: typeof closeConnectionModal === 'function' ? closeConnectionModal : null },
                            { id: 'nodeInfoModal',   fn: typeof closeNodeInfoModal === 'function' ? closeNodeInfoModal : null },
                            { id: 'menuModal',       fn: typeof closeMenuModal === 'function' ? closeMenuModal : null }
                        ];
                        for (var mi = 0; mi < modals.length; mi++) {
                            var el = document.getElementById(modals[mi].id);
                            if (el && el.classList.contains('active')) {
                                if (modals[mi].fn) modals[mi].fn();
                                else el.classList.remove('active');
                                return;
                            }
                        }
                        // 4) 지도 팝업 (케이블 클릭 InfoWindow 등)
                        if (map) { map.closePopup(); }
                        // 5) 모드 취소
                        if (connectingMode) { cancelConnecting(); return; }
                        if (addingMode) { cancelAdding(); return; }
                        if (movingNodeMode) {
                            movingNodeMode = false;
                            movingNode = null;
                            hideStatus();
                            renderAllNodes();
                            renderAllConnections();
                            return;
                        }
                    }
                });
                
                // 지도 클릭 이벤트
                map.on('click', function(e) {
                    if (!e || !e.latlng || e.latlng.lat == null) return; // 카카오 내부 이벤트 null 방어
                    if (typeof hideAllWaypointMarkers === 'function') hideAllWaypointMarkers();
                    if (addingMode && addingType === 'junction') {
                        // 원이 표시 중이면 원 안/밖 판단
                        if (_junctionCircle && _junctionPole) {
                            var dist = latlngDist(e.latlng.lat, e.latlng.lng, _junctionPole.lat, _junctionPole.lng);
                            if (dist <= 20) {
                                // 원 안 → 사용자가 클릭한 위치에 함체 생성
                                var poleName = _junctionPole.name || '';
                                var poleLat  = e.latlng.lat;
                                var poleLng  = e.latlng.lng;
                                clearJunctionRadius();
                                cancelAdding();
                                document.getElementById('junctionConfirmPopup').style.display = 'none';
                                var junctionNode = {
                                    id: Date.now().toString(),
                                    type: 'junction',
                                    lat: poleLat, lng: poleLng,
                                    name: poleName, fiberType: '', memo: '',
                                    ofds: [], ports: [], rns: [],
                                    inOrder: [], connDirections: {}
                                };
                                nodes.push(junctionNode);
                                saveData();
                                renderNode(junctionNode);
                                selectedNode = junctionNode;
                                showNodeInfoModalForEdit();
                            } else {
                                // 원 밖 → 다른 전주 선택 유도
                                showStatus('원 안에서 클릭하거나 다른 전주를 선택하세요  (ESC: 취소)');
                            }
                        } else {
                            // 원 없이 빈 곳 클릭 → 확인 팝업
                            var popup = document.getElementById('junctionConfirmPopup');
                            var container = map.getContainer();
                            var rect = container.getBoundingClientRect();
                            var pt = map.latLngToLayerPoint(e.latlng);
                            var px = pt.x + 10, py = pt.y + 10;
                            if (px + 220 > rect.width)  px = pt.x - 220;
                            if (py + 100 > rect.height) py = pt.y - 100;
                            popup.style.left = Math.max(4, px) + 'px';
                            popup.style.top  = Math.max(4, py) + 'px';
                            popup.style.display = 'block';
                            document.getElementById('junctionConfirmYes').onclick = function() {
                                popup.style.display = 'none';
                                cancelAdding();
                                var node = {
                                    id: Date.now().toString(),
                                    type: 'junction',
                                    lat: e.latlng.lat, lng: e.latlng.lng,
                                    name: '', fiberType: '', memo: '',
                                    ofds: [], ports: [], rns: [],
                                    inOrder: [], connDirections: {}
                                };
                                nodes.push(node);
                                saveData();
                                renderNode(node);
                            };
                        }
                        return;
                    }
                    if (addingMode) {
                        addNode(e.latlng.lat, e.latlng.lng, addingType);
                        cancelAdding();
                    } else if (!connectingMode) {
                        map.closePopup();
                    }
                });

                // 지도 우클릭 → 빠른 추가 컨텍스트 메뉴
                kakao.maps.event.addListener(map._m, 'rightclick', function(e) {
                    const lat = e.latLng.getLat();
                    const lng = e.latLng.getLng();

                    // 기존 컨텍스트 메뉴 제거
                    const existing = document.getElementById('mapContextMenu');
                    if (existing) existing.remove();

                    // 지도 컨테이너 기준 픽셀 좌표
                    const pt = map.latLngToLayerPoint({ lat, lng });

                    const menu = document.createElement('div');
                    menu.id = 'mapContextMenu';
                    menu.style.cssText = `
                        position: absolute;
                        left: ${pt.x}px;
                        top: ${pt.y}px;
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
                        z-index: 99999;
                        min-width: 150px;
                        overflow: hidden;
                        font-family: 'Segoe UI', sans-serif;
                    `;

                    const svgIcons = {
                        junction: `<svg width="20" height="20" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#e8f0fe" stroke="#1a6fd4" stroke-width="2.5"/><polygon points="20,20 7,11 7,29" fill="#1a6fd4"/><polygon points="20,20 33,11 33,29" fill="#1a6fd4"/><circle cx="20" cy="20" r="2.5" fill="white" stroke="#1a6fd4" stroke-width="1.5"/></svg>`,
                        onu: `<svg width="24" height="18" viewBox="0 0 48 36"><rect x="2" y="4" width="44" height="28" rx="3" fill="#d0d8e4" stroke="#5577aa" stroke-width="2"/><line x1="10" y1="7" x2="10" y2="29" stroke="#8899bb" stroke-width="1"/><line x1="16" y1="7" x2="16" y2="29" stroke="#8899bb" stroke-width="1"/><line x1="22" y1="7" x2="22" y2="29" stroke="#8899bb" stroke-width="1"/><line x1="28" y1="7" x2="28" y2="29" stroke="#8899bb" stroke-width="1"/><line x1="34" y1="7" x2="34" y2="29" stroke="#8899bb" stroke-width="1"/><line x1="40" y1="7" x2="40" y2="29" stroke="#8899bb" stroke-width="1"/><rect x="16" y="0" width="5" height="5" rx="1" fill="#5577aa"/><rect x="27" y="0" width="5" height="5" rx="1" fill="#5577aa"/><circle cx="42" cy="12" r="2" fill="#00dd66"/><circle cx="42" cy="24" r="2" fill="#ffaa00"/></svg>`,
                        subscriber: `<svg width="20" height="20" viewBox="0 0 40 40"><rect x="4" y="4" width="32" height="22" rx="3" fill="#e8f0fe" stroke="#1a6fd4" stroke-width="2"/><line x1="10" y1="12" x2="30" y2="12" stroke="#1a6fd4" stroke-width="1.5" opacity="0.6"/><line x1="10" y1="16" x2="24" y2="16" stroke="#1a6fd4" stroke-width="1.5" opacity="0.4"/><line x1="10" y1="20" x2="27" y2="20" stroke="#1a6fd4" stroke-width="1.5" opacity="0.3"/><rect x="18" y="26" width="4" height="4" fill="#1a6fd4"/><rect x="13" y="30" width="14" height="3" rx="1" fill="#1a6fd4"/></svg>`,
                        cctv: `<svg width="24" height="16" viewBox="0 0 56 36"><polygon points="41,18 56,6 56,30" fill="#1a6fd4" opacity="0.1"/><line x1="41" y1="18" x2="56" y2="6" stroke="#1a6fd4" stroke-width="1" opacity="0.5" stroke-dasharray="2,2"/><line x1="41" y1="18" x2="56" y2="30" stroke="#1a6fd4" stroke-width="1" opacity="0.5" stroke-dasharray="2,2"/><rect x="2" y="4" width="5" height="28" rx="2" fill="#5577aa"/><rect x="5" y="14" width="10" height="8" rx="1" fill="#5577aa"/><rect x="13" y="9" width="28" height="18" rx="5" fill="white" stroke="#1a6fd4" stroke-width="2"/><circle cx="38" cy="18" r="6.5" fill="#e8f0fe" stroke="#1a6fd4" stroke-width="1.5"/><circle cx="38" cy="18" r="3" fill="#1a6fd4" opacity="0.3"/><circle cx="38" cy="18" r="1.5" fill="#1a6fd4"/><circle cx="16" cy="12" r="2" fill="#ff3333"/></svg>`,
                        pole_existing: `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#1a6fd4" stroke="white" stroke-width="2"/></svg>`,
                        pole_new:      `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#e53935" stroke="white" stroke-width="2"/></svg>`,
                        pole_removed:  `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#333333" stroke="white" stroke-width="2"/></svg>`
                    };
                    const items = [
                        { label: '함체 추가',   type: 'junction'      },
                        { label: 'ONU 추가',    type: 'onu'           },
                        { label: '가입자 추가', type: 'subscriber'    },
                        { label: 'CCTV 추가',   type: 'cctv'          },
                        { label: '기설전주',    type: 'pole_existing' },
                        { label: '신설전주',    type: 'pole_new'      },
                        { label: '철거전주',    type: 'pole_removed'  },
                    ];

                    items.forEach(item => {
                        const btn = document.createElement('div');
                        btn.style.cssText = `
                            padding: 11px 16px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: bold;
                            color: #333;
                            border-bottom: 1px solid #f0f0f0;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                        `;
                        btn.innerHTML = (svgIcons[item.type] || '') + `<span>${item.label}</span>`;
                        btn.onmouseover = () => btn.style.background = '#f5f5f5';
                        btn.onmouseout  = () => btn.style.background = '';
                        btn.onclick = () => {
                            menu.remove();
                            if (item.type === 'junction') {
                                startAddingNode('junction');
                            } else {
                                addNode(lat, lng, item.type);
                            }
                        };
                        menu.appendChild(btn);
                    });

                    // 지도 컨테이너에 붙이기
                    map.getContainer().style.position = 'relative';
                    map.getContainer().appendChild(menu);

                    // 바깥 클릭 시 닫기
                    setTimeout(() => {
                        document.addEventListener('click', function closeMenu() {
                            menu.remove();
                            document.removeEventListener('click', closeMenu);
                        }, { once: true });
                    }, 0);
                });
            } catch (error) {
                console.error('지도 초기화 오류:', error);
                alert('지도를 불러오는데 실패했습니다. 페이지를 새로고침해주세요.');
            }
        }
        
        // 노드 추가 시작
        function startAddingNode(type) {
            // 케이블 연결 중이면 먼저 취소
            if (connectingMode) {
                cancelConnecting();
            }
            addingMode = true;
            addingType = type;
            document.getElementById('cancelBtn').style.display = 'flex';
            if (type === 'junction') {
                showStatus('전주를 선택해 주세요');
            } else {
                showStatus('지도에서 위치를 클릭하세요');
            }
        }
        
        // 노드 추가 취소
        function cancelAdding() {
            addingMode = false;
            addingType = '';
            document.getElementById('cancelBtn').style.display = 'none';
            document.getElementById('junctionConfirmPopup').style.display = 'none';
            clearJunctionRadius();
            hideStatus();
        }
        
        // 케이블 연결 취소
        function cancelConnecting() {
            clearPendingWaypoints();
            connectingMode = false;
            connectingFromNode = null;
            connectingToNode = null;
            hideStatus();
        }
        
        // 노드 추가
        function addNode(lat, lng, type) {
            const node = {
                id: Date.now().toString(),
                type: type,
                lat: lat,
                lng: lng,
                name: '',
                fiberType: '',
                memo: '',
                ofds: [],
                ports: [],
                rns: [],
                inOrder: [],
                connDirections: {}
            };
            
            nodes.push(node);
            saveData();
            renderNode(node);
            
            // 바로 정보 입력 모달 띄우기
            selectedNode = node;
            if (isPoleType(node.type)) {
                showPoleModal(node);
            } else {
                showNodeInfoModalForEdit();
            }
        }
        
        // 마커 HTML 생성
        function getMarkerHTML(type, name, memo, nodeId) {
            // ── 국사: 서버랙 표준형 ──
            if (type === 'datacenter') {
                return `
                    <div class="custom-marker">
                        <svg width="40" height="40" viewBox="0 0 40 40" style="filter:drop-shadow(0 2px 8px rgba(0,0,0,0.3));">
                            <rect x="3" y="3" width="34" height="34" rx="3" fill="white" stroke="#1a6fd4" stroke-width="2.5"/>
                            <rect x="7" y="8"  width="26" height="4" rx="1" fill="#1a6fd4" opacity="0.8"/>
                            <rect x="7" y="14" width="26" height="4" rx="1" fill="#1a6fd4" opacity="0.6"/>
                            <rect x="7" y="20" width="26" height="4" rx="1" fill="#1a6fd4" opacity="0.4"/>
                            <rect x="7" y="26" width="26" height="4" rx="1" fill="#1a6fd4" opacity="0.2"/>
                            <circle cx="30" cy="10" r="1.5" fill="#00cc66"/>
                            <circle cx="30" cy="16" r="1.5" fill="#ff9900"/>
                            <circle cx="30" cy="22" r="1.5" fill="#00cc66"/>
                            <circle cx="30" cy="28" r="1.5" fill="#00cc66"/>
                        </svg>
                        ${name ? `<div class="marker-label">${name}</div>` : ''}
                    </div>
                `;
            }
            // ── 함체: 나비넥타이 개선판 ──
            if (type === 'junction') {
                const node = nodes.find(n => n.id === nodeId);
                const isNew = node && node.isNew;
                const fillColor   = isNew ? '#ffe8e8' : '#e8f0fe';
                const strokeColor = isNew ? '#e53935' : '#1a6fd4';
                return `
                    <div class="custom-marker">
                        <svg width="32" height="32" viewBox="0 0 40 40" style="filter:drop-shadow(0 2px 8px rgba(0,0,0,0.3));">
                            <circle cx="20" cy="20" r="18" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.5"/>
                            <polygon points="20,20 7,11 7,29" fill="${strokeColor}"/>
                            <polygon points="20,20 33,11 33,29" fill="${strokeColor}"/>
                            <circle cx="20" cy="20" r="2.5" fill="white" stroke="${strokeColor}" stroke-width="1.5"/>
                        </svg>
                        ${name ? `<div class="marker-label">${name}</div>` : ''}
                    </div>
                `;
            }
            // ── ONU: 전봇대 박스형 ──
            if (type === 'onu') {
                return `
                    <div class="custom-marker">
                        <svg width="44" height="33" viewBox="0 0 48 36" style="filter:drop-shadow(0 2px 8px rgba(0,0,0,0.3));">
                            <rect x="2" y="4" width="44" height="28" rx="3" fill="#d0d8e4" stroke="#5577aa" stroke-width="2"/>
                            <line x1="10" y1="7" x2="10" y2="29" stroke="#8899bb" stroke-width="1"/>
                            <line x1="16" y1="7" x2="16" y2="29" stroke="#8899bb" stroke-width="1"/>
                            <line x1="22" y1="7" x2="22" y2="29" stroke="#8899bb" stroke-width="1"/>
                            <line x1="28" y1="7" x2="28" y2="29" stroke="#8899bb" stroke-width="1"/>
                            <line x1="34" y1="7" x2="34" y2="29" stroke="#8899bb" stroke-width="1"/>
                            <line x1="40" y1="7" x2="40" y2="29" stroke="#8899bb" stroke-width="1"/>
                            <rect x="16" y="0" width="5" height="5" rx="1" fill="#5577aa"/>
                            <rect x="27" y="0" width="5" height="5" rx="1" fill="#5577aa"/>
                            <rect x="8"  y="27" width="4" height="5" rx="1" fill="#5577aa"/>
                            <rect x="15" y="27" width="4" height="5" rx="1" fill="#5577aa"/>
                            <rect x="22" y="27" width="4" height="5" rx="1" fill="#5577aa"/>
                            <rect x="29" y="27" width="4" height="5" rx="1" fill="#5577aa"/>
                            <rect x="36" y="27" width="4" height="5" rx="1" fill="#5577aa"/>
                            <circle cx="42" cy="10" r="2" fill="#00dd66"/>
                            <circle cx="42" cy="18" r="2" fill="#00dd66"/>
                            <circle cx="42" cy="26" r="2" fill="#ffaa00"/>
                        </svg>
                        ${name ? `<div class="marker-label">${name}</div>` : ''}
                    </div>
                `;
            }
            // ── 가입자: 미니멀 PC ──
            if (type === 'subscriber') {
                return `
                    <div class="custom-marker">
                        <svg width="40" height="40" viewBox="0 0 40 40" style="filter:drop-shadow(0 2px 8px rgba(0,0,0,0.3));">
                            <rect x="4" y="4" width="32" height="22" rx="3" fill="#e8f0fe" stroke="#1a6fd4" stroke-width="2"/>
                            <rect x="7" y="7" width="26" height="16" rx="1" fill="#1a6fd4" opacity="0.15"/>
                            <line x1="10" y1="12" x2="30" y2="12" stroke="#1a6fd4" stroke-width="1.5" opacity="0.6"/>
                            <line x1="10" y1="16" x2="24" y2="16" stroke="#1a6fd4" stroke-width="1.5" opacity="0.4"/>
                            <line x1="10" y1="20" x2="27" y2="20" stroke="#1a6fd4" stroke-width="1.5" opacity="0.3"/>
                            <rect x="18" y="26" width="4" height="4" fill="#1a6fd4"/>
                            <rect x="13" y="30" width="14" height="3" rx="1" fill="#1a6fd4"/>
                            <circle cx="34" cy="24" r="2" fill="#00dd66"/>
                        </svg>
                        ${name ? `<div class="marker-label">${name}</div>` : ''}
                    </div>
                `;
            }
            // ── CCTV: 총알형 흰색+시야각 ──
            if (type === 'cctv') {
                return `
                    <div class="custom-marker">
                        <svg width="46" height="32" viewBox="0 0 56 36" style="filter:drop-shadow(0 2px 8px rgba(0,0,0,0.3));">
                            <polygon points="41,18 56,6 56,30" fill="#1a6fd4" opacity="0.1"/>
                            <line x1="41" y1="18" x2="56" y2="6"  stroke="#1a6fd4" stroke-width="1" opacity="0.5" stroke-dasharray="2,2"/>
                            <line x1="41" y1="18" x2="56" y2="30" stroke="#1a6fd4" stroke-width="1" opacity="0.5" stroke-dasharray="2,2"/>
                            <rect x="2" y="4" width="5" height="28" rx="2" fill="#5577aa"/>
                            <rect x="5" y="14" width="10" height="8" rx="1" fill="#5577aa"/>
                            <rect x="13" y="9" width="28" height="18" rx="5" fill="white" stroke="#1a6fd4" stroke-width="2"/>
                            <circle cx="38" cy="18" r="6.5" fill="#e8f0fe" stroke="#1a6fd4" stroke-width="1.5"/>
                            <circle cx="38" cy="18" r="3.5" fill="#1a6fd4" opacity="0.3"/>
                            <circle cx="38" cy="18" r="1.5" fill="#1a6fd4"/>
                            <circle cx="36" cy="16" r="1" fill="white" opacity="0.8"/>
                            <circle cx="16" cy="12" r="2" fill="#ff3333"/>
                        </svg>
                        ${name ? `<div class="marker-label">${name}</div>` : ''}
                    </div>
                `;
            }
            // ── 전주: 원형 점 (기설=파랑, 신설=빨강, 철거=검정, 자가주=보라) ──
            if (type === 'pole' || type === 'pole_existing' || type === 'pole_new' || type === 'pole_removed') {
                const poleNum = memo ? memo.replace('전산화번호: ', '').replace('자가주:true', '').trim() : '';
                const poleLabel = (poleNum && name) ? poleNum + '/' + name : (name || '');
                // 자가주 여부 확인 (memo에 '자가주' 포함 또는 별도 필드)
                const isSelf = memo && memo.includes('자가주:true');
                let fillColor;
                if (isSelf) {
                    fillColor = '#9b59b6'; // 보라
                } else if (type === 'pole_new') {
                    fillColor = '#e53935'; // 빨강
                } else if (type === 'pole_removed') {
                    fillColor = '#333333'; // 검정
                } else {
                    fillColor = '#1a6fd4'; // 파랑 (기설/기본)
                }
                return `
                    <div class="custom-marker pole-marker">
                        <svg width="14" height="14" viewBox="0 0 14 14" style="overflow:visible;display:block;">
                            <circle cx="7" cy="7" r="6" fill="${fillColor}" stroke="white" stroke-width="2"/>
                        </svg>
                        ${poleLabel ? `<div class="pole-label" data-pole-id="${nodeId||''}">${poleLabel}</div>` : ''}
                    </div>
                `;
            }
            // 기본 (알 수 없는 타입)
            return `<div class="custom-marker"><div class="marker-icon" style="background:#999;">?</div>${name ? `<div class="marker-label">${name}</div>` : ''}</div>`;
        }

        // 노드 렌더링
        function renderNode(node) {
            // 전주는 Canvas 레이어로 처리 — DOM 마커 생성 안 함
            if (isPoleType(node.type)) {
                // nodes 배열에 이미 있으므로 데이터 등록만
                // 실제 그리기는 drawPoleCanvas()에서 일괄 처리
                drawPoleCanvas();
                return;
            }

            const markerHTML = getMarkerHTML(node.type, node.name, node.memo || '', node.id);

            var anchorX = 12, anchorY = 18;
            
            const icon = L.divIcon({
                html: markerHTML,
                className: 'custom-div-icon',
                iconSize: [24, 36],
                iconAnchor: [anchorX, anchorY]
            });
            
            const marker = L.marker([node.lat, node.lng], {
                icon: icon,
                zIndexOffset: 0
            }).addTo(map);
            
            marker.on('click', function() {
                window._nodeJustClicked = true;
                clearTimeout(window._nodeClickTimer);
                window._nodeClickTimer = setTimeout(function() {
                    window._nodeJustClicked = false;
                }, 600);
                onNodeClick(node);
            });
            
            markers[node.id] = marker;
        }
        
        // 모든 노드 렌더링
        function renderAllNodes() {
            nodes.forEach(node => {
                renderNode(node);
            });
            drawPoleCanvas();
        }

        // ── Canvas 전주 렌더러 ──────────────────────────────────────
        function drawPoleCanvas() {
            if (!window._poleCanvasReady || !map || !map._m) return;
            // canvas 크기 맞추기
            var mapEl = document.getElementById('map');
            var cv = window._poleCanvas;
            if (cv.width !== mapEl.offsetWidth)  cv.width  = mapEl.offsetWidth;
            if (cv.height !== mapEl.offsetHeight) cv.height = mapEl.offsetHeight;
            var ctx = window._poleCtx;
            var w = cv.width, h = cv.height;
            ctx.clearRect(0, 0, w, h);

            var zoom = map.getZoom();
            if (zoom < 14) return; // 카카오 레벨 5 이상(zoom<14)은 전주 숨김

            var showLabel = zoom >= 15; // 레벨 3까지 라벨 표시

            // 라벨 표시 기준: 케이블이 지나가거나 장비가 있는 전주만
            var labelPoleIds = null;
            if (showLabel) {
                labelPoleIds = new Set();
                // 케이블(connection)에 연결된 전주 (endpoints + 경유 전주)
                connections.forEach(function(c) {
                    if (c.nodeA) labelPoleIds.add(c.nodeA);
                    if (c.nodeB) labelPoleIds.add(c.nodeB);
                    if (c.waypoints) {
                        c.waypoints.forEach(function(wp) {
                            if (wp.snappedPole) labelPoleIds.add(wp.snappedPole);
                        });
                    }
                });
                // 케이블 연결된 장비 근처 전주 (20m 이내) — 함체가 전주 위에 설치된 경우
                var connectedEquipIds = new Set();
                connections.forEach(function(c) {
                    if (c.nodeA) connectedEquipIds.add(c.nodeA);
                    if (c.nodeB) connectedEquipIds.add(c.nodeB);
                });
                var equips = nodes.filter(function(n) {
                    return !isPoleType(n.type) && connectedEquipIds.has(n.id);
                });
                if (equips.length > 0) {
                    nodes.forEach(function(pole) {
                        if (!isPoleType(pole.type)) return;
                        var hasEquip = equips.some(function(eq) {
                            var dlat = (eq.lat - pole.lat) * 111000;
                            var dlng = (eq.lng - pole.lng) * 111000 * Math.cos(pole.lat * Math.PI / 180);
                            return dlat * dlat + dlng * dlng < 100; // 10m 이내
                        });
                        if (hasEquip) labelPoleIds.add(pole.id);
                    });
                }
            }
            // 함체 배치 모드에서 선택된 전주 라벨 표시
            if (_junctionPole && labelPoleIds) labelPoleIds.add(_junctionPole.id);
            // 전주 선택 모드에서 선택된 전주 라벨 강제 표시
            if (_poleSelectedNodes && _poleSelectedNodes.length && labelPoleIds) {
                _poleSelectedNodes.forEach(function(n) { labelPoleIds.add(n.id); });
            }
            // 임시 그리기(철거/조가선)에서 스냅된 전주 라벨 표시
            if (window._tempDrawPoleIds && window._tempDrawPoleIds.size && labelPoleIds) {
                window._tempDrawPoleIds.forEach(function(id) { labelPoleIds.add(id); });
            }

            // 케이블 연결 전주 필터용 ID 세트
            var _cablePoleIds = null;
            if (_poleFilterActive) {
                _cablePoleIds = new Set();
                connections.forEach(function(c) {
                    if (c.nodeA) _cablePoleIds.add(c.nodeA);
                    if (c.nodeB) _cablePoleIds.add(c.nodeB);
                    if (c.waypoints) c.waypoints.forEach(function(wp) { if (wp.snappedPole) _cablePoleIds.add(wp.snappedPole); });
                });
                // 케이블 연결 장비 근처 전주도 포함
                var cEquipIds = new Set();
                connections.forEach(function(c) { if (c.nodeA) cEquipIds.add(c.nodeA); if (c.nodeB) cEquipIds.add(c.nodeB); });
                var cEquips = nodes.filter(function(n) { return !isPoleType(n.type) && cEquipIds.has(n.id); });
                if (cEquips.length > 0) {
                    nodes.forEach(function(pole) {
                        if (!isPoleType(pole.type)) return;
                        var near = cEquips.some(function(eq) {
                            var dlat = (eq.lat - pole.lat) * 111000;
                            var dlng = (eq.lng - pole.lng) * 111000 * Math.cos(pole.lat * Math.PI / 180);
                            return dlat * dlat + dlng * dlng < 100;
                        });
                        if (near) _cablePoleIds.add(pole.id);
                    });
                }
            }

            var _offLat = window._polePreviewOffset ? window._polePreviewOffset.dLat : 0;
            var _offLng = window._polePreviewOffset ? window._polePreviewOffset.dLng : 0;

            ctx.save();
            nodes.forEach(function(node) {
                if (!isPoleType(node.type)) return;
                // 케이블 연결 전주 필터 적용
                if (_cablePoleIds && !_cablePoleIds.has(node.id)) return;
                var pt = map.latLngToLayerPoint({ lat: node.lat + _offLat, lng: node.lng + _offLng });
                var x = pt.x, y = pt.y;
                // 화면 밖 컬링 (여유 50px)
                if (x < -50 || y < -50 || x > w + 50 || y > h + 50) return;

                // 색상 결정
                var isSelf = node.memo && node.memo.includes('자가주:true');
                var color = isSelf ? '#9b59b6'
                    : node.type === 'pole_new'     ? '#e53935'
                    : node.type === 'pole_removed'  ? '#333333'
                    : '#1a6fd4';

                // 선택된 전주 하이라이트
                var isSelected = _poleSelectedNodes && _poleSelectedNodes.some(function(n){ return n.id === node.id; });
                var isSearchHit = window._poleSearchHighlight && window._poleSearchHighlight === node.id;
                var isMoving = _poleMoveMode && isSelected;

                // 원 그리기 (절반 크기)
                var radius = isSearchHit ? 14 : 4;
                ctx.globalAlpha = isMoving ? 0.5 : 1.0;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = isSearchHit ? '#f39c12' : (isMoving ? '#2980b9' : color);
                ctx.fill();
                ctx.strokeStyle = isSearchHit ? '#e67e22' : (isSelected ? '#9b59b6' : 'white');
                ctx.lineWidth   = isSearchHit ? 2 : (isSelected ? 2 : 1.5);
                ctx.stroke();
                ctx.globalAlpha = 1.0;

                // 라벨 그리기 (zoom >= 15, 케이블/장비 연결된 전주만 — 검색 결과는 항상)
                if (isSearchHit || (showLabel && labelPoleIds)) {
                    if (!isSearchHit && !labelPoleIds.has(node.id)) return;

                    var poleNum = node.memo ? node.memo.replace('전산화번호: ','').replace(/자가주:true/g,'').trim() : '';
                    var label   = (poleNum && node.name) ? poleNum + '/' + node.name : (node.name || '');
                    if (!label) return;

                    var angle  = node.labelAngle  != null ? node.labelAngle  : 0;
                    var offset = node.labelOffset != null ? node.labelOffset : 0;

                    ctx.save();
                    ctx.translate(x + 7, y);
                    ctx.rotate(angle * Math.PI / 180);
                    ctx.translate(offset, 0);

                    ctx.font = 'bold 11px "Malgun Gothic", sans-serif';
                    ctx.textBaseline = 'middle';
                    var tw = ctx.measureText(label).width;
                    var th = 14;
                    // 배경 박스 (스카이뷰: 흰색 배경, 지도뷰: 투명)
                    if (window._isSkyView) {
                        ctx.fillStyle = 'rgba(255,255,255,0.92)';
                        ctx.strokeStyle = '#aaaaaa';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.roundRect(0, -th/2 - 2, tw + 10, th + 4, 3);
                        ctx.fill();
                        ctx.stroke();
                    }
                    // 텍스트
                    ctx.fillStyle = isSelected ? '#9b59b6' : (window._isSkyView ? '#1a1a1a' : '#333');
                    ctx.fillText(label, 5, 0);
                    ctx.restore();
                }
            });
            ctx.restore();
        }
        window.drawPoleCanvas = drawPoleCanvas;
        window.renderAllNodes = renderAllNodes;

        // Canvas 클릭 감지 초기화 (initMap 이후 호출)
        function initPoleCanvasEvents() {
            var mapEl = document.getElementById('map');
            mapEl.addEventListener('click', function(e) {
                if (!map || !map._m) return;
                // 장비 마커 클릭이면 전주 무시 (장비 > 케이블 > 전주)
                if (window._nodeJustClicked) return;
                var target = e.target;
                while (target && target !== mapEl) {
                    if (target.classList && (target.classList.contains('custom-marker') || target.classList.contains('custom-div-icon'))) return;
                    target = target.parentElement;
                }
                var rect = mapEl.getBoundingClientRect();
                var mx = e.clientX - rect.left;
                var my = e.clientY - rect.top;
                var zoom = map.getZoom();
                if (zoom < 13) return;
                // 근처에 장비 마커가 있으면 전주 무시 (클릭 우선순위: 장비 > 전주)
                var equipHit = false;
                nodes.forEach(function(node) {
                    if (isPoleType(node.type)) return;
                    var pt = map.latLngToLayerPoint({ lat: node.lat, lng: node.lng });
                    var d = Math.sqrt(Math.pow(pt.x - mx, 2) + Math.pow(pt.y - my, 2));
                    if (d < 20) equipHit = true;
                });
                if (equipHit) return;
                var hit = null, bestDist = 12; // 클릭 반경 12px
                nodes.forEach(function(node) {
                    if (!isPoleType(node.type)) return;
                    var pt = map.latLngToLayerPoint({ lat: node.lat, lng: node.lng });
                    var d = Math.sqrt(Math.pow(pt.x - mx, 2) + Math.pow(pt.y - my, 2));
                    if (d < bestDist) { bestDist = d; hit = node; }
                });
                if (hit) {
                    // 임시 그리기/케이블 연결 모드에서는 전주 팝업 차단 (스냅은 별도 처리)
                    if (window._tempDrawMode || window.connectingMode) return;
                    window._nodeJustClicked = true;
                    clearTimeout(window._nodeClickTimer);
                    window._nodeClickTimer = setTimeout(function(){ window._nodeJustClicked = false; }, 600);
                    onNodeClick(hit);
                    e.stopPropagation();
                }
            }, true); // capture phase — 지도 클릭보다 먼저

            // 커서 변경 + 호버 툴팁
            var _tooltip = document.getElementById('poleHoverTooltip');
            var _tooltipTimer = null;
            var _lastHoverId = null;

            mapEl.addEventListener('mousemove', function(e) {
                if (!map || !map._m) return;
                var rect = mapEl.getBoundingClientRect();
                var mx = e.clientX - rect.left;
                var my = e.clientY - rect.top;
                var zoom = map.getZoom();
                if (zoom < 14) {
                    window._poleCanvas.style.cursor = '';
                    if (_tooltip) _tooltip.style.display = 'none';
                    _lastHoverId = null;
                    return;
                }

                var hit = null, bestDist = 12;
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    if (!isPoleType(node.type)) continue;
                    var pt = map.latLngToLayerPoint({ lat: node.lat, lng: node.lng });
                    var d = Math.sqrt(Math.pow(pt.x - mx, 2) + Math.pow(pt.y - my, 2));
                    if (d < bestDist) { bestDist = d; hit = node; }
                }

                // 임시 그리기/케이블 연결 모드에서는 캔버스 클릭 차단 (카카오맵으로 전달)
                var blockCanvas = window._tempDrawMode || window.connectingMode;
                window._poleCanvas.style.pointerEvents = (!blockCanvas && hit) ? 'auto' : 'none';
                window._poleCanvas.style.cursor = hit ? 'pointer' : '';

                if (!_tooltip) return;
                if (hit) {
                    // 이미 표시 중인 같은 전주면 위치만 업데이트
                    if (_lastHoverId !== hit.id) {
                        _lastHoverId = hit.id;
                        var poleNum = (hit.memo || '').replace('전산화번호: ', '').replace(/자가주:true/g, '').trim();
                        var label = (poleNum && hit.name) ? poleNum + '/' + hit.name : (hit.name || poleNum || '');
                        if (label) {
                            _tooltip.textContent = label;
                            _tooltip.style.display = 'block';
                        } else {
                            _tooltip.style.display = 'none';
                        }
                    }
                    // 커서 오른쪽 아래에 고정
                    _tooltip.style.left = (e.clientX + 14) + 'px';
                    _tooltip.style.top  = (e.clientY + 14) + 'px';
                } else {
                    _lastHoverId = null;
                    _tooltip.style.display = 'none';
                }
            });

            mapEl.addEventListener('mouseleave', function() {
                if (_tooltip) _tooltip.style.display = 'none';
                _lastHoverId = null;
            });
        }

        function updatePoleLabels() { drawPoleCanvas(); } // 하위 호환
        function updatePoleVisibility() { drawPoleCanvas(); } // 하위 호환
        window.updatePoleVisibility = updatePoleVisibility;

        // 노드 클릭
        function isPoleType(t) {
            return t==='pole'||t==='pole_existing'||t==='pole_new'||t==='pole_removed';
        }

        // 함체 위치 선택용 원 오버레이
        var _junctionCircle = null;
        var _junctionPole   = null;

        function showJunctionRadius(poleNode) {
            _junctionPole = poleNode;
            if (_junctionCircle) _junctionCircle.setMap(null);
            _junctionCircle = new kakao.maps.Circle({
                center: new kakao.maps.LatLng(poleNode.lat, poleNode.lng),
                radius: 20,
                strokeWeight: 2,
                strokeColor: '#1a6fd4',
                strokeOpacity: 0.9,
                strokeStyle: 'dashed',
                fillColor: '#1a6fd4',
                fillOpacity: 0.08
            });
            _junctionCircle.setMap(map._m);
            drawPoleCanvas();
            showStatus('원 안에서 함체 위치를 클릭하세요  (ESC: 취소)');
        }

        function clearJunctionRadius() {
            if (_junctionCircle) { _junctionCircle.setMap(null); _junctionCircle = null; }
            _junctionPole = null;
            drawPoleCanvas();
        }

        // 두 좌표 간 거리(m)
        function latlngDist(lat1, lng1, lat2, lng2) {
            var R = 6371000;
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLng = (lng2 - lng1) * Math.PI / 180;
            var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
                    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
                    Math.sin(dLng/2)*Math.sin(dLng/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        }

        function onNodeClick(node) {
            // 지도 click 이벤트와 중복 방지
            window._nodeJustClicked = true;
            clearTimeout(window._nodeClickTimer);
            window._nodeClickTimer = setTimeout(function(){ window._nodeJustClicked = false; }, 600);

            // junction 추가 모드
            if (addingMode && addingType === 'junction') {
                if (isPoleType(node.type)) {
                    document.getElementById('junctionConfirmPopup').style.display = 'none';
                    showJunctionRadius(node);
                } else {
                    showStatus('전주를 선택해 주세요');
                }
                return;
            }

            if (connectingMode) {
                if (isPoleType(node.type)) {
                    // 전주 직접 클릭 → 경유점으로 추가 (장비로 쓰지 않음)
                    addPoleAsWaypoint(node);
                    return;
                }
                if (connectingFromNode.id !== node.id) {
                    // 직접 노드 클릭 시 확인 팝업 먼저 표시
                    var _nodeTarget = node;
                    var typeLabel = node.type === 'junction'   ? '[함체]'
                        : node.type === 'datacenter' ? '[국사]'
                        : node.type === 'onu'        ? '[ONU]'
                        : node.type === 'subscriber' ? '[가입자]'
                        : node.type === 'cctv'       ? '[CCTV]'
                        : '';
                    showConfirm(
                        typeLabel + " '" + (node.name || '이름없음') + "'에 연결하시겠습니까?",
                        function() {
                            connectingToNode = _nodeTarget;
                            if (pendingWaypoints.length > 0) {
                                const last = pendingWaypoints[pendingWaypoints.length - 1];
                                const dlat = Math.abs(last.lat - _nodeTarget.lat);
                                const dlng = Math.abs(last.lng - _nodeTarget.lng);
                                if (dlat < 0.0005 && dlng < 0.0005) pendingWaypoints.pop();
                            }
                            clearPreviewOnly();
                            showConnectionModal();
                        },
                        node.name || '',
                        '연결'
                    );
                } else {
                    showStatus('같은 장비는 연결할 수 없습니다');
                }
            } else {
                selectedNode = node;
                if (isPoleType(node.type)) {
                    showPoleModal(node);
                } else {
                    showMenuModal();
                }
            }
        }
        
        function showPoleModal(node) {
            const colors = { pole:'#1a6fd4', pole_existing:'#1a6fd4', pole_new:'#e53935', pole_removed:'#333333' };
            // 현재 타입 (구버전 'pole' → pole_existing 취급)
            const curType = (node.type === 'pole') ? 'pole_existing' : node.type;
            const isSelf = (node.memo||'').includes('자가주:true');
            const poleNum = (node.memo||'').replace('자가주:true','').replace('전산화번호: ','').trim();
            const labelAngle  = node.labelAngle  != null ? node.labelAngle  : 0;
            const labelOffset = node.labelOffset != null ? node.labelOffset : 20;

            document.getElementById('menuModalTitle').innerHTML =
                `전주 정보 <button onclick="startSinglePoleMoveMode('${node.id}')" title="전주 이동"
                    style="margin-left:8px;padding:3px 10px;background:#2980b9;color:white;border:none;border-radius:5px;font-size:12px;cursor:pointer;font-weight:normal;vertical-align:middle;">이동</button>`;

            // 전주 모달은 폼 형태 → grid 해제
            const menuButtons = document.getElementById('menuButtons');
            if (!menuButtons) { console.error('menuButtons 요소 없음'); return; }
            menuButtons.style.display = 'block';

            menuButtons.innerHTML = `
                <div style="padding:4px 0 12px;">

                    <!-- 전주 종류 버튼 -->
                    <div style="margin-bottom:14px;">
                        <label style="font-size:12px;color:#888;display:block;margin-bottom:6px;">전주 종류</label>
                        <div style="display:flex;gap:6px;" id="poleTypeButtons">
                            ${['pole_existing','pole_new','pole_removed'].map(t => {
                                const active = t === curType;
                                const c = colors[t];
                                const lbl = {pole_existing:'기설',pole_new:'신설',pole_removed:'철거'}[t];
                                return `<button id="poleTypeBtn_${t}" onclick="selectPoleType('${node.id}','${t}')"
                                    style="flex:1;padding:8px 4px;border-radius:8px;border:2px solid ${active?c:'#ddd'};background:${active?c+'22':'#fff'};font-size:13px;cursor:pointer;font-weight:${active?'bold':'normal'};transition:all 0.15s;">
                                    <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:4px;vertical-align:middle;"></span>${lbl}</button>`;
                            }).join('')}
                        </div>
                    </div>

                    <!-- 엑셀 붙여넣기 -->
                    <div style="margin-bottom:12px;">
                        <label style="font-size:12px;color:#888;display:block;margin-bottom:3px;">📋 엑셀 데이터 붙여넣기</label>
                        <textarea id="polePasteArea" rows="1" placeholder="엑셀에서 전산화번호/선로명/선로번호 복사 → 여기에 붙여넣기"
                            style="width:100%;padding:7px 10px;border:1px dashed #aaa;border-radius:6px;font-size:12px;box-sizing:border-box;resize:none;color:#666;transition:all 0.2s;background:#fafafa;"
                            onfocus="this.rows=3;this.style.borderColor='#1a6fd4';this.style.background='#fff';"
                            onblur="if(!this.value){this.rows=1;this.style.borderColor='#aaa';this.style.background='#fafafa';}"></textarea>
                    </div>

                    <!-- 전산화번호 -->
                    <div style="margin-bottom:10px;">
                        <label style="font-size:12px;color:#888;display:block;margin-bottom:3px;">전산화번호</label>
                        <input id="poleNumInput" type="text" value="${escapeHtml(poleNum)}"
                            placeholder="예: 8516W792"
                            maxlength="8"
                            style="width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
                    </div>

                    <!-- 전주번호 -->
                    <div style="margin-bottom:12px;">
                        <label style="font-size:12px;color:#888;display:block;margin-bottom:3px;">전주번호</label>
                        <input id="poleNameInput" type="text" value="${escapeHtml(node.name||'')}"
                            placeholder="예: 나전간-335"
                            style="width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
                    </div>

                    <!-- 자가주 체크박스 -->
                    <div style="margin-bottom:16px;padding:10px 12px;background:#f8f0ff;border-radius:8px;border:1px solid #d9b8f5;display:flex;align-items:center;gap:10px;">
                        <input type="checkbox" id="poleSelfCheck" ${isSelf?'checked':''}
                            style="width:18px;height:18px;cursor:pointer;accent-color:#9b59b6;">
                        <label for="poleSelfCheck" style="font-size:14px;font-weight:bold;color:#7d3c98;cursor:pointer;flex:1;">
                            자가주
                            <span style="font-size:11px;color:#9b59b6;font-weight:normal;margin-left:6px;">체크 시 보라색으로 표시</span>
                        </label>
                        <svg width="14" height="14" viewBox="0 0 14 14">
                            <circle cx="7" cy="7" r="6" fill="#9b59b6" stroke="white" stroke-width="2"/>
                        </svg>
                    </div>

                    <!-- 라벨 각도 -->
                    <div style="margin-bottom:12px;">
                        <label style="font-size:12px;color:#888;display:flex;justify-content:space-between;margin-bottom:6px;">
                            <span>라벨 각도</span>
                            <span id="poleAngleVal" style="font-weight:bold;color:#333;">${labelAngle}°</span>
                        </label>
                        <input type="range" id="poleLabelAngle" min="-180" max="180" step="1" value="${labelAngle}"
                            style="width:100%;accent-color:#1a6fd4;"
                            oninput="document.getElementById('poleAngleVal').textContent=this.value+'°'; previewPoleLabel('${node.id}',this.value,document.getElementById('poleLabelOffset').value);">
                        <div style="display:flex;justify-content:space-between;margin-top:4px;gap:6px;">
                            ${[-90,-45,0,45,90].map(v=>`<button onclick="document.getElementById('poleLabelAngle').value=${v};document.getElementById('poleAngleVal').textContent='${v}°';previewPoleLabel('${node.id}',${v},document.getElementById('poleLabelOffset').value);"
                                style="flex:1;padding:4px 2px;font-size:11px;border:1px solid #ddd;border-radius:5px;cursor:pointer;background:#f8f8f8;">${v}°</button>`).join('')}
                        </div>
                    </div>

                    <!-- 라벨 좌우 위치 -->
                    <div style="margin-bottom:16px;">
                        <label style="font-size:12px;color:#888;display:flex;justify-content:space-between;margin-bottom:6px;">
                            <span>좌우 위치</span>
                            <span id="poleOffsetVal" style="font-weight:bold;color:#333;">${labelOffset}px</span>
                        </label>
                        <input type="range" id="poleLabelOffset" min="-500" max="500" step="1" value="${labelOffset}"
                            style="width:100%;accent-color:#1a6fd4;"
                            oninput="document.getElementById('poleOffsetVal').textContent=this.value+'px'; previewPoleLabel('${node.id}',document.getElementById('poleLabelAngle').value,this.value);">
                    </div>

                    <!-- 저장/삭제 버튼 -->
                    <div style="display:flex;gap:8px;">
                        <button onclick="resetPoleLabel('${node.id}')" style="flex:1;padding:10px;background:#f0f0f0;color:#555;border:1px solid #ddd;border-radius:8px;font-size:13px;cursor:pointer;">초기화</button>
                        <button onclick="savePoleInfo('${node.id}')" style="flex:2;padding:10px;background:#1a6fd4;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">저장</button>
                        <button onclick="deletePole('${node.id}')" style="flex:1;padding:10px;background:#f44336;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;">삭제</button>
                    </div>
                </div>`;

            // 현재 선택된 타입 상태 저장 (저장 시 사용)
            window._currentPoleType = curType;

            document.getElementById('menuModal').classList.add('active');

            // 붙여넣기 파싱 이벤트
            var pasteArea = document.getElementById('polePasteArea');
            if (pasteArea) {
                pasteArea.addEventListener('paste', function(e) {
                    e.preventDefault();
                    var text = (e.clipboardData || window.clipboardData).getData('text') || '';
                    _parsePoleClipboard(text);
                    this.value = '';
                    this.rows = 1;
                    this.style.borderColor = '#aaa';
                    this.style.background = '#fafafa';
                });
            }
            // 전산화번호 자동 포맷 (대문자, 공백제거)
            var numInput = document.getElementById('poleNumInput');
            if (numInput) {
                numInput.addEventListener('blur', function() {
                    this.value = this.value.trim().replace(/\s+/g, '').toUpperCase();
                });
            }
            // 전주번호 자동 포맷 (한글+숫자 → 대시 삽입)
            var nameInput = document.getElementById('poleNameInput');
            if (nameInput) {
                nameInput.addEventListener('blur', function() {
                    var v = this.value.trim();
                    var m = v.match(/^([가-힣]+)\s*(\d+[A-Za-z0-9]*)$/);
                    if (m) this.value = m[1] + '-' + m[2];
                });
            }
        }

        // 전주 종류 선택 (모달 닫지 않고 버튼 스타일만 변경)
        function selectPoleType(nodeId, newType) {
            const colors = { pole_existing:'#1a6fd4', pole_new:'#e53935', pole_removed:'#333333' };
            window._currentPoleType = newType;
            ['pole_existing','pole_new','pole_removed'].forEach(t => {
                const btn = document.getElementById('poleTypeBtn_'+t);
                if (!btn) return;
                const active = t === newType;
                const c = colors[t];
                btn.style.border = `2px solid ${active ? c : '#ddd'}`;
                btn.style.background = active ? c+'22' : '#fff';
                btn.style.fontWeight = active ? 'bold' : 'normal';
            });
        }

        // 클립보드 데이터 파싱 → 전산화번호/전주번호 자동 채움
        function _parsePoleClipboard(text) {
            if (!text) return;
            var lines = text.trim().split(/\r?\n/);
            var 전산화 = '', 선로명 = '', 선로번호 = '';

            // 키-값 패턴 시도 (줄별 탭 구분)
            var kvMap = {};
            lines.forEach(function(line) {
                var parts = line.split('\t');
                if (parts.length >= 2) {
                    var key = parts[0].trim();
                    var val = parts[1].trim();
                    kvMap[key] = val;
                }
            });

            if (kvMap['전산화번호']) 전산화 = kvMap['전산화번호'];
            if (kvMap['선로명']) 선로명 = kvMap['선로명'];
            if (kvMap['선로번호']) 선로번호 = kvMap['선로번호'];

            // 키-값으로 못 찾으면 단일 행 탭 구분 시도
            if (!전산화 && !선로명) {
                var firstLine = lines[0] || '';
                var cols = firstLine.split('\t').map(function(s) { return s.trim(); });

                if (cols.length >= 4 && /^\d+$/.test(cols[1]) && /[가-힣]/.test(cols[2])) {
                    // 4열: 관리구 | 번호 | 선로명 | 선로번호  (예: 88143 \t 581 \t 신월간 \t 44)
                    전산화 = cols[0] + cols[1].padStart(3, '0');
                    선로명 = cols[2]; 선로번호 = cols[3];
                } else if (cols.length >= 3) {
                    // 3열: 전산화번호 | 선로명 | 선로번호  (예: 8614E381 \t 신월간 \t 213)
                    전산화 = cols[0]; 선로명 = cols[1]; 선로번호 = cols[2];
                }
            }

            if (!전산화 && !선로명) return;

            // 포맷팅
            전산화 = 전산화.replace(/\s+/g, '').toUpperCase();
            var poleName = '';
            if (선로명 && 선로번호) {
                poleName = 선로명 + '-' + 선로번호;
            } else if (선로명) {
                poleName = 선로명;
            }

            // 필드 채우기
            if (전산화) document.getElementById('poleNumInput').value = 전산화;
            if (poleName) document.getElementById('poleNameInput').value = poleName;

            // 성공 피드백 (깜빡임)
            var numEl = document.getElementById('poleNumInput');
            var nameEl = document.getElementById('poleNameInput');
            [numEl, nameEl].forEach(function(el) {
                if (!el) return;
                el.style.background = '#e8f5e9';
                setTimeout(function() { el.style.background = ''; }, 800);
            });
            showStatus('붙여넣기 완료: ' + (전산화 || '') + ' / ' + (poleName || ''));
        }

        function savePoleInfo(nodeId) {
            const node = nodes.find(n=>n.id===nodeId); if(!node) return;
            markPoleForUndo(node);
            const isSelf = document.getElementById('poleSelfCheck').checked;
            const poleNum = document.getElementById('poleNumInput').value.trim();
            node.memo = (poleNum ? '전산화번호: '+poleNum : '') + (isSelf ? '자가주:true' : '');
            node.name = document.getElementById('poleNameInput').value.trim();
            node.labelAngle  = parseInt(document.getElementById('poleLabelAngle').value)  || 0;
            node.labelOffset = parseInt(document.getElementById('poleLabelOffset').value) || 0;
            if (window._currentPoleType) node.type = window._currentPoleType;
            saveData(); closeMenuModal();
            drawPoleCanvas(); showStatus('저장 완료');
        }

        // 저장 전 라벨 미리보기
        function previewPoleLabel(nodeId, angle, offset) {
            var node = nodes.find(function(n) { return n.id === nodeId; });
            if (!node) return;
            // 임시로 node에 적용 후 캔버스 다시 그림 (저장은 하지 않음)
            var orig = { labelAngle: node.labelAngle, labelOffset: node.labelOffset };
            node.labelAngle  = parseFloat(angle)  || 0;
            node.labelOffset = parseFloat(offset) != null ? parseFloat(offset) : 20;
            drawPoleCanvas();
            node.labelAngle  = orig.labelAngle;
            node.labelOffset = orig.labelOffset;
        }

        function resetPoleLabel(nodeId) {
            document.getElementById('poleLabelAngle').value = 0;
            document.getElementById('poleAngleVal').textContent = '0°';
            document.getElementById('poleLabelOffset').value = 20;
            document.getElementById('poleOffsetVal').textContent = '20px';
            previewPoleLabel(nodeId, 0, 20);
        }

        // 전주 전체 삭제
        async function deleteAllPoles() {
            var poleCount = nodes.filter(function(n) { return isPoleType(n.type); }).length;
            if (poleCount === 0) { alert('삭제할 전주가 없습니다.'); return; }
            if (!confirm('전주 ' + poleCount.toLocaleString() + '개를 모두 삭제합니다.\n\n⚠️ 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) return;
            nodes = nodes.filter(function(n) { return !isPoleType(n.type); });
            // IndexedDB poles 스토어도 완전히 비움 (idbPutMany는 clear 없이 put만 하므로 별도 clear 필요)
            await clearPoleStore();
            await saveData();
            drawPoleCanvas();
            showStatus('전주 ' + poleCount.toLocaleString() + '개 삭제 완료');
        }
        window.deleteAllPoles = deleteAllPoles;

        function deletePole(nodeId) {
            if(!confirm('전주를 삭제할까요?')) return;
            const idx = nodes.findIndex(n=>n.id===nodeId);
            if(idx!==-1) { markPoleForUndo(nodes[idx]); nodes.splice(idx,1); }
            saveData(); drawPoleCanvas(); closeMenuModal(); showStatus('전주 삭제 완료');
        }

        // 메뉴 모달 표시
        function showMenuModal() {
            const menuButtons = document.getElementById('menuButtons');
            menuButtons.innerHTML = '';

            // 기설/신설 토글: junction일 때만 표시
            const toggle = document.getElementById('junctionTypeToggle');
            if (toggle) {
            if (selectedNode && selectedNode.type === 'junction') {
                toggle.style.display = 'flex';
                _updateJunctionTypeUI(selectedNode.isNew ? 'new' : 'existing');
            } else {
                toggle.style.display = 'none';
            }
            }

            function makeBtn(svgPath, label, onclick, danger=false) {
                const btn = document.createElement('button');
                btn.className = 'menu-btn' + (danger ? ' danger' : '');
                btn.innerHTML = svgPath + `<span>${label}</span>`;
                btn.onclick = onclick;
                return btn;
            }

            // OFD SVG
            const svgOFD = `<svg width="28" height="28" viewBox="0 0 40 40">
                <rect x="5" y="4" width="22" height="28" rx="2" fill="none" stroke="#9b59b6" stroke-width="2"/>
                <rect x="8" y="9" width="13" height="2.5" rx="1" fill="#9b59b6" opacity="0.7"/>
                <rect x="8" y="14" width="13" height="2.5" rx="1" fill="#9b59b6" opacity="0.5"/>
                <rect x="8" y="19" width="9" height="2.5" rx="1" fill="#9b59b6" opacity="0.4"/>
                <circle cx="30" cy="30" r="8" fill="#9b59b6" opacity="0.15" stroke="#9b59b6" stroke-width="1.5"/>
                <circle cx="30" cy="27" r="1.5" fill="#9b59b6"/>
                <circle cx="30" cy="30" r="1.5" fill="#9b59b6"/>
                <circle cx="30" cy="33" r="1.5" fill="#9b59b6"/>
            </svg>`;
            // 케이블 SVG
            const svgCable = `<svg width="28" height="28" viewBox="0 0 40 40">
                <circle cx="8" cy="20" r="4" fill="none" stroke="#3498db" stroke-width="2"/>
                <circle cx="32" cy="20" r="4" fill="none" stroke="#3498db" stroke-width="2"/>
                <path d="M12,20 Q20,8 28,20" fill="none" stroke="#3498db" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M12,20 Q20,32 28,20" fill="none" stroke="#3498db" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
            </svg>`;
            // 직선도 SVG
            const svgWire = `<svg width="28" height="28" viewBox="0 0 40 40">
                <rect x="4" y="6" width="13" height="28" rx="2" fill="none" stroke="#27ae60" stroke-width="2"/>
                <rect x="23" y="6" width="13" height="28" rx="2" fill="none" stroke="#27ae60" stroke-width="2"/>
                <line x1="17" y1="14" x2="23" y2="14" stroke="#27ae60" stroke-width="1.8"/>
                <line x1="17" y1="20" x2="23" y2="20" stroke="#27ae60" stroke-width="1.8"/>
                <line x1="17" y1="26" x2="23" y2="26" stroke="#27ae60" stroke-width="1.8"/>
                <circle cx="17" cy="14" r="1.5" fill="#27ae60"/>
                <circle cx="23" cy="14" r="1.5" fill="#27ae60"/>
                <circle cx="17" cy="20" r="1.5" fill="#27ae60"/>
                <circle cx="23" cy="20" r="1.5" fill="#27ae60"/>
                <circle cx="17" cy="26" r="1.5" fill="#27ae60"/>
                <circle cx="23" cy="26" r="1.5" fill="#27ae60"/>
            </svg>`;
            // 접속정보 SVG
            const svgInfo = `<svg width="28" height="28" viewBox="0 0 40 40">
                <rect x="7" y="4" width="26" height="32" rx="3" fill="none" stroke="#555" stroke-width="2"/>
                <line x1="13" y1="13" x2="27" y2="13" stroke="#555" stroke-width="2" stroke-linecap="round"/>
                <line x1="13" y1="19" x2="27" y2="19" stroke="#555" stroke-width="2" stroke-linecap="round"/>
                <line x1="13" y1="25" x2="21" y2="25" stroke="#555" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
            // 이동 SVG
            const svgMove = `<svg width="28" height="28" viewBox="0 0 40 40">
                <path d="M20,5 L20,35 M5,20 L35,20" stroke="#e67e22" stroke-width="2.2" stroke-linecap="round"/>
                <polyline points="15,10 20,5 25,10" fill="none" stroke="#e67e22" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="15,30 20,35 25,30" fill="none" stroke="#e67e22" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="10,15 5,20 10,25" fill="none" stroke="#e67e22" stroke-width="2" stroke-linejoin="round"/>
                <polyline points="30,15 35,20 30,25" fill="none" stroke="#e67e22" stroke-width="2" stroke-linejoin="round"/>
            </svg>`;
            // 삭제 SVG
            const svgDel = `<svg width="28" height="28" viewBox="0 0 40 40">
                <rect x="10" y="15" width="20" height="2.5" rx="1" fill="#e74c3c"/>
                <rect x="15" y="8" width="10" height="7" rx="2" fill="none" stroke="#e74c3c" stroke-width="2"/>
                <rect x="11" y="18" width="18" height="16" rx="2" fill="#e74c3c" opacity="0.15" stroke="#e74c3c" stroke-width="1.8"/>
                <line x1="16" y1="22" x2="16" y2="30" stroke="#e74c3c" stroke-width="1.8" stroke-linecap="round"/>
                <line x1="20" y1="22" x2="20" y2="30" stroke="#e74c3c" stroke-width="1.8" stroke-linecap="round"/>
                <line x1="24" y1="22" x2="24" y2="30" stroke="#e74c3c" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`;

            if (selectedNode && selectedNode.type === 'datacenter') {
                menuButtons.appendChild(makeBtn(svgInfo, '접속정보', showNodeInfo));
                menuButtons.appendChild(makeBtn(svgOFD, 'OFD 관리', showOFDModal));
                menuButtons.appendChild(makeBtn(svgCable, '케이블 연결', startConnecting));
                menuButtons.appendChild(makeBtn(svgMove, '장비 이동', startMovingNode));
                menuButtons.appendChild(makeBtn(svgDel, '장비 삭제', deleteNodeFromMenu, true));
            } else {
                menuButtons.appendChild(makeBtn(svgInfo, '접속정보', showNodeInfo));
                menuButtons.appendChild(makeBtn(svgCable, '케이블 연결', startConnecting));
                menuButtons.appendChild(makeBtn(svgWire, '직선도', () => { closeMenuModal(); showWireMapFromMenu(); }));
                menuButtons.appendChild(makeBtn(svgMove, '장비 이동', startMovingNode));
                menuButtons.appendChild(makeBtn(svgDel, '장비 삭제', deleteNodeFromMenu, true));
            }

            document.getElementById('menuModal').classList.add('active');
        }
        
        // 메뉴 모달 닫기
        function closeMenuModal() {
            document.getElementById('menuModal').classList.remove('active');
            const _jtt = document.getElementById('junctionTypeToggle');
            if (_jtt) _jtt.style.display = 'none';
            const title = document.getElementById('menuModalTitle');
            if (title) title.innerHTML = '선택하세요';
            const mb = document.getElementById('menuButtons');
            if (mb) mb.style.display = '';
        }

        function _updateJunctionTypeUI(type) {
            const btnE = document.getElementById('junctionTypeBtnExisting');
            const btnN = document.getElementById('junctionTypeBtnNew');
            if (!btnE || !btnN) return;
            if (type === 'new') {
                btnE.style.background = 'white';   btnE.style.color = '#1a6fd4';
                btnN.style.background = '#e53935'; btnN.style.color = 'white';
            } else {
                btnE.style.background = '#1a6fd4'; btnE.style.color = 'white';
                btnN.style.background = 'white';   btnN.style.color = '#e53935';
            }
        }

        function setJunctionType(type) {
            if (!selectedNode || selectedNode.type !== 'junction') return;
            selectedNode.isNew = (type === 'new');
            _updateJunctionTypeUI(type);
            saveData();
            // 마커 다시 렌더링
            if (markers[selectedNode.id]) markers[selectedNode.id].setMap(null);
            delete markers[selectedNode.id];
            renderNode(selectedNode);
        }
        
        // 접속정보 확인
        function showNodeInfo() {
            closeMenuModal();
            showNodeInfoModalForEdit();
        }
        
        // 노드 정보 모달 표시

        // 스카이뷰 토글
        let _isSkyView = false;
        window._isSkyView = false;
        function toggleSkyView() {
            _isSkyView = !_isSkyView;
            window._isSkyView = _isSkyView;
            map._m.setMapTypeId(
                _isSkyView ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP
            );
            const btn = document.getElementById('skyViewBtn');
            if (btn) {
                btn.classList.toggle('active', _isSkyView);
                btn.querySelector('.tb-label').textContent = _isSkyView ? '지도뷰' : '스카이뷰';
            }
            drawPoleCanvas();
        }
        window.toggleSkyView = toggleSkyView;

        // 케이블 연결 전주만 표시 필터
        var _poleFilterActive = false;
        function togglePoleFilter() {
            _poleFilterActive = !_poleFilterActive;
            var btn = document.getElementById('poleFilterBtn');
            if (btn) btn.classList.toggle('active', _poleFilterActive);
            drawPoleCanvas();
        }
        window.togglePoleFilter = togglePoleFilter;


        // ==================== 데이터 내보내기 / 불러오기 ====================

        function exportData() {
            const data = {
                version: DATA_VERSION,
                exportedAt: new Date().toISOString(),
                nodes: nodes,
                connections: connections
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'eum_data_' + new Date().toISOString().slice(0,10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showStatus('내보내기 완료');
        }

        function importData(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.nodes || !data.connections) {
                        alert('올바른 이음 데이터 파일이 아닙니다.');
                        return;
                    }
                    const count = data.nodes.length;
                    if (!confirm(count + '개 노드를 불러옵니다. 현재 데이터는 덮어씌워집니다. 계속할까요?')) {
                        event.target.value = '';
                        return;
                    }
                    // 기존 마커/폴리라인 제거
                    Object.values(markers).forEach(function(m) { m.setMap(null); });
                    Object.keys(markers).forEach(function(k) { delete markers[k]; });
                    polylines.forEach(function(p) { p.setMap(null); });
                    polylines.length = 0;
                    // 데이터 교체 후 렌더링
                    nodes = data.nodes;
                    connections = data.connections;
                    saveData();
                    renderAllNodes();
                    renderAllConnections();
                    updatePoleLabels();
                    showStatus('불러오기 완료: ' + count + '개 노드, ' + connections.length + '개 연결');
                } catch(err) {
                    alert('파일 읽기 오류: ' + err.message);
                }
                event.target.value = '';
            };
            reader.readAsText(file);
        }

        // ==================== 전주 임포트 (js_poll.json) ====================
        function showImportProgress(current, total) {
            const overlay = document.getElementById('importProgressOverlay');
            const fill    = document.getElementById('importProgressFill');
            const label   = document.getElementById('importProgressLabel');
            const pct = total > 0 ? Math.round(current / total * 100) : 0;
            overlay.classList.add('active');
            fill.style.width = pct + '%';
            label.textContent = current.toLocaleString() + ' / ' + total.toLocaleString() + '  (' + pct + '%)';
        }
        function hideImportProgress() {
            document.getElementById('importProgressOverlay').classList.remove('active');
        }

        function importPollData(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.nodes || !Array.isArray(data.nodes)) {
                        alert('올바른 전주 데이터 파일이 아닙니다.');
                        return;
                    }

                    // 이름있는 전주만 필터 (추출장비-N 제외)
                    const pollNodes = data.nodes.filter(function(n) {
                        return n.name && n.name.indexOf('추출장비') !== 0;
                    });

                    if (pollNodes.length === 0) {
                        alert('임포트할 전주 데이터가 없습니다.');
                        return;
                    }

                    // 현재 뷰포트에 로드된 전주 중복 방지 (임포트 내 자체 중복도 방지)
                    const existingMemos = new Set(
                        nodes.filter(function(n) {
                            return isPoleType(n.type) || (n.memo && n.memo.indexOf('전산화번호:') !== -1);
                        })
                             .map(function(n) { return (n.memo || '').replace('전산화번호: ', '').trim(); })
                             .filter(Boolean)
                    );

                    const now = Date.now();
                    let addCount = 0, skipCount = 0;
                    const BATCH = 5000; // 200→5000: setTimeout 횟수 25배 감소

                    document.getElementById('importProgressTitle').textContent = '전주 임포트 중...';
                    showImportProgress(0, pollNodes.length);

                    // 배치마다 IDB에 직접 쓰기 — nodes[]에 쌓지 않음
                    for (let i = 0; i < pollNodes.length; i += BATCH) {
                        const idbBatch = [];
                        const end = Math.min(i + BATCH, pollNodes.length);
                        for (let j = i; j < end; j++) {
                            const n = pollNodes[j];
                            const poleNum = (n.memo || '').replace('전산화번호: ', '').trim();
                            if (poleNum && existingMemos.has(poleNum)) {
                                skipCount++;
                                continue;
                            }
                            // 원본 ID에서 지역명 추출 (pole_문막_... → 문막)
                            const region = n.id ? (n.id.split('_')[1] || '') : '';
                            // 저장된 지역 오프셋 자동 적용
                            const off = (window.getPoleRegionOffset && region) ? window.getPoleRegionOffset(region) : null;
                            idbBatch.push({
                                id:     'poll_' + now + '_' + j,
                                type:   'pole_existing',
                                lat:    n.lat  + (off ? off.dLat : 0),
                                lng:    n.lng  + (off ? off.dLng : 0),
                                name:   n.name || '',
                                memo:   poleNum ? '전산화번호: ' + poleNum : '',
                                region: region
                            });
                            if (poleNum) existingMemos.add(poleNum);
                            addCount++;
                        }

                        // IDB 직접 쓰기 (nodes[] 경유 없음 → 마지막 bulk put 제거)
                        if (idbBatch.length > 0) await idbWritePolesBatch(idbBatch);

                        showImportProgress(end, pollNodes.length);
                        await new Promise(function(r) { setTimeout(r, 0); });
                    }

                    // localStorage 저장 (비전주 노드 + connections만, 전주는 위에서 IDB 직접 저장)
                    document.getElementById('importProgressTitle').textContent = '저장 중...';
                    await saveData();

                    // 뷰포트 전주 로드 후 캔버스 렌더링
                    refreshPoles();
                    hideImportProgress();
                    showStatus('전주 임포트 완료: ' + addCount + '개 추가, ' + skipCount + '개 중복 건너뜀');
                    alert('전주 임포트 완료\n추가: ' + addCount + '개\n중복 건너뜀: ' + skipCount + '개');

                } catch(err) {
                    hideImportProgress();
                    alert('파일 읽기 오류: ' + err.message);
                }
                event.target.value = '';
            };
            reader.readAsText(file);
        }

        window.exportData = exportData;
        window.importData = importData;
        window.importPollData = importPollData;

        // 전역 노출
        // ==================== 전주 범위 선택 ====================
        var _poleSelectMode = false;
        var _poleSelectDragging = false;
        var _poleSelectStart = null;
        var _poleSelectedNodes = [];
        var _poleSelectMouseDown = null;
        var _poleSelectMouseMove = null;
        var _poleSelectMouseUp = null;
        var _poleSelectKeyHandler = null;

        function startPoleSelect() {
            _poleSelectMode = true;
            _poleSelectedNodes = [];
            var btn = document.getElementById('poleSelectBtn');
            if (btn) btn.classList.add('active');
            // 패널은 드래그 후 mouseup에서 표시
            document.getElementById('poleSelectPanel').style.display = 'none';
            document.getElementById('poleSelectControls').style.display = 'none';
            document.getElementById('poleSelectCount').textContent = '드래그로 전주를 선택하세요';
            document.getElementById('poleSelectAngle').value = 0;
            document.getElementById('poleSelectAngleVal').textContent = '0°';

            var mapEl = map.getContainer();
            if (window._setMapCursorMode) window._setMapCursorMode('crosshair');
            map._m.setDraggable(false); // 지도 드래그 비활성화

            _poleSelectKeyHandler = function(e) {
                if (e.key === 'Escape') cancelPoleSelect();
            };
            document.addEventListener('keydown', _poleSelectKeyHandler);

            // 드래그 시작
            _poleSelectMouseDown = function(e) {
                if (!_poleSelectMode) return;
                _poleSelectDragging = true;
                var rect = mapEl.getBoundingClientRect();
                _poleSelectStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                var ov = document.getElementById('poleSelectOverlay');
                ov.style.display = 'block';
                ov.style.left   = _poleSelectStart.x + 'px';
                ov.style.top    = _poleSelectStart.y + 'px';
                ov.style.width  = '0px';
                ov.style.height = '0px';
                e.preventDefault();
            };
            _poleSelectMouseMove = function(e) {
                if (!_poleSelectDragging) return;
                var rect = mapEl.getBoundingClientRect();
                var cur = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                var ov = document.getElementById('poleSelectOverlay');
                ov.style.left   = Math.min(_poleSelectStart.x, cur.x) + 'px';
                ov.style.top    = Math.min(_poleSelectStart.y, cur.y) + 'px';
                ov.style.width  = Math.abs(cur.x - _poleSelectStart.x) + 'px';
                ov.style.height = Math.abs(cur.y - _poleSelectStart.y) + 'px';
            };
            _poleSelectMouseUp = function(e) {
                if (!_poleSelectDragging) return;
                _poleSelectDragging = false;
                var rect = mapEl.getBoundingClientRect();
                var end = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                document.getElementById('poleSelectOverlay').style.display = 'none';

                // 선택 범위 내 전주 찾기
                var x1 = Math.min(_poleSelectStart.x, end.x);
                var x2 = Math.max(_poleSelectStart.x, end.x);
                var y1 = Math.min(_poleSelectStart.y, end.y);
                var y2 = Math.max(_poleSelectStart.y, end.y);

                _poleSelectedNodes = nodes.filter(function(n) {
                    if (!isPoleType(n.type)) return false;
                    var pt = map.latLngToLayerPoint({ lat: n.lat, lng: n.lng });
                    return pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2;
                });

                var count = _poleSelectedNodes.length;
                document.getElementById('poleSelectCount').textContent =
                    count > 0 ? count + '개 전주 선택됨' : '범위 안에 전주가 없습니다';
                document.getElementById('poleSelectControls').style.display =
                    count > 0 ? 'block' : 'none';

                // 팝업 위치: 선택 영역 우하단 근처, 화면 밖으로 나가지 않게 조정
                var panel = document.getElementById('poleSelectPanel');
                panel.style.display = 'block';
                var panelW = 290, panelH = count > 0 ? 180 : 80;
                var px = x2 + 12;
                var py = y2 + 12;
                if (px + panelW > rect.width)  px = x2 - panelW - 4;
                if (py + panelH > rect.height) py = y2 - panelH - 4;
                panel.style.left = Math.max(4, px) + 'px';
                panel.style.top  = Math.max(4, py) + 'px';

                // 선택된 전주 하이라이트 (Canvas가 그림)
                drawPoleCanvas();
            };

            mapEl.addEventListener('mousedown', _poleSelectMouseDown);
            mapEl.addEventListener('mousemove', _poleSelectMouseMove);
            mapEl.addEventListener('mouseup',   _poleSelectMouseUp);
        }

        function onPoleSelectAngleChange(val) {
            document.getElementById('poleSelectAngleVal').textContent = val + '°';
            var offset = parseInt(document.getElementById('poleSelectOffset').value) || 20;
            _poleSelectedNodes.forEach(function(n) {
                n.labelAngle  = parseFloat(val)    || 0;
                n.labelOffset = parseFloat(offset) || 20;
            });
            drawPoleCanvas();
        }

        function onPoleSelectOffsetChange(val) {
            document.getElementById('poleSelectOffsetVal').textContent = val + 'px';
            var angle = parseFloat(document.getElementById('poleSelectAngle').value) || 0;
            _poleSelectedNodes.forEach(function(n) {
                n.labelAngle  = angle;
                n.labelOffset = parseFloat(val) || 20;
            });
            drawPoleCanvas();
        }

        function resetPoleSelectLabel() {
            document.getElementById('poleSelectAngle').value = 0;
            document.getElementById('poleSelectAngleVal').textContent = '0°';
            document.getElementById('poleSelectOffset').value = 20;
            document.getElementById('poleSelectOffsetVal').textContent = '20px';
            _poleSelectedNodes.forEach(function(n){n.labelAngle=0;n.labelOffset=20;});
            drawPoleCanvas();
        }

        function applyPoleSelectAngle() {
            var angle  = parseInt(document.getElementById('poleSelectAngle').value)  || 0;
            var offset = parseInt(document.getElementById('poleSelectOffset').value) || 20;
            _poleSelectedNodes.forEach(function(n) {
                n.labelAngle  = angle;
                n.labelOffset = offset;
            });
            saveData();
            drawPoleCanvas();
            showStatus(_poleSelectedNodes.length + '개 전주 라벨 저장 완료');
            cancelPoleSelect();
        }

        function deleteSelectedPoles() {
            if (!_poleSelectedNodes || _poleSelectedNodes.length === 0) {
                showStatus('선택된 전주가 없습니다');
                return;
            }
            var count = _poleSelectedNodes.length;
            showConfirm(count + '개 전주를 삭제할까요?', function() {
                var ids = new Set(_poleSelectedNodes.map(function(n) { return n.id; }));
                _poleSelectedNodes.forEach(function(n) { markPoleForUndo(n); });
                nodes = nodes.filter(function(n) { return !ids.has(n.id); });
                // IDB에서도 삭제
                (async function() {
                    var db = await getDB();
                    var tx = db.transaction('poles', 'readwrite');
                    var store = tx.objectStore('poles');
                    ids.forEach(function(id) { store.delete(id); });
                })();
                saveData();
                drawPoleCanvas();
                cancelPoleSelect();
                showStatus(count + '개 전주 삭제 완료');
            }, '', '삭제');
        }
        window.deleteSelectedPoles = deleteSelectedPoles;

        function cancelPoleSelect() {
            // 이동 모드 중이면 원본 복원
            if (_poleMoveMode && _poleMoveOrigins) {
                _poleMoveOrigins.forEach(function(o) { o.node.lat = o.lat; o.node.lng = o.lng; });
                _poleMoveOrigins = null;
                _poleMoveMode = false;
                _cleanupPoleMove(map.getContainer());
            }
            _poleSelectMode = false;
            _poleSelectDragging = false;
            _poleSelectedNodes = [];
            drawPoleCanvas();
            document.getElementById('poleSelectPanel').style.display = 'none';
            document.getElementById('poleSelectOverlay').style.display = 'none';
            var btn = document.getElementById('poleSelectBtn');
            if (btn) btn.classList.remove('active');
            var mapEl = map.getContainer();
            if (window._setMapCursorMode) window._setMapCursorMode('default');
            map._m.setDraggable(true); // 지도 드래그 복원
            if (_poleSelectMouseDown) mapEl.removeEventListener('mousedown', _poleSelectMouseDown);
            if (_poleSelectMouseMove) mapEl.removeEventListener('mousemove', _poleSelectMouseMove);
            if (_poleSelectMouseUp)   mapEl.removeEventListener('mouseup',   _poleSelectMouseUp);
            if (_poleSelectKeyHandler) document.removeEventListener('keydown', _poleSelectKeyHandler);
        }

        // ── 전주 이동 모드 ──
        var _poleMoveMode = false;
        var _poleMoveOrigins = null;   // 이동 전 원본 좌표
        var _poleMoveMouseMove = null;
        var _poleMoveClick = null;
        var _poleMoveKeyHandler = null;

        window.startPoleMoveMode = function() {
            if (!_poleSelectedNodes || _poleSelectedNodes.length === 0) return;
            _poleMoveMode = true;

            // 원본 좌표 저장 (기준점: 선택 전주 중심)
            _poleMoveOrigins = _poleSelectedNodes.map(function(n) {
                return { node: n, lat: n.lat, lng: n.lng };
            });
            var sumLat = 0, sumLng = 0;
            _poleMoveOrigins.forEach(function(o) { sumLat += o.lat; sumLng += o.lng; });
            var centerLat = sumLat / _poleMoveOrigins.length;
            var centerLng = sumLng / _poleMoveOrigins.length;

            // 패널 숨기기, 커서 변경, 지도 드래그 비활성화
            document.getElementById('poleSelectPanel').style.display = 'none';
            map._m.setDraggable(false);
            showStatus('지도를 클릭하면 전주가 이동됩니다  (ESC: 취소)');

            var mapEl = map.getContainer();

            _poleMoveMouseMove = function(e) {
                if (!_poleMoveMode) return;
                var rect = mapEl.getBoundingClientRect();
                var mx = e.clientX - rect.left;
                var my = e.clientY - rect.top;
                var latlng = map.containerPointToLatLng({ x: mx, y: my });
                var dLat = latlng.lat - centerLat;
                var dLng = latlng.lng - centerLng;

                // 전주를 마우스 위치 기준으로 오프셋 적용 (50% 불투명도는 drawPoleCanvas에서)
                _poleMoveOrigins.forEach(function(o) {
                    o.node.lat = o.lat + dLat;
                    o.node.lng = o.lng + dLng;
                });
                drawPoleCanvas();
            };

            _poleMoveClick = function(e) {
                if (!_poleMoveMode) return;
                e.stopPropagation();
                // 현재 위치로 확정 저장
                _poleMoveMode = false;
                _cleanupPoleMove(mapEl);
                // IDB 업데이트
                if (window.idbWritePolesBatch) {
                    window.idbWritePolesBatch(_poleMoveOrigins.map(function(o) { return o.node; }));
                }
                saveData();
                drawPoleCanvas();
                showStatus(_poleMoveOrigins.length + '개 전주 이동 완료');
                _poleMoveOrigins = null;
                cancelPoleSelect();
            };

            _poleMoveKeyHandler = function(e) {
                if (e.key === 'Escape') _cancelPoleMoveMode();
            };

            mapEl.addEventListener('mousemove', _poleMoveMouseMove);
            mapEl.addEventListener('click',     _poleMoveClick, true);
            document.addEventListener('keydown', _poleMoveKeyHandler);
        };

        function _cancelPoleMoveMode() {
            if (!_poleMoveMode) return;
            _poleMoveMode = false;
            // 원본 좌표 복원
            if (_poleMoveOrigins) {
                _poleMoveOrigins.forEach(function(o) { o.node.lat = o.lat; o.node.lng = o.lng; });
                _poleMoveOrigins = null;
            }
            _cleanupPoleMove(map.getContainer());
            drawPoleCanvas();
            cancelPoleSelect();
        }

        function _cleanupPoleMove(mapEl) {
            map._m.setDraggable(true);
            if (_poleMoveMouseMove) mapEl.removeEventListener('mousemove', _poleMoveMouseMove);
            if (_poleMoveClick)     mapEl.removeEventListener('click',     _poleMoveClick, true);
            if (_poleMoveKeyHandler) document.removeEventListener('keydown', _poleMoveKeyHandler);
            _poleMoveMouseMove = _poleMoveClick = _poleMoveKeyHandler = null;
        }

        // 단일 전주 이동 — 모달의 이동 버튼에서 호출
        window.startSinglePoleMoveMode = function(nodeId) {
            var node = nodes.find(function(n) { return n.id === nodeId; });
            if (!node) return;
            document.getElementById('menuModal').classList.remove('active');
            _poleSelectedNodes = [node];
            drawPoleCanvas();
            window.startPoleMoveMode();
        };

        // 외부에서 전주 배열을 넘겨 전주선택 패널 표시
        function showPoleSelectPanel(poles) {
            _poleSelectedNodes = poles;
            var count = poles.length;
            // 슬라이더 초기화
            document.getElementById('poleSelectAngle').value = 0;
            document.getElementById('poleSelectAngleVal').textContent = '0°';
            document.getElementById('poleSelectOffset').value = 0;
            document.getElementById('poleSelectOffsetVal').textContent = '0px';
            document.getElementById('poleSelectCount').textContent = count + '개 전주 선택됨';
            document.getElementById('poleSelectControls').style.display = 'block';
            var panel = document.getElementById('poleSelectPanel');
            panel.style.display = 'block';
            // 화면 우상단에 고정 표시
            var mapRect = document.getElementById('map').getBoundingClientRect();
            panel.style.left = (mapRect.right - 240) + 'px';
            panel.style.top = (mapRect.top + 10) + 'px';
            drawPoleCanvas();
        }

        window.resetPoleLabel           = resetPoleLabel;
        window.setJunctionType          = setJunctionType;
        window.startPoleSelect          = startPoleSelect;
        window.cancelPoleSelect         = cancelPoleSelect;
        window.showPoleSelectPanel      = showPoleSelectPanel;
        window.onPoleSelectAngleChange  = onPoleSelectAngleChange;
        window.onPoleSelectOffsetChange = onPoleSelectOffsetChange;
        window.applyPoleSelectAngle     = applyPoleSelectAngle;
        window.resetPoleSelectLabel     = resetPoleSelectLabel;

        // 전주 모달 함수
        window.selectPoleType  = selectPoleType;
        window.previewPoleLabel = previewPoleLabel;
        window.savePoleInfo    = savePoleInfo;
        window.deletePole      = deletePole;

        // 메뉴/노드 모달 함수
        window.closeMenuModal  = closeMenuModal;

        // ==================== 전주 범위 선택 끝 ====================

        // ==================== 구간 캡쳐 ====================

        // ==================== 구간 캡쳐 (지도 위치 두 점 선택) ====================



        window.initMap = initMap;

// ==================== 전주 위치 보정 ====================
(function() {
    var REGIONS = ['문막','신림','영월','원주','정선','평창','횡성'];
    var STORAGE_KEY = 'poleRegionOffsets';
    var GLOBAL_OFFSET_KEY = 'poleGlobalOffset'; // 전체 적용 누적값
    // 1° ≈ 111,000m, 경도는 cos(37.4°) 보정
    var LAT_PER_M = 1 / 111000;
    var LNG_PER_M = 1 / (111000 * Math.cos(37.4 * Math.PI / 180));

    window._polePreviewOffset = { dLat: 0, dLng: 0 };

    function getSavedOffsets() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
        catch(e) { return {}; }
    }
    function setSavedOffsets(obj) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    }

    function refreshSavedList() {
        var saved = getSavedOffsets();
        var el = document.getElementById('offsetSavedList');
        if (!el) return;
        var keys = Object.keys(saved);
        if (keys.length === 0) { el.textContent = '저장된 지역 오프셋 없음'; return; }
        el.innerHTML = keys.map(function(r) {
            var o = saved[r];
            var latM = Math.round(o.dLat / LAT_PER_M);
            var lngM = Math.round(o.dLng / LNG_PER_M);
            return '<b>' + r + '</b>: 북' + (latM >= 0 ? '+' : '') + latM + 'm '
                 + '동' + (lngM >= 0 ? '+' : '') + lngM + 'm'
                 + ' <span style="cursor:pointer;color:#e74c3c;" onclick="deleteRegionOffset(\'' + r + '\')">[삭제]</span>';
        }).join('<br>');
    }

    window.openOffsetPanel = function() {
        document.getElementById('poleOffsetPanel').classList.add('active');
        document.getElementById('poleOffsetOverlay').classList.add('active');
        document.getElementById('offsetLatSlider').value = 0;
        document.getElementById('offsetLngSlider').value = 0;
        document.getElementById('offsetLatVal').textContent = '0m';
        document.getElementById('offsetLngVal').textContent = '0m';
        window._polePreviewOffset = { dLat: 0, dLng: 0 };
        refreshSavedList();
    };

    window.closeOffsetPanel = function() {
        document.getElementById('poleOffsetPanel').classList.remove('active');
        document.getElementById('poleOffsetOverlay').classList.remove('active');
        window._polePreviewOffset = { dLat: 0, dLng: 0 };
        if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
    };

    window.updateOffsetPreview = function() {
        var latM = parseInt(document.getElementById('offsetLatSlider').value);
        var lngM = parseInt(document.getElementById('offsetLngSlider').value);
        document.getElementById('offsetLatVal').textContent = (latM >= 0 ? '+' : '') + latM + 'm';
        document.getElementById('offsetLngVal').textContent = (lngM >= 0 ? '+' : '') + lngM + 'm';
        window._polePreviewOffset = { dLat: latM * LAT_PER_M, dLng: lngM * LNG_PER_M };
        if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
    };

    // +/- 1m 단위 미세 조정
    window.nudgeOffset = function(axis, delta) {
        var id = axis === 'lat' ? 'offsetLatSlider' : 'offsetLngSlider';
        var slider = document.getElementById(id);
        var cur = parseInt(slider.value) || 0;
        var next = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), cur + delta));
        slider.value = next;
        window.updateOffsetPreview();
    };

    window.saveCurrentRegionOffset = function() {
        var region = document.getElementById('offsetRegionSelect').value;
        if (!region) { alert('지역을 선택해주세요.'); return; }
        var latM = parseInt(document.getElementById('offsetLatSlider').value);
        var lngM = parseInt(document.getElementById('offsetLngSlider').value);
        var saved = getSavedOffsets();
        saved[region] = { dLat: latM * LAT_PER_M, dLng: lngM * LNG_PER_M };
        setSavedOffsets(saved);
        refreshSavedList();
        alert(region + ' 오프셋 저장 완료\n(다음 임포트 시 자동 적용됩니다)');
    };

    window.deleteRegionOffset = function(region) {
        var saved = getSavedOffsets();
        delete saved[region];
        setSavedOffsets(saved);
        refreshSavedList();
    };

    // 전체 적용: 현재 슬라이더값을 IDB 모든 전주에 적용
    window.applyOffsetGlobal = async function() {
        var latM = parseInt(document.getElementById('offsetLatSlider').value);
        var lngM = parseInt(document.getElementById('offsetLngSlider').value);
        if (latM === 0 && lngM === 0) { alert('오프셋이 0입니다.'); return; }
        if (!confirm('전체 전주의 위치를 북' + (latM >= 0?'+':'') + latM + 'm / 동' + (lngM >= 0?'+':'') + lngM + 'm 이동합니다.\n계속하시겠습니까?')) return;
        var dLat = latM * LAT_PER_M, dLng = lngM * LNG_PER_M;
        document.getElementById('importProgressTitle').textContent = '위치 적용 중...';
        document.getElementById('importProgressOverlay').classList.add('active');
        await applyOffsetToAllPoles(
            function() { return { dLat: dLat, dLng: dLng }; },
            function(cur, tot) {
                var pct = Math.round(cur / tot * 100);
                document.getElementById('importProgressFill').style.width = pct + '%';
                document.getElementById('importProgressLabel').textContent = cur.toLocaleString() + ' / ' + tot.toLocaleString() + '  (' + pct + '%)';
            }
        );
        document.getElementById('importProgressOverlay').classList.remove('active');
        window._polePreviewOffset = { dLat: 0, dLng: 0 };
        document.getElementById('offsetLatSlider').value = 0;
        document.getElementById('offsetLngSlider').value = 0;
        document.getElementById('offsetLatVal').textContent = '0m';
        document.getElementById('offsetLngVal').textContent = '0m';
        // 누적 글로벌 오프셋 저장 (내보내기용)
        try {
            var prev = JSON.parse(localStorage.getItem(GLOBAL_OFFSET_KEY) || '{"dLat":0,"dLng":0}');
            localStorage.setItem(GLOBAL_OFFSET_KEY, JSON.stringify({ dLat: prev.dLat + dLat, dLng: prev.dLng + dLng }));
        } catch(e) {}
        if (typeof refreshPoles === 'function') refreshPoles();
        alert('위치 적용 완료');
    };

    // 지역별 적용: 저장된 오프셋을 각 전주의 region 필드 기준으로 적용
    window.applyOffsetByRegion = async function() {
        var saved = getSavedOffsets();
        if (Object.keys(saved).length === 0) { alert('저장된 지역 오프셋이 없습니다.'); return; }
        var list = Object.keys(saved).map(function(r) {
            var o = saved[r];
            var latM = Math.round(o.dLat / LAT_PER_M), lngM = Math.round(o.dLng / LNG_PER_M);
            return r + ': 북' + (latM>=0?'+':'') + latM + 'm 동' + (lngM>=0?'+':'') + lngM + 'm';
        }).join('\n');
        if (!confirm('다음 지역별 오프셋을 적용합니다:\n\n' + list + '\n\n계속하시겠습니까?')) return;
        document.getElementById('importProgressTitle').textContent = '지역별 위치 적용 중...';
        document.getElementById('importProgressOverlay').classList.add('active');
        await applyOffsetToAllPoles(
            function(node) {
                var region = node.region || (node.id ? node.id.split('_')[1] : '');
                return saved[region] || null;
            },
            function(cur, tot) {
                var pct = Math.round(cur / tot * 100);
                document.getElementById('importProgressFill').style.width = pct + '%';
                document.getElementById('importProgressLabel').textContent = cur.toLocaleString() + ' / ' + tot.toLocaleString() + '  (' + pct + '%)';
            }
        );
        document.getElementById('importProgressOverlay').classList.remove('active');
        window._polePreviewOffset = { dLat: 0, dLng: 0 };
        if (typeof refreshPoles === 'function') refreshPoles();
        alert('지역별 위치 적용 완료');
    };

    // importPollData에서 사용: 지역 오프셋 자동 조회
    window.getPoleRegionOffset = function(region) {
        var saved = getSavedOffsets();
        return saved[region] || null;
    };

    // 오프셋 내보내기 — poles_offsets.json 다운로드
    window.exportOffsets = function() {
        var saved = getSavedOffsets();
        var globalOff = null;
        try { globalOff = JSON.parse(localStorage.getItem(GLOBAL_OFFSET_KEY)); } catch(e) {}
        // '*' 키: 전체 적용 누적값 (지역 오프셋이 없는 전주에 적용)
        if (globalOff && (globalOff.dLat || globalOff.dLng)) saved['*'] = globalOff;

        if (Object.keys(saved).length === 0) {
            alert('저장된 오프셋이 없습니다.\n"이 지역 저장" 또는 "전체 적용"을 먼저 실행하세요.');
            return;
        }
        var json = JSON.stringify(saved, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'poles_offsets.json';
        a.click();
        URL.revokeObjectURL(a.href);
        alert('poles_offsets.json 다운로드 완료\nC:\\cable_map 폴더로 이동 후 python update_poles.py 실행하세요.');
    };
})();

// ==================== 전주 검색 ====================
(function() {
    var _searchTimer = null;
    var _lastPoleResults = [];
    var _lastAddrResults = [];

    // IDB에서 전주 검색 (이름 or 전산화번호)
    async function searchPoles(query) {
        query = query.trim().toLowerCase();
        if (!query) return [];

        var db = await (window.getDB ? window.getDB() : null);
        if (!db) return [];

        return new Promise(function(resolve) {
            var results = [];
            var tx = db.transaction('poles', 'readonly');
            var store = tx.objectStore('poles');
            store.openCursor().onsuccess = function(e) {
                var cursor = e.target.result;
                if (cursor) {
                    var n = cursor.value;
                    var name = (n.name || '').toLowerCase();
                    var memo = (n.memo || '').toLowerCase();
                    if (name.includes(query) || memo.includes(query)) {
                        results.push(n);
                    }
                    cursor.continue();
                } else {
                    // 자연수 정렬: 1, 2, 3 ... 10, 11 순
                    results.sort(function(a, b) {
                        return (a.name || '').localeCompare(b.name || '', 'ko', { numeric: true });
                    });
                    resolve(results.slice(0, 30));
                }
            };
            tx.onerror = function() { resolve([]); };
        });
    }

    // 결과 렌더링 — type: 'pole' | 'address'
    function renderResults(poleResults, addrResults) {
        var box = document.getElementById('poleSearchResults');
        if (!box) return;
        var html = '';

        if (poleResults && poleResults.length > 0) {
            html += '<div class="sr-group-label">전주</div>';
            html += poleResults.map(function(n, i) {
                var poleNum = (n.memo || '').replace('전산화번호: ', '').trim();
                return '<div class="sr-item" onmousedown="onPoleSearchSelect(\'pole\',' + i + ')">' +
                    '<span class="sr-name">' + escapeHtml(n.name || '') + '</span>' +
                    (poleNum ? '<span class="sr-memo">전산화번호: ' + escapeHtml(poleNum) + '</span>' : '') +
                    '</div>';
            }).join('');
        }

        if (addrResults && addrResults.length > 0) {
            html += '<div class="sr-group-label">주소</div>';
            html += addrResults.map(function(a, i) {
                return '<div class="sr-item" onmousedown="onPoleSearchSelect(\'addr\',' + i + ')">' +
                    '<span class="sr-name">' + escapeHtml(a.place_name || a.address_name || '') + '</span>' +
                    '<span class="sr-memo">' + escapeHtml(a.address_name || a.road_address_name || '') + '</span>' +
                    '</div>';
            }).join('');
        }

        if (!html) html = '<div class="sr-empty">검색 결과 없음</div>';
        box.innerHTML = html;
        box.style.display = 'block';
        _lastPoleResults = poleResults || [];
        _lastAddrResults = addrResults || [];
    }

    window.showPoleSearchResults = function() {
        var box = document.getElementById('poleSearchResults');
        if (box && (_lastPoleResults.length > 0 || _lastAddrResults.length > 0)) box.style.display = 'block';
    };
    window.hidePoleSearchResults = function() {
        var box = document.getElementById('poleSearchResults');
        if (box) box.style.display = 'none';
    };

    // 카카오 Places/Geocoder 주소 검색
    function searchAddress(query, cb) {
        if (!kakao || !kakao.maps || !kakao.maps.services) { cb([]); return; }
        var ps = new kakao.maps.services.Places();
        ps.keywordSearch(query, function(data, status) {
            if (status === kakao.maps.services.Status.OK) cb(data);
            else {
                // Places 실패 → Geocoder fallback
                var gc = new kakao.maps.services.Geocoder();
                gc.addressSearch(query, function(data2, status2) {
                    cb(status2 === kakao.maps.services.Status.OK ? data2 : []);
                });
            }
        });
    }

    function showSearchLoading() {
        var box = document.getElementById('poleSearchResults');
        if (!box) return;
        box.innerHTML = '<div class="sr-empty" style="display:flex;align-items:center;justify-content:center;gap:8px;"><span class="sr-spinner"></span> 검색 중...</div>';
        box.style.display = 'block';
    }

    window.onPoleSearchInput = function(val) {
        if (_searchTimer) clearTimeout(_searchTimer);
        val = val.trim();
        if (val.length < 1) { window.hidePoleSearchResults(); return; }
        showSearchLoading();
        _searchTimer = setTimeout(async function() {
            var poleResults = await searchPoles(val);
            if (poleResults.length > 0) {
                renderResults(poleResults, []);
            } else {
                searchAddress(val, function(addrResults) {
                    renderResults([], addrResults.slice(0, 10));
                });
            }
        }, 300);
    };

    window.onPoleSearchEnter = async function() {
        var val = (document.getElementById('poleSearchInput') || {}).value || '';
        val = val.trim();
        if (!val) return;
        showSearchLoading();
        var poleResults = await searchPoles(val);
        if (poleResults.length === 1) {
            window.onPoleSearchSelect('pole', 0);
            return;
        }
        if (poleResults.length > 1) {
            renderResults(poleResults, []);
            return;
        }
        // 전주 없으면 주소 검색
        searchAddress(val, function(addrResults) {
            addrResults = addrResults.slice(0, 10);
            if (addrResults.length === 1) {
                _lastAddrResults = addrResults;
                window.onPoleSearchSelect('addr', 0);
            } else {
                renderResults([], addrResults);
            }
        });
    };

    window.onPoleSearchSelect = function(type, idx) {
        window.hidePoleSearchResults();
        if (type === 'pole') {
            var n = _lastPoleResults[idx];
            if (!n || !map) return;
            map._m.setCenter(new kakao.maps.LatLng(n.lat, n.lng));
            map._m.setLevel(2);
            if (typeof refreshPoles === 'function') refreshPoles();
            setTimeout(function() {
                if (typeof drawPoleCanvas === 'function') {
                    window._poleSearchHighlight = n.id;
                    drawPoleCanvas();
                    setTimeout(function() {
                        window._poleSearchHighlight = null;
                        drawPoleCanvas();
                    }, 3000);
                }
            }, 300);
        } else {
            var a = _lastAddrResults[idx];
            if (!a || !map) return;
            var lat = parseFloat(a.y || (a.address && a.address.y));
            var lng = parseFloat(a.x || (a.address && a.address.x));
            if (isNaN(lat) || isNaN(lng)) return;
            map._m.setCenter(new kakao.maps.LatLng(lat, lng));
            map._m.setLevel(3);
            if (typeof refreshPoles === 'function') refreshPoles();
        }
    };
})();
