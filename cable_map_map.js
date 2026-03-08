        function initMap() {
            // 전주 라벨 스타일 주입
            (function() {
                var s = document.createElement('style');
                s.textContent = [
                    '.pole-marker { position: relative; }',
                    '.pole-label {',
                    '    position: absolute; left: 16px; top: -6px;',
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
                if (typeof kakao === 'undefined' || !kakao.maps) {
                    console.error('카카오맵이 로드되지 않았습니다.');
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
                kakao.maps.event.addListener(map._m,'zoom_changed',function(){ updatePoleLabels(); });
                map.on('moveend', function() {
                    if (!map || !map._m) return;
                    const c = map._m.getCenter();
                    const z = 18 - map._m.getLevel();
                    localStorage.setItem('mapView', JSON.stringify({lat:c.getLat(), lng:c.getLng(), zoom:Math.max(1,z)}));
                    map.closePopup();
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
                            addNode(lat, lng, item.type);
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
            showStatus('지도에서 위치를 클릭하세요');
        }
        
        // 노드 추가 취소
        function cancelAdding() {
            addingMode = false;
            addingType = '';
            document.getElementById('cancelBtn').style.display = 'none';
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
        function getMarkerHTML(type, name, memo) {
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
                return `
                    <div class="custom-marker">
                        <svg width="40" height="40" viewBox="0 0 40 40" style="filter:drop-shadow(0 2px 8px rgba(0,0,0,0.3));">
                            <circle cx="20" cy="20" r="18" fill="#e8f0fe" stroke="#1a6fd4" stroke-width="2.5"/>
                            <polygon points="20,20 7,11 7,29" fill="#1a6fd4"/>
                            <polygon points="20,20 33,11 33,29" fill="#1a6fd4"/>
                            <circle cx="20" cy="20" r="2.5" fill="white" stroke="#1a6fd4" stroke-width="1.5"/>
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
            // ── 전주: 파란 원형 점 ──
            if (type === 'pole') {
                const poleNum = memo ? memo.replace('전산화번호: ', '') : '';
                const poleLabel = (poleNum && name) ? poleNum + '/' + name : (name || '');
                return `
                    <div class="custom-marker pole-marker">
                        <svg width="14" height="14" viewBox="0 0 14 14" style="overflow:visible;display:block;">
                            <circle cx="7" cy="7" r="6" fill="#1a6fd4" stroke="white" stroke-width="2"/>
                        </svg>
                        ${poleLabel ? `<div class="pole-label">${poleLabel}</div>` : ''}
                    </div>
                `;
            }
            // 기본 (알 수 없는 타입)
            return `<div class="custom-marker"><div class="marker-icon" style="background:#999;">?</div>${name ? `<div class="marker-label">${name}</div>` : ''}</div>`;
        }

        // 노드 렌더링
        function renderNode(node) {
            const markerHTML = getMarkerHTML(node.type, node.name, node.memo || '');
            
            const icon = L.divIcon({
                html: markerHTML,
                className: 'custom-div-icon',
                iconSize: [24, 36],
                iconAnchor: [12, 18]
            });
            
            const marker = L.marker([node.lat, node.lng], { icon: icon }).addTo(map);
            
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
            // 카카오맵: getLevel() - 숫자 작을수록 확대 (1~14, 3이하면 상세)
            var level = (map && map._m) ? map._m.getLevel() : 99;
            document.querySelectorAll('.pole-label').forEach(function(el) {
                if (level <= 3) el.classList.add('pole-label-visible');
                else el.classList.remove('pole-label-visible');
            });
        }
        
        // 노드 클릭
        function isPoleType(t) {
            return t==='pole'||t==='pole_existing'||t==='pole_new'||t==='pole_removed';
        }

        function onNodeClick(node) {
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
            const labels = { pole:'기설전주', pole_existing:'기설전주', pole_new:'신설전주', pole_removed:'철거전주' };
            const color = colors[node.type]||'#1a6fd4';
            const poleNum = (node.memo||'').replace('전산화번호: ','');
            const modal = document.getElementById('menuModal');
            document.getElementById('menuModalTitle').innerHTML =
                `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>${labels[node.type]||'전주'}`;
            document.getElementById('menuButtons').innerHTML = `
                <div style="padding:4px 0 12px;">
                    <div style="margin-bottom:10px;">
                        <label style="font-size:12px;color:#888;display:block;margin-bottom:3px;">전산화번호</label>
                        <input id="poleNumInput" type="text" value="${escapeHtml(poleNum)}"
                            style="width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="font-size:12px;color:#888;display:block;margin-bottom:3px;">전주번호</label>
                        <input id="poleNameInput" type="text" value="${escapeHtml(node.name)}"
                            style="width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="font-size:12px;color:#888;display:block;margin-bottom:6px;">전주 종류</label>
                        <div style="display:flex;gap:6px;">
                            ${['pole_existing','pole_new','pole_removed'].map(t => {
                                const active = t===node.type||(t==='pole_existing'&&node.type==='pole');
                                const c = colors[t];
                                const lbl = {pole_existing:'기설',pole_new:'신설',pole_removed:'철거'}[t];
                                return `<button onclick="changePoleType('${node.id}','${t}')"
                                    style="flex:1;padding:6px 4px;border-radius:6px;border:2px solid ${active?c:'#ddd'};background:${active?c+'22':'#fff'};font-size:12px;cursor:pointer;font-weight:${active?'bold':'normal'};">
                                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:3px;vertical-align:middle;"></span>${lbl}</button>`;
                            }).join('')}
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="savePoleInfo('${node.id}')" style="flex:1;padding:10px;background:#1a6fd4;color:white;border:none;border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;">저장</button>
                        <button onclick="deletePole('${node.id}')" style="flex:1;padding:10px;background:#f44336;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;">삭제</button>
                    </div>
                </div>`;
            modal.style.display = 'flex';
        }

        function savePoleInfo(nodeId) {
            const node = nodes.find(n=>n.id===nodeId); if(!node) return;
            node.memo = '전산화번호: '+document.getElementById('poleNumInput').value.trim();
            node.name = document.getElementById('poleNameInput').value.trim();
            saveData(); closeMenuModal();
            if(markers[nodeId]) markers[nodeId].setMap(null); delete markers[nodeId];
            renderNode(node); updatePoleLabels(); showStatus('저장 완료');
        }

        function changePoleType(nodeId, newType) {
            const node = nodes.find(n=>n.id===nodeId); if(!node) return;
            node.type = newType; saveData(); closeMenuModal();
            if(markers[nodeId]) markers[nodeId].setMap(null); delete markers[nodeId];
            renderNode(node); updatePoleLabels(); showPoleModal(node);
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
            // selectedNode는 유지 (showNodeInfo에서 사용)
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
            map._m.setMapTypeId(
                _isSkyView ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP
            );
            const btn = document.getElementById('skyViewBtn');
            if (btn) {
                btn.classList.toggle('active', _isSkyView);
                btn.querySelector('.tb-label').textContent = _isSkyView ? '지도뷰' : '스카이뷰';
            }
        }
        window.toggleSkyView = toggleSkyView;

        // 전역 노출
        window.initMap = initMap;
