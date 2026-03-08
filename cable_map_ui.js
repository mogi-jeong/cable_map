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

                    const coreSpan = document.createElement('span');
                    coreSpan.className = 'a-conn-core';
                    coreSpan.textContent = `${conn.cores} CORES`;
                    div.appendChild(coreSpan);

                    div.onclick = (e) => {
                        if (['BUTTON','SPAN'].includes(e.target.tagName)) return;
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
            document.getElementById('nodeInfoModal').classList.remove('active');
            selectedNode = null;
            connectingMode = false;
            connectingFromNode = null;
            connectingToNode = null;
            // 커서 복원
            const mapEl = document.getElementById('map');
            if (mapEl) mapEl.style.cursor = '';
        }
        
        // 케이블 연결 시작 - 경유점 먼저 찍는 방식
        let pendingWaypoints = [];
        let waypointMarkers = [];
        let previewPolyline = null;
        let snapCircleOverlay = null;
        let snapHighlight = null;
        const SNAP_RADIUS_M = 5;

        function startConnecting() {
            closeMenuModal();
            connectingMode = true;
            connectingFromNode = selectedNode;
            pendingWaypoints = [];
            waypointMarkers = [];
            // 커서 변경
            const mapEl = document.getElementById('map');
            if (mapEl) mapEl.style.cursor = 'crosshair';
            showStatus('지도를 클릭해 경유점을 찍고, 도착 장비를 클릭하세요 (ESC=취소)');
            map.off('click', onMapClickForWaypoint);
            map.on('click', onMapClickForWaypoint);
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
            const poles = nodes.filter(n => n.type==='pole'||n.type==='pole_existing'||n.type==='pole_new'||n.type==='pole_removed');
            let best=null, bestDist=Infinity;
            poles.forEach(p => {
                const d = distanceM(lat,lng,p.lat,p.lng);
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
                snapHighlight = new kakao.maps.Circle({
                    map:map._m, center:new kakao.maps.LatLng(nearPole.lat,nearPole.lng), radius:3,
                    strokeWeight:2, strokeColor:'#00cc44', strokeOpacity:1,
                    fillColor:'#00cc44', fillOpacity:0.8
                });
            }
        }

        // 전주 마커 직접 클릭 시 경유점으로 추가 (map.js onNodeClick에서 호출)
        function addPoleAsWaypoint(node) {
            if (!connectingMode || !connectingFromNode) return;
            pendingWaypoints.push({ lat:node.lat, lng:node.lng, snappedPole:node.id });
            const marker = L.circleMarker([node.lat,node.lng], {
                radius:5, fillColor:'#00cc44', color:'#fff', weight:2, fillOpacity:1, zIndexOffset:2000
            }).addTo(map);
            waypointMarkers.push(marker);
            updatePreviewLine();
            showStatus('전주 스냅: '+node.name+' | 경유점 '+pendingWaypoints.length+'개');
        }

        function onMapClickForWaypoint(e) {
            if (!connectingMode || !connectingFromNode) return;
            if (window._nodeJustClicked) return;
            let lat=e.latlng.lat, lng=e.latlng.lng;
            const nearPole = findNearestPole(lat,lng);
            if (nearPole) { lat=nearPole.lat; lng=nearPole.lng; }
            pendingWaypoints.push({ lat, lng, snappedPole:nearPole?nearPole.id:null });
            const marker = L.circleMarker([lat,lng], {
                radius:nearPole?5:3,
                fillColor:nearPole?'#00cc44':'#e67e22',
                color:'#fff', weight:2, fillOpacity:1, zIndexOffset:2000
            }).addTo(map);
            waypointMarkers.push(marker);
            updatePreviewLine();
            showStatus(nearPole
                ? '전주 스냅: '+nearPole.name+' | 경유점 '+pendingWaypoints.length+'개'
                : '경유점 '+pendingWaypoints.length+'개. 도착 장비를 클릭하세요 (ESC=취소)');
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
            kakao.maps.event.removeListener(map._m, 'mousemove', onMapMousemoveForSnap);
            map.off('click', onMapClickForWaypoint);
        }
        // 전체 초기화 (취소 시)
        function clearPendingWaypoints() {
            clearPreviewOnly();
            pendingWaypoints = [];
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
            
            // 상태 완전 초기화
            document.getElementById('connectionModal').classList.remove('active');
            connectingMode = false;
            connectingFromNode = null;
            connectingToNode = null;
            selectedNode = null;
            hideStatus();
            showStatus('IN1 케이블이 연결되었습니다');
        }
        
        // 연결 모달 닫기
        function closeConnectionModal() {
            document.getElementById('connectionModal').classList.remove('active');
            connectingMode = false;
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
            const POLE_OFFSET_M = 3; // 전주에서 3m 옆으로
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
            
            // 선 그리기
            const polyline = L.polyline(path, {
                color: '#FF0000',
                weight: 4,
                opacity: 0.8
            }).addTo(map);
            
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
            for (let i = 0; i < segLens.length; i++) {
                if (accLen + segLens[i] >= halfLen) {
                    const t = (halfLen - accLen) / segLens[i];
                    labelLat = path[i][0] + t * (path[i+1][0] - path[i][0]);
                    labelLng = path[i][1] + t * (path[i+1][1] - path[i][1]);
                    break;
                }
                accLen += segLens[i];
            }
            
            const labelHTML = `<div class="connection-label">${connection.cores}코어</div>`;
            
            const labelIcon = L.divIcon({
                html: labelHTML,
                className: 'connection-label-icon',
                iconSize: [60, 30],
                iconAnchor: [30, 15]
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
                const zoomLevel = map._m ? (18 - map._m.getLevel()) : 13;
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
                const popupContent = `<div style="text-align:center; min-width:150px; padding:5px;">
                    <div style="font-weight:bold; margin-bottom:8px; color:#333;">${escapeHtml(fromNode?.name) || '장비'} ↔ ${escapeHtml(toNode?.name) || '장비'}</div>
                    <div style="color:#666; font-size:12px; margin-bottom:10px;">${connection.cores}코어</div>
                    <button onclick="startWaypointInsertModeById('${connId}'); map.closePopup()"
                        style="width:100%; padding:8px; margin-bottom:5px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">
                        📍 경유점 추가
                    </button>
                    <button onclick="changeCoreCount('${connId}'); map.closePopup()"
                        style="width:100%; padding:8px; margin-bottom:5px; background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">
                        🔢 코어 수 변경
                    </button>
                    <button onclick="deleteConnection('${connId}'); map.closePopup()"
                        style="width:100%; padding:8px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">
                        🗑️ 케이블 삭제
                    </button>
                </div>`;
                L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(map);
                }, 300); // 300ms 후 팝업 열기 (더블클릭 대기)
            });

            polylines.push({ line: polyline, label: label });
            
            // 중간 점들에 클릭 가능한 마커 추가
            connection.waypoints.forEach((wp, index) => {
                const waypointMarker = L.circleMarker([wp.lat, wp.lng], {
                    radius: 6,
                    fillColor: '#e67e22',
                    color: '#FFFFFF',
                    weight: 2,
                    fillOpacity: 1,
                    opacity: 1,
                    zIndexOffset: 1000
                }).addTo(map);
                
                // 점 클릭 시 팝업 표시
                const popupContent = `
                    <div style="text-align: center; min-width: 120px;">
                        <button onclick="startDraggingWaypoint('${connection.id}', ${index})" 
                                style="width: 100%; padding: 8px; margin: 3px 0; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            ✋ 점 이동
                        </button>
                        <button onclick="deleteWaypoint('${connection.id}', ${index})" 
                                style="width: 100%; padding: 8px; margin: 3px 0; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            🗑️ 점 삭제
                        </button>
                    </div>
                `;
                
                waypointMarker.bindPopup(popupContent);
                
                polylines.push({ marker: waypointMarker });
            });
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
            document.body.style.cursor = 'crosshair';

            // 기존 핸들러 제거 후 새 등록
            if (_waypointMapClickHandler) {
                kakao.maps.event.removeListener(map._m, 'click', _waypointMapClickHandler);
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
        }

        function cancelWaypointInsertMode() {
            if (_waypointMapClickHandler) {
                kakao.maps.event.removeListener(map._m, 'click', _waypointMapClickHandler);
                _waypointMapClickHandler = null;
            }
            _waypointInsertConn = null;
            _waypointInsertPath = null;
            document.body.style.cursor = '';
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