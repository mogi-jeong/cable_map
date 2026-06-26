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
        function showConfirm(message, onYes, subMessage, yesLabel, onNo) {
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
                if (onNo) onNo();
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
            connectingFromNode = null; window._connectingSourceNodeId = null;
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
        let snapGuideLine = null;
        const SNAP_RADIUS_M = 15;

        // 경유점 번호 뱃지 마커 생성 (흰 원 + 숫자, 케이블 색과 구분됨)
        function _makeWaypointMarker(lat, lng, num) {
            var icon = L.divIcon({
                html: '<div style="width:22px;height:22px;background:#fff;border:2.5px solid #333;border-radius:50%;font-size:11px;font-weight:bold;color:#222;box-shadow:0 1px 5px rgba(0,0,0,0.7);line-height:17px;text-align:center;padding-top:1px;">' + num + '</div>',
                className: '',
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });
            return L.marker([lat, lng], { icon: icon, zIndexOffset: 3000 }).addTo(map);
        }
        // COAX_SNAP_RADIUS_M, _isCoaxDesignConnecting() → cable_map_coax.js로 이동

        function startConnecting() {
            closeMenuModal();
            window._pendingFromPort = null;
            window._pendingToPort   = null;
            // 출발 노드 ID를 즉시 저장 — onNodeClick이 언제 발화해도 차단
            window._connectingSourceNodeId = selectedNode ? selectedNode.id : null;
            // FROM 노드가 함체이면 출발 포트 먼저 선택
            if (selectedNode && selectedNode.type === 'junction' && window.showJunctionPortSelect) {
                window.showJunctionPortSelect(selectedNode, 'from', function(portId) {
                    window._pendingFromPort = portId;
                    _doStartConnecting();
                });
            } else {
                _doStartConnecting();
            }
        }

        function _doStartConnecting() {
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
            // 현재 이벤트 사이클 이후 등록 — 팝업/메뉴 버튼 클릭이 즉시 waypoint로 처리되는 문제 방지
            setTimeout(function() {
                map.on('click', onMapClickForWaypoint);
            }, 0);
            window._mousemoveHandler = onMapMousemoveForSnap;
            _nEvent.add(map._m, 'mousemove', onMapMousemoveForSnap);
        }

        // ── 케이블 연장: 클릭 위치에서 가까운 끝점 노드를 FROM으로 연결 시작 ──
        function extendCableFrom(connId, clickLat, clickLng) {
            var conn = connections.find(function(c) { return c.id === connId; });
            if (!conn) return;
            var fromNode = nodes.find(function(n) { return n.id === connFrom(conn); });
            var toNode   = nodes.find(function(n) { return n.id === connTo(conn); });
            if (!fromNode || !toNode) return;

            // 클릭 위치에서 더 가까운 끝점 선택
            var dFrom = Math.pow(fromNode.lat - clickLat, 2) + Math.pow(fromNode.lng - clickLng, 2);
            var dTo   = Math.pow(toNode.lat   - clickLat, 2) + Math.pow(toNode.lng   - clickLng, 2);
            selectedNode = dFrom <= dTo ? fromNode : toNode;

            startConnecting();
        }
        window.extendCableFrom = extendCableFrom;

        // ── 함체 포트 선택 팝업 (SVG 심볼 직접 클릭 방식) ──
        function showJunctionPortSelect(node, direction, callback) {
            var old = document.getElementById('junctionPortSelectPopup');
            if (old) old.remove();
            window._junctionPortPopupOpen = true;

            var JPORTS = window.JUNCTION_PORTS;
            if (!JPORTS) { callback && callback(null); return; }

            var portConns = window._getJunctionPortConns ? window._getJunctionPortConns(node) : (node.portConns || {});
            var jAngle    = node.junctionAngle || 0;
            var isNew     = node.isNew;
            var fillColor   = isNew ? '#ffe8e8' : '#e8f0fe';
            var strokeColor = isNew ? '#e53935' : '#1a6fd4';

            // ── 팝업 컨테이너 ──
            var popup = document.createElement('div');
            popup.id = 'junctionPortSelectPopup';
            popup.addEventListener('click', function(e) { e.stopPropagation(); });
            popup.style.cssText =
                'position:fixed;z-index:99999;background:white;border-radius:14px;' +
                'box-shadow:0 6px 28px rgba(0,0,0,0.22);padding:14px 14px 12px;width:210px;' +
                'font-family:"Segoe UI",sans-serif;user-select:none;';

            // 헤더
            var hdr = document.createElement('div');
            hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
            hdr.innerHTML =
                '<span style="font-size:12px;font-weight:700;color:#333;">' +
                    (direction === 'from' ? '출발 포트 선택' : '도착 포트 선택') +
                '</span>' +
                '<span id="jPortSelectClose" style="cursor:pointer;color:#aaa;font-size:15px;line-height:1;">✕</span>';
            popup.appendChild(hdr);

            // ── SVG 심볼 (160×160, viewBox 0 0 40 40 를 4배 확대) ──
            var SZ = 160, SC = SZ / 40, CX = SZ / 2, CY = SZ / 2;
            var NS = 'http://www.w3.org/2000/svg';
            var svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('width', SZ);
            svg.setAttribute('height', SZ);
            svg.setAttribute('viewBox', '0 0 ' + SZ + ' ' + SZ);
            svg.style.cssText = 'display:block;margin:0 auto 8px;';

            // 회전 그룹 (맵과 동일한 각도)
            var gRot = document.createElementNS(NS, 'g');
            gRot.setAttribute('transform', 'rotate(' + jAngle + ',' + CX + ',' + CY + ')');

            // 배경 원
            var bg = document.createElementNS(NS, 'circle');
            bg.setAttribute('cx', CX); bg.setAttribute('cy', CY);
            bg.setAttribute('r', 72);
            bg.setAttribute('fill', fillColor);
            bg.setAttribute('stroke', strokeColor);
            bg.setAttribute('stroke-width', 3);
            gRot.appendChild(bg);

            // 나비넥타이 폴리곤 (원본 40px 기준 좌표 × 4)
            var poly1 = document.createElementNS(NS, 'polygon');
            poly1.setAttribute('points', '80,80 28,44 28,116');
            poly1.setAttribute('fill', strokeColor);
            gRot.appendChild(poly1);

            var poly2 = document.createElementNS(NS, 'polygon');
            poly2.setAttribute('points', '80,80 132,44 132,116');
            poly2.setAttribute('fill', strokeColor);
            gRot.appendChild(poly2);

            // 중심 점
            var dot = document.createElementNS(NS, 'circle');
            dot.setAttribute('cx', CX); dot.setAttribute('cy', CY);
            dot.setAttribute('r', 10);
            dot.setAttribute('fill', 'white');
            dot.setAttribute('stroke', strokeColor);
            dot.setAttribute('stroke-width', 2);
            gRot.appendChild(dot);

            // ── 포트 원 ──
            var PORT_DESC = {
                IN:   '케이블 입력 (IN)',
                OUT:  '케이블 출력 (OUT)',
                BRL1: '분기 좌측 1 (BRL1)',
                BRL2: '분기 좌측 2 (BRL2)',
                BRL3: '분기 좌측 3 (BRL3)',
                BRR1: '분기 우측 1 (BRR1)',
                BRR2: '분기 우측 2 (BRR2)',
                BRR3: '분기 우측 3 (BRR3)'
            };
            var hintEl = null; // 아래에서 생성 후 참조

            Object.keys(JPORTS).forEach(function(pid) {
                var p        = JPORTS[pid];
                var occupied = !!portConns[pid];
                var pc       = occupied ? '#bdbdbd' : p.color;
                var px       = p.x * SC;   // 0-40 → 0-160
                var py       = p.y * SC;
                var vr       = (pid === 'IN' || pid === 'OUT') ? 9 : 7.5;
                var hr       = vr + 5; // 히트 영역

                // 시각 원
                var vis = document.createElementNS(NS, 'circle');
                vis.setAttribute('cx', px);
                vis.setAttribute('cy', py);
                vis.setAttribute('r', vr);
                vis.setAttribute('fill', pc);
                vis.setAttribute('stroke', occupied ? '#eee' : 'white');
                vis.setAttribute('stroke-width', 2);
                vis.style.transition = 'r 0.08s';
                gRot.appendChild(vis);

                // 라벨 (counter-rotate → 항상 수평 유지)
                var lbl = document.createElementNS(NS, 'text');
                lbl.setAttribute('x', px);
                lbl.setAttribute('y', py);
                lbl.setAttribute('text-anchor', 'middle');
                lbl.setAttribute('dominant-baseline', 'central');
                lbl.setAttribute('font-size', pid === 'IN' || pid === 'OUT' ? 8 : 7);
                lbl.setAttribute('font-weight', '700');
                lbl.setAttribute('fill', occupied ? '#999' : 'white');
                lbl.setAttribute('pointer-events', 'none');
                // 그룹 회전을 포트 중심에서 상쇄 → 텍스트는 항상 정립
                lbl.setAttribute('transform', 'rotate(' + (-jAngle) + ',' + px + ',' + py + ')');
                lbl.textContent = pid === 'BRL1' ? 'L1' : pid === 'BRL2' ? 'L2' : pid === 'BRL3' ? 'L3'
                                : pid === 'BRR1' ? 'R1' : pid === 'BRR2' ? 'R2' : pid === 'BRR3' ? 'R3'
                                : pid;
                gRot.appendChild(lbl);

                // 히트 영역 (투명, 클릭/호버 전용)
                var hit = document.createElementNS(NS, 'circle');
                hit.setAttribute('cx', px);
                hit.setAttribute('cy', py);
                hit.setAttribute('r', hr);
                hit.setAttribute('fill', 'transparent');
                hit.style.cursor = occupied ? 'not-allowed' : 'pointer';

                if (!occupied) {
                    hit.addEventListener('mouseenter', function() {
                        vis.setAttribute('r', vr + 3);
                        vis.setAttribute('fill', p.color);
                        vis.setAttribute('stroke', p.color);
                        if (hintEl) { hintEl.textContent = PORT_DESC[pid] || pid; hintEl.style.color = p.color; }
                    });
                    hit.addEventListener('mouseleave', function() {
                        vis.setAttribute('r', vr);
                        vis.setAttribute('fill', pc);
                        vis.setAttribute('stroke', 'white');
                        if (hintEl) { hintEl.textContent = '포트를 선택하세요'; hintEl.style.color = '#aaa'; }
                    });
                    hit.addEventListener('click', function(e) {
                        e.stopPropagation();
                        popup.remove();
                        document.removeEventListener('keydown', escHandler);
                        callback && callback(pid);
                        requestAnimationFrame(function() { requestAnimationFrame(function() {
                            window._junctionPortPopupOpen = false;
                        }); });
                    });
                } else {
                    // 사용중 표시: 빗금 패턴
                    var occ = document.createElementNS(NS, 'line');
                    var r2 = vr * 0.6;
                    occ.setAttribute('x1', px - r2); occ.setAttribute('y1', py - r2);
                    occ.setAttribute('x2', px + r2); occ.setAttribute('y2', py + r2);
                    occ.setAttribute('stroke', '#888'); occ.setAttribute('stroke-width', 1.5);
                    occ.setAttribute('pointer-events', 'none');
                    gRot.appendChild(occ);
                    hit.addEventListener('mouseenter', function() {
                        if (hintEl) { hintEl.textContent = (PORT_DESC[pid] || pid) + ' — 사용중'; hintEl.style.color = '#e53935'; }
                    });
                    hit.addEventListener('mouseleave', function() {
                        if (hintEl) { hintEl.textContent = '포트를 선택하세요'; hintEl.style.color = '#aaa'; }
                    });
                }
                gRot.appendChild(hit);
            });

            svg.appendChild(gRot);
            popup.appendChild(svg);

            // 호버 힌트 텍스트
            hintEl = document.createElement('div');
            hintEl.style.cssText = 'text-align:center;font-size:11px;font-weight:600;color:#aaa;' +
                'min-height:16px;margin-bottom:8px;transition:color 0.1s;';
            hintEl.textContent = '포트를 선택하세요';
            popup.appendChild(hintEl);

            // 기본 포트 버튼 (FROM=OUT, TO=IN)
            var defaultPortId = direction === 'from' ? 'OUT' : 'IN';
            var defaultOccupied = !!portConns[defaultPortId];
            var defaultColor = JPORTS[defaultPortId] ? JPORTS[defaultPortId].color : '#1a6fd4';
            var defaultBtn = document.createElement('button');
            defaultBtn.textContent = defaultOccupied
                ? (defaultPortId + ' 포트 사용중 — 직접 선택')
                : (defaultPortId + ' 포트 사용 (기본)');
            defaultBtn.style.cssText = 'width:100%;padding:7px 0;margin-bottom:5px;border:2px solid ' +
                (defaultOccupied ? '#ddd' : defaultColor) + ';border-radius:7px;' +
                'background:' + (defaultOccupied ? '#f5f5f5' : defaultColor) + ';' +
                'color:' + (defaultOccupied ? '#aaa' : 'white') + ';' +
                'font-size:12px;font-weight:700;cursor:' + (defaultOccupied ? 'not-allowed' : 'pointer') + ';';
            if (!defaultOccupied) {
                defaultBtn.onmouseover = function() { defaultBtn.style.opacity = '0.85'; };
                defaultBtn.onmouseout  = function() { defaultBtn.style.opacity = '1'; };
                defaultBtn.onclick = function(e) {
                    e.stopPropagation();
                    popup.remove();
                    document.removeEventListener('keydown', escHandler);
                    callback && callback(defaultPortId);
                    requestAnimationFrame(function() { requestAnimationFrame(function() {
                        window._junctionPortPopupOpen = false;
                    }); });
                };
            }
            popup.appendChild(defaultBtn);

            // 포트 없이 연결 버튼
            var skipBtn = document.createElement('button');
            skipBtn.textContent = '포트 없이 연결';
            skipBtn.style.cssText = 'width:100%;padding:6px 0;border:1px solid #ddd;border-radius:7px;' +
                'background:#fafafa;color:#999;font-size:11px;font-weight:600;cursor:pointer;';
            skipBtn.onmouseover = function() { skipBtn.style.background = '#f0f0f0'; };
            skipBtn.onmouseout  = function() { skipBtn.style.background = '#fafafa'; };
            skipBtn.onclick = function() {
                popup.remove();
                document.removeEventListener('keydown', escHandler);
                callback && callback(null);
                requestAnimationFrame(function() { requestAnimationFrame(function() {
                    var _m = document.getElementById('map'); if (_m) _m.style.pointerEvents = '';
                    window._junctionPortPopupOpen = false;
                }); });
            };
            popup.appendChild(skipBtn);

            // 위치 설정
            var pt = map.latLngToLayerPoint({ lat: node.lat, lng: node.lng });
            var mapRect = map.getContainer().getBoundingClientRect();
            popup.style.left = (mapRect.left + pt.x + 22) + 'px';
            popup.style.top  = (mapRect.top  + pt.y - 30) + 'px';

            document.body.appendChild(popup);

            document.getElementById('jPortSelectClose').onclick = function() {
                popup.remove();
                document.removeEventListener('keydown', escHandler);
                var _m = document.getElementById('map'); if (_m) _m.style.pointerEvents = '';
                window._junctionPortPopupOpen = false;
            };

            // 화면 밖 보정
            requestAnimationFrame(function() {
                var r = popup.getBoundingClientRect();
                if (r.right  > window.innerWidth)  popup.style.left = (window.innerWidth  - r.width  - 8) + 'px';
                if (r.bottom > window.innerHeight)  popup.style.top  = (window.innerHeight - r.height - 8) + 'px';
                if (r.left   < 8)                   popup.style.left = '8px';
                if (r.top    < 8)                   popup.style.top  = '8px';
            });

            function escHandler(e) {
                if (e.key === 'Escape') { popup.remove(); document.removeEventListener('keydown', escHandler); window._junctionPortPopupOpen = false; }
            }
            document.addEventListener('keydown', escHandler);
        }
        window.showJunctionPortSelect = showJunctionPortSelect;

        // ── 함체 포트 점유 상태 계산 (portConns + 포트미지정 연결 모두 반영) ──
        // cable_map_map.js에서도 사용
        window._getJunctionPortConns = function(node) {
            var result = {};
            // 1. 저장된 portConns (실존 conn만)
            if (node.portConns) {
                Object.keys(node.portConns).forEach(function(pid) {
                    var connId = node.portConns[pid];
                    if (connections.some(function(c) { return c.id === connId; })) {
                        result[pid] = connId;
                    }
                });
            }
            // 2. fromPort/toPort 미지정 연결도 OUT/IN 기본 포트 점유로 인식
            connections.forEach(function(c) {
                if (c.nodeA !== node.id && c.nodeB !== node.id) return;
                var nA = nodes.find(function(n) { return n.id === c.nodeA; });
                var dirA = (nA && nA.connDirections && nA.connDirections[c.id]) || 'out';
                var isFrom = (dirA === 'out') ? (c.nodeA === node.id) : (c.nodeB === node.id);
                if (isFrom && !c.fromPort && !result['OUT']) result['OUT'] = c.id;
                if (!isFrom && !c.toPort  && !result['IN'])  result['IN']  = c.id;
            });
            return result;
        };

        // ── 함체 자동 각도 적용 (최초 1회만, saveData 없이) ──
        function _autoRotateJunctions(nodeIds) {
            if (!window.calcJunctionAutoAngle) return;
            nodeIds.forEach(function(nid) {
                var n = nodes.find(function(x) { return x.id === nid; });
                if (!n || n.type !== 'junction') return;
                // 케이블 연결/삭제 시 항상 재계산 (IN-함체-OUT 직선 정렬)
                var newAngle = Math.round(window.calcJunctionAutoAngle(n));
                if (n.junctionAngle === newAngle && n.junctionAngleSet) return; // 변경 없으면 스킵
                n.junctionAngle = newAngle;
                n.junctionAngleSet = true;
                var idx = nodes.findIndex(function(x) { return x.id === n.id; });
                if (idx !== -1) nodes[idx] = n;
                if (markers[n.id]) { markers[n.id].setMap(null); delete markers[n.id]; }
                renderNode(n);
            });
        }

        // ── portConns 업데이트 헬퍼 ──
        function _updateJunctionPortConns(conn, remove) {
            var fromNode = nodes.find(function(n) { return n.id === connFrom(conn); });
            var toNode   = nodes.find(function(n) { return n.id === connTo(conn); });
            if (fromNode && fromNode.type === 'junction' && conn.fromPort) {
                if (!fromNode.portConns) fromNode.portConns = {};
                if (remove) delete fromNode.portConns[conn.fromPort];
                else fromNode.portConns[conn.fromPort] = conn.id;
            }
            if (toNode && toNode.type === 'junction' && conn.toPort) {
                if (!toNode.portConns) toNode.portConns = {};
                if (remove) delete toNode.portConns[conn.toPort];
                else toNode.portConns[conn.toPort] = conn.id;
            }
            // 마커 리렌더
            if (fromNode && fromNode.type === 'junction' && markers[fromNode.id]) {
                markers[fromNode.id].setMap(null); delete markers[fromNode.id]; renderNode(fromNode);
            }
            if (toNode && toNode.type === 'junction' && markers[toNode.id]) {
                markers[toNode.id].setMap(null); delete markers[toNode.id]; renderNode(toNode);
            }
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
            const poles = nodes.filter(n => n.type==='pole'||n.type==='pole_existing'||n.type==='pole_new'||n.type==='pole_removed'||n.type==='pole_private');
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

        // 마우스 이동: 10m 이내 전주에 가이드 실선 표시
        function onMapMousemoveForSnap(me) {
            if (!connectingMode) return;
            const lat=me.coord.lat(), lng=me.coord.lng();
            if (snapCircleOverlay) { snapCircleOverlay.setMap(null); snapCircleOverlay=null; }
            if (snapHighlight) { snapHighlight.setMap(null); snapHighlight=null; }
            if (snapGuideLine) { snapGuideLine.setMap(null); snapGuideLine=null; }
            var _snapR = _isCoaxDesignConnecting() ? COAX_SNAP_RADIUS_M : SNAP_RADIUS_M;
            const nearPole = findNearestPoleR(lat, lng, _snapR);
            if (nearPole) {
                var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                var poleLat = nearPole.lat + _off.dLat, poleLng = nearPole.lng + _off.dLng;
                // 전주 하이라이트 (녹색 점)
                snapHighlight = new naver.maps.Circle({
                    map:map._m, center:new naver.maps.LatLng(poleLat, poleLng), radius:3,
                    strokeWeight:2, strokeColor:'#00cc44', strokeOpacity:1,
                    fillColor:'#00cc44', fillOpacity:0.8
                });
                // 커서 → 전주 가이드 실선
                snapGuideLine = new naver.maps.Polyline({
                    map: map._m,
                    path: [new naver.maps.LatLng(lat, lng), new naver.maps.LatLng(poleLat, poleLng)],
                    strokeColor: '#00cc44', strokeWeight: 1, strokeOpacity: 0.7,
                    strokeStyle: 'solid'
                });
            }
        }

        // 전주 마커 직접 클릭 시 경유점으로 추가 (map.js onNodeClick에서 호출)
        function addPoleAsWaypoint(node) {
            if (!connectingMode || !connectingFromNode) return;
            // 마커 클릭 처리 완료 → 다음 맵 클릭 즉시 허용
            window._nodeJustClicked = false;
            // 같은 전주에 이미 경유점이 있으면 무시
            if (pendingWaypoints.some(function(wp) { return wp.snappedPole === node.id; })) {
                showStatus('⚠ 이미 경유된 전주입니다: ' + (node.name || node.id));
                return;
            }
            var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
            var pLat = node.lat + _off.dLat, pLng = node.lng + _off.dLng;
            pendingWaypoints.push({ lat:pLat, lng:pLng, snappedPole:node.id });
            waypointMarkers.push(_makeWaypointMarker(pLat, pLng, pendingWaypoints.length));
            updatePreviewLine();
            showStatus('전주 등록: '+node.name+' | 경유점 '+pendingWaypoints.length+'개');
        }

        // 장비 노드를 경유점으로 추가 (연결 확인 취소 시 호출)
        // 장비가 전주에 스냅돼 있으면 전주 위치를 경유점으로 사용
        function addEquipAsWaypoint(node) {
            if (!connectingMode || !connectingFromNode) return;
            window._nodeJustClicked = false;
            var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
            // snappedPoleId가 있으면 해당 전주 위치 사용, 없으면 장비 위치
            var poleNode = node.snappedPoleId ? nodes.find(function(n){ return n.id === node.snappedPoleId; }) : null;
            var base = poleNode || node;
            var pLat = base.lat + _off.dLat, pLng = base.lng + _off.dLng;
            var snappedId = poleNode ? poleNode.id : null;
            // 이미 같은 전주 경유점 있으면 무시
            if (snappedId && pendingWaypoints.some(function(wp){ return wp.snappedPole === snappedId; })) {
                showStatus('⚠ 이미 경유된 전주입니다: ' + (poleNode.name || snappedId));
                return;
            }
            var wp = { lat: pLat, lng: pLng };
            if (snappedId) wp.snappedPole = snappedId;
            pendingWaypoints.push(wp);
            waypointMarkers.push(_makeWaypointMarker(pLat, pLng, pendingWaypoints.length));
            updatePreviewLine();
            var label = poleNode ? ('전주 스냅: ' + (poleNode.name || snappedId)) : (node.name || node.type);
            showStatus('경유점 추가: ' + label + ' | 경유점 ' + pendingWaypoints.length + '개');
        }
        window.addEquipAsWaypoint = addEquipAsWaypoint;

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
            if (_now - _lastWaypointClick < 150) return;
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
                        // 도착 장비가 함체이면 포트 자동결정 또는 선택 팝업
                        if (nearJunction.type === 'junction') {
                            // FROM 포트에 따라 기본 TO 포트 결정: OUT→IN, IN→OUT, null→IN
                            var expectedTo = (window._pendingFromPort === 'IN') ? 'OUT' : 'IN';
                            var toPortConns = window._getJunctionPortConns ? window._getJunctionPortConns(nearJunction) : (nearJunction.portConns || {});
                            var isOccupied = !!toPortConns[expectedTo];
                            if (!isOccupied) {
                                // 기본 포트 비어있음 → 자동 연결
                                window._pendingToPort = expectedTo;
                                showConnectionModal();
                            } else if (window.showJunctionPortSelect) {
                                // 기본 포트 사용중 → 수동 선택
                                window.showJunctionPortSelect(nearJunction, 'to', function(portId) {
                                    window._pendingToPort = portId;
                                    showConnectionModal();
                                });
                            } else {
                                window._pendingToPort = null;
                                showConnectionModal();
                            }
                        } else {
                            showConnectionModal();
                        }
                    },
                    '근처에 ' + jName + ' 장비가 있습니다',
                    '연결',
                    function() {
                        // 취소 → 경유점으로 저장 여부 재확인
                        showConfirm(
                            jTypeLabel + " '" + jName + "'을 경유점으로 추가할까요?",
                            function() { addEquipAsWaypoint(nearJunction); },
                            '',
                            '경유점 추가'
                        );
                    }
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
                waypointMarkers.push(_makeWaypointMarker(lat, lng, pendingWaypoints.length));
                updatePreviewLine();
                _showCoaxRouteLabel(nearPole.name || nearPole.id, lat, lng);
                showStatus('경유: ' + (nearPole.name || '') + ' | 경유점 ' + pendingWaypoints.length + '개 (Space=일시정지)');
                return;
            }

            // 광 모드: 클릭 위치에 자유 경유점 추가
            pendingWaypoints.push({ lat: lat, lng: lng });
            waypointMarkers.push(_makeWaypointMarker(lat, lng, pendingWaypoints.length));
            updatePreviewLine();
            showStatus('경유점 ' + pendingWaypoints.length + '개 (Space=일시정지)');
        }

        function updatePreviewLine() {
            if (previewPolyline) map.removeLayer(previewPolyline);
            // ONU outPort 오프셋 적용
            let startLat = connectingFromNode.lat, startLng = connectingFromNode.lng;
            if (connectingFromNode.type === 'onu' && window._coaxCurrentOutPort && typeof getOnuPortLatLng === 'function') {
                var portPos = getOnuPortLatLng(connectingFromNode, window._coaxCurrentOutPort);
                startLat = portPos.lat;
                startLng = portPos.lng;
            } else if (connectingFromNode.type === 'junction' && window._pendingFromPort && window.getJunctionPortLatLng) {
                var jPortPos = window.getJunctionPortLatLng(connectingFromNode, window._pendingFromPort);
                startLat = jPortPos.lat;
                startLng = jPortPos.lng;
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
            if (snapGuideLine) { snapGuideLine.setMap(null); snapGuideLine=null; }
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
                connectingFromNode = null; window._connectingSourceNodeId = null; connectingToNode = null;
                clearPreviewOnly(); pendingWaypoints = [];
                return;
            }

            // inOrder / connDirections 설정
            if (!connectingToNode.inOrder) connectingToNode.inOrder = [];
            if (!connectingFromNode.connDirections) connectingFromNode.connDirections = {};
            if (!connectingToNode.connDirections) connectingToNode.connDirections = {};

            var connId = _genId();
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
                outPort: window._coaxCurrentOutPort || null,
                fromPort: window._pendingFromPort || null,
                toPort: window._pendingToPort || null
            };

            connectingToNode.inOrder.push(connId);
            var toIdx2 = nodes.findIndex(function(n) { return n.id === connectingToNode.id; });
            if (toIdx2 !== -1) nodes[toIdx2] = connectingToNode;

            connections.push(connection);

            // 함체 portConns + 자동 각도
            _updateJunctionPortConns(connection, false);
            _autoRotateJunctions([connectingFromNode.id, connectingToNode.id]);

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
            connectingFromNode = null; window._connectingSourceNodeId = null; connectingToNode = null;
            selectedNode = null;
            pendingWaypoints = [];
            window._coaxCurrentOutPort = null;
            window._pendingFromPort = null;
            window._pendingToPort = null;
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

                        const newConnId = _genId();
                        const newConn = {
                            id: newConnId,
                            nodeA: fn.id,   // fn이 OUT(송신)측
                            nodeB: tn.id,   // tn이 IN(수신)측
                            cores: cs,
                            cableType: _isCoaxConn ? 'coax' : 'fiber',
                            waypoints: wp,
                            portMapping: [],
                            inFromCableId: null,
                            outPort: _isCoaxConn ? (window._coaxCurrentOutPort || null) : null,
                            fromPort: window._pendingFromPort || null,
                            toPort: window._pendingToPort || null
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
                        // 함체 portConns + 자동 각도
                        _updateJunctionPortConns(newConn, false);
                        _autoRotateJunctions([fn.id, tn.id]);
                        window._pendingFromPort = null;
                        window._pendingToPort = null;
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
            
            const connId = _genId();

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
                outPort: _isCoaxConn ? (window._coaxCurrentOutPort || null) : null,
                fromPort: window._pendingFromPort || null,
                toPort: window._pendingToPort || null
            };
            pendingWaypoints = [];

            // 첫 번째 IN 연결이면 inOrder에 등록
            connectingToNode.inOrder.push(connection.id);
            const toIdx2 = nodes.findIndex(n => n.id === connectingToNode.id);
            if (toIdx2 !== -1) nodes[toIdx2] = connectingToNode;

            connections.push(connection);

            // 함체 portConns + 자동 각도
            _updateJunctionPortConns(connection, false);
            _autoRotateJunctions([connectingFromNode.id, connectingToNode.id]);

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
            connectingFromNode = null; window._connectingSourceNodeId = null;
            connectingToNode = null;
            selectedNode = null;
            hideStatus();
            if (_isCoaxConn) window._coaxCurrentOutPort = null;
            window._pendingFromPort = null;
            window._pendingToPort = null;
            showStatus('IN1 케이블이 연결되었습니다');
        }
        
        // 연결 모달 닫기
        function closeConnectionModal() {
            document.getElementById('connectionModal').classList.remove('active');
            connectingMode = false; window.connectingMode = false; document.body.classList.remove('connecting-mode');
            connectingFromNode = null; window._connectingSourceNodeId = null;
            connectingToNode = null;
            selectedNode = null;
            // 잔여 경유점 마커/프리뷰 정리
            if (typeof clearPendingWaypoints === 'function') clearPendingWaypoints();
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

        // ==================== 전주 라벨 다중검색 ====================
        // window._poleSearchLabels: Map<poleId, {memo}> - 매칭된 전주별 표시할 메모
        // window._poleSearchLabelsHidden: 검색 라벨 숨김 토글
        // window._allOverlaysHidden: 현재도면 전체 숨김 토글
        window._poleSearchLabels = window._poleSearchLabels || new Map();
        window._poleSearchLabelsHidden = false;
        window._allOverlaysHidden = false;

        function togglePoleSearchPanel() {
            var panel = document.getElementById('poleSearchPanel');
            if (!panel) return;
            var open = panel.style.display === 'none' || !panel.style.display;
            panel.style.display = open ? 'flex' : 'none';
            var btn = document.getElementById('poleSearchPanelBtn');
            if (btn) btn.classList.toggle('active', open);
        }
        window.togglePoleSearchPanel = togglePoleSearchPanel;

        function closePoleSearchPanel() {
            var panel = document.getElementById('poleSearchPanel');
            if (panel) panel.style.display = 'none';
            var btn = document.getElementById('poleSearchPanelBtn');
            if (btn) btn.classList.remove('active');
        }
        window.closePoleSearchPanel = closePoleSearchPanel;

        // 입력 정규화 — 공백/하이픈 제거 + 대소문자 통일
        function _normPoleKey(s) {
            return (s || '').replace(/[\s\-_]/g, '').toUpperCase();
        }

        // 엑셀 붙여넣기 텍스트 파싱 — 탭/2칸이상 공백/줄바꿈 분리
        function parsePoleSearchInput(text) {
            var rows = [];
            var lines = (text || '').split(/\r?\n/);
            for (var i = 0; i < lines.length; i++) {
                var ln = lines[i].trim();
                if (!ln) continue;
                // 탭 우선 — 없으면 2칸이상 공백/콤마/세미콜론 폴백
                var cols;
                if (lines[i].indexOf('\t') !== -1) {
                    cols = lines[i].split('\t');
                } else if (/[,;]/.test(ln)) {
                    cols = ln.split(/[,;]/);
                } else if (/\s{2,}/.test(ln)) {
                    cols = ln.split(/\s{2,}/);
                } else {
                    // 단일 토큰 — sn으로 간주
                    cols = [ln];
                }
                var sn   = (cols[0] || '').trim();
                var name = (cols[1] || '').trim();
                var memo = (cols[2] || '').trim();
                if (!sn && !name) continue;
                rows.push({ sn: sn, name: name, memo: memo, raw: ln });
            }
            console.log('[라벨검색] 파싱:', rows.length, '행', rows);
            return rows;
        }

        // DB 전체 전주 인덱스 캐시 (한 번 로드 후 재사용)
        // applyPoleSearch가 await로 _ensurePoleDBIndex() 호출
        window._poleDBIndex = window._poleDBIndex || null;
        async function _ensurePoleDBIndex() {
            if (window._poleDBIndex) return window._poleDBIndex;
            if (!window.getDB) return null;
            var db = await window.getDB();
            if (!db) return null;
            var byName = new Map(), bySN = new Map();
            return new Promise(function(resolve) {
                var tx = db.transaction('poles', 'readonly');
                tx.objectStore('poles').openCursor().onsuccess = function(e) {
                    var c = e.target.result;
                    if (c) {
                        var n = c.value;
                        if (n.name) byName.set(_normPoleKey(n.name), n);
                        if (n.memo) {
                            var sm = n.memo.match(/전산화번호\s*[:：]?\s*([A-Za-z0-9]+)/);
                            if (sm) bySN.set(_normPoleKey(sm[1]), n);
                        }
                        c.continue();
                    } else {
                        window._poleDBIndex = { byName: byName, bySN: bySN };
                        console.log('[라벨검색] DB 인덱스 캐시:', byName.size + '개 name,', bySN.size + '개 sn');
                        resolve(window._poleDBIndex);
                    }
                };
                tx.onerror = function(){ resolve(null); };
            });
        }
        window._invalidatePoleDBIndex = function() { window._poleDBIndex = null; };

        // 전주 매칭 — 전주번호 우선, 없으면 전산화번호로
        // dbIndex가 있으면 그걸 쓰고, 없으면 nodes(메모리) 폴백
        function matchPoleSearch(rows, dbIndex) {
            var byName, bySN;
            if (dbIndex) {
                byName = dbIndex.byName; bySN = dbIndex.bySN;
            } else {
                byName = new Map(); bySN = new Map();
                nodes.forEach(function(n) {
                    var isPole = (typeof isPoleType === 'function')
                        ? isPoleType(n.type)
                        : (n.type && n.type.indexOf('pole') === 0);
                    if (!isPole) return;
                    if (n.name) byName.set(_normPoleKey(n.name), n);
                    if (n.memo) {
                        var snMatch = n.memo.match(/전산화번호\s*[:：]?\s*([A-Za-z0-9]+)/);
                        if (snMatch) bySN.set(_normPoleKey(snMatch[1]), n);
                    }
                });
            }
            var _poleCount = byName.size;
            console.log('[라벨검색] 전체 nodes:', nodes.length, '/ 전주 수:', _poleCount,
                '/ byName:', byName.size, '/ bySN:', bySN.size);
            console.log('[라벨검색] byName 샘플:', Array.from(byName.keys()).slice(0, 5));
            console.log('[라벨검색] bySN 샘플:',   Array.from(bySN.keys()).slice(0, 5));

            var matched = new Map(); // poleId → memo
            var missing = [];
            var _missLogShown = 0;
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                var node = null;
                var nameKey = r.name ? _normPoleKey(r.name) : '';
                var snKey   = r.sn   ? _normPoleKey(r.sn)   : '';
                // 1) 전주번호 우선
                if (nameKey) node = byName.get(nameKey);
                // 2) 폴백: 전산화번호
                if (!node && snKey) node = bySN.get(snKey);
                if (node) {
                    var nameLine = r.name || node.name || r.sn || '';
                    var memoLine = r.memo || '';
                    if (!matched.has(node.id)) matched.set(node.id, {
                        name: nameLine, memo: memoLine,
                        lat: node.lat, lng: node.lng
                    });
                } else {
                    if (_missLogShown < 3) {
                        console.log('[라벨검색] 미매칭#' + (_missLogShown+1), {
                            input: r, nameKey: nameKey, snKey: snKey,
                            byNameHas: byName.has(nameKey), bySNHas: bySN.has(snKey)
                        });
                        _missLogShown++;
                    }
                    missing.push(r);
                }
            }
            return { matched: matched, missing: missing };
        }

        async function applyPoleSearch() {
            var input = document.getElementById('poleSearchMultiInput');
            if (!input) return;
            var rows = parsePoleSearchInput(input.value);
            if (rows.length === 0) {
                showStatus('입력이 비어 있습니다.');
                return;
            }
            var t0 = performance.now();
            showStatus('DB 인덱스 준비 중...');
            var dbIndex = await _ensurePoleDBIndex();
            showStatus('매칭 중...');
            var result = matchPoleSearch(rows, dbIndex);
            console.log('[라벨검색] 총 ' + (performance.now() - t0).toFixed(0) + 'ms');
            window._poleSearchLabels = result.matched;
            window._poleSearchLabelsHidden = false;

            // 요약/매칭/누락 표시
            var sum = document.getElementById('pspSummary');
            if (sum) {
                sum.innerHTML = '입력 ' + rows.length + '건 → 매칭 <b style="color:#27ae60">' + result.matched.size + '</b> · 미발견 <b style="color:#c0392b">' + result.missing.length + '</b>';
            }

            // 매칭 리스트 (클릭 → 전주로 이동)
            window._poleSearchMatchedIds = Array.from(result.matched.keys());
            window._poleSearchNavIndex = -1;
            var matchedDiv = document.getElementById('pspMatched');
            if (matchedDiv) {
                if (result.matched.size === 0) {
                    matchedDiv.innerHTML = '';
                    matchedDiv.classList.remove('expanded');
                } else {
                    var mhtml = '<div class="mt-head" onclick="toggleMatchedList()">' +
                        '<span>✅ 매칭 ' + result.matched.size + '건 — 클릭으로 펼치기/이동</span>' +
                        '<span id="mtArrow">▼</span></div>' +
                        '<div class="mt-list">' +
                        '<div class="mt-nav">' +
                        '<button onclick="navigatePoleSearch(-1)" id="navPrevBtn">◀ 이전</button>' +
                        '<button onclick="navigatePoleSearch(1)" id="navNextBtn">다음 ▶</button>' +
                        '</div>';
                    var idx = 0;
                    result.matched.forEach(function(d, poleId) {
                        var n = nodes.find(function(x){ return x.id === poleId; });
                        var nm = (d && d.name) ? d.name : (n ? n.name : '');
                        var mm = (d && d.memo) ? d.memo : '';
                        mhtml += '<div class="mi" onclick="navigateToPoleById(\'' + poleId.replace(/'/g, "\\'") + '\')">' +
                            '<span class="mi-name">' + (idx+1) + '. ' + nm + '</span>' +
                            (mm ? '<span class="mi-memo">' + mm + '</span>' : '') +
                            '</div>';
                        idx++;
                    });
                    mhtml += '</div>';
                    matchedDiv.innerHTML = mhtml;
                }
            }

            var miss = document.getElementById('pspMissing');
            window._poleSearchMissing = result.missing; // verifyMissingAll에서 참조
            if (miss) {
                if (result.missing.length === 0) {
                    miss.innerHTML = '';
                } else {
                    var html = '<div class="mt"><span>❌ 미발견 ' + result.missing.length + '건 — DB 추가검색 가능</span>' +
                        '<button onclick="verifyAllMissing()">전체 DB검색</button></div>';
                    for (var i = 0; i < result.missing.length; i++) {
                        var m = result.missing[i];
                        var info = (m.sn ? m.sn : '-') + ' / ' + (m.name ? m.name : '-') + (m.memo ? ' / ' + m.memo : '');
                        html += '<div class="mr" data-mridx="' + i + '">' +
                            '<span class="mr-info">' + info + '</span>' +
                            '<span class="mr-status unknown" onclick="verifyMissingPole(' + i + ')">🔍 검색</span>' +
                            '</div>';
                    }
                    miss.innerHTML = html;
                }
            }

            // 토글 버튼 라벨 갱신
            var tgl = document.getElementById('pspToggleBtn');
            if (tgl) tgl.textContent = '숨기기';

            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }
        window.applyPoleSearch = applyPoleSearch;

        function togglePoleSearchLabels() {
            window._poleSearchLabelsHidden = !window._poleSearchLabelsHidden;
            var tgl = document.getElementById('pspToggleBtn');
            if (tgl) tgl.textContent = window._poleSearchLabelsHidden ? '표시' : '숨기기';
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }
        window.togglePoleSearchLabels = togglePoleSearchLabels;

        // 점만 표시 토글 — 박스 숨기고 매칭 전주를 주황 점으로만 표시
        function togglePoleSearchDotsOnly() {
            window._poleSearchDotsOnly = !window._poleSearchDotsOnly;
            var btn = document.getElementById('pspDotsBtn');
            if (btn) {
                btn.classList.toggle('active', window._poleSearchDotsOnly);
                btn.textContent = window._poleSearchDotsOnly ? '점만 표시 ON' : '점만 표시';
            }
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }
        window.togglePoleSearchDotsOnly = togglePoleSearchDotsOnly;

        // 드래그된 라벨 위치 모두 초기화
        function resetPoleSearchPositions() {
            window._poleSearchLabelOverrides = new Map();
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }
        window.resetPoleSearchPositions = resetPoleSearchPositions;

        // 매칭된 전주들이 모두 보이도록 지도 줌/팬
        function fitToPoleSearchResults() {
            var labels = window._poleSearchLabels;
            if (!labels || labels.size === 0 || !map || !map._m) {
                showStatus('매칭된 전주가 없습니다.');
                return;
            }
            var minLat = Infinity, maxLat = -Infinity;
            var minLng = Infinity, maxLng = -Infinity;
            labels.forEach(function(d, poleId) {
                var n = nodes.find(function(x){ return x.id === poleId; });
                var lat = n ? n.lat : (d ? d.lat : null);
                var lng = n ? n.lng : (d ? d.lng : null);
                if (lat == null || lng == null) return;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
            });
            if (!isFinite(minLat)) {
                showStatus('좌표를 확인할 수 없습니다.');
                return;
            }
            // naver.maps.LatLngBounds로 fitBounds
            try {
                var bounds = new naver.maps.LatLngBounds(
                    new naver.maps.LatLng(minLat, minLng),
                    new naver.maps.LatLng(maxLat, maxLng)
                );
                map._m.fitBounds(bounds, { top: 60, right: 360, bottom: 60, left: 60 });
            } catch (e) {
                // fitBounds 실패 시 중심점만 setCenter
                var cLat = (minLat + maxLat) / 2;
                var cLng = (minLng + maxLng) / 2;
                map.setCenter(cLat, cLng);
            }
            if (typeof drawPoleCanvas === 'function') {
                setTimeout(drawPoleCanvas, 200);
            }
        }
        window.fitToPoleSearchResults = fitToPoleSearchResults;

        // 매칭 리스트 펼침/접힘 토글
        function toggleMatchedList() {
            var div = document.getElementById('pspMatched');
            if (!div) return;
            div.classList.toggle('expanded');
            var arr = document.getElementById('mtArrow');
            if (arr) arr.textContent = div.classList.contains('expanded') ? '▲' : '▼';
        }
        window.toggleMatchedList = toggleMatchedList;

        // 특정 전주로 지도 이동 + 강조
        function navigateToPoleById(poleId) {
            var n = nodes.find(function(x){ return x.id === poleId; });
            if (!n || !map) return;
            map.setCenter(n.lat, n.lng);
            map.setLevel(2); // 줌 16
            window._poleSearchHighlight = n.id;
            // 인덱스 동기화 (prev/next 위치 추적)
            if (window._poleSearchMatchedIds) {
                var i = window._poleSearchMatchedIds.indexOf(poleId);
                if (i !== -1) window._poleSearchNavIndex = i;
            }
            if (typeof drawPoleCanvas === 'function') {
                setTimeout(function(){ drawPoleCanvas(); }, 200);
                setTimeout(function(){
                    window._poleSearchHighlight = null;
                    drawPoleCanvas();
                }, 3000);
            }
        }
        window.navigateToPoleById = navigateToPoleById;

        // ── 미발견 항목 DB 검색 ────────────────────────────
        // searchPoles()는 IDB 전체를 substring 매칭하므로, 메모리(nodes)에 안 올라온 전주도 찾을 수 있음
        async function _idbSearchAny(queries) {
            if (!window.getDB) return [];
            var db = await window.getDB();
            if (!db) return [];
            // queries[]: ["8714Z201", "광덕지 34", "광덕지34", "광덕지-34"] 등 변형
            var qs = queries.map(function(q){ return (q||'').toLowerCase().trim(); }).filter(Boolean);
            if (qs.length === 0) return [];
            return new Promise(function(resolve) {
                var results = [];
                var seen = {};
                var tx = db.transaction('poles', 'readonly');
                var store = tx.objectStore('poles');
                store.openCursor().onsuccess = function(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        var n = cursor.value;
                        var name = (n.name || '').toLowerCase();
                        var memo = (n.memo || '').toLowerCase();
                        for (var i = 0; i < qs.length; i++) {
                            if (name.indexOf(qs[i]) !== -1 || memo.indexOf(qs[i]) !== -1) {
                                if (!seen[n.id]) { seen[n.id] = true; results.push(n); }
                                break;
                            }
                        }
                        cursor.continue();
                    } else {
                        resolve(results.slice(0, 10));
                    }
                };
                tx.onerror = function() { resolve([]); };
            });
        }

        // 한 미발견 항목 DB 검색
        async function verifyMissingPole(idx) {
            var arr = window._poleSearchMissing;
            if (!arr || !arr[idx]) return;
            var m = arr[idx];
            var row = document.querySelector('.mr[data-mridx="' + idx + '"]');
            if (!row) return;
            var status = row.querySelector('.mr-status');
            if (status) {
                status.className = 'mr-status loading';
                status.textContent = '검색 중...';
            }
            // 다양한 변형으로 검색 시도
            var queries = [];
            if (m.sn)   queries.push(m.sn);
            if (m.name) {
                queries.push(m.name);
                queries.push(m.name.replace(/\s+/g, ''));   // 공백 제거
                queries.push(m.name.replace(/\s+/g, '-'));  // 공백→하이픈
                // 선로명/번호 분리해서 별개 검색은 결과가 너무 많아져서 생략
            }
            var results = await _idbSearchAny(queries);
            if (!status) return;
            if (results.length === 0) {
                status.className = 'mr-status notfound';
                status.textContent = '❌ DB에 없음';
                status.removeAttribute('onclick');
                m._verifiedNotFound = true;
            } else {
                m._verifiedNode = results[0];
                m._verifiedAll = results;
                status.className = 'mr-status found';
                var label = '📍 발견 (' + results.length + ') — 이동';
                status.textContent = label;
                status.setAttribute('onclick', 'navigateToVerifiedMissing(' + idx + ')');
            }
        }
        window.verifyMissingPole = verifyMissingPole;

        // 전체 미발견 일괄 DB 검색 (순차 실행)
        async function verifyAllMissing() {
            var arr = window._poleSearchMissing;
            if (!arr || arr.length === 0) return;
            // 이미 확인 끝난건 스킵
            for (var i = 0; i < arr.length; i++) {
                if (arr[i]._verifiedNode || arr[i]._verifiedNotFound) continue;
                await verifyMissingPole(i);
            }
        }
        window.verifyAllMissing = verifyAllMissing;

        // 검증된 미발견 항목으로 이동
        function navigateToVerifiedMissing(idx) {
            var arr = window._poleSearchMissing;
            if (!arr || !arr[idx]) return;
            var n = arr[idx]._verifiedNode;
            if (!n || !map) return;
            map.setCenter(n.lat, n.lng);
            map.setLevel(2);
            window._poleSearchHighlight = n.id;
            // 강조 — drawPoleCanvas는 nodes 기반이므로, DB에서만 찾은 전주는
            // 화면에 점이 안 보일 수 있음. 사용자가 그 영역에서 데이터 새로고침 필요.
            if (typeof drawPoleCanvas === 'function') {
                setTimeout(function(){ drawPoleCanvas(); }, 200);
                setTimeout(function(){
                    window._poleSearchHighlight = null;
                    drawPoleCanvas();
                }, 3000);
            }
            // refreshPoles가 있으면 호출 — 새 영역 데이터 로드
            if (typeof refreshPoles === 'function') refreshPoles();
        }
        window.navigateToVerifiedMissing = navigateToVerifiedMissing;

        // 매칭 전주 목록 이전/다음 순회 (delta = -1 or +1)
        function navigatePoleSearch(delta) {
            var ids = window._poleSearchMatchedIds;
            if (!ids || ids.length === 0) return;
            var i = (window._poleSearchNavIndex == null ? -1 : window._poleSearchNavIndex);
            i = (i + delta + ids.length) % ids.length;
            window._poleSearchNavIndex = i;
            navigateToPoleById(ids[i]);
            // 진행 상태 표시 (다음 ▶ 버튼 라벨 업데이트)
            var nb = document.getElementById('navNextBtn');
            if (nb) nb.textContent = '다음 ▶ (' + (i+1) + '/' + ids.length + ')';
            var pb = document.getElementById('navPrevBtn');
            if (pb) pb.textContent = '◀ 이전';
        }
        window.navigatePoleSearch = navigatePoleSearch;

        function clearPoleSearch() {
            window._poleSearchLabels = new Map();
            window._poleSearchLabelOverrides = new Map();
            window._poleSearchLabelsHidden = false;
            var sum = document.getElementById('pspSummary');
            if (sum) sum.innerHTML = '';
            var miss = document.getElementById('pspMissing');
            if (miss) miss.innerHTML = '';
            var tgl = document.getElementById('pspToggleBtn');
            if (tgl) tgl.textContent = '숨기기';
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }
        window.clearPoleSearch = clearPoleSearch;

        // 현재 도면 전체 표시/숨기기 (전주마커/케이블/장비 모두) — 검색 라벨은 유지
        function toggleAllOverlays() {
            window._allOverlaysHidden = !window._allOverlaysHidden;
            document.body.classList.toggle('hide-all-overlays', window._allOverlaysHidden);
            var btn = document.getElementById('hideAllOverlaysBtn');
            if (btn) {
                btn.classList.toggle('active', window._allOverlaysHidden);
                var slash = document.getElementById('allOverlaysSlash');
                if (slash) slash.setAttribute('display', window._allOverlaysHidden ? 'inline' : 'none');
            }
            // 장비 마커(전주 제외) detach/reattach — coax 마커가 CSS로 안 잡히는 케이스 대응
            try {
                if (window._allOverlaysHidden) {
                    Object.keys(markers).forEach(function(id) {
                        var node = nodes.find(function(n) { return n.id === id; });
                        if (node && !isPoleType(node.type) && markers[id] && markers[id].setMap) {
                            markers[id].setMap(null);
                        }
                    });
                } else {
                    // 재렌더 — renderNode가 setMap(null) 후 새로 만듦
                    nodes.forEach(function(n) {
                        if (!isPoleType(n.type) && typeof renderNode === 'function') renderNode(n);
                    });
                }
            } catch(e) { console.warn('toggleAllOverlays markers:', e); }

            if (typeof renderAllConnections === 'function') renderAllConnections();
            else if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }
        window.toggleAllOverlays = toggleAllOverlays;

        // ==================== poleRoute 시스템 ====================

        // poleRoute에서 경로 좌표 생성 — 전주 ID 배열 → [lat,lng] 배열
        // 전주별 sibling 감지 + 방향 인식 bisector 오프셋 적용
        function buildPoleRoutePath(connection, fromNode, toNode, _unusedOffset) {
            var poleRoute = connection.poleRoute;
            var off = window._polePreviewOffset || { dLat: 0, dLng: 0 };

            // 시작점 (장비 포트 좌표)
            var startLat = fromNode.lat, startLng = fromNode.lng;
            if (fromNode.type === 'onu' && connection.outPort && typeof getOnuPortLatLng === 'function') {
                var pp = getOnuPortLatLng(fromNode, connection.outPort);
                startLat = pp.lat; startLng = pp.lng;
            } else if (fromNode.type === 'junction' && window.getJunctionPortLatLng) {
                var jp = window.getJunctionPortLatLng(fromNode, connection.fromPort || 'OUT');
                startLat = jp.lat; startLng = jp.lng;
            }

            // 끝점 (장비 포트 좌표)
            var endLat = toNode.lat, endLng = toNode.lng;
            if (toNode.type === 'junction' && window.getJunctionPortLatLng) {
                var jtp = window.getJunctionPortLatLng(toNode, connection.toPort || 'IN');
                endLat = jtp.lat; endLng = jtp.lng;
            }

            // 전주 좌표 조회
            var poleCoords = []; // [{lat, lng, id}]
            for (var i = 0; i < poleRoute.length; i++) {
                var pole = nodes.find(function(n) { return n.id === poleRoute[i]; });
                if (pole) {
                    poleCoords.push({ lat: pole.lat + off.dLat, lng: pole.lng + off.dLng, id: pole.id });
                }
            }

            if (poleCoords.length === 0) {
                return [[startLat, startLng], [endLat, endLng]];
            }

            // ── 전주별 sibling 감지: 같은 전주를 경유하는 모든 poleRoute 케이블 ──
            // 각 전주에서 이 케이블이 몇 번째 슬롯인지 계산
            var poleSlots = {}; // { poleId: { total, myIndex } }
            var connId = connection.id;

            poleCoords.forEach(function(pc) {
                var pid = pc.id;
                // 이 전주를 경유하는 모든 케이블 (poleRoute 기반 + waypoints.snappedPole 기반)
                var siblings = connections.filter(function(c) {
                    if (c.poleRoute) return c.poleRoute.indexOf(pid) !== -1;
                    if (c.waypoints) return c.waypoints.some(function(wp) { return wp.snappedPole === pid; });
                    return false;
                });
                // 일관된 정렬 (ID 기준)
                siblings.sort(function(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
                var total = siblings.length;
                var myIdx = siblings.findIndex(function(c) { return c.id === connId; });
                if (myIdx === -1) myIdx = 0;
                poleSlots[pid] = { total: total, myIndex: myIdx };
            });

            // 전체 포인트 배열: 시작점 + 전주들 + 끝점
            var points = [{ lat: startLat, lng: startLng, id: null }];
            poleCoords.forEach(function(p) { points.push(p); });
            points.push({ lat: endLat, lng: endLng, id: null });

            // 방향 인식 bisector 오프셋 적용
            var result = [];
            var degPerM = 1 / 111320;
            var spacingM = getOffsetM(_cableSpacingBase);

            for (var k = 0; k < points.length; k++) {
                var pt = points[k];

                // 시작/끝 장비는 오프셋 없음
                if (k === 0 || k === points.length - 1) {
                    result.push([pt.lat, pt.lng]);
                    continue;
                }

                // 이 전주에서의 슬롯 정보
                // 첫 번째 케이블(slot 0)은 전주 중심, 이후는 간격만큼 밀림
                var slot = poleSlots[pt.id] || { total: 1, myIndex: 0 };
                var poleOffset = slot.myIndex * spacingM;

                if (poleOffset === 0) {
                    result.push([pt.lat, pt.lng]);
                    continue;
                }

                var prev = points[k - 1];
                var next = points[k + 1];

                // 입사/출사 방향 벡터
                var dxIn  = pt.lng - prev.lng, dyIn  = pt.lat - prev.lat;
                var lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn) || 1;
                dxIn /= lenIn; dyIn /= lenIn;

                var dxOut = next.lng - pt.lng, dyOut = next.lat - pt.lat;
                var lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut) || 1;
                dxOut /= lenOut; dyOut /= lenOut;

                // 각 방향의 수직벡터 (왼쪽 90도)
                var perpInX  = -dyIn,  perpInY  = dxIn;
                var perpOutX = -dyOut, perpOutY = dxOut;

                // bisector (이등분선)
                var bisX = perpInX + perpOutX;
                var bisY = perpInY + perpOutY;
                var bisLen = Math.sqrt(bisX * bisX + bisY * bisY) || 1;
                bisX /= bisLen; bisY /= bisLen;

                // miter 보정
                var dot = perpInX * bisX + perpInY * bisY;
                var miterScale = (Math.abs(dot) > 0.1) ? 1 / dot : 1;
                if (miterScale > 2.5) miterScale = 2.5;

                var offLat = bisY * poleOffset * degPerM * miterScale;
                var offLng = bisX * poleOffset * degPerM * miterScale;

                result.push([pt.lat + offLat, pt.lng + offLng]);
            }

            return result;
        }

        // poleRoute에서 특정 구간의 병렬 케이블 수 계산
        // (향후 구간별 세분화에 사용, 현재는 endpoint 기반 sibling 사용)
        window.buildPoleRoutePath = buildPoleRoutePath;

        // 전주 삭제 시 모든 케이블의 poleRoute/waypoints에서 해당 전주 제거
        window.removePoleFromAllRoutes = function(poleId) {
            connections.forEach(function(conn) {
                // poleRoute에서 제거
                if (conn.poleRoute) {
                    conn.poleRoute = conn.poleRoute.filter(function(id) { return id !== poleId; });
                    if (conn.poleRoute.length === 0) delete conn.poleRoute;
                }
                // waypoints에서도 제거 (snappedPole 일치)
                if (conn.waypoints) {
                    conn.waypoints = conn.waypoints.filter(function(wp) { return wp.snappedPole !== poleId; });
                }
            });
        };

        // ==================== poleRoute 시스템 끝 ====================

        // 연결 렌더링
        // 두 점 사이 수직 오프셋 (lat/lng 단위)
        function perpOffset(lat1, lng1, lat2, lng2, distM) {
            const dx = lng2 - lng1;
            const dy = lat2 - lat1;
            const len = Math.sqrt(dx*dx + dy*dy) || 1;
            const degPerM = 1 / 111320;
            return { dlat: -dx/len * distM * degPerM, dlng: dy/len * distM * degPerM };
        }

        // 병렬 케이블 기본 간격 (사용자 설정, localStorage 저장)
        var _cableSpacingBase = parseFloat(localStorage.getItem('cableSpacingBase') || '6');

        window.setCableSpacing = function(val) {
            _cableSpacingBase = parseFloat(val);
            localStorage.setItem('cableSpacingBase', _cableSpacingBase);
            var lbl = document.getElementById('cableSpacingVal');
            if (lbl) lbl.textContent = _cableSpacingBase + 'm';
            if (typeof renderAllConnections === 'function') renderAllConnections();
        };

        // 슬라이더 초기값 동기화 (DOM 로드 후)
        window._initCableSpacingUI = function() {
            var slider = document.getElementById('cableSpacingSlider');
            var lbl    = document.getElementById('cableSpacingVal');
            if (slider) slider.value = _cableSpacingBase;
            if (lbl)    lbl.textContent = _cableSpacingBase + 'm';
        };

        // 줌 레벨에 따라 오프셋 거리 조정 (시각적 일관성 유지)
        function getOffsetM(baseM) {
            var z = map ? map.getZoom() : 16;
            if (z >= 21) return baseM * 0.15;
            if (z >= 20) return baseM * 0.2;
            if (z >= 19) return baseM * 0.25;
            if (z >= 18) return baseM * 0.4;
            if (z >= 17) return baseM * 0.65;
            if (z >= 16) return baseM * 1.0;
            if (z >= 15) return baseM * 1.6;
            return baseM * 2.5;
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
        // 전주에서 특정 케이블의 진행 방향 벡터를 반환
        function getConnDirAtPole(conn, poleId) {
            var fNode = nodes.find(function(n) { return n.id === connFrom(conn); });
            var tNode = nodes.find(function(n) { return n.id === connTo(conn); });
            if (!fNode || !tNode) return null;
            var fullPath = [[fNode.lat, fNode.lng]].concat(
                conn.waypoints.map(function(w) { return [w.lat, w.lng]; }),
                [[tNode.lat, tNode.lng]]
            );
            var wpIdx = conn.waypoints.findIndex(function(w) { return w.snappedPole === poleId; });
            if (wpIdx < 0) return null;
            var polePathIdx = wpIdx + 1;
            var prev = fullPath[polePathIdx - 1];
            var next = fullPath[Math.min(polePathIdx + 1, fullPath.length - 1)];
            if (!prev || !next) return null;
            return { dlat: next[0] - prev[0], dlng: next[1] - prev[1] };
        }

        function applyPoleOffset(path, waypoints, connection) {
            if (!waypoints || waypoints.length === 0) return path;
            return path.map(function(pt, i) {
                if (i === 0 || i === path.length-1) return pt;
                const wp = waypoints[i-1];
                if (!wp || !wp.snappedPole) return pt;
                var poleId = wp.snappedPole;
                var poleConns = connection ? connections.filter(function(c) {
                    return c.waypoints && c.waypoints.some(function(w) { return w.snappedPole === poleId; });
                }) : [];
                var poleIdx = poleConns.findIndex(function(c) { return c.id === connection.id; });
                if (poleIdx <= 0) return pt;
                var offsetM = poleIdx * getOffsetM(_cableSpacingBase * 0.5);
                const prev = path[i-1];
                const next = path[Math.min(i+1, path.length-1)];
                var refDir = getConnDirAtPole(poleConns[0], poleId);
                if (refDir) {
                    var myDlat = next[0] - prev[0], myDlng = next[1] - prev[1];
                    if (myDlat * refDir.dlat + myDlng * refDir.dlng < 0) offsetM = -offsetM;
                }
                if (connection.offsetFlip) offsetM = -offsetM;
                const off = perpOffset(prev[0],prev[1],next[0],next[1], offsetM);
                return [pt[0]+off.dlat, pt[1]+off.dlng];
            });
        }

        function renderConnection(connection) {
            // 도면 전체 숨김 모드: 모든 케이블 렌더링 스킵
            if (window._allOverlaysHidden) return;
            // 광케이블 숨김 모드: fiber 케이블 렌더링 스킵
            if (_fiberCablesHidden && connection.cableType !== 'coax') return;
            // 동축 숨김 모드: coax 케이블 렌더링 스킵
            if (_coaxHidden && connection.cableType === 'coax') return;
            // 도면보기 모드: 기설이 아닌 동축 케이블 스킵
            if (typeof coaxIsViewFiltered === 'function' && coaxIsViewFiltered(connection)) return;

            const fromNode = nodes.find(n => n.id === connFrom(connection));
            const toNode = nodes.find(n => n.id === connTo(connection));

            if (!fromNode || !toNode) return;

            let path;
            {
                if (!connection.waypoints) connection.waypoints = [];

                // 경로 생성 — ONU outPort / 함체 포트 오프셋 적용
                let startLat = fromNode.lat, startLng = fromNode.lng;
                if (fromNode.type === 'onu' && connection.outPort && typeof getOnuPortLatLng === 'function') {
                    var portPos = getOnuPortLatLng(fromNode, connection.outPort);
                    startLat = portPos.lat;
                    startLng = portPos.lng;
                } else if (fromNode.type === 'junction' && window.getJunctionPortLatLng) {
                    var _fromPort = connection.fromPort || 'OUT';
                    var jFromPos = window.getJunctionPortLatLng(fromNode, _fromPort);
                    startLat = jFromPos.lat;
                    startLng = jFromPos.lng;
                }
                let endLat = toNode.lat, endLng = toNode.lng;
                if (toNode.type === 'junction' && window.getJunctionPortLatLng) {
                    var _toPort = connection.toPort || 'IN';
                    var jToPos = window.getJunctionPortLatLng(toNode, _toPort);
                    endLat = jToPos.lat;
                    endLng = jToPos.lng;
                }
                path = [
                    [startLat, startLng],
                    ...connection.waypoints.map(wp => [wp.lat, wp.lng]),
                    [endLat, endLng]
                ];
            }
            
            // 선 그리기 — 신설/기설/철거, 광/동축 구분
            const cableLineType = connection.lineType || 'existing';
            const isNewCable = cableLineType === 'new';
            const isRemovedCable = cableLineType === 'removed';
            const isCoaxLine = connection.cableType === 'coax';
            let cableColor;
            if (connection.color) {
                cableColor = connection.color;
            } else if (isRemovedCable) {
                cableColor = '#222222';
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
            const typeLabel = isCoaxCable ? '' : (isRemovedCable ? '철거 ' : (isNewCable ? '신설 ' : ''));
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
                // 함체 portConns 정리 (fromPort/toPort 경로)
                _updateJunctionPortConns(conn, true);
                // 보완: connId로 전체 노드 스캔하여 잔여 portConns 완전 제거
                nodes.forEach(function(n) {
                    if (n.type !== 'junction' || !n.portConns) return;
                    var dirty = false;
                    Object.keys(n.portConns).forEach(function(pid) {
                        if (n.portConns[pid] === connectionId) { delete n.portConns[pid]; dirty = true; }
                    });
                    if (dirty && markers[n.id]) { markers[n.id].setMap(null); delete markers[n.id]; renderNode(n); }
                });

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
        let _wpSnapMM = null;
        let _wpHighlight = null;
        let _wpGuideLine = null;

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
            showStatus('경로 추가 — 추가할 전주를 클릭하세요 (ESC=취소)');
            document.body.classList.add('connecting-mode');

            if (_waypointMapClickHandler) {
                if (_waypointClickListener) { _nEvent.remove(map._m, 'click', _waypointClickListener); _waypointClickListener = null; }
            }

            // 가이드 실선 표시용 (케이블 그리기 모드와 동일)
            _wpHighlight = null; _wpGuideLine = null;
            _wpSnapMM = function(me) {
                if (_wpHighlight)  { _wpHighlight.setMap(null);  _wpHighlight  = null; }
                if (_wpGuideLine)  { _wpGuideLine.setMap(null);  _wpGuideLine  = null; }
                var lat = me.coord.lat(), lng = me.coord.lng();
                var pole = findNearestPoleR(lat, lng, SNAP_RADIUS_M);
                if (pole) {
                    var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                    var pLat = pole.lat + _off.dLat, pLng = pole.lng + _off.dLng;
                    _wpHighlight = new naver.maps.Circle({
                        map: map._m, center: new naver.maps.LatLng(pLat, pLng), radius: 3,
                        strokeWeight: 2, strokeColor: '#00cc44', strokeOpacity: 1,
                        fillColor: '#00cc44', fillOpacity: 0.8
                    });
                    _wpGuideLine = new naver.maps.Polyline({
                        map: map._m,
                        path: [new naver.maps.LatLng(lat, lng), new naver.maps.LatLng(pLat, pLng)],
                        strokeColor: '#00cc44', strokeWeight: 1, strokeOpacity: 0.7, strokeStyle: 'solid'
                    });
                }
            };
            _nEvent.add(map._m, 'mousemove', _wpSnapMM);

            _waypointMapClickHandler = function(mouseEvent) {
                var lat = mouseEvent.coord.lat(), lng = mouseEvent.coord.lng();

                // 클릭 위치에 자유 경유점 삽입
                var latlng = { lat: lat, lng: lng };

                // 가장 가까운 구간에 삽입
                var minDist = Infinity, insertIndex = 0;
                for (var i = 0; i < _waypointInsertPath.length - 1; i++) {
                    var p1 = L.latLng(_waypointInsertPath[i][0], _waypointInsertPath[i][1]);
                    var p2 = L.latLng(_waypointInsertPath[i + 1][0], _waypointInsertPath[i + 1][1]);
                    var d = L.LineUtil.pointToSegmentDistance(
                        map.latLngToLayerPoint(L.latLng(lat, lng)),
                        map.latLngToLayerPoint(p1), map.latLngToLayerPoint(p2)
                    );
                    if (d < minDist) { minDist = d; insertIndex = i; }
                }
                _waypointInsertConn.waypoints.splice(insertIndex, 0, latlng);
                saveData(); renderAllConnections();
                if (_wpHighlight)  { _wpHighlight.setMap(null);  _wpHighlight  = null; }
                if (_wpGuideLine)  { _wpGuideLine.setMap(null);  _wpGuideLine  = null; }
                _nEvent.remove(map._m, 'mousemove', _wpSnapMM);
                cancelWaypointInsertMode();
                showStatus('경로 추가: ' + (pole.name || pole.id));
            };
            _nEvent.add(map._m, 'click', _waypointMapClickHandler);
            _waypointClickListener = _waypointMapClickHandler;
        }

        function cancelWaypointInsertMode() {
            if (_waypointMapClickHandler) {
                if (_waypointClickListener) { _nEvent.remove(map._m, 'click', _waypointClickListener); _waypointClickListener = null; }
                _waypointMapClickHandler = null;
            }
            if (_wpSnapMM) { _nEvent.remove(map._m, 'mousemove', _wpSnapMM); _wpSnapMM = null; }
            if (_wpHighlight) { _wpHighlight.setMap(null); _wpHighlight = null; }
            if (_wpGuideLine) { _wpGuideLine.setMap(null); _wpGuideLine = null; }
            _waypointInsertConn = null;
            _waypointInsertPath = null;
            document.body.classList.remove('connecting-mode');
        }

        // ===== 오프셋 방향 반전 =====
        window.flipCableOffset = function(connId) {
            var conn = connections.find(function(c) { return c.id === connId; });
            if (!conn) return;
            conn.offsetFlip = !conn.offsetFlip;
            renderAllConnections();
            saveData();
        };

        // ===== 경로 삭제 모드 =====
        var _wpDeleteConn = null;
        var _wpDeleteMarkers = [];

        window.startWaypointDeleteModeById = function(connId) {
            var conn = connections.find(function(c){ return c.id === connId; });
            if (!conn || !conn.waypoints || conn.waypoints.length === 0) {
                showStatus('⚠ 삭제할 경유 전주가 없습니다');
                return;
            }
            _wpDeleteConn = conn;
            _wpDeleteMarkers = [];
            document.body.classList.add('connecting-mode');
            showStatus('경로 삭제 — 제거할 전주(빨간 원)를 클릭하세요 (ESC=취소)');

            conn.waypoints.forEach(function(wp, idx) {
                var off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                var pole = nodes.find(function(n){ return n.id === wp.snappedPole; });
                var lat = wp.lat + (pole ? 0 : off.dLat);
                var lng = wp.lng + (pole ? 0 : off.dLng);
                var circle = new naver.maps.Circle({
                    map: map._m,
                    center: new naver.maps.LatLng(lat, lng),
                    radius: 8,
                    strokeWeight: 2, strokeColor: '#e53935', strokeOpacity: 1,
                    fillColor: '#e53935', fillOpacity: 0.5,
                    clickable: true
                });
                naver.maps.Event.addListener(circle, 'click', function() {
                    // poleRoute 동기화
                    if (_wpDeleteConn.poleRoute && wp.snappedPole) {
                        var prIdx = _wpDeleteConn.poleRoute.indexOf(wp.snappedPole);
                        if (prIdx !== -1) _wpDeleteConn.poleRoute.splice(prIdx, 1);
                        if (_wpDeleteConn.poleRoute.length === 0) delete _wpDeleteConn.poleRoute;
                    }
                    _wpDeleteConn.waypoints.splice(idx, 1);
                    saveData(); renderAllConnections();
                    _cancelWpDeleteMode();
                    var poleName = pole ? (pole.name || pole.id) : '경유점';
                    showStatus('경로가 삭제되었습니다: ' + poleName);
                });
                _wpDeleteMarkers.push(circle);
            });
        };

        function _cancelWpDeleteMode() {
            _wpDeleteMarkers.forEach(function(c){ c.setMap(null); });
            _wpDeleteMarkers = [];
            _wpDeleteConn = null;
            document.body.classList.remove('connecting-mode');
        }

        // ===== 점이동 모드 =====
        var _wpMoveConn = null;
        var _wpMoveMarkers = [];
        var _wpMoveSelectedIdx = null;
        var _wpMoveOrigPoleId = null;
        var _wpMoveSnapMM = null;
        var _wpMoveHighlight = null;
        var _wpMoveGuideLine = null;
        var _wpMoveClickHandler = null;

        function _wpMoveDoMove(targetPole, clat, clng) {
            var wp = _wpMoveConn.waypoints[_wpMoveSelectedIdx];
            var isSamePole = targetPole && wp.snappedPole === targetPole.id;
            function doMove() {
                _wpMoveConn.waypoints[_wpMoveSelectedIdx] = { lat: clat, lng: clng, snappedPole: targetPole ? targetPole.id : wp.snappedPole };
                saveData(); renderAllConnections();
                showStatus('점이동 완료: ' + (targetPole ? (targetPole.name || targetPole.id) : ''));
                _cancelWpMoveMode();
            }
            if (isSamePole || !targetPole) {
                doMove();
            } else {
                showConfirm(
                    (targetPole.name || targetPole.id) + '(으)로 이동하시겠습니까?',
                    doMove,
                    '', '이동'
                );
            }
        }

        window.startWaypointMoveMode = function(connId) {
            var conn = connections.find(function(c){ return c.id === connId; });
            if (!conn || !conn.waypoints || conn.waypoints.length === 0) {
                showStatus('⚠ 이동할 경유 전주가 없습니다');
                return;
            }
            _wpMoveConn = conn;
            _wpMoveSelectedIdx = null;
            _wpMoveOrigPoleId = null;
            _wpMoveMarkers = [];
            document.body.classList.add('connecting-mode');
            showStatus('점이동 — 이동할 경유 전주를 클릭하세요 (ESC=취소)');

            // 케이블 경유 좌표(꺾임 위치)에 점 표시 (non-clickable, 위치 안내용)
            conn.waypoints.forEach(function(wp) {
                var dot = new naver.maps.Circle({
                    map: map._m,
                    center: new naver.maps.LatLng(wp.lat, wp.lng),
                    radius: 0.5,
                    strokeWeight: 1, strokeColor: '#1a6fd4', strokeOpacity: 1,
                    fillColor: '#1a6fd4', fillOpacity: 1,
                    clickable: false
                });
                _wpMoveMarkers.push(dot);
            });

            // 1단계: 경유점 선택 클릭
            _wpMoveClickHandler = function(mouseEvent) {
                var clat = mouseEvent.coord.lat(), clng = mouseEvent.coord.lng();
                // 클릭 위치에서 가장 가까운 경유점 탐색
                var bestIdx = null, bestD = Infinity;
                conn.waypoints.forEach(function(wp, idx) {
                    var pole = nodes.find(function(n){ return n.id === wp.snappedPole; });
                    var off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                    var plat = pole ? pole.lat + off.dLat : wp.lat;
                    var plng = pole ? pole.lng + off.dLng : wp.lng;
                    var dlat = (plat - clat) * 111000;
                    var dlng = (plng - clng) * 111000 * Math.cos(clat * Math.PI / 180);
                    var d = dlat * dlat + dlng * dlng;
                    if (d < bestD) { bestD = d; bestIdx = idx; }
                });
                var THRESHOLD = SNAP_RADIUS_M * SNAP_RADIUS_M;
                if (bestIdx === null || bestD > THRESHOLD) {
                    showStatus('⚠ ' + SNAP_RADIUS_M + 'm 이내 경유 전주가 없습니다');
                    return;
                }

                // 경유점 선택 완료 → 선택된 점 노란색으로 변경
                if (_wpMoveMarkers[bestIdx]) {
                    _wpMoveMarkers[bestIdx].setOptions({ fillColor: '#f59e0b', strokeColor: '#f59e0b' });
                }
                _wpMoveSelectedIdx = bestIdx;
                _wpMoveOrigPoleId = conn.waypoints[bestIdx].snappedPole;
                var selPole = nodes.find(function(n){ return n.id === _wpMoveOrigPoleId; });
                var off2 = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                var selLat = selPole ? selPole.lat + off2.dLat : conn.waypoints[bestIdx].lat;
                var selLng = selPole ? selPole.lng + off2.dLng : conn.waypoints[bestIdx].lng;
                var poleName = selPole ? (selPole.name || selPole.id) : '경유점';
                showStatus('점이동 — "' + poleName + '" 선택됨. 이동할 전주를 클릭하세요 (ESC=취소)');

                // 케이블 그리기 모드와 동일한 녹색 스냅 가이드선 활성화
                _wpMoveSnapMM = function(me) {
                    if (_wpMoveHighlight) { _wpMoveHighlight.setMap(null); _wpMoveHighlight = null; }
                    if (_wpMoveGuideLine) { _wpMoveGuideLine.setMap(null); _wpMoveGuideLine = null; }
                    var mlat = me.coord.lat(), mlng = me.coord.lng();
                    var nearPole = findNearestPoleR(mlat, mlng, SNAP_RADIUS_M);
                    if (nearPole) {
                        var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                        var pLat = nearPole.lat + _off.dLat, pLng = nearPole.lng + _off.dLng;
                        _wpMoveHighlight = new naver.maps.Circle({
                            map: map._m, center: new naver.maps.LatLng(pLat, pLng), radius: 1,
                            strokeWeight: 1, strokeColor: '#00cc44', strokeOpacity: 1,
                            fillColor: '#00cc44', fillOpacity: 0.8
                        });
                        _wpMoveGuideLine = new naver.maps.Polyline({
                            map: map._m,
                            path: [new naver.maps.LatLng(mlat, mlng), new naver.maps.LatLng(pLat, pLng)],
                            strokeColor: '#00cc44', strokeWeight: 1, strokeOpacity: 0.7, strokeStyle: 'solid'
                        });
                    }
                };
                _nEvent.add(map._m, 'mousemove', _wpMoveSnapMM);

                // 클릭 핸들러를 목적지 선택용으로 교체 (현재 클릭 이벤트 이후)
                _nEvent.remove(map._m, 'click', _wpMoveClickHandler);
                setTimeout(function() {
                    if (_wpMoveSelectedIdx === null) return;
                    _wpMoveClickHandler = function(mouseEvent2) {
                        var clat2 = mouseEvent2.coord.lat(), clng2 = mouseEvent2.coord.lng();
                        var targetPole = findNearestPoleR(clat2, clng2, SNAP_RADIUS_M);
                        if (!targetPole) { showStatus('⚠ ' + SNAP_RADIUS_M + 'm 이내 전주가 없습니다'); return; }
                        _wpMoveDoMove(targetPole, clat2, clng2);
                    };
                    _nEvent.add(map._m, 'click', _wpMoveClickHandler);
                }, 50);
            };
            _nEvent.add(map._m, 'click', _wpMoveClickHandler);
        };

        function _cancelWpMoveMode() {
            _wpMoveMarkers.forEach(function(c){ c.setMap(null); });
            _wpMoveMarkers = [];
            _wpMoveConn = null;
            _wpMoveSelectedIdx = null;
            _wpMoveOrigPoleId = null;
            if (_wpMoveSnapMM) { _nEvent.remove(map._m, 'mousemove', _wpMoveSnapMM); _wpMoveSnapMM = null; }
            if (_wpMoveHighlight) { _wpMoveHighlight.setMap(null); _wpMoveHighlight = null; }
            if (_wpMoveGuideLine) { _wpMoveGuideLine.setMap(null); _wpMoveGuideLine = null; }
            if (_wpMoveClickHandler) { _nEvent.remove(map._m, 'click', _wpMoveClickHandler); _wpMoveClickHandler = null; }
            document.body.classList.remove('connecting-mode');
        }

        // ESC 키
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                if (_waypointInsertConn) { cancelWaypointInsertMode(); showStatus('경로 추가 취소'); }
                if (_wpDeleteConn) { _cancelWpDeleteMode(); showStatus('경로 삭제 취소'); }
                if (_wpMoveConn) { _cancelWpMoveMode(); showStatus('점이동 취소'); }
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
            // 전주 캔버스 재생성 (polyline 재생성 후 전주명이 가려지는 현상 방지)
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }
        
        // 상태 메시지 표시
        var _statusTimer = null;
        function showStatus(message) {
            const statusEl = document.getElementById('statusMessage');
            statusEl.textContent = message;
            statusEl.classList.add('active');
            if (_statusTimer) clearTimeout(_statusTimer);
            _statusTimer = setTimeout(() => {
                hideStatus();
                _statusTimer = null;
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
            window.movingNodeMode = true;
            movingNode = selectedNode;
            document.body.classList.add('moving-mode');
            var _isCoaxMoving = typeof isCoaxType === 'function' && isCoaxType(movingNode.type);
            var _moveSnapCircle = null;
            var _moveSnapHighlight = null;
            var _moveSnapR = _isCoaxMoving ? COAX_SNAP_RADIUS_M : 15;

            showStatus(_isCoaxMoving
                ? '전주 근처를 클릭하여 장비를 이동하세요 (ESC=취소)'
                : '지도를 클릭하여 장비를 이동하세요');

            // 장비 이동 시 마우스 근처 전주 10m 반경 표시 + 잔상 오버레이
            var _poleMoveCircles = [];
            var _ghostOverlay = null;

            // 원본 마커 지도에서 제거 (이동 완료 후 renderNode로 복원)
            if (markers[movingNode.id]) {
                map.removeLayer(markers[movingNode.id]);
                delete markers[movingNode.id];
            }

            // 잔상 오버레이 생성
            var _ghostHTML = typeof getMarkerHTML === 'function'
                ? getMarkerHTML(movingNode.type, movingNode.name, movingNode.memo, movingNode.id)
                : '';
            if (_ghostHTML) {
                _ghostOverlay = document.createElement('div');
                _ghostOverlay.style.cssText = 'position:fixed;opacity:0.5;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);';
                _ghostOverlay.innerHTML = _ghostHTML;
                document.body.appendChild(_ghostOverlay);
            }

            // 마우스 픽셀 좌표로 잔상 이동 (map mousemove는 픽셀좌표도 제공)
            function _onBodyMousemove(e) {
                if (_ghostOverlay) {
                    _ghostOverlay.style.left = e.clientX + 'px';
                    _ghostOverlay.style.top  = e.clientY + 'px';
                }
            }
            document.addEventListener('mousemove', _onBodyMousemove);

            function _onMoveMousemove(me) {
                var lat = me.coord.lat(), lng = me.coord.lng();
                if (_moveSnapCircle) { _moveSnapCircle.setMap(null); _moveSnapCircle = null; }
                if (_moveSnapHighlight) { _moveSnapHighlight.setMap(null); _moveSnapHighlight = null; }
                _poleMoveCircles.forEach(function(c){ c.setMap(null); });
                _poleMoveCircles = [];

                var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                // 마우스 50m 반경 내 전주에 10m 원 표시
                nodes.forEach(function(n) {
                    if (!isPoleType(n.type)) return;
                    var d = distanceM(lat, lng, n.lat + _off.dLat, n.lng + _off.dLng);
                    if (d > 50) return;
                    var isNear = d <= 10;
                    _poleMoveCircles.push(new naver.maps.Circle({
                        map: map._m,
                        center: new naver.maps.LatLng(n.lat + _off.dLat, n.lng + _off.dLng),
                        radius: 10,
                        strokeWeight: 1.5,
                        strokeColor: isNear ? '#00cc44' : '#1a6fd4',
                        strokeOpacity: 0.9,
                        fillColor: isNear ? '#00cc44' : '#1a6fd4',
                        fillOpacity: isNear ? 0.15 : 0.07
                    }));
                });

                if (!_isCoaxMoving) return;
                var nearPole = findNearestPoleR(lat, lng, _moveSnapR);
                _moveSnapCircle = new naver.maps.Circle({
                    map: map._m, center: new naver.maps.LatLng(lat, lng), radius: _moveSnapR,
                    strokeWeight: 1, strokeColor: nearPole ? '#00cc44' : '#aaaaaa', strokeOpacity: 0.8,
                    fillColor: nearPole ? '#00cc44' : '#cccccc', fillOpacity: 0.15
                });
            }

            function _cleanupMoveSnap() {
                if (_moveSnapCircle) { _moveSnapCircle.setMap(null); _moveSnapCircle = null; }
                if (_moveSnapHighlight) { _moveSnapHighlight.setMap(null); _moveSnapHighlight = null; }
                _poleMoveCircles.forEach(function(c){ c.setMap(null); });
                _poleMoveCircles = [];
                if (_ghostOverlay) { _ghostOverlay.remove(); _ghostOverlay = null; }
                // 취소 시 원본 마커 복원
                if (movingNode && !markers[movingNode.id]) {
                    renderNode(movingNode);
                }
                document.removeEventListener('mousemove', _onBodyMousemove);
                _nEvent.remove(map._m, 'mousemove', _onMoveMousemove);
            }

            _nEvent.add(map._m, 'mousemove', _onMoveMousemove);

            // ESC 취소 핸들러
            function _onMoveEsc(e) {
                if (e.key === 'Escape' || e.keyCode === 27) {
                    _cleanupMoveSnap();
                    map.off('click', _onMoveClick);
                    document.removeEventListener('keydown', _onMoveEsc);
                    movingNodeMode = false;
                    window.movingNodeMode = false;
                    movingNode = null;
                    document.body.classList.remove('moving-mode');
                    showStatus('장비 이동 취소');
                }
            }
            document.addEventListener('keydown', _onMoveEsc);

            // 지도 클릭 이벤트 추가
            map.on('click', _onMoveClick);
            function _onMoveClick(e) {
                map.off('click', _onMoveClick);
                document.removeEventListener('keydown', _onMoveEsc);
                _cleanupMoveSnap();

                if (movingNode) {
                    var clickLat = e.latlng.lat, clickLng = e.latlng.lng;

                    // 동축 장비: 전주 근처만 이동 허용
                    if (_isCoaxMoving) {
                        var newPole = findNearestPoleR(clickLat, clickLng, _moveSnapR);
                        if (!newPole) {
                            showStatus('⚠ 전주 근처를 클릭해주세요');
                            movingNodeMode = false;
                            window.movingNodeMode = false;
                            movingNode = null;
                            document.body.classList.remove('moving-mode');
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
                window.movingNodeMode = false;
                movingNode = null;
                document.body.classList.remove('moving-mode');
            }
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
            // 양 끝 장비 + 경유점을 포함하는 바운딩 박스로 IDB 전주 로드
            var margin = 0.0005; // ~50m
            var boundsPoints = [];
            if (fromNode) boundsPoints.push(fromNode);
            if (toNode) boundsPoints.push(toNode);
            (conn.waypoints || []).forEach(function(wp) {
                if (wp.lat && wp.lng) boundsPoints.push(wp);
            });
            if (boundsPoints.length > 0) {
                var bMinLat = Infinity, bMaxLat = -Infinity, bMinLng = Infinity, bMaxLng = -Infinity;
                boundsPoints.forEach(function(p) {
                    if (p.lat < bMinLat) bMinLat = p.lat;
                    if (p.lat > bMaxLat) bMaxLat = p.lat;
                    if (p.lng < bMinLng) bMinLng = p.lng;
                    if (p.lng > bMaxLng) bMaxLng = p.lng;
                });
                var nearby = await loadPolesInBounds({
                    minLat: bMinLat - margin, maxLat: bMaxLat + margin,
                    minLng: bMinLng - margin, maxLng: bMaxLng + margin
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
                var node = null;
                // 1) snappedPole ID로 매칭 시도
                if (wp.snappedPole) {
                    node = allPoles.find(function(n) { return n.id === wp.snappedPole; });
                }
                // 2) ID 매칭 실패 또는 snappedPole 없음 → 좌표 기반 최근접 전주 검색
                if (!node && wp.lat && wp.lng) {
                    var bestD = Infinity, bestN = null;
                    allPoles.forEach(function(n) {
                        if (!isPoleType(n.type)) return;
                        var dlat1 = (n.lat + off.dLat - wp.lat) * 111000;
                        var dlng1 = (n.lng + off.dLng - wp.lng) * 111000 * Math.cos(wp.lat * Math.PI / 180);
                        var d1 = dlat1 * dlat1 + dlng1 * dlng1;
                        var dlat2 = (n.lat - wp.lat) * 111000;
                        var dlng2 = (n.lng - wp.lng) * 111000 * Math.cos(wp.lat * Math.PI / 180);
                        var d2 = dlat2 * dlat2 + dlng2 * dlng2;
                        var d = Math.min(d1, d2);
                        if (d < bestD) { bestD = d; bestN = n; }
                    });
                    if (bestN && bestD < 400) node = bestN; // 20m 이내
                }
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

            // 엑셀 생성 (공용 함수)
            _exportPoleRowsExcel(poleList, conn.spanDistances, (fromNode?.name || 'A') + '_' + (toNode?.name || 'B'));
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

        // ==================== 공가 범위 추출 (다각형 선택) ====================

        var _gonggaPolyPts    = [];   // {lat, lng} 꼭지점 배열
        var _gonggaPolyMarkers = [];  // 꼭지점 마커
        var _gonggaPolyLine   = null; // 현재까지 그린 외곽선
        var _gonggaPreviewLine = null;// 마우스 미리보기 선
        var _gonggaPolygon    = null; // 확정된 채운 폴리곤
        var _gonggaPolyMode   = false;
        var _gonggaKeyHandler  = null;

        // 다각형 내 점 판별 (ray casting)
        function _pointInPoly(lat, lng, pts) {
            var inside = false;
            for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                var xi = pts[i].lat, yi = pts[i].lng;
                var xj = pts[j].lat, yj = pts[j].lng;
                if (((yi > lng) !== (yj > lng)) &&
                    (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
            }
            return inside;
        }

        // 공가 범위 모드 진입/취소
        window.startGonggaRangeMode = function() {
            if (_gonggaPolyMode) { _gonggaPolyCancel(); return; }
            _gonggaPolyMode = true;
            _gonggaPolyPts = [];
            _gonggaPolyMarkers = [];

            window._gonggaPolyMode = true;
            document.body.classList.add('gongga-poly-mode');
            var guide = document.getElementById('gonggaGuide');
            if (guide) guide.classList.add('active');
            var btn = document.getElementById('gonggaRangeBtn');
            if (btn) btn.classList.add('active');
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();

            // 지도 컨테이너 div에 캡처 단계 클릭 — 오버레이 stopPropagation 무관하게 동작
            var _mapDiv = document.getElementById('map');
            _gonggaMapClickFn = function(e) {
                if (!_gonggaPolyMode) return;
                var rect = _mapDiv.getBoundingClientRect();
                var pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                var ll = map.containerPointToLatLng(pt);
                _gonggaAddPoint(ll.lat, ll.lng);
            };
            _gonggaMapMoveFn = function(e) {
                if (!_gonggaPolyMode || _gonggaPolyPts.length === 0) return;
                var rect = _mapDiv.getBoundingClientRect();
                var pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                var ll = map.containerPointToLatLng(pt);
                _gonggaUpdatePreview(ll.lat, ll.lng);
            };
            _gonggaKeyHandler = function(e) {
                if (!_gonggaPolyMode) return;
                if (e.key === 'Enter')  { e.preventDefault(); _gonggaPolyClose(); }
                if (e.key === 'Escape') { e.preventDefault(); _gonggaPolyCancel(); }
            };

            _mapDiv.addEventListener('click',     _gonggaMapClickFn, true);
            _mapDiv.addEventListener('mousemove', _gonggaMapMoveFn,  true);
            document.addEventListener('keydown', _gonggaKeyHandler);
        };

        var _gonggaMapClickFn = null;
        var _gonggaMapMoveFn  = null;

        function _gonggaAddPoint(lat, lng) {
            // 꼭지점 3개 이상일 때 첫 점 근처 클릭 → 폴리곤 닫기
            if (_gonggaPolyPts.length >= 3) {
                var first = _gonggaPolyPts[0];
                var sp1 = map.latLngToLayerPoint({ lat: first.lat, lng: first.lng });
                var sp2 = map.latLngToLayerPoint({ lat: lat, lng: lng });
                var dx = sp1.x - sp2.x, dy = sp1.y - sp2.y;
                if (dx * dx + dy * dy < 400) { // 20px 반경
                    _gonggaPolyClose();
                    return;
                }
            }

            _gonggaPolyPts.push({ lat: lat, lng: lng });

            // 첫 꼭지점은 크게(초록), 나머지는 작게(주황)
            var isFirst = _gonggaPolyPts.length === 1;
            var marker = L.circleMarker([lat, lng], {
                radius: isFirst ? 8 : 5,
                fillColor: isFirst ? '#27ae60' : '#e67e22',
                color: '#fff', weight: 2, fillOpacity: 1, zIndexOffset: 5000
            }).addTo(map);
            _gonggaPolyMarkers.push(marker);

            _gonggaUpdatePolyLine();

            // 가이드 텍스트 업데이트
            var guide = document.getElementById('gonggaGuide');
            if (guide) {
                guide.textContent = _gonggaPolyPts.length >= 3
                    ? '꼭지점 ' + _gonggaPolyPts.length + '개 | Enter 또는 ● 클릭으로 완성 | ESC: 취소'
                    : '꼭지점 ' + _gonggaPolyPts.length + '개 | 계속 클릭하세요 | ESC: 취소';
            }
        }

        function _gonggaUpdatePolyLine() {
            if (_gonggaPolyLine) map.removeLayer(_gonggaPolyLine);
            if (_gonggaPolyPts.length < 2) { _gonggaPolyLine = null; return; }
            _gonggaPolyLine = L.polyline(
                _gonggaPolyPts.map(function(p) { return [p.lat, p.lng]; }),
                { color: '#27ae60', weight: 2.5, opacity: 0.9, dashArray: '6,4' }
            ).addTo(map);
        }

        function _gonggaUpdatePreview(lat, lng) {
            if (_gonggaPreviewLine) map.removeLayer(_gonggaPreviewLine);
            var last = _gonggaPolyPts[_gonggaPolyPts.length - 1];
            _gonggaPreviewLine = L.polyline(
                [[last.lat, last.lng], [lat, lng]],
                { color: '#27ae60', weight: 1.5, opacity: 0.5, dashArray: '4,4' }
            ).addTo(map);
        }

        function _gonggaPolyClose() {
            if (_gonggaPolyPts.length < 3) {
                showStatus('⚠ 꼭지점이 3개 이상 필요합니다');
                return;
            }
            _gonggaPolyCleanupHandlers();

            // 확정 폴리곤 표시
            _gonggaPolygon = L.polygon(
                _gonggaPolyPts.map(function(p) { return [p.lat, p.lng]; }),
                { color: '#27ae60', weight: 2, fillColor: '#27ae60', fillOpacity: 0.15 }
            ).addTo(map);

            var pts = _gonggaPolyPts.slice();
            _gonggaPolyPts = [];
            _gonggaPolyMode = false;

            showStatus('범위 확정 — 공가 데이터 추출 중...');
            generateApplicationFromRange(pts).then(function() {
                setTimeout(function() {
                    if (_gonggaPolygon) { map.removeLayer(_gonggaPolygon); _gonggaPolygon = null; }
                }, 4000);
            }).catch(function(err) {
                console.error('[공가범위] 오류:', err);
                if (_gonggaPolygon) { map.removeLayer(_gonggaPolygon); _gonggaPolygon = null; }
            });
        }

        function _gonggaPolyCancel() {
            _gonggaPolyCleanupHandlers();
            _gonggaPolyPts = [];
            _gonggaPolyMode = false;
            showStatus('공가 범위 추출 취소');
        }

        function _gonggaPolyCleanupHandlers() {
            var _mapDiv = document.getElementById('map');
            if (_gonggaMapClickFn) { _mapDiv.removeEventListener('click',     _gonggaMapClickFn, true); _gonggaMapClickFn = null; }
            if (_gonggaMapMoveFn)  { _mapDiv.removeEventListener('mousemove', _gonggaMapMoveFn,  true); _gonggaMapMoveFn  = null; }
            if (_gonggaKeyHandler) { document.removeEventListener('keydown', _gonggaKeyHandler); _gonggaKeyHandler = null; }
            _gonggaPolyMarkers.forEach(function(m) { map.removeLayer(m); });
            _gonggaPolyMarkers = [];
            if (_gonggaPolyLine)    { map.removeLayer(_gonggaPolyLine);    _gonggaPolyLine    = null; }
            if (_gonggaPreviewLine) { map.removeLayer(_gonggaPreviewLine); _gonggaPreviewLine = null; }
            window._gonggaPolyMode = false;
            document.body.classList.remove('gongga-poly-mode');
            var guide = document.getElementById('gonggaGuide');
            if (guide) guide.classList.remove('active');
            var btn = document.getElementById('gonggaRangeBtn');
            if (btn) btn.classList.remove('active');
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }

        // ── connRoutes 헬퍼: 전주번호 정렬 키 (낮은 번호 = 1차전주 방향)
        // H주(7H)는 7 바로 앞 위치 → sort key = 7 - 0.5 = 6.5
        function _poleNumSortKey(poleId, arr) {
            var n = (arr || nodes).find(function(nd){ return nd.id === poleId; });
            if (!n) return 99999;
            var m = (n.name || '').match(/(\d+)([Hh])?(?:[^0-9]|$)/);
            if (!m) return 99999;
            return parseInt(m[1]) + (m[2] ? -0.5 : 0);
        }
        window._poleNumSortKey = _poleNumSortKey;

        // ── connRoutes 헬퍼: 케이블의 경유 전주 ID 목록 (전주번호 오름차순 정렬) ──
        // 장비(junction/ONU 등) fromNode/toNode → 30m 이내 가장 가까운 전주 자동 포함
        function _getConnPoleStops(conn, nodeArr) {
            var arr = nodeArr || nodes;
            var stops = [];
            var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };

            // 전주이면 직접, 장비이면 30m 이내 가장 가까운 전주 추가
            function addNodeOrNearPole(nd) {
                if (!nd) return;
                if (isPoleType(nd.type)) {
                    if (stops.indexOf(nd.id) === -1) stops.push(nd.id);
                } else {
                    var best = null, bestD = Infinity;
                    arr.forEach(function(p) {
                        if (!isPoleType(p.type)) return;
                        var dlat = (p.lat + _off.dLat - nd.lat) * 111000;
                        var dlng = (p.lng + _off.dLng - nd.lng) * 111000 * Math.cos(nd.lat * Math.PI / 180);
                        var d2 = dlat * dlat + dlng * dlng;
                        if (d2 < 900 && d2 < bestD) { bestD = d2; best = p; }
                    });
                    if (best && stops.indexOf(best.id) === -1) stops.push(best.id);
                }
            }

            var fromNode = arr.find(function(n){ return n.id === connFrom(conn); });
            var toNode   = arr.find(function(n){ return n.id === connTo(conn); });
            addNodeOrNearPole(fromNode);
            // poleRoute 우선 사용 (전주 ID 배열), 없으면 waypoints에서 추출
            if (conn.poleRoute && conn.poleRoute.length > 0) {
                conn.poleRoute.forEach(function(pid) {
                    if (stops.indexOf(pid) === -1) stops.push(pid);
                });
            } else {
                (conn.waypoints || []).forEach(function(wp) {
                    if (wp.snappedPole && stops.indexOf(wp.snappedPole) === -1) stops.push(wp.snappedPole);
                });
            }
            addNodeOrNearPole(toNode);
            return stops;
        }

        // ── 범위 내 케이블·전주 공가 추출 ──
        async function generateApplicationFromRange(polyPts) {
            var minLat = Math.min.apply(null, polyPts.map(function(p){ return p.lat; }));
            var maxLat = Math.max.apply(null, polyPts.map(function(p){ return p.lat; }));
            var minLng = Math.min.apply(null, polyPts.map(function(p){ return p.lng; }));
            var maxLng = Math.max.apply(null, polyPts.map(function(p){ return p.lng; }));
            var pad = 0.0003;

            // IDB에서 바운딩박스 내 전주 로드 (현재 nodes와 합산)
            var dbPoles = await loadPolesInBounds({
                minLat: minLat - pad, maxLat: maxLat + pad,
                minLng: minLng - pad, maxLng: maxLng + pad
            });
            var seenIds = new Set();
            var allAvail = [];
            nodes.concat(dbPoles).forEach(function(n) {
                if (!seenIds.has(n.id)) { seenIds.add(n.id); allAvail.push(n); }
            });

            // 다각형 내부 전주만 필터
            var polesInPoly = allAvail.filter(function(n) {
                return isPoleType(n.type) && _pointInPoly(n.lat, n.lng, polyPts);
            });
            var poleIdSet = new Set(polesInPoly.map(function(p){ return p.id; }));

            if (polesInPoly.length === 0) {
                alert('선택 범위 내 전주가 없습니다.');
                return;
            }

            var off = window._polePreviewOffset || { dLat: 0, dLng: 0 };

            // 장비 노드 목록 (전주·국사·가입자 제외)
            var equipNodes = allAvail.filter(function(n) {
                return !isPoleType(n.type) && n.type !== 'datacenter' && n.type !== 'subscriber';
            });

            // 전주 집합에서 장비와 가장 가까운 전주 찾기
            function findNearPoleIn(eq, poles) {
                if (!eq) return null;
                var best = null, bestD = Infinity;
                poles.forEach(function(p) {
                    var dlat = (p.lat + off.dLat - eq.lat) * 111000;
                    var dlng = (p.lng + off.dLng - eq.lng) * 111000 * Math.cos(eq.lat * Math.PI / 180);
                    var d = dlat * dlat + dlng * dlng;
                    if (d < 900 && d < bestD) { bestD = d; best = p; }
                });
                return best;
            }

            var allPolesArr = allAvail.filter(function(n){ return isPoleType(n.type); });
            var AGENT_EQUIP_CODE = { 'onu': '3', 'junction': '6' };

            // 전주 노드 → 참조 데이터 변환 헬퍼
            function parsePoleRef(node) {
                if (!node) return null;
                var rawNum = (node.memo || '').replace('자가주:true', '').replace('전산화번호: ', '').trim();
                var m1 = rawNum.match(/^(.{5})(\d{3})$/);
                var 관리구 = m1 ? m1[1] : rawNum;
                var 번호   = m1 ? m1[2] : '';
                var m2 = (node.name || '').match(/^(.+)-(\d+[A-Za-z0-9]*)$/);
                var 선로명   = m2 ? m2[1] : (node.name || '');
                var 선로번호 = m2 ? m2[2] : '';
                var 전산화번호 = (관리구 + (번호 ? String(parseInt(번호) || 0).padStart(3, '0') : '')).toUpperCase();
                return { id: node.id, 선로명: 선로명, 선로번호: 선로번호,
                         관리구: 관리구, 번호: 번호, 전산화번호: 전산화번호, type: node.type };
            }

            // ── connRoutes 맵 구성 (케이블 → 전주 중심 인덱싱) ──────────
            // poleId → [{ connId, prevPoleId, nextPoleId, cores, lineType, fromNodeId, fromNodeType }]
            var connRoutesMap = {};
            connections.forEach(function(conn) {
                var fromEq = allAvail.find(function(n){ return n.id === connFrom(conn); });
                var toEq   = allAvail.find(function(n){ return n.id === connTo(conn); });
                var stops  = _getConnPoleStops(conn, allAvail); // 장비→근처전주 포함, 물리적 경로 순서
                // 범위 내 전주 없으면 스킵
                if (!stops.some(function(pid){ return poleIdSet.has(pid); })) return;
                stops.forEach(function(poleId, i) {
                    if (!connRoutesMap[poleId]) connRoutesMap[poleId] = [];
                    connRoutesMap[poleId].push({
                        connId:      conn.id,
                        prevPoleId:  i > 0 ? stops[i-1] : null,
                        nextPoleId:  i < stops.length - 1 ? stops[i+1] : null,
                        cores:       conn.cores || '',
                        cableType:   conn.cableType || 'fiber',
                        lineType:    conn.lineType || 'new',
                        fromNodeId:  connFrom(conn),
                        fromNodeType: fromEq ? fromEq.type : null,
                        toNodeId:    connTo(conn),
                        toNodeType:  toEq ? toEq.type : null
                    });
                });
            });

            // 전체 전주 참조 맵 (범위 밖 경계 전주 조회용)
            var allPoleRefMap = {};
            allPolesArr.forEach(function(n){ allPoleRefMap[n.id] = parsePoleRef(n); });

            // 범위 내 전주 목록 (connRoutes 포함)
            var agentPoles = polesInPoly.map(function(pole) {
                var ref = parsePoleRef(pole);
                ref.connRoutes = connRoutesMap[pole.id] || [];
                return ref;
            });

            // 케이블도 없고 장비(30m 이내)도 없으면 종료
            var _hasRoutes = agentPoles.some(function(p){ return p.connRoutes.length > 0; });
            var _hasEquip  = !_hasRoutes && polesInPoly.some(function(pole) {
                return equipNodes.some(function(eq) {
                    var dlat = (eq.lat - pole.lat) * 111000;
                    var dlng = (eq.lng - pole.lng) * 111000 * Math.cos(pole.lat * Math.PI / 180);
                    return dlat * dlat + dlng * dlng < 900;
                });
            });
            if (!_hasRoutes && !_hasEquip) {
                alert('선택 범위 내 케이블 또는 장비가 없습니다.');
                return;
            }

            // 장비 매핑 (범위 내 전주별 10m)
            var agentEquipMapping = {};
            polesInPoly.forEach(function(pole) {
                var nearby = equipNodes.filter(function(eq) {
                    var dlat = (eq.lat - pole.lat) * 111000;
                    var dlng = (eq.lng - pole.lng) * 111000 * Math.cos(pole.lat * Math.PI / 180);
                    var d2 = dlat * dlat + dlng * dlng;
                    if (off.dLat || off.dLng) {
                        var dlat2 = (eq.lat - (pole.lat + off.dLat)) * 111000;
                        var dlng2 = (eq.lng - (pole.lng + off.dLng)) * 111000 * Math.cos(pole.lat * Math.PI / 180);
                        d2 = Math.min(d2, dlat2 * dlat2 + dlng2 * dlng2);
                    }
                    return d2 < 100;
                });
                if (nearby.length > 0) {
                    agentEquipMapping[pole.id] = nearby.map(function(eq) {
                        return { type: eq.type, 기기코드: AGENT_EQUIP_CODE[eq.type] || '', id: eq.id, name: eq.name || '' };
                    });
                }
            });

            // 함체 수집 (범위 내 전주 30m 반경)
            var junctionMap = {};
            allAvail.forEach(function(n) {
                if (n.type !== 'junction') return;
                var isNear = polesInPoly.some(function(p) {
                    var dlat = (p.lat + off.dLat - n.lat) * 111000;
                    var dlng = (p.lng + off.dLng - n.lng) * 111000 * Math.cos(n.lat * Math.PI / 180);
                    return dlat * dlat + dlng * dlng < 900;
                });
                if (isNear) junctionMap[n.id] = n;
            });
            var agentJunctions = Object.keys(junctionMap).map(function(jid) {
                var j = junctionMap[jid];
                var portConns = window._getJunctionPortConns ? window._getJunctionPortConns(j) : (j.portConns || {});
                var nearPole = findNearPoleIn(j, allPolesArr);

                // IN 포트 케이블의 마지막 전주 탐색 → OUT/BRL/BRR 케이블의 1차전주 판단에 사용
                var anchorId = nearPole ? nearPole.id : null;
                var inLastPole = null;
                var inConnId = portConns['IN'];
                if (inConnId) {
                    var inConn = connections.find(function(c){ return c.id === inConnId; });
                    if (inConn) {
                        var inStops = _getConnPoleStops(inConn, allAvail);
                        // 함체 근접 전주를 제외한 마지막 전주
                        for (var wi = inStops.length - 1; wi >= 0; wi--) {
                            if (inStops[wi] !== anchorId) {
                                var prevNode = allAvail.find(function(n){ return n.id === inStops[wi]; });
                                if (prevNode) { inLastPole = parsePoleRef(prevNode); break; }
                            }
                        }
                    }
                }

                // OUT 포트 케이블의 첫 전주 탐색 → outRoute.nextPoleId가 null일 때 2차전주 폴백
                var outFirstPole = null;
                var outCId = portConns['OUT'];
                if (outCId) {
                    var outCo = connections.find(function(c){ return c.id === outCId; });
                    if (outCo) {
                        var outSt = _getConnPoleStops(outCo, allAvail);
                        // anchor 전주 이후 첫 번째 전주 (anchor가 없으면 첫 번째)
                        for (var oi = 0; oi < outSt.length; oi++) {
                            if (outSt[oi] !== anchorId) {
                                var oNd = allAvail.find(function(x){ return x.id === outSt[oi]; });
                                if (oNd) { outFirstPole = parsePoleRef(oNd); break; }
                            }
                        }
                    }
                }

                return { id: j.id, name: j.name || '', portConns: portConns,
                         nearPoleId: nearPole ? nearPole.id : null,
                         inLastPole: inLastPole, outFirstPole: outFirstPole };
            });

            var agentData = {
                범위내전주:  agentPoles,      // connRoutes 포함
                _allPoleMap: allPoleRefMap,   // 범위 밖 전주 조회용
                함체목록:    agentJunctions,
                장비매핑:    agentEquipMapping
            };

            showStatus('데이터 추출 완료 — 전주 ' + agentPoles.length + '개');

            if (window.gonggaAgentProcess) {
                window.gonggaAgentProcess(agentData);
            } else {
                console.warn('[공가] 에이전트 미로드');
                alert('공가 에이전트가 로드되지 않았습니다.');
            }
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
            window.showPoleSelectPanel(poles);
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
            var _lt = connection.lineType || 'existing';
            var isNew = _lt === 'new';
            var isRemoved = _lt === 'removed';
            var typeDot = isRemoved ? '#222222' : (isNew ? '#e53935' : '#1a6fd4');
            var typeLabel = isRemoved ? '철거' : (isNew ? '신설' : '기설');
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
            var icoAdd = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/><line x1="10" y1="6" x2="10" y2="14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
            var icoRemove = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8"/><line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
            var icoDel = '<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 7h10l-1 10H6L5 7z" stroke="currentColor" stroke-width="1.5"/><path d="M3 5h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 3h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

            // 케이블 총 거리(m) — 출발→경유점→도착 경로 길이 합산, 천단위 콤마
            var _cablePts = [];
            if (fromNode) _cablePts.push([fromNode.lat, fromNode.lng]);
            (connection.waypoints || []).forEach(function(wp) { if (wp && wp.lat != null) _cablePts.push([wp.lat, wp.lng]); });
            if (toNode) _cablePts.push([toNode.lat, toNode.lng]);
            var _cableM = 0;
            for (var _cpi = 0; _cpi < _cablePts.length - 1; _cpi++) {
                // 직접 입력한 경간(spanDistances)이 있으면 그 값, 없으면 지도상 거리
                var _customSpan = connection.spanDistances && connection.spanDistances[_cpi];
                if (_customSpan) { _cableM += _customSpan; continue; }
                var _ca = _cablePts[_cpi], _cb = _cablePts[_cpi + 1];
                var _cdLat = (_cb[0] - _ca[0]) * Math.PI / 180;
                var _cdLng = (_cb[1] - _ca[1]) * Math.PI / 180;
                var _chav = Math.sin(_cdLat / 2) * Math.sin(_cdLat / 2) +
                    Math.cos(_ca[0] * Math.PI / 180) * Math.cos(_cb[0] * Math.PI / 180) *
                    Math.sin(_cdLng / 2) * Math.sin(_cdLng / 2);
                _cableM += 6371000 * 2 * Math.atan2(Math.sqrt(_chav), Math.sqrt(1 - _chav));
            }
            var _cableDistStr = String(Math.round(_cableM)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'm';
            var icoTable = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="12" rx="1.5" stroke="currentColor" stroke-width="1.6"/><line x1="3" y1="9" x2="17" y2="9" stroke="currentColor" stroke-width="1.4"/><line x1="10" y1="9" x2="10" y2="16" stroke="currentColor" stroke-width="1.4"/></svg>';

            document.getElementById('cableInfoContent').innerHTML =
                // 헤더
                '<div style="padding:14px 16px 10px;border-bottom:1px solid #f0f0f0;">' +
                  '<div style="font-size:13px;font-weight:700;color:#1e293b;letter-spacing:-0.3px;line-height:1.4;">' +
                    (escapeHtml(fromNode?.name) || '장비') + '&nbsp;&nbsp;<span style="color:#94a3b8;font-weight:400;">→</span>&nbsp;&nbsp;' + (escapeHtml(toNode?.name) || '장비') +
                  '</div>' +
                  '<div style="margin-top:5px;display:flex;align-items:center;gap:5px;">' +
                    '<span style="width:7px;height:7px;border-radius:50%;background:' + typeDot + ';display:inline-block;"></span>' +
                    '<span style="font-size:11.5px;color:#64748b;font-weight:500;">' + (connection.cableType === 'coax' ? '' : typeLabel + ' · ') + connection.cores + (connection.cableType === 'coax' ? 'C' : '코어') + ' · ' + _cableDistStr + '</span>' +
                  '</div>' +
                '</div>' +
                // 버튼 영역
                '<div style="padding:10px 12px;display:flex;flex-direction:column;gap:5px;">' +
                  '<button onclick="' + _ci('changeCoreCount') + '" style="' + btnPrimary + '" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">' + icoCore + (connection.cableType === 'coax' ? '규격 변경' : '코어 수 변경') + '</button>' +
                  '<button onclick="' + _ci('openCableSpanTable') + '" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoTable + '구간 거리표</button>' +
                  (connection.cableType !== 'coax' ? '<button onclick="' + _ci('exportPoleData') + '" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoPole + '전주 데이터 추출</button>' : '') +
                  (connection.cableType !== 'coax' ? '<button onclick="' + _ci('generateApplication') + '" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoDoc + '공가 신청서 생성</button>' : '') +
                  (connection.cableType !== 'coax' ? '<button onclick="' + _ci('openCablePoleLabelBatch') + '" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoLabel + '전주 라벨 일괄조정</button>' : '') +
                  (connection.cableType !== 'coax' ? '<div style="display:flex;gap:3px;">' +
                    '<button onclick="setCableLineType(\'' + cid + '\',\'existing\');closeCableInfoPanel();" style="flex:1;padding:6px 0;border:none;border-radius:5px;cursor:pointer;font-size:11.5px;font-weight:600;font-family:inherit;' + (_lt === 'existing' ? 'background:#1a6fd4;color:#fff;' : 'background:#f0f4fa;color:#64748b;') + '">기설</button>' +
                    '<button onclick="setCableLineType(\'' + cid + '\',\'new\');closeCableInfoPanel();" style="flex:1;padding:6px 0;border:none;border-radius:5px;cursor:pointer;font-size:11.5px;font-weight:600;font-family:inherit;' + (_lt === 'new' ? 'background:#e53935;color:#fff;' : 'background:#f0f4fa;color:#64748b;') + '">신설</button>' +
                    '<button onclick="setCableLineType(\'' + cid + '\',\'removed\');closeCableInfoPanel();" style="flex:1;padding:6px 0;border:none;border-radius:5px;cursor:pointer;font-size:11.5px;font-weight:600;font-family:inherit;' + (_lt === 'removed' ? 'background:#222;color:#fff;' : 'background:#f0f4fa;color:#64748b;') + '">철거</button>' +
                  '</div>' : '') +
                  '<button onclick="startWaypointInsertModeById(\'' + cid + '\');closeCableInfoPanel();" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoAdd + '경로 추가</button>' +
                  '<button onclick="startWaypointDeleteModeById(\'' + cid + '\');closeCableInfoPanel();" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">' + icoRemove + '경로 삭제</button>' +
                  '<button onclick="startWaypointMoveMode(\'' + cid + '\');closeCableInfoPanel();" style="' + btnLight + '" onmouseover="this.style.background=\'#e2e8f0\'" onmouseout="this.style.background=\'#f0f4fa\'">⇄ 점이동</button>' +
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

        // 케이블 구간 거리표 — 전주 구간별 거리 표시 + 직접 편집 (직접입력 우선, 빈칸은 지도거리)
        async function openCableSpanTable(connId) {
            var conn = connections.find(function(c){ return c.id === connId; });
            if (!conn) return;
            var fromNode = nodes.find(function(n){ return n.id === connFrom(conn); });
            var toNode = nodes.find(function(n){ return n.id === connTo(conn); });
            if (!fromNode || !toNode) { showStatus('케이블 양 끝 노드를 찾을 수 없습니다'); return; }
            if (!conn.spanDistances) conn.spanDistances = [];
            var wps = conn.waypoints || [];
            var off = window._polePreviewOffset || { dLat: 0, dLng: 0 };

            // 경유 전주 이름 해석 — 화면 밖(메모리에 없는) 전주는 IDB에서 로드 (전주 데이터 추출과 동일 방식)
            var snappedIds = wps.filter(function(wp){ return wp.snappedPole; }).map(function(wp){ return wp.snappedPole; });
            var missingIds = snappedIds.filter(function(id){ return !nodes.find(function(n){ return n.id === id; }); });
            var extraPoles = [];
            try {
                if (missingIds.length && typeof loadPolesByIds === 'function') extraPoles = await loadPolesByIds(missingIds);
                var bpts = [];
                if (fromNode) bpts.push(fromNode);
                if (toNode) bpts.push(toNode);
                wps.forEach(function(wp){ if (wp.lat && wp.lng) bpts.push(wp); });
                if (bpts.length && typeof loadPolesInBounds === 'function') {
                    var mnLat=Infinity,mxLat=-Infinity,mnLng=Infinity,mxLng=-Infinity;
                    bpts.forEach(function(p){ if(p.lat<mnLat)mnLat=p.lat; if(p.lat>mxLat)mxLat=p.lat; if(p.lng<mnLng)mnLng=p.lng; if(p.lng>mxLng)mxLng=p.lng; });
                    var mg = 0.0005;
                    var nb = await loadPolesInBounds({ minLat:mnLat-mg, maxLat:mxLat+mg, minLng:mnLng-mg, maxLng:mxLng+mg });
                    extraPoles = extraPoles.concat(nb);
                }
            } catch(e) {}
            var _seenP = {}, allPoles = [];
            nodes.concat(extraPoles).forEach(function(n){ if(!_seenP[n.id]){ _seenP[n.id]=1; allPoles.push(n); } });

            function resolveWpName(wp){
                var node = null;
                if (wp.snappedPole) node = allPoles.find(function(n){ return n.id === wp.snappedPole; });
                if (!node && wp.lat && wp.lng) {
                    var bestD = Infinity, bestN = null;
                    allPoles.forEach(function(n){
                        if (!isPoleType(n.type)) return;
                        var dlat1=(n.lat+off.dLat-wp.lat)*111000, dlng1=(n.lng+off.dLng-wp.lng)*111000*Math.cos(wp.lat*Math.PI/180);
                        var d1=dlat1*dlat1+dlng1*dlng1;
                        var dlat2=(n.lat-wp.lat)*111000, dlng2=(n.lng-wp.lng)*111000*Math.cos(wp.lat*Math.PI/180);
                        var d2=dlat2*dlat2+dlng2*dlng2;
                        var d=Math.min(d1,d2);
                        if (d<bestD){ bestD=d; bestN=n; }
                    });
                    if (bestN && bestD < 400) node = bestN; // 20m 이내
                }
                return node ? (node.name || '(이름없음)') : '(경유점)';
            }

            var stops = [];
            stops.push({ name: fromNode.name || '(출발)', lat: fromNode.lat, lng: fromNode.lng });
            wps.forEach(function(wp){ stops.push({ name: resolveWpName(wp), lat: wp.lat, lng: wp.lng }); });
            stops.push({ name: toNode.name || '(도착)', lat: toNode.lat, lng: toNode.lng });

            _showSpanTableModal((fromNode.name||'') + ' → ' + (toNode.name||''), stops, conn.spanDistances,
                function(){ saveData(); if (typeof renderAllConnections === 'function') renderAllConnections(); });
        }
        window.openCableSpanTable = openCableSpanTable;

        // 구간 거리표 모달 (일반 케이블 / 철거 임시선 공용). stops=[{name,lat,lng}], spanArr=거리배열(직접변경), onChange=편집후 콜백
        function _showSpanTableModal(subtitle, stops, spanArr, onChange) {
            function autoM(i){
                var a = stops[i], b = stops[i+1];
                var dLat = (b.lat-a.lat)*Math.PI/180, dLng = (b.lng-a.lng)*Math.PI/180;
                var sa = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
                return Math.round(6371000*2*Math.atan2(Math.sqrt(sa), Math.sqrt(1-sa)));
            }
            function fmt(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

            var oldM = document.getElementById('cableSpanTableModal');
            if (oldM) oldM.remove();
            var overlay = document.createElement('div');
            overlay.id = 'cableSpanTableModal';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:"Malgun Gothic","Segoe UI",sans-serif;';
            var box = document.createElement('div');
            box.style.cssText = 'background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,0.3);width:min(460px,92vw);max-height:84vh;display:flex;flex-direction:column;';

            var rows = '';
            for (var i = 0; i < stops.length - 1; i++) {
                var a = autoM(i);
                var v = spanArr[i];
                var custom = (v != null && v !== '');
                rows += '<tr style="border-bottom:1px solid #f1f5f9;">'
                    + '<td style="padding:7px 6px;text-align:center;color:#94a3b8;font-size:12px;">' + (i+1) + '</td>'
                    + '<td style="padding:7px 8px;font-size:12.5px;color:#334155;">' + escapeHtml(stops[i].name) + ' <span style="color:#cbd5e1;">→</span> ' + escapeHtml(stops[i+1].name) + '</td>'
                    + '<td style="padding:6px 10px 6px 4px;text-align:right;white-space:nowrap;">'
                    +   '<input class="cst-dist" data-seg="' + i + '" type="number" placeholder="' + a + '" value="' + (custom ? v : '') + '" style="width:62px;height:28px;text-align:right;font-size:13px;border:1px solid ' + (custom ? '#1a6fd4' : '#cbd5e1') + ';border-radius:6px;padding:0 6px;' + (custom ? 'font-weight:700;' : '') + '"> <span style="color:#94a3b8;font-size:12px;">m</span>'
                    + '</td></tr>';
            }

            box.innerHTML =
                '<div style="padding:14px 18px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:flex-start;">'
                +   '<div><div style="font-weight:700;font-size:14px;color:#1e293b;">구간 거리표</div>'
                +   '<div style="font-size:12px;color:#64748b;margin-top:2px;">' + escapeHtml(subtitle || '') + '</div></div>'
                +   '<button id="cstClose" style="border:none;background:#f1f5f9;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:17px;color:#475569;line-height:1;">×</button>'
                + '</div>'
                + '<div style="overflow:auto;padding:4px 12px;">'
                +   '<table style="width:100%;border-collapse:collapse;">'
                +   '<thead><tr style="color:#94a3b8;font-size:11px;text-align:left;"><th style="padding:5px 6px;width:24px;">#</th><th style="padding:5px 8px;">구간 (전주)</th><th style="padding:5px 8px;text-align:right;">거리</th></tr></thead>'
                +   '<tbody>' + (rows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;">구간이 없습니다</td></tr>') + '</tbody></table>'
                + '</div>'
                + '<div style="padding:12px 18px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">'
                +   '<span style="font-size:11.5px;color:#94a3b8;">빈칸=지도거리 자동 · 입력=고정(굵게)</span>'
                +   '<span style="font-size:14px;font-weight:700;color:#1e293b;">합계 <span id="cstTotal">0</span> m</span>'
                + '</div>';

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            function recalc(){
                var t = 0;
                for (var i = 0; i < stops.length - 1; i++) {
                    var v = spanArr[i];
                    t += (v != null && v !== '') ? Number(v) : autoM(i);
                }
                var el = document.getElementById('cstTotal'); if (el) el.textContent = fmt(t);
            }
            recalc();

            box.querySelectorAll('.cst-dist').forEach(function(inp){
                inp.addEventListener('change', function(){
                    var seg = parseInt(inp.getAttribute('data-seg'));
                    var val = parseInt(inp.value);
                    if (inp.value === '' || isNaN(val)) { spanArr[seg] = null; inp.style.fontWeight=''; inp.style.borderColor='#cbd5e1'; }
                    else { spanArr[seg] = val; inp.style.fontWeight='700'; inp.style.borderColor='#1a6fd4'; }
                    if (typeof onChange === 'function') onChange();
                    recalc();
                });
                inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
            });

            document.getElementById('cstClose').onclick = function(){ overlay.remove(); };
            overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
        }

        // 전주 풀 로드 (메모리 nodes + IDB) + 좌표 최근접 전주 — 케이블/철거임시선 공용
        async function _loadPolePool(boundsPts, snappedIds) {
            var extra = [];
            try {
                var missing = (snappedIds || []).filter(function(id){ return id && !nodes.find(function(n){ return n.id === id; }); });
                if (missing.length && typeof loadPolesByIds === 'function') extra = await loadPolesByIds(missing);
                if (boundsPts && boundsPts.length && typeof loadPolesInBounds === 'function') {
                    var mnLat=Infinity,mxLat=-Infinity,mnLng=Infinity,mxLng=-Infinity;
                    boundsPts.forEach(function(p){ if(p.lat<mnLat)mnLat=p.lat; if(p.lat>mxLat)mxLat=p.lat; if(p.lng<mnLng)mnLng=p.lng; if(p.lng>mxLng)mxLng=p.lng; });
                    var mg=0.0005;
                    var nb = await loadPolesInBounds({ minLat:mnLat-mg, maxLat:mxLat+mg, minLng:mnLng-mg, maxLng:mxLng+mg });
                    extra = extra.concat(nb);
                }
            } catch(e) {}
            var seen={}, pool=[];
            nodes.concat(extra).forEach(function(n){ if(!seen[n.id]){ seen[n.id]=1; pool.push(n); } });
            return pool;
        }
        function _nearestPoleInPool(pt, pool, off) {
            var bestD=Infinity, bestN=null;
            pool.forEach(function(n){
                if(!isPoleType(n.type)) return;
                var dlat1=(n.lat+off.dLat-pt.lat)*111000, dlng1=(n.lng+off.dLng-pt.lng)*111000*Math.cos(pt.lat*Math.PI/180);
                var d1=dlat1*dlat1+dlng1*dlng1;
                var dlat2=(n.lat-pt.lat)*111000, dlng2=(n.lng-pt.lng)*111000*Math.cos(pt.lat*Math.PI/180);
                var d2=dlat2*dlat2+dlng2*dlng2;
                var d=Math.min(d1,d2);
                if(d<bestD){ bestD=d; bestN=n; }
            });
            return (bestN && bestD<400) ? bestN : null;
        }

        // 엑셀 전주 데이터 생성 (poleList 순서대로, spanArr는 구간거리) — 케이블/철거임시선 공용
        function _exportPoleRowsExcel(poleList, spanArr, sheetName) {
            var rows = [];
            for (var i = 0; i < poleList.length; i++) {
                var node = poleList[i];
                var rawNum = (node.memo || '').replace('자가주:true','').replace('전산화번호: ','').trim();
                var m1 = rawNum.match(/^(.{5})(\d{3})$/);
                var 관리구 = m1 ? m1[1] : rawNum;
                var 전산번호 = m1 ? m1[2] : '';
                var poleName = node.name || '';
                var m2 = poleName.match(/^(.+)-(\d+[A-Za-z0-9]*)$/);
                var 간선명 = m2 ? m2[1] : poleName;
                var 전주번호 = m2 ? m2[2] : '';
                var 경간 = '';
                if (i > 0) {
                    var customSpan = spanArr && spanArr[i-1];
                    if (customSpan) { 경간 = customSpan; }
                    else {
                        var prev = poleList[i-1];
                        var dLat=(node.lat-prev.lat)*Math.PI/180, dLng=(node.lng-prev.lng)*Math.PI/180;
                        var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(prev.lat*Math.PI/180)*Math.cos(node.lat*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
                        경간=Math.round(6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
                    }
                }
                var 자가주 = (node.memo || '').indexOf('자가주:true')!==-1 ? '자가주' : '';
                var 구분 = node.type==='pole_new'?'신설':(node.type==='pole_removed'?'철거':'기설');
                rows.push([구분, 관리구, 전산번호, 간선명, 전주번호, 경간, 자가주]);
            }
            var wsData = [['구분','관리구','번호','간선명','번호','경간(m)','자가주']].concat(rows);
            var ws = XLSX.utils.aoa_to_sheet(wsData);
            ws['!cols'] = [{wch:6},{wch:8},{wch:6},{wch:12},{wch:6},{wch:8},{wch:6}];
            var wb = XLSX.utils.book_new();
            var sn = (sheetName || '전주').slice(0,31);
            XLSX.utils.book_append_sheet(wb, ws, sn);
            XLSX.writeFile(wb, '전주_' + sn + '.xlsx');
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
            showStatus(label + ' 그리기: ' + (type === 'cable' ? '전주를 클릭하세요' : '지도를 클릭하세요') + ' (Enter=확정, ESC=취소)');
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
            var nearPole = null;
            // 철거 케이블만 전주 스냅 적용, 조가선은 자유 그리기
            if (_tempDrawMode === 'cable') {
                nearPole = findNearestPole(lat, lng);
                if (nearPole) {
                    if (_tempDrawPoints.some(function(p) { return p.snappedPole === nearPole.id; })) return;
                    var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                    lat = nearPole.lat + _off.dLat;
                    lng = nearPole.lng + _off.dLng;
                }
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
            // 조가선은 스냅 표시 없이 커서만
            if (_tempDrawMode === 'mw') return;
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
            var snappedIds = [];

            if (isCable) {
                var tempPoleOffsetM = 1;

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
                snappedIds = _tempDrawPoints.filter(function(p) { return p.snappedPole; }).map(function(p) { return p.snappedPole; });
                var overlapCount = 0;
                if (snappedIds.length >= 2) {
                    connections.forEach(function(c) {
                        var cPoleIds = [];
                        if (c.waypoints) c.waypoints.forEach(function(wp) { if (wp.snappedPole) cPoleIds.push(wp.snappedPole); });
                        var shared = snappedIds.filter(function(id) { return cPoleIds.indexOf(id) !== -1; }).length;
                        if (shared >= 2) overlapCount++;
                    });
                }
                _tempDrawLines.forEach(function(entry) {
                    if (!entry.poleIds || !entry.poleIds.length) return;
                    var shared = snappedIds.filter(function(id) { return entry.poleIds.indexOf(id) !== -1; }).length;
                    if (shared >= 2) overlapCount++;
                });
                if (overlapCount > 0) {
                    path = applyPathOffset(path, -(overlapCount * 4));
                }
            }

            // 확정 polyline
            var line = L.polyline(path, { color: color, weight: 4, opacity: 0.9 }).addTo(map);
            var entry = { line: line, labels: [], markers: [], path: path, drawType: drawType, poleIds: snappedIds, spanDistances: [], color: color,
                snappedPoleIds: _tempDrawPoints.map(function(p){ return p.snappedPole || null; }) };

            // 경간 라벨 (철거 케이블만) — 클릭하면 인라인 편집
            if (isCable) renderTempSpanLabels(entry);

            // 철거 케이블 클릭 → 메뉴 (전주 데이터 추출 / 구간 거리표)
            if (isCable) {
                (function(en){
                    en.line.on('click', function(ev){
                        if (ev && ev.originalEvent && L.DomEvent) L.DomEvent.stopPropagation(ev);
                        _showTempLineMenu(en, ev);
                    });
                })(entry);
            }

            _tempDrawLines.push(entry);
            _tempDrawPoints = [];
            var label = isCable ? '철거 케이블' : '조가선';
            showStatus(label + ' 확정! 계속 그리거나 ESC로 종료');
            // 전주 라벨 갱신
            if (typeof drawPoleCanvas === 'function') drawPoleCanvas();
        }

        // 철거 임시선 경간 라벨 렌더 + 클릭 인라인 편집 (직접 입력값 우선, 없으면 지도거리)
        function renderTempSpanLabels(entry) {
            if (entry.labels) entry.labels.forEach(function(m) { map.removeLayer(m); });
            entry.labels = [];
            if (entry.drawType !== 'cable') return;
            if (!entry.spanDistances) entry.spanDistances = [];
            var path = entry.path;
            var color = entry.color || '#27ae60';
            for (var si = 0; si < path.length - 1; si++) {
                var sLat1 = path[si][0], sLng1 = path[si][1];
                var sLat2 = path[si+1][0], sLng2 = path[si+1][1];
                var dLat = (sLat2 - sLat1) * Math.PI / 180;
                var dLng = (sLng2 - sLng1) * Math.PI / 180;
                var sa = Math.sin(dLat/2)*Math.sin(dLat/2) +
                         Math.cos(sLat1*Math.PI/180)*Math.cos(sLat2*Math.PI/180)*
                         Math.sin(dLng/2)*Math.sin(dLng/2);
                var autoM = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1-sa)));
                if (autoM < 1 && !entry.spanDistances[si]) continue;
                var spanM = entry.spanDistances[si] || autoM;
                var isCustom = !!entry.spanDistances[si];
                var midLat = (sLat1 + sLat2) / 2;
                var midLng = (sLng1 + sLng2) / 2;
                var pt1 = map.latLngToLayerPoint({ lat: sLat1, lng: sLng1 });
                var pt2 = map.latLngToLayerPoint({ lat: sLat2, lng: sLng2 });
                var angleDeg = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * 180 / Math.PI;
                if (angleDeg > 90) angleDeg -= 180;
                if (angleDeg < -90) angleDeg += 180;
                var _sls = (typeof getStyle === 'function' ? getStyle('spanLabelSize') : 10);
                var spanStyle = 'color:' + color + ';font-size:' + _sls + 'px;transform:rotate(' + angleDeg.toFixed(1) + 'deg) translateY(8px);transform-origin:center center;cursor:pointer;' + (isCustom ? 'font-weight:bold;' : '');
                var spanIcon = L.divIcon({
                    html: '<div class="span-label" style="' + spanStyle + '">' + spanM + 'm</div>',
                    className: '', iconSize: [50, 16], iconAnchor: [25, 8]
                });
                var spanMarker = L.marker([midLat, midLng], { icon: spanIcon, zIndexOffset: 3000 }).addTo(map);
                (function(en, segIdx, autoVal, mLat, mLng, col) {
                    spanMarker.on('click', function() {
                        var old = document.getElementById('spanInlineInput');
                        if (old) old.remove();
                        var container = map.getContainer();
                        var pt = map.latLngToLayerPoint({ lat: mLat, lng: mLng });
                        var inp = document.createElement('input');
                        inp.id = 'spanInlineInput';
                        inp.type = 'number';
                        inp.placeholder = autoVal + '';
                        inp.value = en.spanDistances[segIdx] || '';
                        inp.style.cssText = 'position:absolute;left:' + (pt.x - 30) + 'px;top:' + (pt.y - 12) + 'px;width:60px;height:24px;z-index:99999;text-align:center;font-size:12px;border:2px solid ' + col + ';border-radius:4px;outline:none;background:#fff;';
                        container.appendChild(inp);
                        inp.focus(); inp.select();
                        var _finished = false;
                        function finish() {
                            if (_finished) return;
                            _finished = true;
                            var v = parseInt(inp.value);
                            if (inp.value === '' || isNaN(v)) en.spanDistances[segIdx] = null;
                            else en.spanDistances[segIdx] = v;
                            inp.remove();
                            renderTempSpanLabels(en);
                        }
                        inp.addEventListener('keydown', function(e) {
                            if (e.key === 'Enter') { e.preventDefault(); finish(); }
                            if (e.key === 'Escape') { _finished = true; inp.remove(); }
                        });
                        inp.addEventListener('blur', finish);
                    });
                })(entry, si, autoM, midLat, midLng, color);
                entry.labels.push(spanMarker);
            }
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

        // 철거 케이블 클릭 메뉴
        function _showTempLineMenu(entry, ev) {
            var old = document.getElementById('tempLineMenu');
            if (old) old.remove();
            // 클릭한 케이블 위치에 메뉴 띄우기 (shim polyline 이벤트는 latlng 제공, clientX는 없음)
            var x = window.innerWidth / 2 - 80, y = window.innerHeight / 2 - 60;
            try {
                if (ev && ev.latlng && map && typeof map.latLngToLayerPoint === 'function') {
                    var mapRect = document.getElementById('map').getBoundingClientRect();
                    var pt = map.latLngToLayerPoint(ev.latlng);
                    x = mapRect.left + pt.x + 12;
                    y = mapRect.top + pt.y - 10;
                }
            } catch(e) {}
            var menu = document.createElement('div');
            menu.id = 'tempLineMenu';
            menu.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;z-index:100000;background:#fff;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.25);overflow:hidden;font-family:"Malgun Gothic","Segoe UI",sans-serif;font-size:13px;min-width:160px;';
            menu.innerHTML =
                '<div style="padding:8px 13px;font-size:11px;color:#94a3b8;border-bottom:1px solid #f1f5f9;">철거 케이블</div>'
                + '<div id="tlmExport" style="padding:10px 14px;cursor:pointer;">📋 전주 데이터 추출</div>'
                + '<div id="tlmTable" style="padding:10px 14px;cursor:pointer;border-top:1px solid #f6f6f6;">📏 구간 거리표</div>';
            document.body.appendChild(menu);
            var r = menu.getBoundingClientRect();
            if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 8) + 'px';
            if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 8) + 'px';
            function close(){ if (menu.parentNode) menu.remove(); document.removeEventListener('mousedown', onDoc, true); }
            function onDoc(e){ if (!menu.contains(e.target)) close(); }
            setTimeout(function(){ document.addEventListener('mousedown', onDoc, true); }, 0);
            var be = document.getElementById('tlmExport'), bt = document.getElementById('tlmTable');
            be.onmouseover = function(){ this.style.background='#f5f5f5'; }; be.onmouseout = function(){ this.style.background=''; };
            bt.onmouseover = function(){ this.style.background='#f5f5f5'; }; bt.onmouseout = function(){ this.style.background=''; };
            be.onclick = function(){ close(); exportTempPoleData(entry); };
            bt.onclick = function(){ close(); openTempSpanTable(entry); };
        }

        // 철거 케이블 path 각 점 → 전주 노드 해석 (스냅 우선, 없으면 좌표 최근접)
        async function _tempLineStops(entry) {
            var off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
            var pts = (entry.path || []).map(function(p){ return { lat: p[0], lng: p[1] }; });
            var snapIds = entry.snappedPoleIds || [];
            var pool = await _loadPolePool(pts, snapIds);
            return pts.map(function(p, i){
                var node = null;
                if (snapIds[i]) node = pool.find(function(n){ return n.id === snapIds[i]; });
                if (!node) node = _nearestPoleInPool(p, pool, off);
                return { name: node ? (node.name || '(이름없음)') : '(경유점)', lat: p.lat, lng: p.lng, node: node };
            });
        }

        // 철거 케이블 구간 거리표
        async function openTempSpanTable(entry) {
            if (!entry.spanDistances) entry.spanDistances = [];
            var stops = await _tempLineStops(entry);
            _showSpanTableModal('철거 케이블', stops, entry.spanDistances, function(){ renderTempSpanLabels(entry); });
        }

        // 철거 케이블 전주 데이터 추출
        async function exportTempPoleData(entry) {
            var stops = await _tempLineStops(entry);
            var poleList = [];
            stops.forEach(function(s){
                if (!s.node) return;
                if (poleList.length && poleList[poleList.length-1].id === s.node.id) return;
                poleList.push(s.node);
            });
            if (poleList.length === 0) { alert('이 철거 케이블에 스냅된 전주가 없습니다.\n전주를 찍으면서 그렸는지 확인하세요.'); return; }
            // 모든 점이 전주에 1:1로 잡혔을 때만 직접입력 경간 사용, 아니면 좌표거리
            var spanArr = (poleList.length === stops.length) ? entry.spanDistances : null;
            var sheetName = '철거_' + (poleList[0].name||'A') + '_' + (poleList[poleList.length-1].name||'B');
            _exportPoleRowsExcel(poleList, spanArr, sheetName);
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
            connectingFromNode = null; window._connectingSourceNodeId = null;
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
            pendingWaypoints.forEach(function(wp, idx) {
                waypointMarkers.push(_makeWaypointMarker(wp.lat, wp.lng, idx + 1));
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
            var _otdrDx = 0, _otdrDy = 0, _otdrDragging = false;
            function _otdrMousedown(e) {
                if (e.target === closeBtn) return;
                _otdrDragging = true;
                _otdrDx = e.clientX - panel.offsetLeft;
                _otdrDy = e.clientY - panel.offsetTop;
                e.preventDefault();
            }
            function _otdrMousemove(e) {
                if (!_otdrDragging) return;
                panel.style.left = (e.clientX - _otdrDx) + 'px';
                panel.style.top = (e.clientY - _otdrDy) + 'px';
            }
            function _otdrMouseup() { _otdrDragging = false; }
            header.addEventListener('mousedown', _otdrMousedown);
            document.addEventListener('mousemove', _otdrMousemove);
            document.addEventListener('mouseup', _otdrMouseup);
            // 터치 지원
            function _otdrTouchstart(e) {
                if (e.target === closeBtn) return;
                _otdrDragging = true;
                var t = e.touches[0];
                _otdrDx = t.clientX - panel.offsetLeft;
                _otdrDy = t.clientY - panel.offsetTop;
            }
            function _otdrTouchmove(e) {
                if (!_otdrDragging) return;
                var t = e.touches[0];
                panel.style.left = (t.clientX - _otdrDx) + 'px';
                panel.style.top = (t.clientY - _otdrDy) + 'px';
            }
            function _otdrTouchend() { _otdrDragging = false; }
            header.addEventListener('touchstart', _otdrTouchstart);
            document.addEventListener('touchmove', _otdrTouchmove);
            document.addEventListener('touchend', _otdrTouchend);
            // 닫을 때 리스너 제거용 저장
            window._otdrDragCleanup = function() {
                document.removeEventListener('mousemove', _otdrMousemove);
                document.removeEventListener('mouseup', _otdrMouseup);
                document.removeEventListener('touchmove', _otdrTouchmove);
                document.removeEventListener('touchend', _otdrTouchend);
            };

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
            if (window._otdrDragCleanup) { window._otdrDragCleanup(); window._otdrDragCleanup = null; }
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
                id: 'coax_' + _genId(),
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

            var connId = _genId();

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
            connectingFromNode = null; window._connectingSourceNodeId = null;
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
            var cur = conn.lineType || 'existing';
            conn.lineType = cur === 'existing' ? 'new' : cur === 'new' ? 'removed' : 'existing';
            saveData();
            renderAllConnections();
            var labels = { 'new': '신설', 'existing': '기설', 'removed': '철거' };
            showStatus(labels[conn.lineType] + '로 변경됨');
        };
        window.setCableLineType         = function(connId, lineType) {
            var conn = connections.find(c => c.id === connId);
            if (!conn) return;
            conn.lineType = lineType;
            saveData();
            renderAllConnections();
            var labels = { 'new': '신설', 'existing': '기설', 'removed': '철거' };
            showStatus(labels[lineType] + '로 변경됨');
        };
