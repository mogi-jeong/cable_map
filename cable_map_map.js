        function initMap() {
            // 전주 라벨 스타일 주입
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
                if (typeof naver === "undefined" || !naver.maps) {
                    console.error('네이버맵이 로드되지 않았습니다.');
                    return;
                }
                
                // 마지막 위치 복원 (없으면 강원도 원주 기본값)
                const _sv = localStorage.getItem('mapView');
                const _mv = _sv ? JSON.parse(_sv) : {lat:37.3422, lng:127.9202, zoom:13};
                map = L.map('map').setView([_mv.lat, _mv.lng], _mv.zoom);
                
                // 카카오맵 자체 타일 사용
                
                // 데이터 로드
                loadData();

                // 지도 이동/줌 시 위치 저장 + 팝업 닫기
                map.on('zoomend', function() { updatePoleLabels(); });
                NMaps.addListener(map._m,'zoom_changed',function(){ updatePoleLabels(); });
                map.on('moveend', function() {
                    if (!map || !map._m) return;
                    const c = map._m.getCenter();
                    const z = map._m.getZoom();
                    localStorage.setItem('mapView', JSON.stringify({lat:c.lat(), lng:c.lng(), zoom:z}));
                    map.closePopup();
                    updatePoleLabels();
                });
                
                // 기존 노드와 연결 표시
                renderAllNodes();
                renderAllConnections();
                
                // ESC 키 이벤트 (케이블 연결 취소)
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape' || e.keyCode === 27) {
                        if (connectingMode) {
                            cancelConnecting();
                        }
                        if (addingMode) {
                            cancelAdding();
                        }
                    }
                });
                
                // 지도 클릭 이벤트
                map.on('click', function(e) {
                    if (addingMode && addingType === 'junction') {
                        // 원이 표시 중이면 원 안/밖 판단
                        if (_junctionCircle && _junctionPole) {
                            var dist = latlngDist(e.latlng.lat, e.latlng.lng, _junctionPole.lat, _junctionPole.lng);
                            if (dist <= 20) {
                                // 원 안 → 함체 생성
                                var poleName = _junctionPole.name || '';
                                clearJunctionRadius();
                                cancelAdding();
                                document.getElementById('junctionConfirmPopup').style.display = 'none';
                                var junctionNode = {
                                    id: Date.now().toString(),
                                    type: 'junction',
                                    lat: e.latlng.lat, lng: e.latlng.lng,
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
                NMaps.addListener(map._m, 'rightclick', function(e) {
                    const lat = e.coord.lat();
                    const lng = e.coord.lng();

                    // 기존 컨텍스트 메뉴 제거
                    const existing = document.getElementById('mapContextMenu');
                    if (existing) existing.remove();

                    // 지도 컨테이너 기준 픽셀 좌표
                    const proj = map._m.getProjection();
                    const pt = proj.containerPointFromCoords(e.latLng);

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
            showNodeInfoModalForEdit();
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
            const markerHTML = getMarkerHTML(node.type, node.name, node.memo || '', node.id);

            // junction이 전주 위에 겹쳐있으면 오른쪽 아래로 픽셀 오프셋
            var anchorX = 12, anchorY = 18;
            if (node.type === 'junction') {
                var nearPole = nodes.find(function(n) {
                    if (!isPoleType(n.type)) return false;
                    var dlat = Math.abs(n.lat - node.lat);
                    var dlng = Math.abs(n.lng - node.lng);
                    return dlat < 0.0002 && dlng < 0.0002;
                });
                if (nearPole) {
                    // iconAnchor를 왼쪽으로 당기면 아이콘이 오른쪽으로 이동
                    anchorX = -4; // 16px 오른쪽
                    anchorY = 28; // 10px 아래
                }
            }
            
            const icon = L.divIcon({
                html: markerHTML,
                className: 'custom-div-icon',
                iconSize: [24, 36],
                iconAnchor: [anchorX, anchorY]
            });
            
            const isPole = isPoleType(node.type);
            const marker = L.marker([node.lat, node.lng], {
                icon: icon,
                zIndexOffset: isPole ? 5000 : 0
            }).addTo(map);
            
            marker.on('click', function() {
                // 폴리라인 클릭 무시 플래그 (카카오맵 이벤트 시스템 분리 대응)
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
            updatePoleLabels();
        }

        function updatePoleLabels() {
            var level = (map && map._m) ? map._m.getZoom() : 0;
            document.querySelectorAll('.pole-label').forEach(function(el) {
                if (level >= 16) {
                    el.classList.add('pole-label-visible');
                    var poleId = el.getAttribute('data-pole-id');
                    if (poleId) {
                        var node = nodes.find(function(n) { return n.id === poleId; });
                        var angle  = (node && node.labelAngle  != null) ? node.labelAngle  : 0;
                        var offset = (node && node.labelOffset != null) ? node.labelOffset : 20;
                        el.style.left = '7px';
                        el.style.right = 'auto';
                        el.style.top = '0px';
                        el.style.transformOrigin = '0 50%';
                        el.style.transform = 'rotate(' + angle + 'deg) translateX(' + offset + 'px)';
                    }
                } else {
                    el.classList.remove('pole-label-visible');
                    el.style.transform = '';
                }
            });
        }

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
            _junctionCircle = NMaps.Circle({
                center: NMaps.LatLng(poleNode.lat, poleNode.lng),
                radius: 20,
                strokeWeight: 2,
                strokeColor: '#1a6fd4',
                strokeOpacity: 0.9,
                strokeStyle: 'dashed',
                fillColor: '#1a6fd4',
                fillOpacity: 0.08
            });
            _junctionCircle.setMap(map._m);
            showStatus('원 안에서 함체 위치를 클릭하세요  (ESC: 취소)');
        }

        function clearJunctionRadius() {
            if (_junctionCircle) { _junctionCircle.setMap(null); _junctionCircle = null; }
            _junctionPole = null;
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
                    connectingToNode = node;
                    if (pendingWaypoints.length > 0) {
                        const last = pendingWaypoints[pendingWaypoints.length - 1];
                        const dlat = Math.abs(last.lat - node.lat);
                        const dlng = Math.abs(last.lng - node.lng);
                        if (dlat < 0.0005 && dlng < 0.0005) pendingWaypoints.pop();
                    }
                    clearPreviewOnly();
                    showConnectionModal();
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

            document.getElementById('menuModalTitle').innerHTML = `전주 정보`;

            // 전주 모달은 폼 형태 → grid 해제
            const menuButtons = document.getElementById('menuButtons');
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

        function savePoleInfo(nodeId) {
            const node = nodes.find(n=>n.id===nodeId); if(!node) return;
            const isSelf = document.getElementById('poleSelfCheck').checked;
            const poleNum = document.getElementById('poleNumInput').value.trim();
            node.memo = (poleNum ? '전산화번호: '+poleNum : '') + (isSelf ? '자가주:true' : '');
            node.name = document.getElementById('poleNameInput').value.trim();
            node.labelAngle  = parseInt(document.getElementById('poleLabelAngle').value)  || 0;
            node.labelOffset = parseInt(document.getElementById('poleLabelOffset').value) ?? 20;
            if (window._currentPoleType) node.type = window._currentPoleType;
            saveData(); closeMenuModal();
            if(markers[nodeId]) markers[nodeId].setMap(null); delete markers[nodeId];
            renderNode(node); updatePoleLabels(); showStatus('저장 완료');
        }

        // 저장 전 라벨 미리보기
        function previewPoleLabel(nodeId, angle, offset) {
            var node = nodes.find(function(n) { return n.id === nodeId; });
            if (offset == null) offset = (node && node.labelOffset != null) ? node.labelOffset : 20;
            var el = document.querySelector('.pole-label[data-pole-id="'+nodeId+'"]');
            if (!el) return;
            el.style.left = '7px';
            el.style.right = 'auto';
            el.style.top = '0px';
            el.style.transformOrigin = '0 50%';
            el.style.transform = 'rotate('+angle+'deg) translateX('+offset+'px)';
        }

        function resetPoleLabel(nodeId) {
            document.getElementById('poleLabelAngle').value = 0;
            document.getElementById('poleAngleVal').textContent = '0°';
            document.getElementById('poleLabelOffset').value = 20;
            document.getElementById('poleOffsetVal').textContent = '20px';
            previewPoleLabel(nodeId, 0, 20);
        }

        function deletePole(nodeId) {
            if(!confirm('전주를 삭제할까요?')) return;
            const idx = nodes.findIndex(n=>n.id===nodeId);
            if(idx!==-1) nodes.splice(idx,1);
            if(markers[nodeId]) markers[nodeId].setMap(null); delete markers[nodeId];
            saveData(); closeMenuModal(); showStatus('전주 삭제 완료');
        }

        // 메뉴 모달 표시
        function showMenuModal() {
            const menuButtons = document.getElementById('menuButtons');
            menuButtons.innerHTML = '';

            // 기설/신설 토글: junction일 때만 표시
            const toggle = document.getElementById('junctionTypeToggle');
            if (selectedNode && selectedNode.type === 'junction') {
                toggle.style.display = 'flex';
                _updateJunctionTypeUI(selectedNode.isNew ? 'new' : 'existing');
            } else {
                toggle.style.display = 'none';
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
                menuButtons.appendChild(makeBtn(svgOFD, 'OFD 관리', showOFDModal));
                menuButtons.appendChild(makeBtn(svgCable, '케이블 연결', startConnecting));
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
            document.getElementById('junctionTypeToggle').style.display = 'none';
            const title = document.getElementById('menuModalTitle');
            if (title) title.innerHTML = '선택하세요';
            const mb = document.getElementById('menuButtons');
            if (mb) mb.style.display = '';
        }

        function _updateJunctionTypeUI(type) {
            const btnE = document.getElementById('junctionTypeBtnExisting');
            const btnN = document.getElementById('junctionTypeBtnNew');
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
        function toggleSkyView() {
            _isSkyView = !_isSkyView;
            NMaps.setMapTypeId(map._m,
                _isSkyView ? NMaps.MapTypeId.HYBRID : NMaps.MapTypeId.ROADMAP
            );
            const btn = document.getElementById('skyViewBtn');
            if (btn) {
                btn.classList.toggle('active', _isSkyView);
                btn.querySelector('.tb-label').textContent = _isSkyView ? '지도뷰' : '스카이뷰';
            }
        }
        window.toggleSkyView = toggleSkyView;


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

        window.exportData = exportData;
        window.importData = importData;

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
            mapEl.style.cursor = 'crosshair';
            NMaps.setDraggable(map._m, false); // 지도 드래그 비활성화

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

                // 선택된 전주 하이라이트
                _poleSelectedNodes.forEach(function(n) {
                    var el = document.querySelector('.pole-label[data-pole-id="'+n.id+'"]');
                    if (el) el.style.outline = '2px solid #9b59b6';
                });
            };

            mapEl.addEventListener('mousedown', _poleSelectMouseDown);
            mapEl.addEventListener('mousemove', _poleSelectMouseMove);
            mapEl.addEventListener('mouseup',   _poleSelectMouseUp);
        }

        function onPoleSelectAngleChange(val) {
            document.getElementById('poleSelectAngleVal').textContent = val + '°';
            var offset = parseInt(document.getElementById('poleSelectOffset').value) ?? 20;
            _poleSelectedNodes.forEach(function(n) {
                var el = document.querySelector('.pole-label[data-pole-id="'+n.id+'"]');
                if (!el) return;
                el.style.left = '7px';
                el.style.transformOrigin = '0 50%';
                el.style.transform = 'rotate('+val+'deg) translateX('+offset+'px)';
                el.style.outline = '2px solid #9b59b6';
            });
        }

        function onPoleSelectOffsetChange(val) {
            document.getElementById('poleSelectOffsetVal').textContent = val + 'px';
            var angle = document.getElementById('poleSelectAngle').value;
            _poleSelectedNodes.forEach(function(n) {
                var el = document.querySelector('.pole-label[data-pole-id="'+n.id+'"]');
                if (!el) return;
                el.style.left = '7px';
                el.style.transformOrigin = '0 50%';
                el.style.transform = 'rotate('+angle+'deg) translateX('+val+'px)';
                el.style.outline = '2px solid #9b59b6';
            });
        }

        function resetPoleSelectLabel() {
            document.getElementById('poleSelectAngle').value = 0;
            document.getElementById('poleSelectAngleVal').textContent = '0°';
            document.getElementById('poleSelectOffset').value = 20;
            document.getElementById('poleSelectOffsetVal').textContent = '20px';
            onPoleSelectAngleChange(0);
            onPoleSelectOffsetChange(20);
        }

        function applyPoleSelectAngle() {
            var angle  = parseInt(document.getElementById('poleSelectAngle').value)  || 0;
            var offset = parseInt(document.getElementById('poleSelectOffset').value) ?? 20;
            _poleSelectedNodes.forEach(function(n) {
                n.labelAngle  = angle;
                n.labelOffset = offset;
                var el = document.querySelector('.pole-label[data-pole-id="'+n.id+'"]');
                if (el) el.style.outline = '';
            });
            saveData();
            showStatus(_poleSelectedNodes.length + '개 전주 라벨 저장 완료');
            cancelPoleSelect();
        }

        function cancelPoleSelect() {
            _poleSelectMode = false;
            _poleSelectDragging = false;
            _poleSelectedNodes.forEach(function(n) {
                var el = document.querySelector('.pole-label[data-pole-id="'+n.id+'"]');
                if (el) el.style.outline = '';
            });
            _poleSelectedNodes = [];
            document.getElementById('poleSelectPanel').style.display = 'none';
            document.getElementById('poleSelectOverlay').style.display = 'none';
            var btn = document.getElementById('poleSelectBtn');
            if (btn) btn.classList.remove('active');
            var mapEl = map.getContainer();
            mapEl.style.cursor = '';
            NMaps.setDraggable(map._m, true); // 지도 드래그 복원
            if (_poleSelectMouseDown) mapEl.removeEventListener('mousedown', _poleSelectMouseDown);
            if (_poleSelectMouseMove) mapEl.removeEventListener('mousemove', _poleSelectMouseMove);
            if (_poleSelectMouseUp)   mapEl.removeEventListener('mouseup',   _poleSelectMouseUp);
            if (_poleSelectKeyHandler) document.removeEventListener('keydown', _poleSelectKeyHandler);
        }

        window.resetPoleLabel           = resetPoleLabel;
        window.setJunctionType          = setJunctionType;
        window.startPoleSelect          = startPoleSelect;
        window.cancelPoleSelect         = cancelPoleSelect;
        window.onPoleSelectAngleChange  = onPoleSelectAngleChange;
        window.onPoleSelectOffsetChange = onPoleSelectOffsetChange;
        window.applyPoleSelectAngle     = applyPoleSelectAngle;
        window.resetPoleSelectLabel     = resetPoleSelectLabel;

        // ==================== 전주 범위 선택 끝 ====================

        window.initMap = initMap;
