        function showNodeInfoModalForEdit() {
            const typeNames = {
                datacenter: '국사장비',
                junction: '함체',
                onu: 'ONU',
                subscriber: '가입자',
                cctv: 'CCTV'
            };
            const typeIcons = {
                datacenter: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="#1a6fd4" stroke-width="1.8"/><circle cx="10" cy="7" r="1.5" fill="#1a6fd4"/><line x1="6" y1="11" x2="14" y2="11" stroke="#1a6fd4" stroke-width="1.2"/><line x1="6" y1="14" x2="14" y2="14" stroke="#1a6fd4" stroke-width="1.2"/></svg>',
                junction: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><polygon points="10,10 3,5 3,15" fill="#1a6fd4"/><polygon points="10,10 17,5 17,15" fill="#1a6fd4"/><circle cx="10" cy="10" r="8" stroke="#1a6fd4" stroke-width="1.8" fill="none"/></svg>',
                onu: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="16" height="8" rx="2" stroke="#1a6fd4" stroke-width="1.8"/><circle cx="6" cy="10" r="1.5" fill="#1a6fd4"/><line x1="10" y1="8" x2="10" y2="12" stroke="#1a6fd4" stroke-width="1.2"/><line x1="13" y1="8" x2="13" y2="12" stroke="#1a6fd4" stroke-width="1.2"/></svg>',
                subscriber: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6" r="3.5" stroke="#1a6fd4" stroke-width="1.8"/><path d="M3 17c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="#1a6fd4" stroke-width="1.8" fill="none"/></svg>',
                cctv: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="12" height="9" rx="2" stroke="#1a6fd4" stroke-width="1.8"/><path d="M14 8l4-2v7l-4-2" stroke="#1a6fd4" stroke-width="1.8" fill="none"/></svg>'
            };

            var titleEl = document.getElementById('nodeInfoTitle');
            titleEl.innerHTML = (typeIcons[selectedNode.type] || '') + ' ' + (typeNames[selectedNode.type] || '장비') + ' 정보';
            document.getElementById('nodeName').value = selectedNode.name || '';
            document.getElementById('nodeMemo').value = selectedNode.memo || '';

            // ONU일 때 NAME 라벨을 CELL_NAME으로 변경 + placeholder 빈칸
            var nameLabelEl = document.querySelector('#nodeInfoModal .form-group .a-lbl');
            var nameInput = document.getElementById('nodeName');
            if (nameLabelEl) nameLabelEl.textContent = selectedNode.type === 'onu' ? 'Cell_Name' : 'Name';
            if (nameInput) nameInput.placeholder = selectedNode.type === 'onu' ? '' : '장비 이름을 입력하세요';

            // 연결 목록 표시
            const connectionsList = document.getElementById('connectionsList');
            connectionsList.innerHTML = '';

            const nodeConnections = getNodeConns(selectedNode.id);

            if (nodeConnections.length === 0) {
                connectionsList.innerHTML = '<div style="text-align:center;padding:16px 0;color:#94a3b8;font-size:12.5px;">연결된 장비가 없습니다</div>';
            } else {
                const canToggle = selectedNode.type !== 'datacenter' && nodeConnections.length >= 2;

                // outOrder 기반으로 OUT 연결 정렬
                const outConns = getOrderedOutConns(selectedNode, nodeConnections);
                // inOrder 기반으로 IN 연결 정렬 (IN1 고정, IN2...)
                const inConnsRaw = nodeConnections.filter(c => isInConn(c, selectedNode.id));
                const inOrder = selectedNode.inOrder || [];
                const inConns = [
                    ...inOrder.map(id => inConnsRaw.find(c => c.id === id)).filter(Boolean),
                    ...inConnsRaw.filter(c => !inOrder.includes(c.id))
                ];

                // 방향 색상 (블루 컨셉 통일)
                var inColor = '#0d9488';   // teal
                var outBaseColor = '#1a6fd4'; // blue

                // IN 먼저, OUT 순서대로
                [...inConns, ...outConns].forEach(conn => {
                    const otherNodeId = getOtherNodeId(conn, selectedNode.id);
                    const otherNode = nodes.find(n => n.id === otherNodeId);
                    if (!otherNode) return;

                    const isIncoming = isInConn(conn, selectedNode.id);
                    const outIdx = outConns.indexOf(conn);
                    const outNum = outIdx + 1;
                    const inIdx = inConns.indexOf(conn);
                    const inNum = inIdx + 1;

                    const lineColor = isIncoming ? inColor : outLineColors[outIdx % outLineColors.length];
                    const dirLabel  = isIncoming ? `IN${inNum}` : `OUT${outNum}`;

                    const div = document.createElement('div');
                    div.className = 'a-conn-card';
                    div.style.borderLeftColor = lineColor;

                    // 헤더 행
                    const headerRow = document.createElement('div');
                    headerRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

                    const dirBadge = document.createElement('span');
                    dirBadge.style.cssText = 'padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.03em;' +
                        (isIncoming
                            ? 'background:rgba(13,148,136,0.12);color:#0d9488;'
                            : 'background:rgba(26,111,212,0.1);color:#1a6fd4;');
                    dirBadge.textContent = dirLabel;
                    headerRow.appendChild(dirBadge);

                    const nameSpan = document.createElement('span');
                    nameSpan.style.cssText = 'font-size:13px;font-weight:600;color:#1e293b;';
                    nameSpan.textContent = otherNode.name || '이름 없음';
                    headerRow.appendChild(nameSpan);

                    div.appendChild(headerRow);

                    // 액션 버튼 행
                    const actionRow = document.createElement('div');
                    actionRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:6px;flex-wrap:wrap;';

                    var smallBtnBase = 'padding:3px 8px;border:none;border-radius:4px;font-size:10.5px;font-weight:600;cursor:pointer;transition:filter 0.15s;';

                    // IN/OUT 전환 버튼
                    if (canToggle) {
                        if (isIncoming) {
                            if (inIdx === 0) {
                                const fixedBadge = document.createElement('span');
                                fixedBadge.style.cssText = 'padding:3px 8px;background:#f1f5f9;color:#94a3b8;border-radius:4px;font-size:10.5px;font-weight:600;';
                                fixedBadge.textContent = 'IN1 고정';
                                actionRow.appendChild(fixedBadge);
                            } else {
                                const toOutBtn = document.createElement('button');
                                toOutBtn.style.cssText = smallBtnBase + 'background:rgba(26,111,212,0.1);color:#1a6fd4;';
                                toOutBtn.textContent = 'OUT으로 변경';
                                toOutBtn.onmouseover = function(){ this.style.background='rgba(26,111,212,0.18)'; };
                                toOutBtn.onmouseout = function(){ this.style.background='rgba(26,111,212,0.1)'; };
                                toOutBtn.onclick = (e) => { e.stopPropagation(); toggleConnToOut(conn.id); };
                                actionRow.appendChild(toOutBtn);
                            }
                        } else {
                            const toggleBtn = document.createElement('button');
                            toggleBtn.style.cssText = smallBtnBase + 'background:rgba(13,148,136,0.1);color:#0d9488;';
                            toggleBtn.textContent = 'IN으로 변경';
                            toggleBtn.onmouseover = function(){ this.style.background='rgba(13,148,136,0.18)'; };
                            toggleBtn.onmouseout = function(){ this.style.background='rgba(13,148,136,0.1)'; };
                            toggleBtn.onclick = (e) => { e.stopPropagation(); toggleConnDirection(conn.id); };
                            actionRow.appendChild(toggleBtn);
                        }
                    }

                    // OUT 순서 변경 버튼
                    if (!isIncoming && outConns.length >= 2) {
                        const moveUp = document.createElement('button');
                        moveUp.style.cssText = smallBtnBase + 'background:#f1f5f9;color:#475569;padding:3px 6px;';
                        moveUp.textContent = '▲';
                        moveUp.disabled = outIdx === 0;
                        moveUp.style.opacity = outIdx === 0 ? '0.3' : '1';
                        moveUp.onmouseover = function(){ if(!this.disabled) this.style.background='#e2e8f0'; };
                        moveUp.onmouseout = function(){ this.style.background='#f1f5f9'; };
                        moveUp.onclick = (e) => { e.stopPropagation(); moveOutOrder(conn.id, -1); };
                        actionRow.appendChild(moveUp);

                        const moveDown = document.createElement('button');
                        moveDown.style.cssText = smallBtnBase + 'background:#f1f5f9;color:#475569;padding:3px 6px;';
                        moveDown.textContent = '▼';
                        moveDown.disabled = outIdx === outConns.length - 1;
                        moveDown.style.opacity = outIdx === outConns.length - 1 ? '0.3' : '1';
                        moveDown.onmouseover = function(){ if(!this.disabled) this.style.background='#e2e8f0'; };
                        moveDown.onmouseout = function(){ this.style.background='#f1f5f9'; };
                        moveDown.onclick = (e) => { e.stopPropagation(); moveOutOrder(conn.id, +1); };
                        actionRow.appendChild(moveDown);
                    }

                    // OTDR 버튼 (OUT 방향만)
                    if (!isIncoming) {
                        const otdrBtn = document.createElement('button');
                        otdrBtn.style.cssText = smallBtnBase + 'background:rgba(124,58,237,0.1);color:#7c3aed;margin-left:auto;';
                        otdrBtn.textContent = 'OTDR';
                        otdrBtn.onmouseover = function(){ this.style.background='rgba(124,58,237,0.18)'; };
                        otdrBtn.onmouseout = function(){ this.style.background='rgba(124,58,237,0.1)'; };
                        otdrBtn.onclick = (e) => {
                            e.stopPropagation();
                            openOtdrInput(selectedNode, conn, dirLabel, otherNode);
                        };
                        actionRow.appendChild(otdrBtn);
                    }

                    if (actionRow.children.length > 0) div.appendChild(actionRow);

                    // 케이블 총 거리 계산
                    var totalDist = 0;
                    var cPath = [
                        [nodes.find(n=>n.id===connFrom(conn))?.lat, nodes.find(n=>n.id===connFrom(conn))?.lng],
                        ...(conn.waypoints||[]).map(function(wp){return [wp.lat, wp.lng];}),
                        [nodes.find(n=>n.id===connTo(conn))?.lat, nodes.find(n=>n.id===connTo(conn))?.lng]
                    ];
                    for (var di = 0; di < cPath.length - 1; di++) {
                        if (!cPath[di][0] || !cPath[di+1][0]) continue;
                        var dLa = (cPath[di+1][0]-cPath[di][0])*Math.PI/180;
                        var dLo = (cPath[di+1][1]-cPath[di][1])*Math.PI/180;
                        var aa = Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(cPath[di][0]*Math.PI/180)*Math.cos(cPath[di+1][0]*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
                        totalDist += 6371000*2*Math.atan2(Math.sqrt(aa),Math.sqrt(1-aa));
                    }

                    const coreRow = document.createElement('div');
                    coreRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px;';

                    const coreSpan = document.createElement('span');
                    coreSpan.style.cssText = 'font-size:11px;color:#64748b;font-weight:600;letter-spacing:.04em;';
                    coreSpan.textContent = conn.cores + ' CORES';

                    const distSpan = document.createElement('span');
                    distSpan.style.cssText = 'font-size:11px;color:#94a3b8;font-weight:500;';
                    distSpan.textContent = Math.round(totalDist) + 'm';

                    coreRow.appendChild(coreSpan);
                    coreRow.appendChild(distSpan);
                    div.appendChild(coreRow);

                    div.onclick = (e) => {
                        if (['BUTTON','SPAN'].includes(e.target.tagName)) return;
                        map.setView([otherNode.lat, otherNode.lng], 16);
                        selectedNode = otherNode;
                        showNodeInfoModalForEdit();
                    };
                    connectionsList.appendChild(div);
                });
            }

            // 직선도 버튼: IN(전단) + OUT(후단) 둘 다 있을 때만 표시
            const wireMapBtn = document.getElementById('wireMapButtonContainer');
            const hasUpstream = nodeConnections.some(c => isInConn(c, selectedNode.id));
            const hasDownstream = nodeConnections.some(c => isOutConn(c, selectedNode.id));
            if (selectedNode.type !== 'datacenter' && hasUpstream && hasDownstream) {
                wireMapBtn.style.display = 'block';
            } else {
                wireMapBtn.style.display = 'none';
            }

            document.getElementById('nodeInfoModal').classList.add('active');
        }
        
        // 노드 정보 저장
        function saveNodeInfo() {
            selectedNode.name = document.getElementById('nodeName').value;
            selectedNode.memo = document.getElementById('nodeMemo').value;
            
            // 마커 업데이트
            if (markers[selectedNode.id]) {
                map.removeLayer(markers[selectedNode.id]);
                delete markers[selectedNode.id];
                renderNode(selectedNode);
            }
            
            saveData();
            closeNodeInfoModal();
            showStatus('저장되었습니다');
        }
        
        // 커스텀 확인 다이얼로그
        function showConfirm(message, onYes, subMessage, yesLabel) {
            const dialog = document.getElementById('confirmDialog');
            document.getElementById('confirmMessage').textContent = message;
            document.getElementById('confirmSubMessage').textContent = subMessage || '';
            document.getElementById('confirmYesBtn').textContent = yesLabel || '확인';
            dialog.style.display = 'flex';
            document.getElementById('confirmYesBtn').onclick = () => {
                dialog.style.display = 'none';
                onYes();
            };
            document.getElementById('confirmNoBtn').onclick = () => {
                dialog.style.display = 'none';
            };
        }

        // 노드 삭제 시 연결된 downstream 노드의 ports 라벨 초기화 (재귀)
        function clearDownstreamLabels(nodeId, visited) {
            if (!visited) visited = new Set();
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            // 이 노드에서 나가는 연결 → 후단 노드 라벨 초기화 후 재귀
            connections.filter(c => isOutConn(c, nodeId)).forEach(conn => {
                const toNode = nodes.find(n => n.id === connTo(conn));
                if (toNode && toNode.ports) {
                    if (conn.portMapping && conn.portMapping.length > 0) {
                        conn.portMapping.forEach(([, toPort]) => {
                            if (toNode.ports[toPort - 1]) toNode.ports[toPort - 1].label = '';
                        });
                    } else {
                        toNode.ports.forEach(p => { p.label = ''; });
                    }
                    clearDownstreamLabels(toNode.id, visited); // 재귀
                }
            });

            // 이 노드로 들어오는 연결 → 이 노드 자신의 ports 초기화
            connections.filter(c => isInConn(c, nodeId)).forEach(() => {
                const thisNode = nodes.find(n => n.id === nodeId);
                if (thisNode && thisNode.ports) thisNode.ports.forEach(p => { p.label = ''; });
            });
        }

        // 노드 삭제
        function deleteNode() {
            showConfirm(
                `'${selectedNode.name || '이름 없음'}' 장비를 삭제하시겠습니까?`,
                () => {
                    clearDownstreamLabels(selectedNode.id);
                    const connsToRemove = connections.filter(conn =>
                        conn.nodeA === selectedNode.id || conn.nodeB === selectedNode.id
                    );
                    connsToRemove.forEach(conn => {
                        const toNodeId = connTo(conn);
                        const fromNodeId = connFrom(conn);
                        const toNode = nodes.find(n => n.id === toNodeId);
                        if (toNode && toNode.inOrder) toNode.inOrder = toNode.inOrder.filter(id => id !== conn.id);
                        const nA = nodes.find(n => n.id === conn.nodeA);
                        const nB = nodes.find(n => n.id === conn.nodeB);
                        if (nA && nA.connDirections) delete nA.connDirections[conn.id];
                        if (nB && nB.connDirections) delete nB.connDirections[conn.id];
                        const fromNode = nodes.find(n => n.id === fromNodeId);
                        if (fromNode && fromNode.outOrder) fromNode.outOrder = fromNode.outOrder.filter(id => id !== conn.id);
                    });
                    connections = connections.filter(conn =>
                        conn.nodeA !== selectedNode.id && conn.nodeB !== selectedNode.id
                    );
                    if (markers[selectedNode.id]) {
                        map.removeLayer(markers[selectedNode.id]);
                        delete markers[selectedNode.id];
                    }
                    nodes = nodes.filter(n => n.id !== selectedNode.id);
                    saveData();
                    renderAllConnections();
                    closeNodeInfoModal();
                    showStatus('삭제되었습니다');
                },
                '연결된 케이블도 함께 삭제됩니다.',
                '삭제'
            );
        }
        
        // 메뉴에서 바로 장비 삭제
        function deleteNodeFromMenu() {
            if (!selectedNode) {
                showStatus('선택된 장비가 없습니다');
                return;
            }
            showConfirm(
                `'${selectedNode.name || '이름 없음'}' 장비를 삭제하시겠습니까?`,
                () => {
                    clearDownstreamLabels(selectedNode.id);
                    const connsToRemove = connections.filter(conn =>
                        conn.nodeA === selectedNode.id || conn.nodeB === selectedNode.id
                    );
                    connsToRemove.forEach(conn => {
                        const toNodeId = connTo(conn);
                        const fromNodeId = connFrom(conn);
                        const toNode = nodes.find(n => n.id === toNodeId);
                        if (toNode && toNode.inOrder) toNode.inOrder = toNode.inOrder.filter(id => id !== conn.id);
                        const nA = nodes.find(n => n.id === conn.nodeA);
                        const nB = nodes.find(n => n.id === conn.nodeB);
                        if (nA && nA.connDirections) delete nA.connDirections[conn.id];
                        if (nB && nB.connDirections) delete nB.connDirections[conn.id];
                        const fromNode = nodes.find(n => n.id === fromNodeId);
                        if (fromNode && fromNode.outOrder) fromNode.outOrder = fromNode.outOrder.filter(id => id !== conn.id);
                    });
                    connections = connections.filter(conn =>
                        conn.nodeA !== selectedNode.id && conn.nodeB !== selectedNode.id
                    );
                    if (markers[selectedNode.id]) {
                        map.removeLayer(markers[selectedNode.id]);
                        delete markers[selectedNode.id];
                    }
                    nodes = nodes.filter(n => n.id !== selectedNode.id);
                    saveData();
                    renderAllConnections();
                    closeMenuModal();
                    selectedNode = null;
                    showStatus('삭제되었습니다');
                },
                '연결된 케이블도 함께 삭제됩니다.',
                '삭제'
            );
        }
        
        // 노드 정보 모달 닫기
        function closeNodeInfoModal() {
            var modal = document.getElementById('nodeInfoModal');
            modal.classList.remove('active');
            selectedNode = null;
            connectingMode = false; window.connectingMode = false; document.body.classList.remove('connecting-mode');
            connectingFromNode = null;
            connectingToNode = null;
            // 커서 복원
            if (window._setMapCursorMode) window._setMapCursorMode('default');
            else { const mapEl = document.getElementById('map'); if (mapEl) mapEl.style.cursor = ''; }
        }
        
        // 케이블 연결 시작 - 경유점 먼저 찍는 방식
        let pendingWaypoints = [];
        let waypointMarkers = [];
        let previewPolyline = null;
        let snapCircleOverlay = null;
        let snapHighlight = null;
        const SNAP_RADIUS_M = 10;
        // COAX_SNAP_RADIUS_M, _isCoaxDesignConnecting() → cable_map_coax.js로 이동

        function startConnecting() {
            closeMenuModal();
            connectingMode = true; window.connectingMode = true; document.body.classList.add('connecting-mode');
            connectingFromNode = selectedNode;
            pendingWaypoints = [];
            waypointMarkers = [];
            // 커서 변경
            if (window._setMapCursorMode) window._setMapCursorMode('crosshair');
            else { const mapEl = document.getElementById('map'); if (mapEl) mapEl.style.cursor = 'crosshair'; }
            if (_isCoaxDesignConnecting()) {
                showStatus('전주를 클릭하여 케이블 경로를 지정하세요 (Space=일시정지, ESC=취소)');
            } else {
                showStatus('경유점을 찍고 도착 장비를 클릭하세요 (Space=일시정지, ESC=취소)');
            }
            map.off('click', onMapClickForWaypoint);
            map.on('click', onMapClickForWaypoint);
            window._mousemoveHandler = onMapMousemoveForSnap;
            _nEvent.add(map._m, 'mousemove', onMapMousemoveForSnap);
        }

        // 두 좌표 간 거리(m)
        function distanceM(lat1, lng1, lat2, lng2) {
            const R = 6371000;
            const dLat = (lat2-lat1)*Math.PI/180;
            const dLng = (lng2-lng1)*Math.PI/180;
            const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
            return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
        }

        // 반경 내 가장 가까운 전주
        function findNearestPoleR(lat, lng, radius) {
            const off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
            const poles = nodes.filter(n => n.type==='pole'||n.type==='pole_existing'||n.type==='pole_new'||n.type==='pole_removed');
            let best=null, bestDist=Infinity;
            poles.forEach(p => {
                const d = distanceM(lat,lng,p.lat+off.dLat,p.lng+off.dLng);
                if (d<=radius && d<bestDist) { bestDist=d; best=p; }
            });
            return best;
        }
        function findNearestPole(lat, lng) {
            return findNearestPoleR(lat, lng, SNAP_RADIUS_M);
        }

        // 마우스 이동: 스냅 원 표시
        function onMapMousemoveForSnap(me) {
            if (!connectingMode) return;
            const lat=me.coord.lat(), lng=me.coord.lng();
            if (snapCircleOverlay) { snapCircleOverlay.setMap(null); snapCircleOverlay=null; }
            if (snapHighlight) { snapHighlight.setMap(null); snapHighlight=null; }
            var _snapR = _isCoaxDesignConnecting() ? COAX_SNAP_RADIUS_M : SNAP_RADIUS_M;
            const nearPole = findNearestPoleR(lat,lng,_snapR);
            snapCircleOverlay = new naver.maps.Circle({
                map:map._m, center:new naver.maps.LatLng(lat,lng), radius:_snapR,
                strokeWeight:1, strokeColor:nearPole?'#00cc44':'#aaaaaa', strokeOpacity:0.8,
                fillColor:nearPole?'#00cc44':'#cccccc', fillOpacity:0.15
            });
            if (nearPole) {
                var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                snapHighlight = new naver.maps.Circle({
                    map:map._m, center:new naver.maps.LatLng(nearPole.lat+_off.dLat,nearPole.lng+_off.dLng), radius:3,
                    strokeWeight:2, strokeColor:'#00cc44', strokeOpacity:1,
                    fillColor:'#00cc44', fillOpacity:0.8
                });
            }
        }

        // 전주 마커 직접 클릭 시 경유점으로 추가 (map.js onNodeClick에서 호출)
        function addPoleAsWaypoint(node) {
            if (!connectingMode || !connectingFromNode) return;
            // 같은 전주에 이미 경유점이 있으면 무시
            if (pendingWaypoints.some(function(wp) { return wp.snappedPole === node.id; })) {
                showStatus('⚠ 이미 경유된 전주입니다: ' + (node.name || node.id));
                return;
            }
            var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
            var pLat = node.lat + _off.dLat, pLng = node.lng + _off.dLng;
            pendingWaypoints.push({ lat:pLat, lng:pLng, snappedPole:node.id });
            const marker = L.circleMarker([pLat,pLng], {
                radius:5, fillColor:'#00cc44', color:'#fff', weight:2, fillOpacity:1, zIndexOffset:2000
            }).addTo(map);
            waypointMarkers.push(marker);
            updatePreviewLine();
            showStatus('전주 스냅: '+node.name+' | 경유점 '+pendingWaypoints.length+'개');
        }

        const JUNCTION_SNAP_RADIUS_M = 15;

        function findNearestJunction(lat, lng) {
            let best = null, bestDist = Infinity;
            nodes.forEach(function(n) {
                if (n.id === connectingFromNode.id) return;
                var isEquip = n.type === 'junction' || n.type === 'datacenter' || n.type === 'onu'
                    || n.type === 'subscriber' || n.type === 'cctv'
                    || (typeof isCoaxType === 'function' && isCoaxType(n.type));
                if (!isEquip) return;
                const d = distanceM(lat, lng, n.lat, n.lng);
                if (d <= JUNCTION_SNAP_RADIUS_M && d < bestDist) { bestDist = d; best = n; }
            });
            return best;
        }

        // _coaxRouteLabel, _showCoaxRouteLabel(), _clearCoaxRouteLabel() → cable_map_coax.js로 이동

        let _lastWaypointClick = 0;
        function onMapClickForWaypoint(e) {
            if (!connectingMode || !connectingFromNode) return;
            if (window._nodeJustClicked) return;
            const _now = Date.now();
            if (_now - _lastWaypointClick < 300) return;
            _lastWaypointClick = _now;
            let lat = e.latlng.lat, lng = e.latlng.lng;

            // 이전 경유 라벨 제거
            _clearCoaxRouteLabel();

            var isCoaxDesign = _isCoaxDesignConnecting();

            // 근처 함체/장비 감지 → 연결 여부 팝업
            const nearJunction = findNearestJunction(lat, lng);
            if (nearJunction) {
                const jName = nearJunction.name || '이름없음';
                const jTypeLabel = nearJunction.type === 'junction' ? '[함체]'
                    : nearJunction.type === 'datacenter' ? '[국사]'
                    : nearJunction.type === 'onu'        ? '[ONU]'
                    : nearJunction.type === 'subscriber' ? '[가입자]'
                    : nearJunction.type === 'cctv'       ? '[CCTV]'
                    : (typeof isCoaxType === 'function' && isCoaxType(nearJunction.type))
                        ? '[' + (typeof COAX_EQUIP_TYPES !== 'undefined' && COAX_EQUIP_TYPES[nearJunction.type] ? COAX_EQUIP_TYPES[nearJunction.type].label : '동축') + ']'
                    : '';
                showConfirm(
                    `${jTypeLabel} '${jName}'에 연결하시겠습니까?`,
                    function() {
                        connectingToNode = nearJunction;
                        if (pendingWaypoints.length > 0) {
                            const last = pendingWaypoints[pendingWaypoints.length - 1];
                            if (Math.abs(last.lat - nearJunction.lat) < 0.0005 &&
                                Math.abs(last.lng - nearJunction.lng) < 0.0005) {
                                pendingWaypoints.pop();
                            }
                        }
                        _clearCoaxRouteLabel();
                        clearPreviewOnly();
                        showConnectionModal();
                    },
                    '근처에 ' + jName + ' 장비가 있습니다',
                    '연결'
                );
                return;
            }

            // 동축 설계 모드: 전주 필수 경유점
            if (isCoaxDesign) {
                var _snapR = COAX_SNAP_RADIUS_M;
                var nearPole = findNearestPoleR(lat, lng, _snapR);
                if (!nearPole) {
                    showStatus('⚠ 전주를 선택하세요 (전주 근처를 클릭해주세요)');
                    return;
                }
                // 같은 전주에 이미 경유점이 있으면 무시
                if (pendingWaypoints.some(function(wp) { return wp.snappedPole === nearPole.id; })) {
                    showStatus('⚠ 이미 경유된 전주입니다: ' + (nearPole.name || nearPole.id));
                    return;
                }
                pendingWaypoints.push({ lat: lat, lng: lng, snappedPole: nearPole.id });
                var marker = L.circleMarker([lat, lng], {
                    radius: 4, fillColor: '#FF6D00', color: '#fff', weight: 2, fillOpacity: 0.8, zIndexOffset: 2000
                }).addTo(map);
                waypointMarkers.push(marker);
                updatePreviewLine();
                _showCoaxRouteLabel(nearPole.name || nearPole.id, lat, lng);
                showStatus('경유: ' + (nearPole.name || '') + ' | 경유점 ' + pendingWaypoints.length + '개 (Space=일시정지)');
                return;
            }

            // 광 모드: 기존 로직 (전주 스냅 + 자유점)
            var fiberPole = findNearestPole(lat, lng);
            if (fiberPole) {
                // 같은 전주에 이미 경유점이 있으면 무시
                if (pendingWaypoints.some(function(wp) { return wp.snappedPole === fiberPole.id; })) {
                    showStatus('⚠ 이미 경유된 전주입니다: ' + (fiberPole.name || fiberPole.id));
                    return;
                }
                var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                lat = fiberPole.lat + _off.dLat; lng = fiberPole.lng + _off.dLng;
            }
            pendingWaypoints.push({ lat, lng, snappedPole: fiberPole ? fiberPole.id : null });
            var marker = L.circleMarker([lat, lng], {
                radius: fiberPole ? 5 : 3,
                fillColor: fiberPole ? '#00cc44' : '#e67e22',
                color: '#fff', weight: 2, fillOpacity: 1, zIndexOffset: 2000
            }).addTo(map);
            waypointMarkers.push(marker);
            updatePreviewLine();
            showStatus(fiberPole
                ? '전주 스냅: ' + fiberPole.name + ' | 경유점 ' + pendingWaypoints.length + '개 (Space=일시정지)'
                : '경유점 ' + pendingWaypoints.length + '개 (Space=일시정지, ESC=취소)');
        }

        function updatePreviewLine() {
            if (previewPolyline) map.removeLayer(previewPolyline);
            // ONU outPort 오프셋 적용
            let startLat = connectingFromNode.lat, startLng = connectingFromNode.lng;
            if (connectingFromNode.type === 'onu' && window._coaxCurrentOutPort && typeof getOnuPortLatLng === 'function') {
                var portPos = getOnuPortLatLng(connectingFromNode, window._coaxCurrentOutPort);
                startLat = portPos.lat;
                startLng = portPos.lng;
            }
            const path = [
                [startLat, startLng],
                ...pendingWaypoints.map(wp => [wp.lat, wp.lng])
            ];
            if (path.length >= 2) {
                var lineColor = _isCoaxDesignConnecting() ? '#FF6D00' : '#e67e22';
                previewPolyline = L.polyline(path, {
                    color: lineColor, weight: 2, opacity: 0.6, dashArray: '8,6'
                }).addTo(map);
            }
        }

        // 임시 마커/선만 제거 (배열 유지)
        function clearPreviewOnly() {
            waypointMarkers.forEach(m => map.removeLayer(m));
            waypointMarkers = [];
            if (previewPolyline) { map.removeLayer(previewPolyline); previewPolyline = null; }
            if (snapCircleOverlay) { snapCircleOverlay.setMap(null); snapCircleOverlay=null; }
            if (snapHighlight) { snapHighlight.setMap(null); snapHighlight=null; }
            _clearCoaxRouteLabel();
            if(window._mousemoveHandler){_nEvent.remove(map._m,'mousemove',window._mousemoveHandler);window._mousemoveHandler=null;}
            map.off('click', onMapClickForWaypoint);
        }
        // 전체 초기화 (취소 시)
        function clearPendingWaypoints() {
            clearPreviewOnly();
            pendingWaypoints = [];
        }

        // 마지막 경유점 취소 (Ctrl+Z)
        function undoLastWaypoint() {
            if (!connectingMode || pendingWaypoints.length === 0) return;
            pendingWaypoints.pop();
            if (waypointMarkers.length > 0) {
                var last = waypointMarkers.pop();
                map.removeLayer(last);
            }
            updatePreviewLine();
            showStatus('경유점 취소 — 남은 경유점 ' + pendingWaypoints.length + '개 (Ctrl+Z=취소, Space=일시정지)');
        }
        
        // 연결 모달 표시
        function showConnectionModal() {
            // 동축 연결 감지
            const _isCoaxConn = (typeof isCoaxType === 'function') &&
                (isCoaxType(connectingFromNode.type) || isCoaxType(connectingToNode.type));

            // 동축: 컨텍스트 메뉴 스타일로 규격만 선택
            if (_isCoaxConn) {
                _showCoaxCoreMenu();
                return;
            }

            // 광케이블: 기존 모달
            const container = document.getElementById('fiberCoreSelection');
            container.innerHTML = '';
            const titleEl = document.getElementById('connectionModalTitle');
            const labelEl = document.getElementById('coreSelectionLabel');
            if (titleEl) titleEl.textContent = '케이블 연결';
            if (labelEl) labelEl.textContent = '연결할 코어 수를 선택하세요:';
            document.getElementById('lineTypeSelection').style.display = '';
            document.querySelector('#connectionModal p[style*="케이블 종류"]');
            // 케이블 종류 라벨 표시
            var ltLabel = document.getElementById('lineTypeSelection').previousElementSibling;
            if (ltLabel && ltLabel.tagName === 'P') ltLabel.style.display = '';
            document.getElementById('lineTypeSelection').style.display = '';

            var coreOptions = [12, 24, 48, 72, 144, 288, 432];
            coreOptions.forEach(function(cores) {
                var btn = document.createElement('button');
                btn.className = 'fiber-core-btn';
                btn.textContent = cores + '코어';
                btn.dataset.cores = cores;
                btn.onclick = function() {
                    container.querySelectorAll('.fiber-core-btn').forEach(function(b) { b.classList.remove('selected'); });
                    btn.classList.add('selected');
                };
                container.appendChild(btn);
            });

            // lineType 초기화 (신설 기본)
            document.querySelectorAll('#lineTypeSelection .fiber-core-btn').forEach(b => b.classList.remove('selected'));
            var defBtn = document.querySelector('#lineTypeSelection [data-line-type="new"]');
            if (defBtn) defBtn.classList.add('selected');

            document.getElementById('connectionModal').classList.add('active');
        }

        // 동축 케이블 규격 선택 — 컨텍스트 메뉴 스타일
        function _showCoaxCoreMenu() {
            var old = document.getElementById('coaxCoreMenu');
            if (old) old.remove();

            var menu = document.createElement('div');
            menu.id = 'coaxCoreMenu';
            menu.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10010;';
            // 배경 클릭 시 취소
            menu.addEventListener('click', function(e) {
                if (e.target === menu) { menu.remove(); closeConnectionModal(); }
            });

            var box = document.createElement('div');
            box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
                'background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.25);' +
                'padding:10px;display:flex;gap:6px;';

            var options = [
                { label: '12C', value: 12 },
                { label: '7C', value: 7 },
                { label: '5C', value: 5 }
            ];

            options.forEach(function(opt) {
                var btn = document.createElement('button');
                btn.textContent = opt.label;
                btn.style.cssText = 'padding:10px 20px;border:2px solid #1a6fd4;border-radius:8px;' +
                    'background:#fff;color:#1a6fd4;font-size:15px;font-weight:bold;cursor:pointer;' +
                    'transition:all 0.15s;min-width:56px;';
                btn.onmouseover = function() { btn.style.background = '#1a6fd4'; btn.style.color = '#fff'; };
                btn.onmouseout = function() { btn.style.background = '#fff'; btn.style.color = '#1a6fd4'; };
                btn.onclick = function() {
                    menu.remove();
                    _confirmCoaxConnection(opt.value);
                };
                box.appendChild(btn);
            });

            menu.appendChild(box);
            document.body.appendChild(menu);
        }

        // 동축 케이블 연결 확정 (규격 선택 즉시)
        function _confirmCoaxConnection(cores) {
            if (!connectingFromNode || !connectingToNode) {
                showStatus('연결할 장비를 다시 선택해주세요');
                return;
            }

            // IN 중복 체크
            var toNodeInConns = getNodeInConns(connectingToNode.id);
            if (toNodeInConns.length >= 1) {
                var toName = connectingToNode.name || '장비';
                showConfirm(
                    '\'' + toName + '\'에 이미 IN 케이블이 연결되어 있습니다.\n동축 장비는 IN 1개만 가능합니다.',
                    function() {},
                    '다른 장비에 연결하세요.',
                    '확인'
                );
                connectingMode = false; window.connectingMode = false; document.body.classList.remove('connecting-mode');
                connectingFromNode = null; connectingToNode = null;
                clearPreviewOnly(); pendingWaypoints = [];
                return;
            }

            // inOrder / connDirections 설정
            if (!connectingToNode.inOrder) connectingToNode.inOrder = [];
            if (!connectingFromNode.connDirections) connectingFromNode.connDirections = {};
            if (!connectingToNode.connDirections) connectingToNode.connDirections = {};

            var connId = Date.now().toString();
            connectingFromNode.connDirections[connId] = 'out';
            connectingToNode.connDirections[connId] = 'in';

            var fromIndex = nodes.findIndex(function(n) { return n.id === connectingFromNode.id; });
            var toIndex = nodes.findIndex(function(n) { return n.id === connectingToNode.id; });
            if (fromIndex !== -1) nodes[fromIndex] = connectingFromNode;
            if (toIndex !== -1) nodes[toIndex] = connectingToNode;

            var connection = {
                id: connId,
                nodeA: connectingFromNode.id,
                nodeB: connectingToNode.id,
                cores: cores,
                lineType: 'new',
                cableType: 'coax',
                waypoints: [].concat(pendingWaypoints || []),
                portMapping: [],
                inFromCableId: null,
                outPort: window._coaxCurrentOutPort || null
            };

            connectingToNode.inOrder.push(connId);
            var toIdx2 = nodes.findIndex(function(n) { return n.id === connectingToNode.id; });
            if (toIdx2 !== -1) nodes[toIdx2] = connectingToNode;

            connections.push(connection);
            saveData();
            renderAllConnections();

            // ONU 마커 리렌더
            if (connectingFromNode.type === 'onu' && markers[connectingFromNode.id]) {
                map.removeLayer(markers[connectingFromNode.id]);
                delete markers[connectingFromNode.id];
                renderNode(connectingFromNode);
            }

            clearPreviewOnly();
            connectingMode = false; window.connectingMode = false; document.body.classList.remove('connecting-mode');
            connectingFromNode = null; connectingToNode = null;
            selectedNode = null;
            pendingWaypoints = [];
            window._coaxCurrentOutPort = null;
            hideStatus();
            showStatus(cores + 'C 케이블이 연결되었습니다');
        }
        
        // 연결 확인
        function confirmConnection() {
            const selectedBtn = document.querySelector('#fiberCoreSelection .fiber-core-btn.selected');
            if (!selectedBtn) {
                showStatus('케이블 규격을 선택하세요');
                return;
            }
            
            // null 체크 추가
            if (!connectingFromNode || !connectingToNode) {
                showStatus('연결할 장비를 다시 선택해주세요');
                closeConnectionModal();
                return;
            }
            
            const cores = parseInt(selectedBtn.dataset.cores);
            const lineTypeBtn = document.querySelector('#lineTypeSelection .fiber-core-btn.selected');
            const lineType = lineTypeBtn ? lineTypeBtn.dataset.lineType : 'new';
            const _isCoaxConn = selectedBtn.dataset.coax === 'true';

            // 같은 장비 간 기존 연결 확인 (IN2 처리)
            const duplicate = connections.find(c =>
                (c.nodeA === connectingFromNode.id && c.nodeB === connectingToNode.id) ||
                (c.nodeA === connectingToNode.id && c.nodeB === connectingFromNode.id)
            );
            if (duplicate) {
                // toNode 기준으로 IN 개수 확인
                const toNodeInConns = getNodeInConns(connectingToNode.id);
                const fromName = connectingFromNode.name || '장비';
                const toName = connectingToNode.name || '장비';
                const inNum = toNodeInConns.length + 1; // 추가될 IN 번호

                // 동축 장비: IN은 무조건 1개만 허용
                if (_isCoaxConn && toNodeInConns.length >= 1) {
                    closeConnectionModal();
                    showConfirm(
                        `'${toName}'에 이미 IN 케이블이 연결되어 있습니다.\n동축 장비는 IN 1개만 가능합니다.`,
                        () => {},
                        `다른 장비에 연결하세요.`,
                        '확인'
                    );
                    return;
                }

                // 광케이블: IN은 최대 2개까지만 허용
                if (toNodeInConns.length >= 2) {
                    closeConnectionModal();
                    showConfirm(
                        `'${fromName}' → '${toName}'\nIN은 최대 2개까지만 연결 가능합니다.`,
                        () => {},
                        `현재 IN1, IN2가 모두 사용 중입니다.`,
                        '확인'
                    );
                    return;
                }

                // IN2 추가 여부 확인 팝업
                const fn = connectingFromNode; const tn = connectingToNode;
                const cs = cores;
                const wp = [...(pendingWaypoints || [])];
                closeConnectionModal();
                showConfirm(
                    `'${fromName}' → '${toName}'\nIN${inNum}으로 추가 연결하시겠습니까?`,
                    () => {
                        // IN2 연결 생성
                        if (!tn.inOrder) tn.inOrder = [];
                        if (!fn.connDirections) fn.connDirections = {};
                        if (!tn.connDirections) tn.connDirections = {};

                        const newConnId = (Date.now() + 1).toString();
                        const newConn = {
                            id: newConnId,
                            nodeA: fn.id,   // fn이 OUT(송신)측
                            nodeB: tn.id,   // tn이 IN(수신)측
                            cores: cs,
                            cableType: _isCoaxConn ? 'coax' : 'fiber',
                            waypoints: wp,
                            portMapping: [],
                            inFromCableId: null,
                            outPort: _isCoaxConn ? (window._coaxCurrentOutPort || null) : null
                        };
                        // connDirections 설정
                        fn.connDirections[newConnId] = 'out';
                        tn.connDirections[newConnId] = 'in';

                        // inOrder에 추가 (IN1이 없으면 기존 연결도 등록)
                        if (tn.inOrder.length === 0) {
                            tn.inOrder.push(duplicate.id); // 기존 연결이 IN1
                        }
                        tn.inOrder.push(newConnId); // 새 연결이 IN2

                        // 포트 생성
                        if (!fn.ports) fn.ports = [];
                        if (!tn.ports) tn.ports = [];
                        while (fn.ports.length < cs) fn.ports.push({ number: fn.ports.length + 1, label: '' });
                        while (tn.ports.length < cs) tn.ports.push({ number: tn.ports.length + 1, label: '' });

                        const fnIdx = nodes.findIndex(n => n.id === fn.id);
                        const tnIdx = nodes.findIndex(n => n.id === tn.id);
                        if (fnIdx !== -1) nodes[fnIdx] = fn;
                        if (tnIdx !== -1) nodes[tnIdx] = tn;

                        connections.push(newConn);
                        saveData();
                        renderAllConnections();
                        showStatus(`IN${inNum} 케이블이 연결되었습니다`);
                    },
                    `현재 IN${inNum === 2 ? 1 : inNum}이 연결된 상태입니다.`,
                    `IN${inNum} 추가`
                );
                return;
            }

            // 첫 연결 시 inOrder 초기화
            if (!connectingToNode.inOrder) connectingToNode.inOrder = [];
            if (!connectingFromNode.connDirections) connectingFromNode.connDirections = {};
            if (!connectingToNode.connDirections) connectingToNode.connDirections = {};
            
            // 광케이블: 양쪽 장비에 포트 생성 (동축은 포트 불필요)
            if (!_isCoaxConn) {
                if (!connectingFromNode.ports) connectingFromNode.ports = [];
                if (!connectingToNode.ports) connectingToNode.ports = [];
                while (connectingFromNode.ports.length < cores) {
                    connectingFromNode.ports.push({
                        number: connectingFromNode.ports.length + 1,
                        label: ''
                    });
                }
                while (connectingToNode.ports.length < cores) {
                    connectingToNode.ports.push({
                        number: connectingToNode.ports.length + 1,
                        label: ''
                    });
                }
            }
            
            const connId = Date.now().toString();

            // connDirections: connectingFromNode가 OUT, connectingToNode가 IN
            connectingFromNode.connDirections[connId] = 'out';
            connectingToNode.connDirections[connId] = 'in';

            // 노드 배열 업데이트
            const fromIndex = nodes.findIndex(n => n.id === connectingFromNode.id);
            const toIndex = nodes.findIndex(n => n.id === connectingToNode.id);
            if (fromIndex !== -1) nodes[fromIndex] = connectingFromNode;
            if (toIndex !== -1) nodes[toIndex] = connectingToNode;
            
            const connection = {
                id: connId,
                nodeA: connectingFromNode.id,  // OUT(송신)측
                nodeB: connectingToNode.id,    // IN(수신)측
                cores: cores,
                lineType: lineType,
                cableType: _isCoaxConn ? 'coax' : 'fiber',
                waypoints: [...(pendingWaypoints || [])],
                portMapping: [],
                inFromCableId: null,
                outPort: _isCoaxConn ? (window._coaxCurrentOutPort || null) : null
            };
            pendingWaypoints = [];
            
            // 첫 번째 IN 연결이면 inOrder에 등록
            connectingToNode.inOrder.push(connection.id);
            const toIdx2 = nodes.findIndex(n => n.id === connectingToNode.id);
            if (toIdx2 !== -1) nodes[toIdx2] = connectingToNode;

            connections.push(connection);
            saveData();
            renderAllConnections();

            // ONU 마커 리렌더 (포트 사용상태 업데이트)
            if (_isCoaxConn && connectingFromNode && connectingFromNode.type === 'onu' && markers[connectingFromNode.id]) {
                map.removeLayer(markers[connectingFromNode.id]);
                delete markers[connectingFromNode.id];
                renderNode(connectingFromNode);
            }

            // 프리뷰 라인/마커 정리
            clearPreviewOnly();

            // 상태 완전 초기화
            document.getElementById('connectionModal').classList.remove('active');
            connectingMode = false; window.connectingMode = false; document.body.classList.remove('connecting-mode');
            connectingFromNode = null;
            connectingToNode = null;
            selectedNode = null;
            hideStatus();
            if (_isCoaxConn) window._coaxCurrentOutPort = null;
            showStatus('IN1 케이블이 연결되었습니다');
        }
        
        // 연결 모달 닫기
        function closeConnectionModal() {
            document.getElementById('connectionModal').classList.remove('active');
            connectingMode = false; window.connectingMode = false; document.body.classList.remove('connecting-mode');
            connectingFromNode = null;
            connectingToNode = null;
            selectedNode = null;
            hideStatus();
        }
        
        // ── 광케이블 숨김 토글 ──
        var _fiberCablesHidden = false;
        function toggleFiberCables() {
            _fiberCablesHidden = !_fiberCablesHidden;
            var btn = document.getElementById('hideFiberBtn');
            if (btn) {
                btn.classList.toggle('active', _fiberCablesHidden);
                var lbl = btn.querySelector('.tb-label');
                if (lbl) lbl.textContent = _fiberCablesHidden ? '광표시' : '광숨김';
            }
            renderAllConnections();
        }
        window.toggleFiberCables = toggleFiberCables;

        // ── 전주번호 숨김 토글 ──
        var _poleLabelsHidden = false;
        function togglePoleLabels() {
            _poleLabelsHidden = !_poleLabelsHidden;
            window._poleLabelsHidden = _poleLabelsHidden;
            var btn = document.getElementById('hidePoleLabelsBtn');
            if (btn) {
                btn.classList.toggle('active', _poleLabelsHidden);
                var slash = document.getElementById('poleLabelSlash');
                if (slash) slash.setAttribute('display', _poleLabelsHidden ? 'inline' : 'none');
            }
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }
        window.togglePoleLabels = togglePoleLabels;

        // ── 경간 숨김 토글 ──
        var _spanLabelsHidden = false;
        function toggleSpanLabels() {
            _spanLabelsHidden = !_spanLabelsHidden;
            document.body.classList.toggle('hide-span-labels', _spanLabelsHidden);
            var btn = document.getElementById('hideSpanLabelsBtn');
            if (btn) {
                btn.classList.toggle('active', _spanLabelsHidden);
                var slash = document.getElementById('spanLabelSlash');
                if (slash) slash.setAttribute('display', _spanLabelsHidden ? 'inline' : 'none');
            }
        }
        window.toggleSpanLabels = toggleSpanLabels;

        // _coaxHidden, toggleCoaxVisible() → cable_map_coax.js로 이동

        // 연결 렌더링
        // 두 점 사이 수직 오프셋 (lat/lng 단위)
        function perpOffset(lat1, lng1, lat2, lng2, distM) {
            const dx = lng2 - lng1;
            const dy = lat2 - lat1;
            const len = Math.sqrt(dx*dx + dy*dy) || 1;
            const degPerM = 1 / 111320;
            return { dlat: -dx/len * distM * degPerM, dlng: dy/len * distM * degPerM };
        }

        // 경로 전체에 수직 오프셋 적용
        function applyPathOffset(path, offsetM) {
            if (offsetM === 0 || path.length < 2) return path;
            return path.map(function(pt, i) {
                const prev = path[Math.max(0, i-1)];
                const next = path[Math.min(path.length-1, i+1)];
                const off = perpOffset(prev[0],prev[1],next[0],next[1], offsetM);
                return [pt[0]+off.dlat, pt[1]+off.dlng];
            });
        }

        // 전주 경유점 오프셋 (전주 옆으로 살짝 비켜감)
        function applyPoleOffset(path, waypoints) {
            if (!waypoints || waypoints.length === 0) return path;
            const POLE_OFFSET_M = 0; // 전주 중심
            return path.map(function(pt, i) {
                if (i === 0 || i === path.length-1) return pt;
                const wp = waypoints[i-1];
                if (!wp || !wp.snappedPole) return pt;
                const prev = path[i-1];
                const next = path[Math.min(i+1, path.length-1)];
                const off = perpOffset(prev[0],prev[1],next[0],next[1], POLE_OFFSET_M);
                return [pt[0]+off.dlat, pt[1]+off.dlng];
            });
        }

        function renderConnection(connection) {
            // 광케이블 숨김 모드: fiber 케이블 렌더링 스킵
            if (_fiberCablesHidden && connection.cableType !== 'coax') return;
            // 동축 숨김 모드: coax 케이블 렌더링 스킵
            if (_coaxHidden && connection.cableType === 'coax') return;
            // 도면보기 모드: 기설이 아닌 동축 케이블 스킵
            if (typeof coaxIsViewFiltered === 'function' && coaxIsViewFiltered(connection)) return;

            const fromNode = nodes.find(n => n.id === connFrom(connection));
            const toNode = nodes.find(n => n.id === connTo(connection));

            if (!fromNode || !toNode) return;
            
            if (!connection.waypoints) connection.waypoints = [];
            
            // 같은 노드쌍 연결들 중 몇 번째인지 계산 → 평행 오프셋
            const siblingConns = connections.filter(c => {
                const a = connFrom(c), b = connTo(c);
                const fa = connFrom(connection), fb = connTo(connection);
                return (a===fa&&b===fb) || (a===fb&&b===fa);
            });
            const myIndex = siblingConns.findIndex(c => c.id === connection.id);
            const total = siblingConns.length;
            const PARALLEL_OFFSET_M = 4; // 병렬선 간격 4m
            const parallelOffset = total > 1 ? (myIndex - (total-1)/2) * PARALLEL_OFFSET_M : 0;

            // 경로 생성 — ONU outPort 오프셋 적용
            let startLat = fromNode.lat, startLng = fromNode.lng;
            if (fromNode.type === 'onu' && connection.outPort && typeof getOnuPortLatLng === 'function') {
                var portPos = getOnuPortLatLng(fromNode, connection.outPort);
                startLat = portPos.lat;
                startLng = portPos.lng;
            }
            let path = [
                [startLat, startLng],
                ...connection.waypoints.map(wp => [wp.lat, wp.lng]),
                [toNode.lat, toNode.lng]
            ];

            // 전주 경유점 옆으로 오프셋
            path = applyPoleOffset(path, connection.waypoints);

            // 병렬선 오프셋
            if (parallelOffset !== 0) {
                path = applyPathOffset(path, parallelOffset);
            }
            
            // 선 그리기 — 신설/기설, 광/동축 구분
            const isNewCable = (connection.lineType || 'existing') === 'new';
            const isCoaxLine = connection.cableType === 'coax';
            let cableColor;
            if (connection.color) {
                cableColor = connection.color;
            } else if (isCoaxLine) {
                // 동축: 도착(IN)이 amp류면 빨강, 아니면 파랑
                var _toAmp = toNode && typeof COAX_EQUIP_TYPES !== 'undefined' &&
                    COAX_EQUIP_TYPES[toNode.type] && COAX_EQUIP_TYPES[toNode.type].category === 'amp';
                cableColor = _toAmp ? '#e53935' : '#1a6fd4';
            } else {
                cableColor = isNewCable ? '#ff0000' : '#0055ff';
            }
            var _cw = (typeof getStyle === 'function' ? getStyle('coaxWeight') : 2);
            var _ow = (typeof getStyle === 'function' ? getStyle('opticalWeight') : 3);
            var _co = (typeof getStyle === 'function' ? getStyle('cableOpacity') : 0.8);
            const polylineOpts = { color: cableColor, weight: isCoaxLine ? _cw : _ow, opacity: _co };
            if (isNewCable && !isCoaxLine) polylineOpts.dashArray = '10,6';
            const polyline = L.polyline(path, polylineOpts).addTo(map);
            
            // 라벨을 전체 경로의 중간 지점에 표시
            let labelLat, labelLng;
            
            // 전체 경로 길이의 정확한 중간 지점 계산
            let totalLen = 0;
            const segLens = [];
            for (let i = 0; i < path.length - 1; i++) {
                const dx = path[i+1][0] - path[i][0];
                const dy = path[i+1][1] - path[i][1];
                const l = Math.sqrt(dx*dx + dy*dy);
                segLens.push(l);
                totalLen += l;
            }
            const halfLen = totalLen / 2;
            let accLen = 0;
            labelLat = path[0][0];
            labelLng = path[0][1];
            var labelSegIdx = 0;
            for (let i = 0; i < segLens.length; i++) {
                if (accLen + segLens[i] >= halfLen) {
                    const t = (halfLen - accLen) / segLens[i];
                    labelLat = path[i][0] + t * (path[i+1][0] - path[i][0]);
                    labelLng = path[i][1] + t * (path[i+1][1] - path[i][1]);
                    labelSegIdx = i;
                    break;
                }
                accLen += segLens[i];
            }

            // 케이블 방향 각도 계산 (화면 픽셀 기준)
            var lPt1 = map.latLngToLayerPoint({ lat: path[labelSegIdx][0], lng: path[labelSegIdx][1] });
            var lPt2 = map.latLngToLayerPoint({ lat: path[labelSegIdx+1][0], lng: path[labelSegIdx+1][1] });
            var labelAngle = Math.atan2(lPt2.y - lPt1.y, lPt2.x - lPt1.x) * 180 / Math.PI;
            if (labelAngle > 90) labelAngle -= 180;
            if (labelAngle < -90) labelAngle += 180;

            const isCoaxCable = connection.cableType === 'coax';
            const typeLabel = isCoaxCable ? '' : (isNewCable ? '신설 ' : '');
            const coreLabel = isCoaxCable ? connection.cores + 'C' : connection.cores + '코어';
            const labelHTML = `<div class="connection-label" style="color:${cableColor};transform:rotate(${labelAngle.toFixed(1)}deg) translateY(-8px);transform-origin:center center;white-space:nowrap;">${typeLabel}${coreLabel}</div>`;

            const labelIcon = L.divIcon({
                html: labelHTML,
                className: '',
                iconSize: [80, 20],
                iconAnchor: [40, 10]
            });
            
            const label = L.marker([labelLat, labelLng], { 
                icon: labelIcon,
                zIndexOffset: -1000
            }).addTo(map);
            
            // 케이블 클릭 시 정보 패널
            function _onCableClick(e) {
                L.DomEvent.stopPropagation(e);
                if (window._nodeJustClicked) return;
                // 줌 레벨에 따라 동적 THRESHOLD (고배율일수록 더 좁게)
                const zoomLevel = map ? map.getZoom() : 13;
                const THRESHOLD = 0.0003 * Math.pow(2, 13 - zoomLevel);
                const clickLat = e.latlng.lat, clickLng = e.latlng.lng;
                const nearNode = nodes.find(n =>
                    Math.abs(n.lat - clickLat) < THRESHOLD &&
                    Math.abs(n.lng - clickLng) < THRESHOLD
                );
                if (nearNode) { onNodeClick(nearNode); return; }
                const fromNode = nodes.find(n => n.id === connFrom(connection));
                const toNode = nodes.find(n => n.id === connTo(connection));
                const connId = connection.id;
                showCableInfoPanel(connId, fromNode, toNode, connection, e);
            }
            polyline.on('click', _onCableClick);

            polylines.push({ line: polyline, label: label, connId: connection.id, isCoax: !!isCoaxLine });

            // 경간(구간별 거리) 라벨 표시 — 경유점이 있을 때만
            if (path.length > 2) {
                if (!connection.spanDistances) connection.spanDistances = [];
                for (let si = 0; si < path.length - 1; si++) {
                    var sLat1 = path[si][0], sLng1 = path[si][1];
                    var sLat2 = path[si+1][0], sLng2 = path[si+1][1];
                    var dLat = (sLat2 - sLat1) * Math.PI / 180;
                    var dLng = (sLng2 - sLng1) * Math.PI / 180;
                    var sa = Math.sin(dLat/2)*Math.sin(dLat/2) +
                             Math.cos(sLat1*Math.PI/180)*Math.cos(sLat2*Math.PI/180)*
                             Math.sin(dLng/2)*Math.sin(dLng/2);
                    var autoM = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1-sa)));
                    if (autoM < 1 && !connection.spanDistances[si]) continue;
                    var spanM = connection.spanDistances[si] || autoM;
                    var isCustom = !!connection.spanDistances[si];
                    var sMidLat = (sLat1 + sLat2) / 2;
                    var sMidLng = (sLng1 + sLng2) / 2;
                    // 케이블 방향 각도 계산 (화면 픽셀 기준)
                    var pt1 = map.latLngToLayerPoint({ lat: sLat1, lng: sLng1 });
                    var pt2 = map.latLngToLayerPoint({ lat: sLat2, lng: sLng2 });
                    var angleDeg = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * 180 / Math.PI;
                    // 글씨가 뒤집히지 않게 -90~90 범위로 보정
                    if (angleDeg > 90) angleDeg -= 180;
                    if (angleDeg < -90) angleDeg += 180;
                    var _sls = (typeof getStyle === 'function' ? getStyle('spanLabelSize') : 10);
                    var spanStyle = 'color:' + cableColor + ';font-size:' + _sls + 'px;transform:rotate(' + angleDeg.toFixed(1) + 'deg) translateY(8px);transform-origin:center center;cursor:pointer;'
                        + (isCustom ? 'font-weight:bold;' : '');
                    var spanIcon = L.divIcon({
                        html: '<div class="span-label" style="' + spanStyle + '" data-conn-id="' + connection.id + '" data-seg-idx="' + si + '" data-auto="' + autoM + '">' + spanM + 'm</div>',
                        className: '',
                        iconSize: [50, 16],
                        iconAnchor: [25, 8]
                    });
                    var spanMarker = L.marker([sMidLat, sMidLng], {
                        icon: spanIcon,
                        zIndexOffset: 3000
                    }).addTo(map);
                    // 클릭 → 인라인 입력
                    (function(conn, segIdx, autoVal, marker, midLat, midLng, angle, color) {
                        spanMarker.on('click', function() {
                            // 기존 인라인 input 제거
                            var old = document.getElementById('spanInlineInput');
                            if (old) old.remove();
                            var container = map.getContainer();
                            var pt = map.latLngToLayerPoint({ lat: midLat, lng: midLng });
                            var inp = document.createElement('input');
                            inp.id = 'spanInlineInput';
                            inp.type = 'number';
                            inp.placeholder = autoVal + '';
                            inp.value = conn.spanDistances[segIdx] || '';
                            inp.style.cssText = 'position:absolute;left:' + (pt.x - 30) + 'px;top:' + (pt.y - 12) + 'px;width:60px;height:24px;z-index:99999;'
                                + 'text-align:center;font-size:12px;border:2px solid ' + color + ';border-radius:4px;outline:none;background:#fff;';
                            container.appendChild(inp);
                            inp.focus();
                            inp.select();
                            var _finished = false;
                            function finish() {
                                if (_finished) return;
                                _finished = true;
                                var v = parseInt(inp.value);
                                if (inp.value === '' || isNaN(v)) {
                                    conn.spanDistances[segIdx] = null;
                                } else {
                                    conn.spanDistances[segIdx] = v;
                                }
                                inp.remove();
                                saveData();
                                renderAllConnections();
                            }
                            inp.addEventListener('keydown', function(e) {
                                if (e.key === 'Enter') { e.preventDefault(); finish(); }
                                if (e.key === 'Escape') { _finished = true; inp.remove(); }
                            });
                            inp.addEventListener('blur', finish);
                        });
                    })(connection, si, autoM, spanMarker, sMidLat, sMidLng, angleDeg, cableColor);
                    polylines.push({ marker: spanMarker, connId: connection.id });
                }
            }

        }
        
        // 케이블 삭제
        function deleteConnection(connectionId) {
            const conn = connections.find(c => c.id === connectionId);
            var toNodeId = conn ? connTo(conn) : null;
            var fromNodeId = conn ? connFrom(conn) : null;
            if (conn) {

                // toNode 포트 초기화 + 하위 노드 연쇄 초기화
                const toNode = nodes.find(n => n.id === toNodeId);
                if (toNode && toNode.ports) toNode.ports.forEach(p => { p.label = ''; });
                clearDownstreamLabels(toNodeId, new Set([fromNodeId]));

                // toNode의 inOrder에서 해당 케이블 ID 제거
                if (toNode && toNode.inOrder) {
                    toNode.inOrder = toNode.inOrder.filter(id => id !== connectionId);
                }

                // connDirections 정리 (양쪽 노드)
                const nA = nodes.find(n => n.id === conn.nodeA);
                const nB = nodes.find(n => n.id === conn.nodeB);
                if (nA && nA.connDirections) delete nA.connDirections[connectionId];
                if (nB && nB.connDirections) delete nB.connDirections[connectionId];

                // fromNode의 outOrder에서 해당 케이블 ID 제거
                const fromNode = nodes.find(n => n.id === fromNodeId);
                if (fromNode && fromNode.outOrder) {
                    fromNode.outOrder = fromNode.outOrder.filter(id => id !== connectionId);
                }
                if (fromNode && fromNode.ofds) {
                    fromNode.ofds.forEach(ofd => {
                        if (ofd.connectedCable === connectionId) {
                            ofd.connectedCable = null;
                            ofd.cableMapping = [];
                        }
                    });
                }
            }
            // 동축 케이블 삭제 시: 도착 장비가 동축 장비이고 다른 연결이 없으면 함께 삭제
            if (conn && conn.cableType === 'coax' && toNodeId) {
                var toNd = nodes.find(function(n) { return n.id === toNodeId; });
                if (toNd && typeof isCoaxType === 'function' && isCoaxType(toNd.type)) {
                    // 이 장비에 연결된 다른 케이블이 있는지 확인
                    var otherConns = connections.filter(function(c) {
                        return c.id !== connectionId && (c.nodeA === toNodeId || c.nodeB === toNodeId);
                    });
                    if (otherConns.length === 0) {
                        // 마커 제거
                        if (markers[toNodeId]) {
                            map.removeLayer(markers[toNodeId]);
                            delete markers[toNodeId];
                        }
                        nodes = nodes.filter(function(n) { return n.id !== toNodeId; });
                    }
                }
            }

            // ONU 마커 리렌더 (포트 사용상태 업데이트)
            if (conn && conn.outPort && fromNodeId) {
                var onuNd = nodes.find(function(n) { return n.id === fromNodeId; });
                if (onuNd && onuNd.type === 'onu' && markers[fromNodeId]) {
                    map.removeLayer(markers[fromNodeId]);
                    delete markers[fromNodeId];
                    renderNode(onuNd);
                }
            }

            connections = connections.filter(c => c.id !== connectionId);
            saveData();
            renderAllConnections();
            showStatus('케이블이 삭제되었습니다');
        }

        // ==================== 경유점 추가 모드 ====================
        let _waypointInsertConn = null;
        let _waypointInsertPath = null;
        let _waypointMapClickHandler = null;
        let _waypointClickListener = null;

        function startWaypointInsertModeById(connId) {
            const conn = connections.find(c => c.id === connId);
            if (!conn) return;
            if (!conn.waypoints) conn.waypoints = [];
            const fromNode = nodes.find(n => n.id === connFrom(conn));
            const toNode = nodes.find(n => n.id === connTo(conn));
            const path = [
                [fromNode.lat, fromNode.lng],
                ...conn.waypoints.map(wp => [wp.lat, wp.lng]),
                [toNode.lat, toNode.lng]
            ];
            startWaypointInsertMode(conn, path);
        }

        function startWaypointInsertMode(connection, path) {
            _waypointInsertConn = connection;
            _waypointInsertPath = path;
            showStatus('📍 경유점 추가 모드 — 지도에서 추가할 위치를 클릭하세요 (ESC=취소)');
            if (window._setMapCursorMode) window._setMapCursorMode('crosshair');
            else document.body.style.cursor = 'crosshair';

            // 기존 핸들러 제거 후 새 등록
            if (_waypointMapClickHandler) {
                if(_waypointClickListener){_nEvent.remove(map._m,'click',_waypointClickListener);_waypointClickListener=null;}
            }
            _waypointMapClickHandler = function(mouseEvent) {
                const latlng = { lat: mouseEvent.coord.lat(), lng: mouseEvent.coord.lng() };
                // 가장 가까운 구간 찾기
                let minDist = Infinity, insertIndex = 0;
                for (let i = 0; i < _waypointInsertPath.length - 1; i++) {
                    const p1 = L.latLng(_waypointInsertPath[i][0], _waypointInsertPath[i][1]);
                    const p2 = L.latLng(_waypointInsertPath[i + 1][0], _waypointInsertPath[i + 1][1]);
                    const d = L.LineUtil.pointToSegmentDistance(
                        map.latLngToLayerPoint(L.latLng(latlng.lat, latlng.lng)),
                        map.latLngToLayerPoint(p1),
                        map.latLngToLayerPoint(p2)
                    );
                    if (d < minDist) { minDist = d; insertIndex = i; }
                }
                _waypointInsertConn.waypoints.splice(insertIndex, 0, latlng);
                saveData();
                renderAllConnections();
                cancelWaypointInsertMode();
                showStatus('📍 경유점이 추가되었습니다');
            };
            _nEvent.add(map._m, 'click', _waypointMapClickHandler);
            _waypointClickListener = _waypointMapClickHandler;
        }

        function cancelWaypointInsertMode() {
            if (_waypointMapClickHandler) {
                if(_waypointClickListener){_nEvent.remove(map._m,'click',_waypointClickListener);_waypointClickListener=null;}
                _waypointMapClickHandler = null;
            }
            _waypointInsertConn = null;
            _waypointInsertPath = null;
            if (window._setMapCursorMode) window._setMapCursorMode('default');
            else document.body.style.cursor = '';
        }

        // ESC 키로 경유점 모드 취소
        document.addEventListener('keydown', function(e) {
            if ((e.key === 'Escape' || e.keyCode === 27) && _waypointInsertConn) {
                cancelWaypointInsertMode();
                showStatus('경유점 추가 취소');
            }
        });

        // ==================== 경유점 추가 모드 끝 ====================

        // ==================== 전체 저장 + 라벨 재계산 ====================
        function saveAllWithRecalc() {
            // 최상류 노드(IN 연결 없는 노드)부터 cascadeLabels 전파
            const visited = new Set();
            const rootNodes = nodes.filter(n =>
                !connections.some(c => isInConn(c, n.id))
            );
            rootNodes.forEach(n => cascadeLabels(n.id, visited));
            saveData();
            showStatus('💾 저장 완료 — 전체 라벨이 갱신되었습니다');
        }

        // 모든 연결 렌더링
        // 경유점 마커 표시/숨김
        function showWaypointMarkers(connId) {
            polylines.forEach(function(item) {
                if (!item.marker) return;
                if (item.connId === connId) {
                    // HtmlOverlay의 엘리먼트 직접 조작
                    if (item.marker._ov && item.marker._ov._el) {
                        item.marker._ov._el.style.opacity = '1';
                        item.marker._ov._el.style.pointerEvents = 'all';
                    }
                } else {
                    if (item.marker._ov && item.marker._ov._el) {
                        item.marker._ov._el.style.opacity = '0';
                        item.marker._ov._el.style.pointerEvents = 'none';
                    }
                }
            });
        }
        function hideAllWaypointMarkers() {
            polylines.forEach(function(item) {
                if (!item.marker) return;
                if (item.marker._ov && item.marker._ov._el) {
                    item.marker._ov._el.style.opacity = '0';
                    item.marker._ov._el.style.pointerEvents = 'none';
                }
            });
        }
        window.hideAllWaypointMarkers = hideAllWaypointMarkers;

        function renderAllConnections() {
            // 기존 폴리라인 삭제
            polylines.forEach(item => {
                if (item.line) map.removeLayer(item.line);
                if (item.label) map.removeLayer(item.label);
                if (item.marker) map.removeLayer(item.marker);
            });
            polylines = [];
            
            // 새로 렌더링
            connections.forEach(connection => {
                renderConnection(connection);
            });
        }
        
        // 상태 메시지 표시
        function showStatus(message) {
            const statusEl = document.getElementById('statusMessage');
            statusEl.textContent = message;
            statusEl.classList.add('active');
            
            setTimeout(() => {
                hideStatus();
            }, 5000);
        }
        
        // 상태 메시지 숨기기
        function hideStatus() {
            document.getElementById('statusMessage').classList.remove('active');
        }
        
        // Waypoint 드래그 시작
        function startDraggingWaypoint(connectionId, waypointIndex) {
            // 모든 팝업 닫기
            map.closePopup();
            
            draggingWaypoint = true;
            draggingConnection = connectionId;
            draggingIndex = waypointIndex;
            
            showStatus('지도를 클릭하여 점을 이동하세요');
            
            // 지도 클릭 이벤트 추가
            map.once('click', function(e) {
                const connection = connections.find(c => c.id === connectionId);
                if (connection && connection.waypoints[waypointIndex]) {
                    connection.waypoints[waypointIndex] = {
                        lat: e.latlng.lat,
                        lng: e.latlng.lng
                    };
                    saveData();
                    renderAllConnections();
                    showStatus('점이 이동되었습니다');
                }
                
                draggingWaypoint = false;
                draggingConnection = null;
                draggingIndex = null;
            });
        }
        
        // Waypoint 삭제
        function deleteWaypoint(connectionId, waypointIndex) {
            const connection = connections.find(c => c.id === connectionId);
            if (connection) {
                connection.waypoints.splice(waypointIndex, 1);
                saveData();
                renderAllConnections();
                showStatus('점이 삭제되었습니다');
            }
        }
        
        // 장비 이동 시작
        function startMovingNode() {
            closeMenuModal();
            movingNodeMode = true;
            movingNode = selectedNode;
            var _isCoaxMoving = typeof isCoaxType === 'function' && isCoaxType(movingNode.type);
            var _moveSnapCircle = null;
            var _moveSnapHighlight = null;
            var _moveSnapR = _isCoaxMoving ? COAX_SNAP_RADIUS_M : 15;

            showStatus(_isCoaxMoving
                ? '전주 근처를 클릭하여 장비를 이동하세요 (ESC=취소)'
                : '지도를 클릭하여 장비를 이동하세요');

            // 동축 장비: 마우스 이동 시 스냅 원 표시
            function _onMoveMousemove(me) {
                var lat = me.coord.lat(), lng = me.coord.lng();
                if (_moveSnapCircle) { _moveSnapCircle.setMap(null); _moveSnapCircle = null; }
                if (_moveSnapHighlight) { _moveSnapHighlight.setMap(null); _moveSnapHighlight = null; }
                if (!_isCoaxMoving) return;
                var nearPole = findNearestPoleR(lat, lng, _moveSnapR);
                _moveSnapCircle = new naver.maps.Circle({
                    map: map._m, center: new naver.maps.LatLng(lat, lng), radius: _moveSnapR,
                    strokeWeight: 1, strokeColor: nearPole ? '#00cc44' : '#aaaaaa', strokeOpacity: 0.8,
                    fillColor: nearPole ? '#00cc44' : '#cccccc', fillOpacity: 0.15
                });
                if (nearPole) {
                    var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                    _moveSnapHighlight = new naver.maps.Circle({
                        map: map._m,
                        center: new naver.maps.LatLng(nearPole.lat + _off.dLat, nearPole.lng + _off.dLng),
                        radius: 3,
                        strokeWeight: 2, strokeColor: '#00cc44', strokeOpacity: 1,
                        fillColor: '#00cc44', fillOpacity: 0.5
                    });
                }
            }

            function _cleanupMoveSnap() {
                if (_moveSnapCircle) { _moveSnapCircle.setMap(null); _moveSnapCircle = null; }
                if (_moveSnapHighlight) { _moveSnapHighlight.setMap(null); _moveSnapHighlight = null; }
                _nEvent.remove(map._m, 'mousemove', _onMoveMousemove);
            }

            if (_isCoaxMoving) {
                _nEvent.add(map._m, 'mousemove', _onMoveMousemove);
            }

            // 지도 클릭 이벤트 추가
            map.once('click', function(e) {
                _cleanupMoveSnap();

                if (movingNode) {
                    var clickLat = e.latlng.lat, clickLng = e.latlng.lng;

                    // 동축 장비: 전주 근처만 이동 허용
                    if (_isCoaxMoving) {
                        var newPole = findNearestPoleR(clickLat, clickLng, _moveSnapR);
                        if (!newPole) {
                            showStatus('⚠ 전주 근처를 클릭해주세요');
                            movingNodeMode = false;
                            movingNode = null;
                            return;
                        }
                        movingNode.lat = clickLat;
                        movingNode.lng = clickLng;
                        movingNode.snappedPoleId = newPole.id;
                    } else {
                        movingNode.lat = clickLat;
                        movingNode.lng = clickLng;
                    }

                    // 노드 배열에서도 업데이트
                    const index = nodes.findIndex(n => n.id === movingNode.id);
                    if (index !== -1) {
                        nodes[index] = movingNode;
                    }

                    // 마커 다시 그리기
                    if (markers[movingNode.id]) {
                        map.removeLayer(markers[movingNode.id]);
                        delete markers[movingNode.id];
                    }
                    renderNode(movingNode);

                    // 연결선도 다시 그리기
                    renderAllConnections();

                    saveData();
                    showStatus('장비가 이동되었습니다');
                }

                movingNodeMode = false;
                movingNode = null;
            });
        }
        
        // ==================== OFD 관련 함수 ====================
        
        // OFD 모달 표시
        function showOFDModal() {
            closeMenuModal();
            
            // OFD 배열 초기화
            if (!selectedNode.ofds) {
                selectedNode.ofds = [];
            }
            
            // OFD 목록 렌더링
            renderOFDList();
            
            document.getElementById('ofdModal').classList.add('active');
        }
        
        // OFD 목록 렌더링
        // 전주 데이터 Excel 추출
        async function exportPoleData(connId) {
            const conn = connections.find(c => c.id === connId);
            if (!conn) return;

            const fromNode = nodes.find(n => n.id === connFrom(conn));
            const toNode   = nodes.find(n => n.id === connTo(conn));
            const off = window._polePreviewOffset || { dLat: 0, dLng: 0 };

            // 경유점의 snappedPole ID 중 nodes에 없는 것을 IDB에서 로드
            var snappedIds = (conn.waypoints || [])
                .filter(function(wp) { return wp.snappedPole; })
                .map(function(wp) { return wp.snappedPole; });
            var missingIds = snappedIds.filter(function(id) {
                return !nodes.find(function(n) { return n.id === id; });
            });
            var extraPoles = [];
            if (missingIds.length > 0) {
                extraPoles = await loadPolesByIds(missingIds);
            }
            // 양 끝 장비 주변 전주도 IDB에서 로드 (뷰포트 밖 대응, 약 50m 범위)
            var margin = 0.0005; // ~50m
            for (var ei = 0; ei < 2; ei++) {
                var eq = ei === 0 ? fromNode : toNode;
                if (!eq) continue;
                var nearby = await loadPolesInBounds({
                    minLat: eq.lat - margin, maxLat: eq.lat + margin,
                    minLng: eq.lng - margin, maxLng: eq.lng + margin
                });
                extraPoles = extraPoles.concat(nearby);
            }
            // 메모리 노드 + IDB에서 가져온 전주를 합친 검색 풀 (중복 제거)
            var seenIds = new Set();
            var allPoles = [];
            nodes.concat(extraPoles).forEach(function(n) {
                if (!seenIds.has(n.id)) { seenIds.add(n.id); allPoles.push(n); }
            });

            // 장비 근처 전주 찾기 (30m 이내 — 오프셋 유무 모두 검색)
            function findEquipPole(eq) {
                if (!eq) return null;
                var best = null, bestD = Infinity;
                allPoles.forEach(function(n) {
                    if (!isPoleType(n.type)) return;
                    var dlat1 = (n.lat + off.dLat - eq.lat) * 111000;
                    var dlng1 = (n.lng + off.dLng - eq.lng) * 111000 * Math.cos(eq.lat * Math.PI / 180);
                    var d1 = dlat1 * dlat1 + dlng1 * dlng1;
                    var dlat2 = (n.lat - eq.lat) * 111000;
                    var dlng2 = (n.lng - eq.lng) * 111000 * Math.cos(eq.lat * Math.PI / 180);
                    var d2 = dlat2 * dlat2 + dlng2 * dlng2;
                    var d = Math.min(d1, d2);
                    if (d < 900 && d < bestD) { bestD = d; best = n; }
                });
                return best;
            }

            // 전주 목록 구성: 시작 전주 → 경유 전주 → 끝 전주
            var poleList = [];
            var startPole = findEquipPole(fromNode);
            if (startPole) poleList.push(startPole);
            (conn.waypoints || []).forEach(function(wp) {
                if (!wp.snappedPole) return;
                var node = allPoles.find(function(n) { return n.id === wp.snappedPole; });
                if (!node) return;
                if (poleList.length && poleList[poleList.length - 1].id === node.id) return;
                poleList.push(node);
            });
            var endPole = findEquipPole(toNode);
            if (endPole && (!poleList.length || poleList[poleList.length - 1].id !== endPole.id)) {
                poleList.push(endPole);
            }

            if (poleList.length === 0) {
                alert('이 케이블에 스냅된 전주가 없습니다.\n전주를 찍으면서 케이블을 연결했는지 확인하세요.');
                return;
            }

            // 전주 파싱 + 경간 계산
            const rows = [];
            for (var i = 0; i < poleList.length; i++) {
                var node = poleList[i];
                // 전산화번호 파싱
                var rawNum = (node.memo || '')
                    .replace('자가주:true', '')
                    .replace('전산화번호: ', '')
                    .trim();
                var m1 = rawNum.match(/^(.{5})(\d{3})$/);
                var 관리구 = m1 ? m1[1] : rawNum;
                var 전산번호 = m1 ? m1[2] : '';
                // 전주번호 파싱
                var poleName = node.name || '';
                var m2 = poleName.match(/^(.+?)-(\d{1,4})$/);
                var 간선명 = m2 ? m2[1] : poleName;
                var 전주번호 = m2 ? m2[2] : '';
                // 경간 계산 (이전 전주와의 거리)
                var 경간 = '';
                if (i > 0) {
                    var prev = poleList[i - 1];
                    var dLat = (node.lat - prev.lat) * Math.PI / 180;
                    var dLng = (node.lng - prev.lng) * Math.PI / 180;
                    var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
                            Math.cos(prev.lat*Math.PI/180)*Math.cos(node.lat*Math.PI/180)*
                            Math.sin(dLng/2)*Math.sin(dLng/2);
                    경간 = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
                }
                var 자가주 = (node.memo || '').indexOf('자가주:true') !== -1 ? '자가주' : '';
                rows.push([관리구, 전산번호, 간선명, 전주번호, 경간, 자가주]);
            }

            // SheetJS로 Excel 생성
            const wsData = [['관리구', '번호', '간선명', '번호', '경간(m)', '자가주']].concat(rows);
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = [{ wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 6 }, { wch: 8 }, { wch: 6 }];

            const wb = XLSX.utils.book_new();
            const sheetName = ((fromNode?.name || 'A') + '_' + (toNode?.name || 'B')).slice(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, '전주_' + sheetName + '.xlsx');
        }

        // ==================== 공가 신청서 생성 (로직은 cable_map_gongga.js) ====================
        async function generateApplication(connId) {
            const conn = connections.find(c => c.id === connId);
            if (!conn) return;
            const fromNode = nodes.find(n => n.id === connFrom(conn));
            const toNode   = nodes.find(n => n.id === connTo(conn));
            const off = window._polePreviewOffset || { dLat: 0, dLng: 0 };

            // 전주 로딩 (스냅 누락분 + 장비 인근)
            var snappedIds = (conn.waypoints || [])
                .filter(wp => wp.snappedPole).map(wp => wp.snappedPole);
            var missingIds = snappedIds.filter(id => !nodes.find(n => n.id === id));
            var extraPoles = [];
            if (missingIds.length > 0) extraPoles = await loadPolesByIds(missingIds);
            var margin = 0.0005;
            for (var ei = 0; ei < 2; ei++) {
                var eq = ei === 0 ? fromNode : toNode;
                if (!eq) continue;
                var nearby = await loadPolesInBounds({
                    minLat: eq.lat - margin, maxLat: eq.lat + margin,
                    minLng: eq.lng - margin, maxLng: eq.lng + margin
                });
                extraPoles = extraPoles.concat(nearby);
            }
            var seenIds = new Set();
            var allPoles = [];
            nodes.concat(extraPoles).forEach(n => { if (!seenIds.has(n.id)) { seenIds.add(n.id); allPoles.push(n); } });

            function findEquipPole(eq) {
                if (!eq) return null;
                var best = null, bestD = Infinity;
                allPoles.forEach(n => {
                    if (!isPoleType(n.type)) return;
                    var dlat1 = (n.lat + off.dLat - eq.lat) * 111000;
                    var dlng1 = (n.lng + off.dLng - eq.lng) * 111000 * Math.cos(eq.lat * Math.PI / 180);
                    var d1 = dlat1 * dlat1 + dlng1 * dlng1;
                    var dlat2 = (n.lat - eq.lat) * 111000;
                    var dlng2 = (n.lng - eq.lng) * 111000 * Math.cos(eq.lat * Math.PI / 180);
                    var d2 = dlat2 * dlat2 + dlng2 * dlng2;
                    var d = Math.min(d1, d2);
                    if (d < 900 && d < bestD) { bestD = d; best = n; }
                });
                return best;
            }

            // 전주 목록 구성
            var poleList = [];
            var startPole = findEquipPole(fromNode);
            if (startPole) poleList.push(startPole);
            (conn.waypoints || []).forEach(wp => {
                if (!wp.snappedPole) return;
                var node = allPoles.find(n => n.id === wp.snappedPole);
                if (!node) return;
                if (poleList.length && poleList[poleList.length - 1].id === node.id) return;
                poleList.push(node);
            });
            var endPole = findEquipPole(toNode);
            if (endPole && (!poleList.length || poleList[poleList.length - 1].id !== endPole.id)) {
                poleList.push(endPole);
            }
            if (poleList.length === 0) {
                alert('이 케이블에 스냅된 전주가 없습니다.');
                return;
            }

            // 전주별 장비 매핑 (근접 30m 이내)
            var equipNodes = nodes.filter(n => !isPoleType(n.type) && n.type !== 'datacenter' && n.type !== 'subscriber');
            var equipByPoleId = {};
            poleList.forEach(pole => {
                var nearby = [];
                equipNodes.forEach(eq => {
                    var dlat = (eq.lat - pole.lat) * 111000;
                    var dlng = (eq.lng - pole.lng) * 111000 * Math.cos(pole.lat * Math.PI / 180);
                    var d2 = dlat * dlat + dlng * dlng;
                    if (off.dLat || off.dLng) {
                        var dlat2 = (eq.lat - (pole.lat + off.dLat)) * 111000;
                        var dlng2 = (eq.lng - (pole.lng + off.dLng)) * 111000 * Math.cos(pole.lat * Math.PI / 180);
                        d2 = Math.min(d2, dlat2 * dlat2 + dlng2 * dlng2);
                    }
                    if (d2 < 100) nearby.push(eq); // 10m 반경
                });
                if (nearby.length > 0) equipByPoleId[pole.id] = nearby;
            });

            // gongga.js로 위임
            var poles = gonggaParsePoles(poleList, { cores: conn.cores, lineType: conn.lineType, equipByPoleId: equipByPoleId });
            gonggaLoadInvs(function(invsData) {
                gonggaBuildApplication(poles, invsData, fromNode, toNode);
            });
        }

        // ── 케이블 경유 전주 라벨 일괄 조정 (전주선택 패널 재사용) ──
        function openCablePoleLabelBatch(connId) {
            var conn = connections.find(function(c) { return c.id === connId; });
            if (!conn) return;
            var poleIds = new Set();
            if (conn.waypoints) conn.waypoints.forEach(function(wp) { if (wp.snappedPole) poleIds.add(wp.snappedPole); });
            [connFrom(conn), connTo(conn)].forEach(function(eqId) {
                var eq = nodes.find(function(n) { return n.id === eqId; });
                if (!eq) return;
                var best = null, bestD = Infinity;
                nodes.forEach(function(n) {
                    if (!isPoleType(n.type)) return;
                    var dlat = (n.lat - eq.lat) * 111000;
                    var dlng = (n.lng - eq.lng) * 111000 * Math.cos(eq.lat * Math.PI / 180);
                    var d = dlat * dlat + dlng * dlng;
                    if (d < 100 && d < bestD) { bestD = d; best = n; }
                });
                if (best) poleIds.add(best.id);
            });
            var poles = nodes.filter(function(n) { return poleIds.has(n.id); });
            if (poles.length === 0) { showStatus('케이블에 연결된 전주가 없습니다'); return; }
            // 전주선택 시스템에 전주 전달 후 패널 표시
            showPoleSelectPanel(poles);
        }

        // ==================== 케이블 정보 패널 ====================
        // 동축 케이블 컨텍스트 메뉴 (규격 + 삭제)
        function _showCoaxCableMenu(connId, connection, e) {
            var old = document.getElementById('coaxCableCtxMenu');
            if (old) old.remove();

            var cores = connection.cores;
            var coreOptions = [12, 7, 5];

            var wrap = document.createElement('div');
            wrap.id = 'coaxCableCtxMenu';
            wrap.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10010;';
            wrap.addEventListener('click', function(ev) { if (ev.target === wrap) wrap.remove(); });

            var mapRect = document.getElementById('map').getBoundingClientRect();
            var clickPt = map.latLngToLayerPoint(e.latlng);
            var px = mapRect.left + clickPt.x + 10;
            var py = mapRect.top + clickPt.y - 10;

            var box = document.createElement('div');
            box.style.cssText = 'position:absolute;left:' + px + 'px;top:' + py + 'px;' +
                'background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.25);' +
                'padding:8px;min-width:160px;';

            // 헤더
            var header = document.createElement('div');
            header.style.cssText = 'font-size:11px;color:#888;padding:2px 6px 6px;font-weight:600;';
            header.textContent = '케이블 규격';
            box.appendChild(header);

            // 규격 버튼들
            var btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:4px;padding:0 4px 6px;';
            coreOptions.forEach(function(c) {
                var btn = document.createElement('button');
                btn.textContent = c + 'C';
                var isActive = c === cores;
                btn.style.cssText = 'flex:1;padding:7px 0;border:2px solid ' + (isActive ? '#1a6fd4' : '#ddd') + ';' +
                    'border-radius:6px;background:' + (isActive ? '#1a6fd4' : '#fff') + ';' +
                    'color:' + (isActive ? '#fff' : '#333') + ';font-size:13px;font-weight:bold;cursor:pointer;transition:all 0.15s;';
                if (!isActive) {
                    btn.onmouseover = function() { btn.style.borderColor = '#1a6fd4'; btn.style.color = '#1a6fd4'; };
                    btn.onmouseout = function() { btn.style.borderColor = '#ddd'; btn.style.color = '#333'; };
                }
                btn.onclick = function() {
                    if (c !== cores) {
                        var conn = connections.find(function(x) { return x.id === connId; });
                        if (conn) { conn.cores = c; saveData(); renderAllConnections(); }
                    }
                    wrap.remove();
                };
                btnRow.appendChild(btn);
            });
            box.appendChild(btnRow);

            // 구분선
            var hr = document.createElement('div');
            hr.style.cssText = 'border-top:1px solid #eee;margin:2px 4px;';
            box.appendChild(hr);

            // 삭제 버튼
            var delBtn = document.createElement('button');
            delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 20 20" fill="none" style="vertical-align:middle;margin-right:4px;"><path d="M5 7h10l-1 10H6L5 7z" stroke="currentColor" stroke-width="1.5"/><path d="M3 5h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 3h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>케이블 삭제';
            delBtn.style.cssText = 'width:100%;padding:7px 10px;border:none;border-radius:6px;background:none;color:#b91c1c;font-size:12px;cursor:pointer;text-align:center;transition:background 0.15s;';
            delBtn.onmouseover = function() { delBtn.style.background = '#fef2f2'; };
            delBtn.onmouseout = function() { delBtn.style.background = 'none'; };
            delBtn.onclick = function() {
                wrap.remove();
                deleteConnection(connId);
            };
            box.appendChild(delBtn);

            // 화면 밖 보정
            wrap.appendChild(box);
            document.body.appendChild(wrap);
            var boxRect = box.getBoundingClientRect();
            if (boxRect.right > window.innerWidth) box.style.left = (px - boxRect.width - 20) + 'px';
            if (boxRect.bottom > window.innerHeight) box.style.top = (window.innerHeight - boxRect.height - 10) + 'px';
        }

        function showCableInfoPanel(connId, fromNode, toNode, connection, e) {
            // 동축: 컨텍스트 메뉴 스타일
            if (connection.cableType === 'coax') {
                _showCoaxCableMenu(connId, connection, e);
                return;
            }
            var panel = document.getElementById('cableInfoPanel');
            var isNew = (connection.lineType || 'existing') === 'new';
            var typeDot = isNew ? '#e53935' : '#1a6fd4';
            var typeLabel = isNew ? '신설' : '기설';
            var cid = connId;
            var _ci = function(fn) { return fn + '(\'' + cid + '\'); closeCableInfoPanel()'; };
            var btnBase = 'width:100%;padding:7px 12px;border:none;border-radius:6px;cursor:pointer;font-size:12.5px;font-weight:600;font-family:inherit;display:flex;align-items:center;gap:7px;transition:filter 0.15s;';
            var btnPrimary = btnBase + 'background:#1a6fd4;color:#fff;';
            var btnLight = btnBase + 'background:#f0f4fa;color:#334155;';
            var btnDanger = btnBase + 'background:none;color:#b91c1c;justify-content:center;font-size:11.5px;font-weight:500;padding:6px;';
            // SVG 아이콘
            var icoCore = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="3" fill="currentColor"/></svg>';
            var icoPole = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="9" y="2" width="2.5" height="16" rx="1" fill="currentColor"/><rect x="4" y="5" width="12" height="2" rx="1" fill="currentColor" opacity="0.6"/></svg>';
            var icoDoc = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="3" y="1" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><line x1="6.5" y1="6" x2="13.5" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="6.5" y1="9.5" x2="13.5" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="6.5" y1="13" x2="10.5" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
            var icoLabel = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M3 4h10l4 6-4 6H3V4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="13" cy="10" r="1.5" fill="currentColor"/></svg>';
            var icoSwitch = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M4 7h9m0 0l-3-3m3 3l-3 3M16 13H7m0 0l3 3m-3-3l3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            var icoDel = '<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 7h10l-1 10H6L5 7z" stroke="currentColor" stroke-width="1.5"/><path d="M3 5h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 3h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

            document.getElementById('cableInfoContent').innerHTML =
                // 헤더
                '<div style="padding:14px 16px 10px;border-bottom:1px solid #f0f0f0;">' +
                  '<div style="font-size:13px;font-weight:700;color:#1e293b;letter-spacing:-0.3px;line-height:1.4;">' +
                    (escapeHtml(fromNode?.name) || '장비') + '&nbsp;&nbsp;<span style="color:#94a3b8;font-weight:400;">→</span>&nbsp;&nbsp;' + (escapeHtml(toNode?.name) || '장비') +
                  '</div>' +
                  '<div style="margin-top:5px;display:flex;align-items:center;gap:5px;">' +
                    '<span style="width:7px;height:7px;border-radius:50%;background:' + typeDot + ';display:inline-block;"></span>' +
                    '<span style="font-size:11.5px;color:#64748b;font-weight:500;">' + (connection.cableType === 'coax' ? '' : typeLabel + ' · ') + connection.cores + (connection.cableType === 'coax' ? 'C' : '코어') + '</span>' +
                  '</div>' +
                '</div>' +
                // 버튼 영역
                '<div style="padding:10px 12px;display:flex;flex-direction:column;gap:5px;">' +
                  '<button onclick="' + _ci('changeCoreCount') + '" style="' + btnPrimary + '" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">' + icoCore + (connection.cableType === 'coax' ? '규격 변경' : '코어 수 변경') + '</button>' +
                  (connection.cableType !== 'coax' ? '<button onclick="' + _ci('exportPoleData') + '" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoPole + '전주 데이터 추출</button>' : '') +
                  (connection.cableType !== 'coax' ? '<button onclick="' + _ci('generateApplication') + '" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoDoc + '공가 신청서 생성</button>' : '') +
                  (connection.cableType !== 'coax' ? '<button onclick="' + _ci('openCablePoleLabelBatch') + '" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoLabel + '전주 라벨 일괄조정</button>' : '') +
                  (connection.cableType !== 'coax' ? '<button onclick="' + _ci('toggleCableType') + '" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoSwitch + '신설/기설 전환</button>' : '') +
                '</div>' +
                // 삭제 영역
                '<div style="padding:4px 12px 10px;border-top:1px solid #f0f0f0;">' +
                  '<button onclick="' + _ci('deleteConnection') + '" style="' + btnDanger + '" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'none\'">' + icoDel + '케이블 삭제</button>' +
                '</div>';
            // 클릭 위치 기준으로 패널 위치 결정
            var mapRect = document.getElementById('map').getBoundingClientRect();
            var clickPt = map.latLngToLayerPoint(e.latlng);
            var px = mapRect.left + clickPt.x + 15;
            var py = mapRect.top + clickPt.y - 30;
            // 화면 밖으로 넘어가지 않도록 보정
            if (px + 250 > window.innerWidth) px = px - 270;
            if (py + 320 > window.innerHeight) py = window.innerHeight - 330;
            if (py < 10) py = 10;
            panel.style.left = px + 'px';
            panel.style.top = py + 'px';
            panel.style.display = 'block';
            showWaypointMarkers(connId);
        }

        function closeCableInfoPanel() {
            document.getElementById('cableInfoPanel').style.display = 'none';
        }

        // 지도/화면 클릭 시 케이블 패널 닫기
        document.addEventListener('mousedown', function(e) {
            var panel = document.getElementById('cableInfoPanel');
            if (panel.style.display !== 'none' && !panel.contains(e.target)) {
                closeCableInfoPanel();
            }
        });

        // ==================== 철거 케이블 / 조가선 임시 그리기 ====================
        var _tempDrawMode = null;       // 'cable' | 'mw' | null
        window._tempDrawMode = null;
        var _tempDrawPoints = [];       // [{lat,lng,snappedPole}]
        var _tempDrawMarkers = [];      // circleMarker array
        var _tempDrawPreview = null;    // preview polyline
        var _tempDrawLines = [];        // 완성된 임시 선 {line, labels[], markers[]}
        var _tempSnapCircle = null;
        var _tempSnapHighlight = null;
        var _tempMousemoveHandler = null;
        var _tempDrawStartTime = 0;
        window._tempDrawPoleIds = new Set();

        function startTempDraw(type) {
            // 이미 그리기 모드면 현재 선 확정 후 모드 유지 또는 종료
            if (_tempDrawMode) {
                finishTempDrawLine();
                if (_tempDrawMode === type) {
                    // 같은 버튼 다시 누르면 모드 종료
                    endTempDrawMode();
                    return;
                }
            }
            _tempDrawMode = type;
            window._tempDrawMode = type;
            _tempDrawStartTime = Date.now();
            _tempDrawPoints = [];
            _tempDrawMarkers = [];
            _tempDrawPreview = null;
            if (window._setMapCursorMode) window._setMapCursorMode('crosshair');
            var label = type === 'cable' ? '철거 케이블' : '조가선';
            showStatus(label + ' 그리기: 전주를 클릭하세요 (Enter=확정, ESC=취소)');
            // 버튼 활성화 표시
            var btnId = type === 'cable' ? 'tempDrawCableBtn' : 'tempDrawMWBtn';
            document.getElementById(btnId).classList.add('active');

            map.on('click', onTempDrawClick);
            _tempMousemoveHandler = onTempDrawMousemove;
            _nEvent.add(map._m, 'mousemove', _tempMousemoveHandler);
        }

        function endTempDrawMode() {
            _tempDrawMode = null;
            window._tempDrawMode = null;
            _tempDrawPoints = [];
            _tempDrawMarkers.forEach(function(m) { map.removeLayer(m); });
            _tempDrawMarkers = [];
            if (_tempDrawPreview) { map.removeLayer(_tempDrawPreview); _tempDrawPreview = null; }
            if (_tempSnapCircle) { _tempSnapCircle.setMap(null); _tempSnapCircle = null; }
            if (_tempSnapHighlight) { _tempSnapHighlight.setMap(null); _tempSnapHighlight = null; }
            map.off('click', onTempDrawClick);
            if (_tempMousemoveHandler) {
                _nEvent.remove(map._m, 'mousemove', _tempMousemoveHandler);
                _tempMousemoveHandler = null;
            }
            if (window._setMapCursorMode) window._setMapCursorMode('default');
            document.getElementById('tempDrawCableBtn').classList.remove('active');
            document.getElementById('tempDrawMWBtn').classList.remove('active');
            showStatus('');
        }

        function onTempDrawClick(e) {
            if (!_tempDrawMode) return;
            if (window._nodeJustClicked) return;
            var lat = e.latlng.lat, lng = e.latlng.lng;
            var nearPole = findNearestPole(lat, lng);
            if (nearPole) {
                // 이미 찍은 전주면 무시
                if (_tempDrawPoints.some(function(p) { return p.snappedPole === nearPole.id; })) return;
                var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                lat = nearPole.lat + _off.dLat;
                lng = nearPole.lng + _off.dLng;
            }
            _tempDrawPoints.push({ lat: lat, lng: lng, snappedPole: nearPole ? nearPole.id : null });
            var mk = L.circleMarker([lat, lng], {
                radius: nearPole ? 5 : 3,
                fillColor: nearPole ? '#00cc44' : '#888',
                color: '#fff', weight: 2, fillOpacity: 1, zIndexOffset: 2000
            }).addTo(map);
            _tempDrawMarkers.push(mk);
            updateTempDrawPreview();
        }

        function onTempDrawMousemove(me) {
            if (!_tempDrawMode) return;
            var lat = me.coord.lat(), lng = me.coord.lng();
            if (_tempSnapCircle) { _tempSnapCircle.setMap(null); _tempSnapCircle = null; }
            if (_tempSnapHighlight) { _tempSnapHighlight.setMap(null); _tempSnapHighlight = null; }
            var nearPole = findNearestPole(lat, lng);
            _tempSnapCircle = new naver.maps.Circle({
                map: map._m, center: new naver.maps.LatLng(lat, lng), radius: 10,
                strokeWeight: 1, strokeColor: nearPole ? '#00cc44' : '#aaa', strokeOpacity: 0.8,
                fillColor: nearPole ? '#00cc44' : '#ccc', fillOpacity: 0.15
            });
            if (nearPole) {
                var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                _tempSnapHighlight = new naver.maps.Circle({
                    map: map._m, center: new naver.maps.LatLng(nearPole.lat + _off.dLat, nearPole.lng + _off.dLng),
                    radius: 3, strokeWeight: 2, strokeColor: '#00cc44', strokeOpacity: 1,
                    fillColor: '#00cc44', fillOpacity: 0.8
                });
            }
        }

        function updateTempDrawPreview() {
            if (_tempDrawPreview) map.removeLayer(_tempDrawPreview);
            if (_tempDrawPoints.length < 2) return;
            var path = _tempDrawPoints.map(function(p) { return [p.lat, p.lng]; });
            var color = _tempDrawMode === 'cable' ? '#27ae60' : '#333333';
            _tempDrawPreview = L.polyline(path, {
                color: color, weight: 3, opacity: 0.6, dashArray: '6,4'
            }).addTo(map);
        }

        function finishTempDrawLine() {
            if (_tempDrawPoints.length < 2) {
                // 점이 부족하면 마커만 정리
                _tempDrawMarkers.forEach(function(m) { map.removeLayer(m); });
                _tempDrawMarkers = [];
                _tempDrawPoints = [];
                if (_tempDrawPreview) { map.removeLayer(_tempDrawPreview); _tempDrawPreview = null; }
                return;
            }
            // 미리보기 제거
            if (_tempDrawPreview) { map.removeLayer(_tempDrawPreview); _tempDrawPreview = null; }
            _tempDrawMarkers.forEach(function(m) { map.removeLayer(m); });
            _tempDrawMarkers = [];

            var path = _tempDrawPoints.map(function(p) { return [p.lat, p.lng]; });
            var isCable = _tempDrawMode === 'cable';
            var color = isCable ? '#27ae60' : '#333333';
            var drawType = _tempDrawMode;
            var tempPoleOffsetM = isCable ? 1 : 2;

            // 전주 경유점 오프셋 (전주 옆으로 비켜감)
            path = path.map(function(pt, i) {
                if (i === 0 || i === path.length - 1) return pt;
                var wp = _tempDrawPoints[i];
                if (!wp || !wp.snappedPole) return pt;
                var prev = path[Math.max(0, i - 1)];
                var next = path[Math.min(path.length - 1, i + 1)];
                var off = perpOffset(prev[0], prev[1], next[0], next[1], tempPoleOffsetM);
                return [pt[0] + off.dlat, pt[1] + off.dlng];
            });

            // 스냅된 전주 ID 수집 → 라벨 표시용
            _tempDrawPoints.forEach(function(p) {
                if (p.snappedPole) window._tempDrawPoleIds.add(p.snappedPole);
            });

            // 기존 케이블/임시선과 겹침 방지 오프셋
            // 스냅된 전주 ID 목록으로 경로 유사성 판단
            var snappedIds = _tempDrawPoints.filter(function(p) { return p.snappedPole; }).map(function(p) { return p.snappedPole; });
            var overlapCount = 0;
            // 기존 케이블과 겹침 체크 (경유 전주 2개 이상 공유하면 겹침)
            if (snappedIds.length >= 2) {
                connections.forEach(function(c) {
                    var cPoleIds = [];
                    if (c.waypoints) c.waypoints.forEach(function(wp) { if (wp.snappedPole) cPoleIds.push(wp.snappedPole); });
                    var shared = snappedIds.filter(function(id) { return cPoleIds.indexOf(id) !== -1; }).length;
                    if (shared >= 2) overlapCount++;
                });
            }
            // 기존 임시선과 겹침 체크
            _tempDrawLines.forEach(function(entry) {
                if (!entry.poleIds || !entry.poleIds.length) return;
                var shared = snappedIds.filter(function(id) { return entry.poleIds.indexOf(id) !== -1; }).length;
                if (shared >= 2) overlapCount++;
            });
            // 겹침이 있으면 반대쪽으로 오프셋 (-4m씩)
            if (overlapCount > 0) {
                path = applyPathOffset(path, -(overlapCount * 4));
            }

            // 확정 polyline
            var line = L.polyline(path, { color: color, weight: 4, opacity: 0.9 }).addTo(map);
            var entry = { line: line, labels: [], markers: [], path: path, drawType: drawType, poleIds: snappedIds };

            // 경간 라벨 (철거 케이블만)
            if (isCable) {
                for (var si = 0; si < path.length - 1; si++) {
                    var sLat1 = path[si][0], sLng1 = path[si][1];
                    var sLat2 = path[si+1][0], sLng2 = path[si+1][1];
                    var dLat = (sLat2 - sLat1) * Math.PI / 180;
                    var dLng = (sLng2 - sLng1) * Math.PI / 180;
                    var sa = Math.sin(dLat/2)*Math.sin(dLat/2) +
                             Math.cos(sLat1*Math.PI/180)*Math.cos(sLat2*Math.PI/180)*
                             Math.sin(dLng/2)*Math.sin(dLng/2);
                    var spanM = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1-sa)));
                    if (spanM < 1) continue;
                    var midLat = (sLat1 + sLat2) / 2;
                    var midLng = (sLng1 + sLng2) / 2;
                    var pt1 = map.latLngToLayerPoint({ lat: sLat1, lng: sLng1 });
                    var pt2 = map.latLngToLayerPoint({ lat: sLat2, lng: sLng2 });
                    var angleDeg = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * 180 / Math.PI;
                    if (angleDeg > 90) angleDeg -= 180;
                    if (angleDeg < -90) angleDeg += 180;
                    var spanIcon = L.divIcon({
                        html: '<div class="span-label" style="color:' + color + ';transform:rotate(' + angleDeg.toFixed(1) + 'deg) translateY(8px);transform-origin:center center;">' + spanM + 'm</div>',
                        className: '', iconSize: [50, 16], iconAnchor: [25, 8]
                    });
                    var spanMarker = L.marker([midLat, midLng], { icon: spanIcon, zIndexOffset: -2000 }).addTo(map);
                    entry.labels.push(spanMarker);
                }
            }

            _tempDrawLines.push(entry);
            _tempDrawPoints = [];
            var label = isCable ? '철거 케이블' : '조가선';
            showStatus(label + ' 확정! 계속 그리거나 ESC로 종료');
            // 전주 라벨 갱신
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }

        function clearTempDrawAll() {
            _tempDrawLines.forEach(function(entry) {
                if (entry.line) map.removeLayer(entry.line);
                entry.labels.forEach(function(m) { map.removeLayer(m); });
                entry.markers.forEach(function(m) { map.removeLayer(m); });
            });
            _tempDrawLines = [];
            window._tempDrawPoleIds = new Set();
            if (_tempDrawMode) endTempDrawMode();
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
            showStatus('임시 그리기 전체 삭제됨');
        }

        // ESC/Enter 키 핸들러
        document.addEventListener('keydown', function(e) {
            if (!_tempDrawMode) return;
            if (e.key === 'Escape') {
                // 그리던 점 버리고 모드 종료
                _tempDrawMarkers.forEach(function(m) { map.removeLayer(m); });
                _tempDrawMarkers = [];
                _tempDrawPoints = [];
                if (_tempDrawPreview) { map.removeLayer(_tempDrawPreview); _tempDrawPreview = null; }
                endTempDrawMode();
            } else if (e.key === 'Enter') {
                finishTempDrawLine();
            }
        });

        // ==================== 케이블 그리기 일시정지/재개 ====================
        var _pausedCable = null; // { fromNode, waypoints, line, endMarker }

        function pauseConnecting() {
            if (!connectingMode || !connectingFromNode) return;
            if (pendingWaypoints.length === 0) {
                showStatus('경유점이 없어 일시정지할 수 없습니다');
                return;
            }

            // 프리뷰/마커 정리
            clearPreviewOnly();

            // 일시정지 라인 그리기
            var path = [
                [connectingFromNode.lat, connectingFromNode.lng],
                ...pendingWaypoints.map(wp => [wp.lat, wp.lng])
            ];
            var pausedLine = L.polyline(path, {
                color: '#e67e22', weight: 2, opacity: 0.4, dashArray: '8,6'
            }).addTo(map);

            // 끝점 원 마커 (divIcon으로 DOM 클릭 우선)
            var lastWp = pendingWaypoints[pendingWaypoints.length - 1];
            var _dotSize = 20;
            var _dotColor = _isCoaxDesignConnecting() ? '#FF6D00' : '#e67e22';
            var _dotBorder = 2;
            var dotIcon = L.divIcon({
                html: '<div class="paused-cable-dot" style="width:'+_dotSize+'px; height:'+_dotSize+'px; background:'+_dotColor+'; border:'+_dotBorder+'px solid white; border-radius:50%; opacity:0.85; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
                className: '',
                iconSize: [_dotSize, _dotSize],
                iconAnchor: [_dotSize/2, _dotSize/2]
            });
            var endMarker = L.marker([lastWp.lat, lastWp.lng], {
                icon: dotIcon, zIndexOffset: 9000
            }).addTo(map);

            _pausedCable = {
                fromNode: connectingFromNode,
                waypoints: [...pendingWaypoints],
                line: pausedLine,
                endMarker: endMarker
            };

            // 주황 원 클릭 → 바로 재개 (DOM capture로 전주 클릭보다 우선)
            var dotDom = endMarker._ov && (endMarker._ov._div || endMarker._ov._content);
            if (dotDom) {
                dotDom.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    window._nodeJustClicked = true;
                    clearTimeout(window._nodeClickTimer);
                    window._nodeClickTimer = setTimeout(function() { window._nodeJustClicked = false; }, 600);
                    resumeConnecting();
                }, true);
            }
            endMarker.on('click', function() { resumeConnecting(); });
            pausedLine.on('click', function() { resumeConnecting(); });

            // 상태 초기화
            connectingMode = false; window.connectingMode = false; document.body.classList.remove('connecting-mode');
            connectingFromNode = null;
            connectingToNode = null;
            pendingWaypoints = [];
            if (window._setMapCursorMode) window._setMapCursorMode('default');
            else { var mapEl = document.getElementById('map'); if (mapEl) mapEl.style.cursor = ''; }

            showStatus('케이블 그리기 일시정지 — 주황색 선을 클릭해 계속/삭제');
        }

        function resumeConnecting() {
            if (!_pausedCable) return;

            // 상태 복원
            connectingFromNode = _pausedCable.fromNode;
            pendingWaypoints = _pausedCable.waypoints.slice();
            waypointMarkers = [];

            // 일시정지 비주얼 제거
            if (_pausedCable.line) map.removeLayer(_pausedCable.line);
            if (_pausedCable.endMarker) map.removeLayer(_pausedCable.endMarker);
            _pausedCable = null;

            // 경유점 마커 다시 그리기
            pendingWaypoints.forEach(function(wp) {
                var marker = L.circleMarker([wp.lat, wp.lng], {
                    radius: 5, color: wp.snappedPole ? '#00cc44' : '#e67e22',
                    fillColor: wp.snappedPole ? '#00cc44' : '#e67e22',
                    fillOpacity: 0.8, weight: 2
                }).addTo(map);
                waypointMarkers.push(marker);
            });

            // 연결 모드 재개
            connectingMode = true; window.connectingMode = true; document.body.classList.add('connecting-mode');
            if (window._setMapCursorMode) window._setMapCursorMode('crosshair');
            else { var mapEl = document.getElementById('map'); if (mapEl) mapEl.style.cursor = 'crosshair'; }

            updatePreviewLine();
            map.off('click', onMapClickForWaypoint);
            map.on('click', onMapClickForWaypoint);
            window._mousemoveHandler = onMapMousemoveForSnap;
            _nEvent.add(map._m, 'mousemove', onMapMousemoveForSnap);

            showStatus('케이블 그리기 재개 — 경유점 ' + pendingWaypoints.length + '개 (ESC=취소, Space=일시정지)');
        }

        function clearPausedCable() {
            if (!_pausedCable) return;
            if (_pausedCable.line) map.removeLayer(_pausedCable.line);
            if (_pausedCable.endMarker) map.removeLayer(_pausedCable.endMarker);
            _pausedCable = null;
        }

        // ==================== OTDR 측정 ====================
        var _otdrMarker = null;
        var _otdrLine = null;

        function clearOtdrMarker() {
            if (_otdrMarker) { map.removeLayer(_otdrMarker); _otdrMarker = null; }
            if (_otdrLine) { map.removeLayer(_otdrLine); _otdrLine = null; }
        }

        // 모든 가능한 경로를 탐색 (분기점에서 갈라짐)
        // 반환: [ { segments: [...], routeLabel: "국사→함체A→함체B→..." }, ... ]
        var JUNCTION_SLACK = 10; // 함체 여장 10m

        function calcSegDist(path) {
            var d = 0;
            for (var i = 0; i < path.length - 1; i++) {
                var dLa = (path[i+1][0] - path[i][0]) * Math.PI / 180;
                var dLo = (path[i+1][1] - path[i][1]) * Math.PI / 180;
                var a = Math.sin(dLa/2)**2 + Math.cos(path[i][0]*Math.PI/180)*Math.cos(path[i+1][0]*Math.PI/180)*Math.sin(dLo/2)**2;
                d += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            }
            return d;
        }

        function traceAllRoutes(startNodeId, firstConn) {
            var allRoutes = [];
            var startNode = nodes.find(n => n.id === startNodeId);
            var startName = startNode ? (startNode.name || '국사') : '국사';

            function walk(conn, fromNodeId, prevSegments, cumDist, visited, routeNames) {
                if (visited.has(conn.id)) return;
                var newVisited = new Set(visited);
                newVisited.add(conn.id);

                var fromNode = nodes.find(n => n.id === fromNodeId);
                var toNodeId = getOtherNodeId(conn, fromNodeId);
                var toNode = nodes.find(n => n.id === toNodeId);
                if (!fromNode || !toNode) return;

                var path = [
                    [fromNode.lat, fromNode.lng],
                    ...(conn.waypoints || []).map(wp => [wp.lat, wp.lng]),
                    [toNode.lat, toNode.lng]
                ];

                var segDist = calcSegDist(path);
                var newCum = cumDist + segDist;

                var isJunction = toNode.type === 'junction';
                if (isJunction) newCum += JUNCTION_SLACK;

                var seg = {
                    conn: conn, fromNode: fromNode, toNode: toNode,
                    segDist: segDist, cumDist: newCum,
                    slackAdded: isJunction ? JUNCTION_SLACK : 0,
                    path: path
                };
                var segs = prevSegments.concat([seg]);
                var names = routeNames.slice();
                if (!isPoleType(toNode.type)) {
                    names.push(toNode.name || toNode.type);
                }

                // 도착 노드에서 OUT 계속 따라감
                var outConns = [];
                if (!isPoleType(toNode.type)) {
                    outConns = getNodeOutConns(toNodeId);
                }

                if (outConns.length === 0) {
                    // 끝점: 이 경로 저장
                    allRoutes.push({ segments: segs, routeLabel: names.join(' → ') });
                } else if (outConns.length === 1) {
                    walk(outConns[0], toNodeId, segs, newCum, newVisited, names);
                } else {
                    // 분기: 각 OUT으로 갈라짐
                    outConns.forEach(function(oc) {
                        walk(oc, toNodeId, segs, newCum, newVisited, names);
                    });
                }
            }

            walk(firstConn, startNodeId, [], 0, new Set(), [startName]);
            return allRoutes;
        }

        // 누적거리 배열에서 OTDR 거리에 해당하는 지도 좌표 찾기
        function findOtdrPoint(segments, targetDist) {
            if (segments.length === 0) return null;

            // 각 segment의 시작 cumDist 계산
            var prevCum = 0;
            for (var si = 0; si < segments.length; si++) {
                var seg = segments[si];
                var segStart = seg.cumDist - seg.segDist - seg.slackAdded;

                if (targetDist <= seg.cumDist) {
                    // 이 segment 안에 있음
                    var distIntoSeg = targetDist - segStart;
                    if (distIntoSeg < 0) distIntoSeg = 0;

                    // 여장 제외한 순수 케이블 거리
                    if (distIntoSeg > seg.segDist) distIntoSeg = seg.segDist;

                    // path 내에서 정확한 위치 보간
                    var accumulated = 0;
                    for (var pi = 0; pi < seg.path.length - 1; pi++) {
                        var p1 = seg.path[pi], p2 = seg.path[pi + 1];
                        var dLa = (p2[0]-p1[0])*Math.PI/180;
                        var dLo = (p2[1]-p1[1])*Math.PI/180;
                        var a = Math.sin(dLa/2)**2 + Math.cos(p1[0]*Math.PI/180)*Math.cos(p2[0]*Math.PI/180)*Math.sin(dLo/2)**2;
                        var subDist = 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));

                        if (accumulated + subDist >= distIntoSeg) {
                            var ratio = (distIntoSeg - accumulated) / subDist;
                            if (ratio < 0) ratio = 0;
                            if (ratio > 1) ratio = 1;
                            var lat = p1[0] + (p2[0]-p1[0]) * ratio;
                            var lng = p1[1] + (p2[1]-p1[1]) * ratio;
                            return {
                                lat: lat, lng: lng,
                                seg: seg,
                                segIndex: si,
                                distFromPrev: Math.round(distIntoSeg),
                                distToNext: Math.round(seg.segDist - distIntoSeg)
                            };
                        }
                        accumulated += subDist;
                    }
                    // fallback: segment 끝점
                    var last = seg.path[seg.path.length - 1];
                    return { lat: last[0], lng: last[1], seg: seg, segIndex: si, distFromPrev: Math.round(seg.segDist), distToNext: 0 };
                }
            }
            // 전체 경로보다 길면 마지막 지점
            var lastSeg = segments[segments.length - 1];
            var lastPt = lastSeg.path[lastSeg.path.length - 1];
            return { lat: lastPt[0], lng: lastPt[1], seg: lastSeg, segIndex: segments.length - 1, distFromPrev: Math.round(lastSeg.segDist), distToNext: 0, overrun: true };
        }

        function openOtdrInput(startNode, conn, dirLabel, targetNode) {
            // 접속정보 모달 닫기
            closeNodeInfoModal();

            // 모든 경로 미리 탐색
            var allRoutes = traceAllRoutes(startNode.id, conn);
            var startName = startNode.name || '국사';

            // 기존 패널 제거
            closeOtdrPanel();

            // 플로팅 패널 생성
            var panel = document.createElement('div');
            panel.id = 'otdrPanel';
            panel.style.cssText = 'position:fixed; top:60px; left:10px; z-index:10001; background:white; border-radius:10px; box-shadow:0 4px 20px rgba(0,0,0,0.3); width:320px; max-height:80vh; display:flex; flex-direction:column; font-size:13px;';

            // 헤더 (드래그 가능)
            var header = document.createElement('div');
            header.id = 'otdrPanelHeader';
            header.style.cssText = 'padding:12px 14px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; cursor:move; user-select:none; flex-shrink:0;';
            header.innerHTML = '<strong style="color:#8e44ad;">OTDR 측정</strong><span style="font-size:12px; color:#888;">' + startName + ' · ' + dirLabel + '</span>';
            var closeBtn = document.createElement('span');
            closeBtn.style.cssText = 'cursor:pointer; color:#999; font-size:18px; line-height:1; margin-left:8px;';
            closeBtn.textContent = '\u00d7';
            closeBtn.onclick = function() { closeOtdrPanel(); };
            header.appendChild(closeBtn);
            panel.appendChild(header);

            // 바디 (스크롤)
            var body = document.createElement('div');
            body.style.cssText = 'padding:12px 14px; overflow-y:auto; flex:1;';

            // 거리 입력
            body.innerHTML = '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">' +
                '<input type="number" id="otdrDistInput" placeholder="측정 거리(m)" style="flex:1; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:14px;">' +
                '<button id="otdrSearchBtn" style="padding:8px 14px; background:#8e44ad; color:white; border:none; border-radius:4px; font-size:13px; font-weight:bold; cursor:pointer;">검색</button>' +
                '</div>' +
                '<div style="font-size:11px; color:#999; margin-bottom:8px;">경로 ' + allRoutes.length + '개 탐색 · 함체당 여장 10m 포함</div>' +
                '<div id="otdrResult"></div>';

            panel.appendChild(body);
            document.body.appendChild(panel);

            // 드래그 이동
            (function() {
                var dx = 0, dy = 0, dragging = false;
                header.addEventListener('mousedown', function(e) {
                    if (e.target === closeBtn) return;
                    dragging = true;
                    dx = e.clientX - panel.offsetLeft;
                    dy = e.clientY - panel.offsetTop;
                    e.preventDefault();
                });
                document.addEventListener('mousemove', function(e) {
                    if (!dragging) return;
                    panel.style.left = (e.clientX - dx) + 'px';
                    panel.style.top = (e.clientY - dy) + 'px';
                });
                document.addEventListener('mouseup', function() { dragging = false; });
                // 터치 지원
                header.addEventListener('touchstart', function(e) {
                    if (e.target === closeBtn) return;
                    dragging = true;
                    var t = e.touches[0];
                    dx = t.clientX - panel.offsetLeft;
                    dy = t.clientY - panel.offsetTop;
                });
                document.addEventListener('touchmove', function(e) {
                    if (!dragging) return;
                    var t = e.touches[0];
                    panel.style.left = (t.clientX - dx) + 'px';
                    panel.style.top = (t.clientY - dy) + 'px';
                });
                document.addEventListener('touchend', function() { dragging = false; });
            })();

            // 검색
            document.getElementById('otdrSearchBtn').onclick = function() {
                var dist = parseFloat(document.getElementById('otdrDistInput').value);
                if (isNaN(dist) || dist <= 0) {
                    document.getElementById('otdrResult').innerHTML = '<span style="color:#e74c3c; font-size:12px;">유효한 거리를 입력하세요</span>';
                    return;
                }

                clearOtdrMarker();

                // 모든 경로에서 후보 찾기
                var candidates = [];
                allRoutes.forEach(function(route, ri) {
                    var totalRoute = route.segments.length > 0 ? route.segments[route.segments.length - 1].cumDist : 0;
                    var pt = findOtdrPoint(route.segments, dist);
                    if (pt && !pt.overrun) {
                        pt.routeIndex = ri;
                        pt.routeLabel = route.routeLabel;
                        pt.totalRoute = Math.round(totalRoute);
                        candidates.push(pt);
                    }
                });

                var resultDiv = document.getElementById('otdrResult');

                if (candidates.length === 0) {
                    if (allRoutes.length === 0) {
                        resultDiv.innerHTML = '<div style="color:#e74c3c; font-size:12px; font-weight:bold;">탐색된 경로가 없습니다</div>';
                        return;
                    }
                    var maxRoute = allRoutes.reduce(function(a, b) {
                        var aLen = a.segments.length > 0 ? a.segments[a.segments.length-1].cumDist : 0;
                        var bLen = b.segments.length > 0 ? b.segments[b.segments.length-1].cumDist : 0;
                        return aLen > bLen ? a : b;
                    });
                    var maxLen = maxRoute.segments.length > 0 ? Math.round(maxRoute.segments[maxRoute.segments.length-1].cumDist) : 0;
                    resultDiv.innerHTML = '<div style="color:#e74c3c; font-size:12px; font-weight:bold;">모든 경로의 총 거리를 초과합니다 (최장 ' + maxLen + 'm)</div>';
                    return;
                }

                // 후보 목록
                var rhtml = '<div style="font-size:12px; color:#555; margin-bottom:6px; font-weight:bold;">후보 ' + candidates.length + '건</div>';
                candidates.forEach(function(pt, ci) {
                    var fromName = pt.seg.fromNode.name || pt.seg.fromNode.type;
                    var toName = pt.seg.toNode.name || pt.seg.toNode.type;
                    rhtml += '<div class="otdr-candidate" data-idx="' + ci + '" style="padding:8px; margin-bottom:4px; background:white; border:1px solid #d5b8e8; border-radius:4px; cursor:pointer; transition:background 0.15s;">';
                    rhtml += '<div style="font-size:11px; color:#8e44ad; margin-bottom:3px;">' + pt.routeLabel + '</div>';
                    rhtml += '<div style="font-size:13px; font-weight:bold; color:#333;">' + fromName + ' ↔ ' + toName + '</div>';
                    rhtml += '<div style="font-size:12px; color:#555;">' + fromName + '에서 ' + pt.distFromPrev + 'm / ' + toName + '까지 ' + pt.distToNext + 'm</div>';
                    rhtml += '</div>';
                });
                resultDiv.innerHTML = rhtml;

                // 후보 클릭
                resultDiv.querySelectorAll('.otdr-candidate').forEach(function(el) {
                    el.onclick = function() {
                        var idx = parseInt(el.getAttribute('data-idx'));
                        var pt = candidates[idx];
                        clearOtdrMarker();

                        // 선택 강조
                        resultDiv.querySelectorAll('.otdr-candidate').forEach(function(c) {
                            c.style.borderColor = '#d5b8e8'; c.style.background = 'white';
                        });
                        el.style.borderColor = '#8e44ad';
                        el.style.background = '#f3e8ff';

                        var fromName = pt.seg.fromNode.name || pt.seg.fromNode.type;
                        var toName = pt.seg.toNode.name || pt.seg.toNode.type;

                        // 마커
                        var otdrIcon = L.divIcon({
                            html: '<div style="background:#8e44ad; color:white; border:2px solid white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; box-shadow:0 2px 8px rgba(0,0,0,0.4);">!</div>',
                            className: '', iconSize: [24, 24], iconAnchor: [12, 12]
                        });
                        _otdrMarker = L.marker([pt.lat, pt.lng], { icon: otdrIcon, zIndexOffset: 9000 }).addTo(map);
                        _otdrMarker.bindPopup('<div style="font-size:12px; text-align:center;"><b>OTDR ' + Math.round(dist) + 'm</b><br>' + fromName + ' ↔ ' + toName + '<br>' + fromName + '에서 ' + pt.distFromPrev + 'm</div>');

                        _otdrLine = L.polyline(pt.seg.path, { color: '#8e44ad', weight: 6, opacity: 0.7, dashArray: '8,4' }).addTo(map);

                        // 지도 이동
                        map.setView([pt.lat, pt.lng], 17);
                        // bindPopup은 클릭 시 열리므로, 자동 팝업은 직접 InfoWindow로 표시
                        setTimeout(function() {
                            if (_otdrMarker && _otdrMarker._mr) {
                                var pos = new naver.maps.LatLng(_otdrMarker._lat, _otdrMarker._lng);
                                var iw = new naver.maps.InfoWindow({
                                    position: pos,
                                    content: '<div style="padding:5px;min-width:120px;font-size:12px;text-align:center;"><b>OTDR ' + Math.round(dist) + 'm</b><br>' + fromName + ' ↔ ' + toName + '<br>' + fromName + '에서 ' + pt.distFromPrev + 'm</div>',
                                    borderWidth: 1, zIndex: 99999
                                });
                                iw.open(_otdrMarker._mr._m);
                            }
                        }, 200);
                    };
                });

                // 후보 1개면 자동 선택
                if (candidates.length === 1) {
                    resultDiv.querySelector('.otdr-candidate').click();
                }
            };

            document.getElementById('otdrDistInput').onkeydown = function(e) {
                if (e.key === 'Enter') document.getElementById('otdrSearchBtn').click();
            };
            setTimeout(function() { document.getElementById('otdrDistInput').focus(); }, 100);
        }

        function closeOtdrPanel() {
            var panel = document.getElementById('otdrPanel');
            if (panel) panel.remove();
            clearOtdrMarker();
        }

        // ==================== window 공개 ====================
        window.showNodeInfoModalForEdit = showNodeInfoModalForEdit;
        window.saveNodeInfo             = saveNodeInfo;
        window.deleteNode               = deleteNode;
        window.deleteNodeFromMenu       = deleteNodeFromMenu;
        window.closeNodeInfoModal       = closeNodeInfoModal;
        window.startConnecting          = startConnecting;
        window.showConnectionModal      = showConnectionModal;
        window.confirmConnection        = confirmConnection;
        window.closeConnectionModal     = closeConnectionModal;
        window.deleteConnection         = deleteConnection;
        window.exportPoleData           = exportPoleData;
        window.deleteWaypoint           = deleteWaypoint;
        window.startWaypointInsertModeById = startWaypointInsertModeById;
        window.cancelWaypointInsertMode = cancelWaypointInsertMode;
        window.startMovingNode          = startMovingNode;
        window.showOFDModal             = showOFDModal;
        window.saveAllWithRecalc        = saveAllWithRecalc;
        window.showWaypointMarkers      = showWaypointMarkers;
        window.renderAllConnections     = renderAllConnections;
        // 동축 설계: 장비 생성 + 케이블 자동 IN 연결
        // equipType: 장비 타입, lat/lng: 우클릭 위치, tapValue: 탭 수치 (옵션)
        function coaxAutoConnectEquip(equipType, lat, lng, tapValue) {
            if (!connectingMode || !connectingFromNode) return null;
            if (!_coaxActiveOnu) return null;

            var def = COAX_EQUIP_TYPES[equipType];
            if (!def) return null;

            // 장비 배치 위치 = 마지막 경유점 좌표 (케이블 끝점)
            var placeLat = lat, placeLng = lng;
            var nearPoleId = null;

            if (pendingWaypoints && pendingWaypoints.length > 0) {
                var lastWp = pendingWaypoints[pendingWaypoints.length - 1];
                placeLat = lastWp.lat;
                placeLng = lastWp.lng;
                nearPoleId = lastWp.snappedPole || null;
            }
            // 경유점 없으면 출발 장비 위치에 배치
            if (!nearPoleId) {
                var nearPole = findNearestPoleR(placeLat, placeLng, COAX_SNAP_RADIUS_M * 2);
                if (nearPole) nearPoleId = nearPole.id;
            }

            // 장비 노드 생성 (전주 중심에 배치)
            var equipNode = {
                id: 'coax_' + Date.now().toString(),
                type: equipType,
                lat: placeLat,
                lng: placeLng,
                name: tapValue || def.label,
                memo: '',
                snappedPoleId: nearPoleId,
                parentOnu: _coaxActiveOnu.id,
                coaxStatus: 'new',
                ofds: [], ports: [], rns: [], inOrder: [], connDirections: {}
            };

            nodes.push(equipNode);

            // 케이블 자동 연결 (connectingFromNode → equipNode, IN 방향)
            connectingToNode = equipNode;

            // 케이블 규격 결정: 동축 기본 12C
            var cores = 12;
            var lineType = 'new';

            var connId = Date.now().toString();

            // connDirections 설정
            if (!connectingFromNode.connDirections) connectingFromNode.connDirections = {};
            equipNode.connDirections[connId] = 'in';
            connectingFromNode.connDirections[connId] = 'out';
            equipNode.inOrder.push(connId);

            // 노드 배열 업데이트
            var fromIndex = nodes.findIndex(function(n) { return n.id === connectingFromNode.id; });
            if (fromIndex !== -1) nodes[fromIndex] = connectingFromNode;

            var connection = {
                id: connId,
                nodeA: connectingFromNode.id,
                nodeB: equipNode.id,
                cores: cores,
                lineType: lineType,
                cableType: 'coax',
                waypoints: pendingWaypoints && pendingWaypoints.length > 1
                    ? [].concat(pendingWaypoints.slice(0, -1))
                    : [],
                portMapping: [],
                inFromCableId: null,
                outPort: window._coaxCurrentOutPort || null
            };

            connections.push(connection);
            saveData();

            // 프리뷰 정리
            clearPreviewOnly();
            pendingWaypoints = [];

            // 렌더링
            rerenderCoaxNodes();
            renderAllConnections();

            // ONU 마커 리렌더 (포트 사용상태 업데이트)
            if (_coaxActiveOnu && markers[_coaxActiveOnu.id]) {
                map.removeLayer(markers[_coaxActiveOnu.id]);
                delete markers[_coaxActiveOnu.id];
                renderNode(_coaxActiveOnu);
            }

            // 연결 모드 종료: 장비 클릭으로 다시 시작해야 함
            connectingFromNode = null;
            connectingToNode = null;
            pendingWaypoints = [];
            waypointMarkers = [];
            connectingMode = false; window.connectingMode = false; document.body.classList.remove('connecting-mode');

            // 커서 복원
            if (window._setMapCursorMode) window._setMapCursorMode('default');
            else { var mapEl = document.getElementById('map'); if (mapEl) mapEl.style.cursor = ''; }

            window._coaxCurrentOutPort = null;
            showStatus(def.label + ' 배치 및 12C 케이블 연결 완료 — 장비를 클릭하여 계속 그리세요');
            return equipNode;
        }
        window.coaxAutoConnectEquip = coaxAutoConnectEquip;

        window.showStatus               = showStatus;
        window.openCablePoleLabelBatch  = openCablePoleLabelBatch;
        window.closeCableInfoPanel      = closeCableInfoPanel;
        window.closeOtdrPanel           = closeOtdrPanel;
        window.pauseConnecting          = pauseConnecting;
        window.clearPausedCable         = clearPausedCable;
        window.undoLastWaypoint         = undoLastWaypoint;
        window.toggleLegend             = function() {
            var panel = document.getElementById('legendPanel');
            var btn = document.getElementById('legendBtn');
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                if (btn) btn.classList.add('active');
            } else {
                panel.style.display = 'none';
                if (btn) btn.classList.remove('active');
            }
        };
        // 범례 패널 드래그 이동
        (function() {
            var panel = document.getElementById('legendPanel');
            var header = document.getElementById('legendHeader');
            var dx = 0, dy = 0, dragging = false;
            header.addEventListener('mousedown', function(e) {
                dragging = true;
                dx = e.clientX - panel.getBoundingClientRect().left;
                dy = e.clientY - panel.getBoundingClientRect().top;
                e.preventDefault();
            });
            document.addEventListener('mousemove', function(e) {
                if (!dragging) return;
                panel.style.left = (e.clientX - dx) + 'px';
                panel.style.top = (e.clientY - dy) + 'px';
                panel.style.right = 'auto';
            });
            document.addEventListener('mouseup', function() { dragging = false; });
        })();
        window.startTempDraw            = startTempDraw;
        window.clearTempDrawAll         = clearTempDrawAll;
        window.selectLineType           = function(btn) {
            document.querySelectorAll('#lineTypeSelection .fiber-core-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
        window.toggleCableType          = function(connId) {
            var conn = connections.find(c => c.id === connId);
            if (!conn) return;
            conn.lineType = (conn.lineType || 'existing') === 'new' ? 'existing' : 'new';
            saveData();
            renderAllConnections();
            showStatus(conn.lineType === 'new' ? '신설로 변경됨' : '기설로 변경됨');
        };
