        function showNodeInfoModalForEdit() {
            const typeNames = {
                datacenter: '국사장비',
                junction: '함체',
                onu: 'ONU',
                subscriber: '가입자',
                cctv: 'CCTV'
            };
            
            document.getElementById('nodeInfoTitle').textContent = typeNames[selectedNode.type] + ' 정보';
            document.getElementById('nodeName').value = selectedNode.name || '';
            document.getElementById('nodeMemo').value = selectedNode.memo || '';
            
            // 연결 목록 표시
            const connectionsList = document.getElementById('connectionsList');
            connectionsList.innerHTML = '';
            
            const nodeConnections = getNodeConns(selectedNode.id);
            
            if (nodeConnections.length === 0) {
                connectionsList.innerHTML = '<p style="color: #999;">연결된 장비가 없습니다</p>';
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

                // IN 먼저, OUT 순서대로
                [...inConns, ...outConns].forEach(conn => {
                    const otherNodeId = getOtherNodeId(conn, selectedNode.id);
                    const otherNode = nodes.find(n => n.id === otherNodeId);
                    if (!otherNode) return;

                    const isIncoming = isInConn(conn, selectedNode.id);
                    const outIdx = outConns.indexOf(conn); // -1이면 IN
                    const outNum = outIdx + 1; // OUT1, OUT2, ...
                    const inIdx = inConns.indexOf(conn);
                    const inNum = inIdx + 1; // IN1, IN2, ...

                    // 방향 뱃지
                    const lineColor = isIncoming ? '#16a085' : outLineColors[outIdx % outLineColors.length];
                    const dirLabel  = isIncoming ? `IN${inNum}` : `OUT${outNum}`;

                    const div = document.createElement('div');
                    div.className = 'a-conn-card';
                    div.style.borderLeftColor = lineColor;

                    // 헤더 행
                    const headerRow = document.createElement('div');
                    headerRow.style.cssText = 'display:flex; align-items:center; gap:6px; flex-wrap:wrap;';

                    const nameSpan = document.createElement('strong');
                    nameSpan.textContent = otherNode.name || '이름 없음';
                    headerRow.appendChild(nameSpan);

                    const dirBadge = document.createElement('span');
                    dirBadge.style.cssText = `padding:2px 8px; background:${lineColor}; color:white; border-radius:3px; font-size:12px; font-weight:bold;`;
                    dirBadge.textContent = dirLabel;
                    headerRow.appendChild(dirBadge);

                    // IN1 고정 뱃지 / IN2+는 OUT으로 변경 가능
                    if (canToggle) {
                        if (isIncoming) {
                            if (inIdx === 0) {
                                const fixedBadge = document.createElement('span');
                                fixedBadge.style.cssText = 'padding:2px 8px; background:#95a5a6; color:white; border-radius:3px; font-size:11px;';
                                fixedBadge.textContent = 'IN1 고정';
                                headerRow.appendChild(fixedBadge);
                            } else {
                                const toOutBtn = document.createElement('button');
                                toOutBtn.style.cssText = 'padding:2px 8px; background:#e67e22; color:white; border:none; border-radius:3px; font-size:11px; cursor:pointer;';
                                toOutBtn.textContent = '↪ OUT으로 변경';
                                toOutBtn.onclick = (e) => { e.stopPropagation(); toggleConnToOut(conn.id); };
                                headerRow.appendChild(toOutBtn);
                            }
                        } else {
                            const toggleBtn = document.createElement('button');
                            toggleBtn.style.cssText = 'padding:2px 8px; background:#3498db; color:white; border:none; border-radius:3px; font-size:11px; cursor:pointer;';
                            toggleBtn.textContent = '↩ IN으로 변경';
                            toggleBtn.onclick = (e) => { e.stopPropagation(); toggleConnDirection(conn.id); };
                            headerRow.appendChild(toggleBtn);
                        }
                    }

                    // OUT 순서 변경 버튼 (OUT이 2개 이상일 때)
                    if (!isIncoming && outConns.length >= 2) {
                        const moveUp = document.createElement('button');
                        moveUp.style.cssText = 'padding:2px 6px; background:#f39c12; color:white; border:none; border-radius:3px; font-size:11px; cursor:pointer;';
                        moveUp.textContent = '▲';
                        moveUp.disabled = outIdx === 0;
                        moveUp.style.opacity = outIdx === 0 ? '0.3' : '1';
                        moveUp.onclick = (e) => { e.stopPropagation(); moveOutOrder(conn.id, -1); };
                        headerRow.appendChild(moveUp);

                        const moveDown = document.createElement('button');
                        moveDown.style.cssText = 'padding:2px 6px; background:#f39c12; color:white; border:none; border-radius:3px; font-size:11px; cursor:pointer;';
                        moveDown.textContent = '▼';
                        moveDown.disabled = outIdx === outConns.length - 1;
                        moveDown.style.opacity = outIdx === outConns.length - 1 ? '0.3' : '1';
                        moveDown.onclick = (e) => { e.stopPropagation(); moveOutOrder(conn.id, +1); };
                        headerRow.appendChild(moveDown);
                    }

                    div.appendChild(headerRow);

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
                    coreRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:5px;';

                    const coreSpan = document.createElement('span');
                    coreSpan.className = 'a-conn-core';
                    coreSpan.style.margin = '0';
                    coreSpan.textContent = `${conn.cores} CORES · ${Math.round(totalDist)}m`;
                    coreRow.appendChild(coreSpan);

                    // OTDR 버튼 (OUT 방향만)
                    if (!isIncoming) {
                        const otdrBtn = document.createElement('button');
                        otdrBtn.style.cssText = 'padding:2px 8px; background:#8e44ad; color:white; border:none; border-radius:3px; font-size:11px; cursor:pointer; font-weight:bold;';
                        otdrBtn.textContent = 'OTDR';
                        otdrBtn.onclick = (e) => {
                            e.stopPropagation();
                            openOtdrInput(selectedNode, conn, dirLabel, otherNode);
                        };
                        coreRow.appendChild(otdrBtn);
                    }

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
            connectingMode = false; window.connectingMode = false;
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

        function startConnecting() {
            closeMenuModal();
            connectingMode = true; window.connectingMode = true;
            connectingFromNode = selectedNode;
            pendingWaypoints = [];
            waypointMarkers = [];
            // 커서 변경
            if (window._setMapCursorMode) window._setMapCursorMode('crosshair');
            else { const mapEl = document.getElementById('map'); if (mapEl) mapEl.style.cursor = 'crosshair'; }
            showStatus('경유점을 찍고 도착 장비를 클릭하세요 (Space=일시정지, ESC=취소)');
            map.off('click', onMapClickForWaypoint);
            map.on('click', onMapClickForWaypoint);
            window._mousemoveHandler = onMapMousemoveForSnap;
            kakao.maps.event.addListener(map._m, 'mousemove', onMapMousemoveForSnap);
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
        function findNearestPole(lat, lng) {
            const off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
            const poles = nodes.filter(n => n.type==='pole'||n.type==='pole_existing'||n.type==='pole_new'||n.type==='pole_removed');
            let best=null, bestDist=Infinity;
            poles.forEach(p => {
                const d = distanceM(lat,lng,p.lat+off.dLat,p.lng+off.dLng);
                if (d<=SNAP_RADIUS_M && d<bestDist) { bestDist=d; best=p; }
            });
            return best;
        }

        // 마우스 이동: 스냅 원 표시
        function onMapMousemoveForSnap(me) {
            if (!connectingMode) return;
            const lat=me.latLng.getLat(), lng=me.latLng.getLng();
            if (snapCircleOverlay) { snapCircleOverlay.setMap(null); snapCircleOverlay=null; }
            if (snapHighlight) { snapHighlight.setMap(null); snapHighlight=null; }
            const nearPole = findNearestPole(lat,lng);
            snapCircleOverlay = new kakao.maps.Circle({
                map:map._m, center:new kakao.maps.LatLng(lat,lng), radius:SNAP_RADIUS_M,
                strokeWeight:1, strokeColor:nearPole?'#00cc44':'#aaaaaa', strokeOpacity:0.8,
                fillColor:nearPole?'#00cc44':'#cccccc', fillOpacity:0.15
            });
            if (nearPole) {
                var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                snapHighlight = new kakao.maps.Circle({
                    map:map._m, center:new kakao.maps.LatLng(nearPole.lat+_off.dLat,nearPole.lng+_off.dLng), radius:3,
                    strokeWeight:2, strokeColor:'#00cc44', strokeOpacity:1,
                    fillColor:'#00cc44', fillOpacity:0.8
                });
            }
        }

        // 전주 마커 직접 클릭 시 경유점으로 추가 (map.js onNodeClick에서 호출)
        function addPoleAsWaypoint(node) {
            if (!connectingMode || !connectingFromNode) return;
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
                if (n.type !== 'junction' && n.type !== 'datacenter' && n.type !== 'onu' && n.type !== 'subscriber' && n.type !== 'cctv') return;
                const d = distanceM(lat, lng, n.lat, n.lng);
                if (d <= JUNCTION_SNAP_RADIUS_M && d < bestDist) { bestDist = d; best = n; }
            });
            return best;
        }

        let _lastWaypointClick = 0;
        function onMapClickForWaypoint(e) {
            if (!connectingMode || !connectingFromNode) return;
            if (window._nodeJustClicked) return;
            const _now = Date.now();
            if (_now - _lastWaypointClick < 300) return;
            _lastWaypointClick = _now;
            let lat = e.latlng.lat, lng = e.latlng.lng;

            // 근처 함체/장비 감지 → 연결 여부 팝업
            const nearJunction = findNearestJunction(lat, lng);
            if (nearJunction) {
                const jName = nearJunction.name || '이름없음';
                const jTypeLabel = nearJunction.type === 'junction' ? '[함체]'
                    : nearJunction.type === 'datacenter' ? '[국사]'
                    : nearJunction.type === 'onu'        ? '[ONU]'
                    : nearJunction.type === 'subscriber' ? '[가입자]'
                    : nearJunction.type === 'cctv'       ? '[CCTV]'
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
                        clearPreviewOnly();
                        showConnectionModal();
                    },
                    '근처에 ' + jName + ' 장비가 있습니다',
                    '연결'
                );
                return;
            }

            // 함체 없으면 기존 전주 스냅 로직
            const nearPole = findNearestPole(lat, lng);
            if (nearPole) {
                var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                lat = nearPole.lat + _off.dLat; lng = nearPole.lng + _off.dLng;
            }
            pendingWaypoints.push({ lat, lng, snappedPole: nearPole ? nearPole.id : null });
            const marker = L.circleMarker([lat, lng], {
                radius: nearPole ? 5 : 3,
                fillColor: nearPole ? '#00cc44' : '#e67e22',
                color: '#fff', weight: 2, fillOpacity: 1, zIndexOffset: 2000
            }).addTo(map);
            waypointMarkers.push(marker);
            updatePreviewLine();
            showStatus(nearPole
                ? '전주 스냅: ' + nearPole.name + ' | 경유점 ' + pendingWaypoints.length + '개 (Space=일시정지)'
                : '경유점 ' + pendingWaypoints.length + '개 (Space=일시정지, ESC=취소)');
        }

        function updatePreviewLine() {
            if (previewPolyline) map.removeLayer(previewPolyline);
            const path = [
                [connectingFromNode.lat, connectingFromNode.lng],
                ...pendingWaypoints.map(wp => [wp.lat, wp.lng])
            ];
            if (path.length >= 2) {
                previewPolyline = L.polyline(path, {
                    color: '#e67e22', weight: 2, opacity: 0.6, dashArray: '8,6'
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
            if(window._mousemoveHandler){kakao.maps.event.removeListener(map._m,'mousemove',window._mousemoveHandler);window._mousemoveHandler=null;}
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
            const coreOptions = [12, 24, 48, 72, 144, 288, 432];
            const container = document.getElementById('fiberCoreSelection');
            container.innerHTML = '';
            
            coreOptions.forEach(cores => {
                const btn = document.createElement('button');
                btn.className = 'fiber-core-btn';
                btn.textContent = cores + '코어';
                btn.onclick = function() {
                    document.querySelectorAll('.fiber-core-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    btn.dataset.cores = cores;
                };
                container.appendChild(btn);
            });
            
            // lineType 초기화 (신설 기본)
            document.querySelectorAll('#lineTypeSelection .fiber-core-btn').forEach(b => b.classList.remove('selected'));
            var defBtn = document.querySelector('#lineTypeSelection [data-line-type="new"]');
            if (defBtn) defBtn.classList.add('selected');

            document.getElementById('connectionModal').classList.add('active');
        }
        
        // 연결 확인
        function confirmConnection() {
            const selectedBtn = document.querySelector('.fiber-core-btn.selected');
            if (!selectedBtn) {
                showStatus('코어 수를 선택하세요');
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

                // IN은 최대 2개까지만 허용
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
                            waypoints: wp,
                            portMapping: [],
                            inFromCableId: null
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
            
            // 양쪽 장비에 포트 생성 (아직 없으면)
            if (!connectingFromNode.ports) connectingFromNode.ports = [];
            if (!connectingToNode.ports) connectingToNode.ports = [];
            
            // 포트가 부족하면 추가
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
                waypoints: [...(pendingWaypoints || [])],
                portMapping: [],
                inFromCableId: null
            };
            pendingWaypoints = [];
            
            // 첫 번째 IN 연결이면 inOrder에 등록
            connectingToNode.inOrder.push(connection.id);
            const toIdx2 = nodes.findIndex(n => n.id === connectingToNode.id);
            if (toIdx2 !== -1) nodes[toIdx2] = connectingToNode;

            connections.push(connection);
            saveData();
            renderAllConnections();

            // 프리뷰 라인/마커 정리
            clearPreviewOnly();

            // 상태 완전 초기화
            document.getElementById('connectionModal').classList.remove('active');
            connectingMode = false; window.connectingMode = false;
            connectingFromNode = null;
            connectingToNode = null;
            selectedNode = null;
            hideStatus();
            showStatus('IN1 케이블이 연결되었습니다');
        }
        
        // 연결 모달 닫기
        function closeConnectionModal() {
            document.getElementById('connectionModal').classList.remove('active');
            connectingMode = false; window.connectingMode = false;
            connectingFromNode = null;
            connectingToNode = null;
            selectedNode = null;
            hideStatus();
        }
        
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

            // 경로 생성
            let path = [
                [fromNode.lat, fromNode.lng],
                ...connection.waypoints.map(wp => [wp.lat, wp.lng]),
                [toNode.lat, toNode.lng]
            ];

            // 전주 경유점 옆으로 오프셋
            path = applyPoleOffset(path, connection.waypoints);

            // 병렬선 오프셋
            if (parallelOffset !== 0) {
                path = applyPathOffset(path, parallelOffset);
            }
            
            // 선 그리기 — 신설/기설 구분
            const isNewCable = (connection.lineType || 'existing') === 'new';
            const cableColor = connection.color || (isNewCable ? '#ff0000' : '#0055ff');
            const polylineOpts = { color: cableColor, weight: 4, opacity: 0.8 };
            if (isNewCable) polylineOpts.dashArray = '10,6';
            const polyline = L.polyline(path, polylineOpts).addTo(map);
            
            // 경유점 삽입 공통 함수 (PC 더블클릭 / 모바일 길게터치 공용)
            function insertWaypointAt(clickedLatLng) {
                let minDistance = Infinity;
                let insertIndex = 0;

                for (let i = 0; i < path.length - 1; i++) {
                    const p1 = L.latLng(path[i][0], path[i][1]);
                    const p2 = L.latLng(path[i + 1][0], path[i + 1][1]);
                    const distance = L.LineUtil.pointToSegmentDistance(
                        map.latLngToLayerPoint(clickedLatLng),
                        map.latLngToLayerPoint(p1),
                        map.latLngToLayerPoint(p2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        insertIndex = i;
                    }
                }

                connection.waypoints.splice(insertIndex, 0, {
                    lat: clickedLatLng.lat,
                    lng: clickedLatLng.lng
                });
                saveData();
                renderAllConnections();
                showStatus('점이 추가되었습니다');
            }

            // 더블클릭: click 핸들러에서 처리

            // 모바일: 길게 터치(500ms)로 점 추가
            (function() {
                let longPressTimer = null;
                let touchMoved = false;

                polyline.on('touchstart', function(e) {
                    touchMoved = false;
                    longPressTimer = setTimeout(function() {
                        if (!touchMoved) {
                            const touch = e.originalEvent.touches[0];
                            const latlng = map.containerPointToLatLng(
                                L.point(touch.clientX - map.getContainer().getBoundingClientRect().left,
                                        touch.clientY - map.getContainer().getBoundingClientRect().top)
                            );
                            insertWaypointAt(latlng);
                        }
                    }, 500);
                });

                polyline.on('touchmove', function() {
                    touchMoved = true;
                    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
                });

                polyline.on('touchend touchcancel', function() {
                    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
                });
            })();
            
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

            const typeLabel = isNewCable ? '신설' : '기설';
            const labelHTML = `<div class="connection-label" style="color:${cableColor};transform:rotate(${labelAngle.toFixed(1)}deg) translateY(-8px);transform-origin:center center;white-space:nowrap;">${typeLabel} ${connection.cores}코어</div>`;

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
            
            // 케이블 클릭 시 삭제 메뉴
            let _clickTimer = null;
            polyline.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                if (window._nodeJustClicked) return;
                // 더블클릭 판별: 300ms 내 두 번 클릭이면 경유점 추가 모드
                if (_clickTimer) {
                    clearTimeout(_clickTimer);
                    _clickTimer = null;
                    startWaypointInsertMode(connection, path);
                    return;
                }
                _clickTimer = setTimeout(function() {
                    _clickTimer = null;
                // 줌 레벨에 따라 동적 THRESHOLD (고배율일수록 더 좁게)
                const zoomLevel = map._m ? map.getZoom() : 13;
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
                }, 300); // 300ms 후 팝업 열기 (더블클릭 대기)
            });

            polylines.push({ line: polyline, label: label, connId: connection.id });

            // 경간(구간별 거리) 라벨 표시 — 경유점이 있을 때만
            if (path.length > 2) {
                for (let si = 0; si < path.length - 1; si++) {
                    var sLat1 = path[si][0], sLng1 = path[si][1];
                    var sLat2 = path[si+1][0], sLng2 = path[si+1][1];
                    var dLat = (sLat2 - sLat1) * Math.PI / 180;
                    var dLng = (sLng2 - sLng1) * Math.PI / 180;
                    var sa = Math.sin(dLat/2)*Math.sin(dLat/2) +
                             Math.cos(sLat1*Math.PI/180)*Math.cos(sLat2*Math.PI/180)*
                             Math.sin(dLng/2)*Math.sin(dLng/2);
                    var spanM = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1-sa)));
                    if (spanM < 1) continue;
                    var sMidLat = (sLat1 + sLat2) / 2;
                    var sMidLng = (sLng1 + sLng2) / 2;
                    // 케이블 방향 각도 계산 (화면 픽셀 기준)
                    var pt1 = map.latLngToLayerPoint({ lat: sLat1, lng: sLng1 });
                    var pt2 = map.latLngToLayerPoint({ lat: sLat2, lng: sLng2 });
                    var angleDeg = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * 180 / Math.PI;
                    // 글씨가 뒤집히지 않게 -90~90 범위로 보정
                    if (angleDeg > 90) angleDeg -= 180;
                    if (angleDeg < -90) angleDeg += 180;
                    var spanIcon = L.divIcon({
                        html: '<div class="span-label" style="color:' + cableColor + ';transform:rotate(' + angleDeg.toFixed(1) + 'deg) translateY(8px);transform-origin:center center;">' + spanM + 'm</div>',
                        className: '',
                        iconSize: [50, 16],
                        iconAnchor: [25, 8]
                    });
                    var spanMarker = L.marker([sMidLat, sMidLng], {
                        icon: spanIcon,
                        zIndexOffset: -2000
                    }).addTo(map);
                    polylines.push({ marker: spanMarker, connId: connection.id });
                }
            }

        }
        
        // 케이블 삭제
        function deleteConnection(connectionId) {
            const conn = connections.find(c => c.id === connectionId);
            if (conn) {
                const toNodeId = connTo(conn);
                const fromNodeId = connFrom(conn);

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
                if(_waypointClickListener){kakao.maps.event.removeListener(map._m,'click',_waypointClickListener);_waypointClickListener=null;}
            }
            _waypointMapClickHandler = function(mouseEvent) {
                const latlng = { lat: mouseEvent.latLng.getLat(), lng: mouseEvent.latLng.getLng() };
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
            kakao.maps.event.addListener(map._m, 'click', _waypointMapClickHandler);
            _waypointClickListener = _waypointMapClickHandler;
        }

        function cancelWaypointInsertMode() {
            if (_waypointMapClickHandler) {
                if(_waypointClickListener){kakao.maps.event.removeListener(map._m,'click',_waypointClickListener);_waypointClickListener=null;}
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
            }, 3000);
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
            
            showStatus('지도를 클릭하여 장비를 이동하세요');
            
            // 지도 클릭 이벤트 추가
            map.once('click', function(e) {
                if (movingNode) {
                    // 장비 위치 업데이트
                    movingNode.lat = e.latlng.lat;
                    movingNode.lng = e.latlng.lng;
                    
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

        // ==================== 공가 신청서 생성 ====================
        var _cachedInvsData = null; // 세션 동안 장표 캐시

        async function generateApplication(connId) {
            // 1. 전주 목록 추출 (exportPoleData와 동일 로직)
            const conn = connections.find(c => c.id === connId);
            if (!conn) return;
            const fromNode = nodes.find(n => n.id === connFrom(conn));
            const toNode   = nodes.find(n => n.id === connTo(conn));
            const off = window._polePreviewOffset || { dLat: 0, dLng: 0 };

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

            // 전주 파싱
            var poles = [];
            for (var i = 0; i < poleList.length; i++) {
                var node = poleList[i];
                var rawNum = (node.memo || '').replace('자가주:true', '').replace('전산화번호: ', '').trim();
                var m1 = rawNum.match(/^(.{5})(\d{3})$/);
                var 관리구 = m1 ? m1[1] : rawNum;
                var 번호 = m1 ? m1[2] : '';
                var poleName = node.name || '';
                var m2 = poleName.match(/^(.+?)-(\d{1,4})$/);
                var 선로명 = m2 ? m2[1] : poleName;
                var 선로번호 = m2 ? m2[2] : '';
                var 전산화번호 = (관리구 + (번호 ? String(parseInt(번호)).padStart(3, '0') : '')).toUpperCase();
                poles.push({ 관리구: 관리구, 번호: 번호, 선로명: 선로명, 선로번호: 선로번호, 전산화번호: 전산화번호 });
            }

            // 정렬 (sort_key 포팅)
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

            // 2. 장표 로딩 (캐시 또는 파일 선택)
            if (_cachedInvsData) {
                _buildApplication(poles, _cachedInvsData, fromNode, toNode);
            } else {
                // 파일 선택 input
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
                            // 장표 인덱싱
                            var byId = {}, byName = {};
                            rows.forEach(function(r) {
                                // 컬럼명 trim
                                var row = {};
                                Object.keys(r).forEach(function(k) { row[k.trim()] = r[k]; });
                                var key = String(row['시작전산화번호'] || '').trim().toUpperCase();
                                if (!key) return;
                                if (!byId[key]) byId[key] = [];
                                byId[key].push(row);
                                var nm = _v(row['현전주 선로명']);
                                var nb = _v(row['현전주 선로번호']);
                                if (nm) {
                                    var nk = nm + '|' + nb;
                                    if (!byName[nk]) byName[nk] = [];
                                    byName[nk].push(row);
                                }
                            });
                            _cachedInvsData = { byId: byId, byName: byName };
                            showStatus('장표 로드 완료 (' + rows.length + '행)');
                            _buildApplication(poles, _cachedInvsData, fromNode, toNode);
                        } catch (ex) {
                            alert('장표 파일 읽기 실패: ' + ex.message);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                };
                inp.click();
            }
        }

        function _v(x) {
            if (x == null) return '';
            var s = String(x).trim();
            return (s.toLowerCase() === 'nan' || s.toLowerCase() === 'none') ? '' : s;
        }

        function _numStr(n) {
            try { return String(parseInt(n)); } catch(e) { return String(n); }
        }

        function _buildApplication(poles, invs, fromNode, toNode) {
            var JUMP_THRESHOLD = 2;
            var defaults = { 설치단: '2', 사업자: 'A000042286', 용도: '4', 통신선: 'O', 규격: '12' };

            var NCOLS = 34;
            // Row 3 (그룹 헤더) — 순번/접수구분/비고는 세로 병합이므로 빈 문자열
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
            // Row 4 (세부 헤더)
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
                row[C.현선로명] = _v(r['현전주 선로명']);
                row[C.현선로번호] = _v(r['현전주 선로번호']);
                row[C.현관리구] = _v(r['현전주 관리구']);
                row[C.현번호] = _v(r['현전주 번호']);
                row[C['1차선로명']] = _v(r['1차전주 선로명']);
                row[C['1차선로번호']] = _v(r['1차전주 선로번호']);
                row[C['1차관리구']] = _v(r['1차전주 관리구']);
                row[C['1차번호']] = _v(r['1차전주 번호']);
                row[C['2차선로명']] = _v(r['2차전주 선로명']);
                row[C['2차선로번호']] = _v(r['2차전주 선로번호']);
                row[C['2차관리구']] = _v(r['2차전주 관리구']);
                row[C['2차번호']] = _v(r['2차전주 번호']);
                row[C.설치단] = _v(r['설치단']);
                row[C.사업자] = _v(r['사업자']);
                row[C.설치일자] = _v(r['설치일자']);
                row[C.케이블번호] = _v(r['케이블번호']);
                row[C.용도] = _v(r['용도']);
                row[C.통선선종류] = _v(r['통신선종류']);
                row[C.규격] = _v(r['규격']);
                row[C.승인코드] = _v(r['승인코드']);
                row[C.고객공급선종류] = _v(r['고객공급선종류']);
                row[C.봉인번호] = _v(r['봉인번호']);
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
                row[C.현번호] = _numStr(pole.번호);
                if (prev) {
                    row[C['1차선로명']] = prev.선로명;
                    row[C['1차선로번호']] = prev.선로번호;
                    row[C['1차관리구']] = prev.관리구;
                    row[C['1차번호']] = _numStr(prev.번호);
                } else {
                    row[C['1차관리구']] = '99999'; row[C['1차번호']] = '999';
                }
                if (nxt) {
                    row[C['2차선로명']] = nxt.선로명;
                    row[C['2차선로번호']] = nxt.선로번호;
                    row[C['2차관리구']] = nxt.관리구;
                    row[C['2차번호']] = _numStr(nxt.번호);
                } else {
                    row[C['2차관리구']] = '99999'; row[C['2차번호']] = '999';
                }
                row[C.설치단] = defaults.설치단;
                row[C.사업자] = defaults.사업자;
                row[C.용도] = defaults.용도;
                row[C.통선선종류] = invsRow ? _v(invsRow['통신선종류']) : defaults.통신선;
                row[C.규격] = invsRow ? _v(invsRow['규격']) : defaults.규격;
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
                    정비_신설.push(poleToRow2(pole, prev, nxt, seq, invsRows[0], jaga));
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

            // 구간명 생성 (첫간선명+번호~끝번호)
            function makeRangeName(dataRows) {
                if (dataRows.length === 0) return '';
                var first = dataRows[0], last = dataRows[dataRows.length - 1];
                var firstName = first[C.현선로명], firstNum = first[C.현선로번호];
                var lastName = last[C.현선로명], lastNum = last[C.현선로번호];
                if (firstName === lastName) {
                    return firstName + firstNum + '-' + lastNum;
                }
                return firstName + firstNum + '-' + lastName + lastNum;
            }

            // Excel 생성
            var COL_WIDTHS = [6,7, 9,8,8,5, 9,8,8,5, 9,8,8,5, 5,13,11,18,5, 5,5,7,7,8, 7,7,7, 7,7,7, 7,7,7, 20];

            function buildSheet(dataRows) {
                var aoa = [];
                // Row 1: 제목
                var titleRow = new Array(NCOLS).fill('');
                titleRow[0] = '공가 가공설비 시설계획서';
                aoa.push(titleRow);
                // Row 2: 빈 행
                aoa.push(new Array(NCOLS).fill(''));
                // Row 3: 그룹 헤더 (순번/접수구분/비고는 세로병합이므로 여기서 텍스트 지정)
                var row3 = HEADER_ROW3.slice();
                row3[0] = '순번';
                row3[1] = '접수구분';
                row3[33] = '비고';
                aoa.push(row3);
                // Row 4: 세부 헤더
                aoa.push(HEADER_ROW4);
                // Row 5~: 데이터
                dataRows.forEach(function(r) { aoa.push(r); });

                var ws = XLSX.utils.aoa_to_sheet(aoa);

                // 병합
                var merges = [
                    // 제목행 (Row 1)
                    { s: { r: 0, c: 0 }, e: { r: 0, c: NCOLS - 1 } },
                    // 순번 세로 병합 (Row 3-4, A3:A4)
                    { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
                    // 접수구분 세로 병합 (Row 3-4, B3:B4)
                    { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
                    // 현전주 (C3:F3)
                    { s: { r: 2, c: 2 }, e: { r: 2, c: 5 } },
                    // 1차전주 (G3:J3)
                    { s: { r: 2, c: 6 }, e: { r: 2, c: 9 } },
                    // 2차전주 (K3:N3)
                    { s: { r: 2, c: 10 }, e: { r: 2, c: 13 } },
                    // 통신케이블 (O3:X3)
                    { s: { r: 2, c: 14 }, e: { r: 2, c: 23 } },
                    // 통신기기1 (Y3:AA3)
                    { s: { r: 2, c: 24 }, e: { r: 2, c: 26 } },
                    // 통신기기2 (AB3:AD3)
                    { s: { r: 2, c: 27 }, e: { r: 2, c: 29 } },
                    // 통신기기3 (AE3:AG3)
                    { s: { r: 2, c: 30 }, e: { r: 2, c: 32 } },
                    // 비고 세로 병합 (Row 3-4, AH3:AH4)
                    { s: { r: 2, c: 33 }, e: { r: 3, c: 33 } }
                ];
                ws['!merges'] = merges;

                // 열 너비
                ws['!cols'] = COL_WIDTHS.map(function(w) { return { wch: w }; });

                return ws;
            }

            // 시트 1: 신규
            var ws1 = buildSheet(신규);

            // 시트 2: 정비 (해제 먼저, 신설 나중)
            var 정비data = 정비_해제.concat(정비_신설);
            var ws2 = buildSheet(정비data);

            // 시트 3: 해지 (빈)
            var ws3 = buildSheet([]);

            var wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws1, '차세대_공가가공설비시설계획서_양식');
            XLSX.utils.book_append_sheet(wb, ws2, '차세대_공가가공설비시설계획서_양식');
            XLSX.utils.book_append_sheet(wb, ws3, '차세대_공가가공설비시설계획서_양식');

            // 파일명 생성
            var today = new Date();
            var dateStr = String(today.getFullYear()).slice(2) +
                          String(today.getMonth() + 1).padStart(2, '0') +
                          String(today.getDate()).padStart(2, '0');

            // 신규 파일명
            if (신규.length > 0) {
                var nInfo = countBonJo(신규);
                var nRange = makeRangeName(신규);
                var fn1 = dateStr + '_공가신규(' + nRange + ')' + nInfo.bon + '본 ' + nInfo.jo + '조.xlsx';
            }
            // 정비 파일명
            if (정비_신설.length > 0) {
                var jInfo = countBonJo(정비_신설);
                var jRange = makeRangeName(정비_신설);
                var fn2 = dateStr + '_공가정비(' + jRange + ')' + jInfo.bon + '본 ' + jInfo.jo + '조.xlsx';
            }

            var fileName = dateStr + '_공가신청서_' + ((fromNode?.name || 'A') + '-' + (toNode?.name || 'B')).slice(0, 20) + '.xlsx';
            XLSX.writeFile(wb, fileName);

            showStatus('공가 신청서 생성 완료 — 신규 ' + 신규.length + '행, 정비 해제 ' + 정비_해제.length + '행 + 신설 ' + 정비_신설.length + '행');
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
        function showCableInfoPanel(connId, fromNode, toNode, connection, e) {
            var panel = document.getElementById('cableInfoPanel');
            var typeText = (connection.lineType || 'existing') === 'new' ? '🔴 신설' : '🔵 기설';
            document.getElementById('cableInfoContent').innerHTML =
                '<div style="text-align:center;">' +
                '<div style="font-weight:bold; margin-bottom:8px; color:#333;">' + (escapeHtml(fromNode?.name) || '장비') + ' ↔ ' + (escapeHtml(toNode?.name) || '장비') + '</div>' +
                '<div style="color:#666; font-size:12px; margin-bottom:10px;">' + typeText + ' · ' + connection.cores + '코어</div>' +
                '<button onclick="startWaypointInsertModeById(\'' + connId + '\'); closeCableInfoPanel()" style="width:100%; padding:8px; margin-bottom:5px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">📍 경유점 추가</button>' +
                '<button onclick="changeCoreCount(\'' + connId + '\'); closeCableInfoPanel()" style="width:100%; padding:8px; margin-bottom:5px; background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🔢 코어 수 변경</button>' +
                '<button onclick="exportPoleData(\'' + connId + '\'); closeCableInfoPanel()" style="width:100%; padding:8px; margin-bottom:5px; background:#9b59b6; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">📊 전주 데이터 추출</button>' +
                '<button onclick="generateApplication(\'' + connId + '\'); closeCableInfoPanel()" style="width:100%; padding:8px; margin-bottom:5px; background:#16a085; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">📋 공가 신청서 생성</button>' +
                '<button onclick="openCablePoleLabelBatch(\'' + connId + '\'); closeCableInfoPanel()" style="width:100%; padding:8px; margin-bottom:5px; background:#e67e22; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🏷️ 전주 라벨 일괄조정</button>' +
                '<button onclick="toggleCableType(\'' + connId + '\'); closeCableInfoPanel()" style="width:100%; padding:8px; margin-bottom:5px; background:#8e44ad; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🔄 신설/기설 전환</button>' +
                '<button onclick="deleteConnection(\'' + connId + '\'); closeCableInfoPanel()" style="width:100%; padding:8px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">🗑️ 케이블 삭제</button>' +
                '</div>';
            // 클릭 위치 기준으로 패널 위치 결정
            var mapRect = document.getElementById('map').getBoundingClientRect();
            var clickPt = map.latLngToLayerPoint(e.latlng);
            var px = mapRect.left + clickPt.x + 15;
            var py = mapRect.top + clickPt.y - 30;
            // 화면 밖으로 넘어가지 않도록 보정
            if (px + 260 > window.innerWidth) px = px - 280;
            if (py + 350 > window.innerHeight) py = window.innerHeight - 360;
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
            kakao.maps.event.addListener(map._m, 'mousemove', _tempMousemoveHandler);
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
                kakao.maps.event.removeListener(map._m, 'mousemove', _tempMousemoveHandler);
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
            var lat = me.latLng.getLat(), lng = me.latLng.getLng();
            if (_tempSnapCircle) { _tempSnapCircle.setMap(null); _tempSnapCircle = null; }
            if (_tempSnapHighlight) { _tempSnapHighlight.setMap(null); _tempSnapHighlight = null; }
            var nearPole = findNearestPole(lat, lng);
            _tempSnapCircle = new kakao.maps.Circle({
                map: map._m, center: new kakao.maps.LatLng(lat, lng), radius: 10,
                strokeWeight: 1, strokeColor: nearPole ? '#00cc44' : '#aaa', strokeOpacity: 0.8,
                fillColor: nearPole ? '#00cc44' : '#ccc', fillOpacity: 0.15
            });
            if (nearPole) {
                var _off = window._polePreviewOffset || { dLat: 0, dLng: 0 };
                _tempSnapHighlight = new kakao.maps.Circle({
                    map: map._m, center: new kakao.maps.LatLng(nearPole.lat + _off.dLat, nearPole.lng + _off.dLng),
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

            // 끝점 주황 원 마커 (divIcon으로 DOM 클릭 우선)
            var lastWp = pendingWaypoints[pendingWaypoints.length - 1];
            var dotIcon = L.divIcon({
                html: '<div class="paused-cable-dot" style="width:60px; height:60px; background:#e67e22; border:4px solid white; border-radius:50%; opacity:0.85; cursor:pointer; box-shadow:0 3px 12px rgba(0,0,0,0.4);"></div>',
                className: '',
                iconSize: [60, 60],
                iconAnchor: [30, 30]
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
            var dotDom = endMarker._ov && endMarker._ov.getContent();
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
            connectingMode = false; window.connectingMode = false;
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
            connectingMode = true; window.connectingMode = true;
            if (window._setMapCursorMode) window._setMapCursorMode('crosshair');
            else { var mapEl = document.getElementById('map'); if (mapEl) mapEl.style.cursor = 'crosshair'; }

            updatePreviewLine();
            map.off('click', onMapClickForWaypoint);
            map.on('click', onMapClickForWaypoint);
            window._mousemoveHandler = onMapMousemoveForSnap;
            kakao.maps.event.addListener(map._m, 'mousemove', onMapMousemoveForSnap);

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
                                var pos = new kakao.maps.LatLng(_otdrMarker._lat, _otdrMarker._lng);
                                var iw = new kakao.maps.InfoWindow({
                                    position: pos,
                                    content: '<div style="padding:5px;min-width:120px;font-size:12px;text-align:center;"><b>OTDR ' + Math.round(dist) + 'm</b><br>' + fromName + ' ↔ ' + toName + '<br>' + fromName + '에서 ' + pt.distFromPrev + 'm</div>',
                                    removable: true, zIndex: 99999
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
