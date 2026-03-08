        function renderOFDList() {
            const ofdList = document.getElementById('ofdList');
            ofdList.innerHTML = '';
            
            if (selectedNode.ofds.length === 0) {
                ofdList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">등록된 OFD가 없습니다. "OFD 추가" 버튼을 클릭하세요.</p>';
                return;
            }
            
            selectedNode.ofds.forEach((ofd, index) => {
                const ofdCard = document.createElement('div');
                ofdCard.className = 'a-ofd-card';
                
                // 이름 행
                const nameRow = document.createElement('div');
                nameRow.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:12px;';
                
                nameRow.innerHTML = `
                    <span class="a-ofd-badge">${escapeHtml(ofd.name)}</span>
                    <input type="text"
                           value="${escapeHtml(ofd.customName) || ''}"
                           placeholder="이름 입력 (예: 정선향)"
                           onchange="updateOFDCustomName(${index}, this.value)">
                    <button class="a-ofd-del" onclick="deleteOFDByIndex(${index})">&#x2715;</button>
                `;
                
                // 케이블 선택
                const cableSection = document.createElement('div');
                const cableSectionLabel = document.createElement('div');
                cableSectionLabel.className = 'a-ofd-sec';
                cableSectionLabel.textContent = 'Connected Cable';
                
                const cableSelect = document.createElement('select');
                cableSelect.style.cssText = 'width:100%; display:block;';
                cableSelect.onchange = (e) => updateOFDCable(index, e.target.value);
                
                // 연결된 케이블 목록 (nodeA/nodeB 양방향)
                const connectedCables = getNodeConns(selectedNode.id);
                cableSelect.innerHTML = '<option value="">선택하세요</option>';
                connectedCables.forEach(conn => {
                    const isOut = isOutConn(conn, selectedNode.id);
                    const targetNode = nodes.find(n => n.id === getOtherNodeId(conn, selectedNode.id));
                    const direction = isOut ? '→' : '←';
                    const option = document.createElement('option');
                    option.value = conn.id;
                    option.textContent = `${direction} ${targetNode?.name || '이름 없음'} (${conn.cores}C)`;
                    if (ofd.connectedCable === conn.id) {
                        option.selected = true;
                    }
                    cableSelect.appendChild(option);
                });
                
                cableSection.appendChild(cableSectionLabel);
                cableSection.appendChild(cableSelect);
                
                // 버튼 행
                const buttonRow = document.createElement('div');
                buttonRow.style.cssText = 'display:flex; gap:8px; margin-top:12px;';
                
                const detailBtn = document.createElement('button');
                detailBtn.className = 'a-ofd-act';
                detailBtn.style.cssText = 'background:#1a6fd4; color:white;';
                detailBtn.textContent = '상세 편집';
                detailBtn.onclick = () => showOFDDetail(index);
                
                const cableWireMapBtn = document.createElement('button');
                cableWireMapBtn.className = 'a-ofd-act';
                cableWireMapBtn.style.cssText = 'background:#9b59b6; color:white;';
                cableWireMapBtn.textContent = '케이블 직선도';
                cableWireMapBtn.onclick = () => showCableWireMap(index);
                
                buttonRow.appendChild(detailBtn);
                buttonRow.appendChild(cableWireMapBtn);
                
                ofdCard.appendChild(nameRow);
                ofdCard.appendChild(cableSection);
                ofdCard.appendChild(buttonRow);
                
                ofdList.appendChild(ofdCard);
            });
        }
        
        // OFD 목록에서 바로 삭제
        function deleteOFDByIndex(index) {
            const ofdName = selectedNode.ofds[index]?.customName || selectedNode.ofds[index]?.name || 'OFD';
            showConfirm(
                `'${ofdName}'을(를) 삭제할까요?\n연결된 케이블 매핑 정보도 모두 사라집니다.`,
                () => {
                    const ofd = selectedNode.ofds[index];
                    if (ofd && ofd.connectedCable) {
                        const cable = connections.find(c => c.id === ofd.connectedCable);
                        if (cable) {
                            const toNode = nodes.find(n => n.id === connTo(cable));
                            if (toNode && toNode.ports) toNode.ports.forEach(p => { p.label = ''; });
                            clearDownstreamLabels(connTo(cable), new Set([connFrom(cable)]));
                        }
                    }
                    selectedNode.ofds.splice(index, 1);
                    const ni = nodes.findIndex(n => n.id === selectedNode.id);
                    if (ni !== -1) nodes[ni] = selectedNode;
                    saveData();
                    renderOFDList();
                    showStatus('OFD가 삭제되었습니다');
                },
                '', '삭제'
            );
        }

        // OFD 사용자 이름 업데이트
        function updateOFDCustomName(ofdIndex, customName) {
            selectedNode.ofds[ofdIndex].customName = customName.trim();
            
            // 노드 업데이트
            const index = nodes.findIndex(n => n.id === selectedNode.id);
            if (index !== -1) {
                nodes[index] = selectedNode;
            }
            
            saveData();
        }
        
        // 새 OFD 추가
        function addNewOFD() {
            // OFD 이름 생성 (A, B, C...)
            const letter = String.fromCharCode(65 + selectedNode.ofds.length); // 65 = 'A'
            const ofdName = `OFD-${letter}`;
            
            // 72코어 OFD 데이터 생성
            const newOFD = {
                name: ofdName,
                customName: '', // 사용자 이름 (나중에 입력)
                ports: []
            };
            
            // 72개 포트 초기화
            for (let i = 1; i <= 72; i++) {
                newOFD.ports.push({
                    number: i,
                    label: '(내용 입력)'
                });
            }
            
            selectedNode.ofds.push(newOFD);
            
            // 노드 업데이트
            const index = nodes.findIndex(n => n.id === selectedNode.id);
            if (index !== -1) {
                nodes[index] = selectedNode;
            }
            
            saveData();
            renderOFDList();
            showStatus(`${ofdName}가 추가되었습니다`);
        }
        
        // OFD 상세 표시
        function showOFDDetail(ofdIndex) {
            currentOFDIndex = ofdIndex;
            currentOFD = selectedNode.ofds[ofdIndex];
            
            // 제목에 사용자 이름 포함
            const displayName = currentOFD.customName ? `${escapeHtml(currentOFD.name)} (${escapeHtml(currentOFD.customName)})` : escapeHtml(currentOFD.name);
            document.getElementById('ofdDetailTitle').textContent = `${displayName} 편집`;
            
            // 6열 테이블 생성 (1-12, 13-24, ...)
            const content = document.getElementById('ofdDetailContent');
            content.innerHTML = '';
            
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `<th colspan="2" style="border: 1px solid #000; padding: 5px; background: #f0f0f0;">${displayName}</th>`;
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            const tbody = document.createElement('tbody');
            
            // 6개 컬럼, 각 컬럼에 12개 포트
            const columnsHTML = [];
            for (let col = 0; col < 6; col++) {
                const startPort = col * 12;
                let columnHTML = '<table style="width: 100%; border-collapse: collapse; margin: 0;">';
                
                for (let i = 0; i < 12; i++) {
                    const portIndex = startPort + i;
                    const port = currentOFD.ports[portIndex];
                    columnHTML += `
                        <tr>
                            <td style="border: 1px solid #000; padding: 5px; text-align: center; width: 30px;">${port.number}</td>
                            <td style="border: 1px solid #000; padding: 5px;">
                                <input type="text" 
                                       value="${escapeHtml(port.label)}" 
                                       onchange="updateOFDPort(${portIndex}, this.value)"
                                       style="width: 100%; border: none; padding: 2px;">
                            </td>
                        </tr>
                    `;
                }
                columnHTML += '</table>';
                columnsHTML.push(columnHTML);
            }
            
            // 2행 3열로 배치
            for (let row = 0; row < 2; row++) {
                const tr = document.createElement('tr');
                for (let col = 0; col < 3; col++) {
                    const td = document.createElement('td');
                    td.style.border = '1px solid #000';
                    td.style.padding = '0';
                    td.style.verticalAlign = 'top';
                    td.innerHTML = columnsHTML[row * 3 + col];
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            
            table.appendChild(tbody);
            content.appendChild(table);
            
            document.getElementById('ofdModal').classList.remove('active');
            document.getElementById('ofdDetailModal').classList.add('active');
        }
        
        // OFD 포트 업데이트
        function updateOFDPort(portIndex, value) {
            if (currentOFD && currentOFD.ports[portIndex]) {
                currentOFD.ports[portIndex].label = value;
            }
        }
        
        // OFD 상세 저장
        function saveOFDDetail() {
            // 노드 업데이트
            const index = nodes.findIndex(n => n.id === selectedNode.id);
            if (index !== -1) {
                nodes[index] = selectedNode;
            }
            
            saveData();
            closeOFDDetailModal();
            showStatus('저장되었습니다');
        }
        
        // OFD 삭제
        function deleteOFD() {
            const ofdName = currentOFD ? (currentOFD.customName || currentOFD.name || 'OFD') : 'OFD';
            showConfirm(
                `'${ofdName}'을(를) 삭제하면\n연결된 케이블 매핑 정보도 모두 사라집니다.\n정말 삭제할까요?`,
                () => {
                    // 삭제 전: 연결된 케이블의 하위 노드 라벨 연쇄 초기화 (유령 글씨 방지)
                    if (currentOFD && currentOFD.connectedCable) {
                        const cable = connections.find(c => c.id === currentOFD.connectedCable);
                        if (cable) {
                            const toNode = nodes.find(n => n.id === connTo(cable));
                            if (toNode && toNode.ports) toNode.ports.forEach(p => { p.label = ''; });
                            clearDownstreamLabels(connTo(cable), new Set([connFrom(cable)]));
                        }
                    }
                    selectedNode.ofds.splice(currentOFDIndex, 1);
                    const index = nodes.findIndex(n => n.id === selectedNode.id);
                    if (index !== -1) nodes[index] = selectedNode;
                    saveData();
                    closeOFDDetailModal();
                    showStatus('OFD가 삭제되었습니다');
                },
                '',
                '삭제'
            );
        }
        
        // OFD 모달 닫기
        function closeOFDModal() {
            document.getElementById('ofdModal').classList.remove('active');
        }
        
        // OFD 상세 모달 닫기
        function closeOFDDetailModal() {
            document.getElementById('ofdDetailModal').classList.remove('active');
            // OFD 목록으로 돌아가기
            document.getElementById('ofdModal').classList.add('active');
            renderOFDList();
            currentOFD = null;
            currentOFDIndex = null;
        }
        
        // ==================== OFD 함수 끝 ====================
        
        // IN/OUT 방향 전환
        function toggleConnDirection(connId) {
            const conn = connections.find(c => c.id === connId);
            if (!conn) return;

            // 이미 이 노드가 IN인 경우
            if (isInConn(conn, selectedNode.id)) {
                showStatus('이미 IN(전단) 케이블입니다');
                return;
            }

            // 현재 IN 케이블 (selectedNode가 수신측인 다른 연결)
            const currentInConn = connections.find(c => isInConn(c, selectedNode.id));

            const hasMapping = (conn.portMapping && conn.portMapping.length > 0) ||
                               (currentInConn && currentInConn.portMapping && currentInConn.portMapping.length > 0);
            const warnText = hasMapping
                ? '포트 매핑(직선도 연결 정보)이 초기화됩니다.\n'
                : '';

            showConfirm(`이 케이블을 IN(전단)으로 변경합니다.\n${warnText}계속할까요?`, () => {
                // 기존 IN 케이블 방향 반전 (IN→OUT)
                if (currentInConn) {
                    const nA = nodes.find(n => n.id === currentInConn.nodeA);
                    const nB = nodes.find(n => n.id === currentInConn.nodeB);
                    // 방향 플립
                    const curDirA = (nA && nA.connDirections && nA.connDirections[currentInConn.id]) || 'out';
                    const newDirA = curDirA === 'out' ? 'in' : 'out';
                    if (nA) { if (!nA.connDirections) nA.connDirections = {}; nA.connDirections[currentInConn.id] = newDirA; }
                    if (nB) { if (!nB.connDirections) nB.connDirections = {}; nB.connDirections[currentInConn.id] = newDirA === 'out' ? 'in' : 'out'; }
                    currentInConn.portMapping = [];
                    // 방향이 바뀐 후 to(수신)측 포트 초기화
                    const prevToNode = nodes.find(n => n.id === connTo(currentInConn));
                    if (prevToNode && prevToNode.ports) prevToNode.ports.forEach(p => { p.label = ''; });
                }

                // 선택한 케이블 → IN으로 전환 (connDirections 플립)
                conn.portMapping = [];
                const oldToNode = nodes.find(n => n.id === connTo(conn));
                if (oldToNode && oldToNode.ports) oldToNode.ports.forEach(p => { p.label = ''; });

                const nA2 = nodes.find(n => n.id === conn.nodeA);
                const nB2 = nodes.find(n => n.id === conn.nodeB);
                const curDirA2 = (nA2 && nA2.connDirections && nA2.connDirections[conn.id]) || 'out';
                const newDirA2 = curDirA2 === 'out' ? 'in' : 'out';
                if (nA2) { if (!nA2.connDirections) nA2.connDirections = {}; nA2.connDirections[conn.id] = newDirA2; }
                if (nB2) { if (!nB2.connDirections) nB2.connDirections = {}; nB2.connDirections[conn.id] = newDirA2 === 'out' ? 'in' : 'out'; }

                // 현재 노드(selectedNode) 포트 초기화
                if (selectedNode.ports) selectedNode.ports.forEach(p => { p.label = ''; });

                const idx = nodes.findIndex(n => n.id === selectedNode.id);
                if (idx !== -1) nodes[idx] = selectedNode;

                saveData();
                showNodeInfoModalForEdit();
                showStatus('IN(전단) 케이블이 변경되었습니다');
            }, '', '변경');
        }

        // IN 케이블 → OUT으로 전환 (IN1이 아닌 케이블만)
        function toggleConnToOut(connId) {
            const conn = connections.find(c => c.id === connId);
            if (!conn) return;

            if (!isInConn(conn, selectedNode.id)) {
                showStatus('이미 OUT(후단) 케이블입니다');
                return;
            }

            const hasMapping = conn.portMapping && conn.portMapping.length > 0;
            const warnText = hasMapping ? '포트 매핑(직선도 연결 정보)이 초기화됩니다.\n' : '';

            showConfirm(`이 케이블을 OUT(후단)으로 변경합니다.\n${warnText}계속할까요?`, () => {
                conn.portMapping = [];
                // 이 노드 포트 초기화
                if (selectedNode.ports) selectedNode.ports.forEach(p => { p.label = ''; });
                // inOrder에서 제거
                if (selectedNode.inOrder) {
                    selectedNode.inOrder = selectedNode.inOrder.filter(id => id !== connId);
                }

                const nA = nodes.find(n => n.id === conn.nodeA);
                const nB = nodes.find(n => n.id === conn.nodeB);
                const curDirA = (nA && nA.connDirections && nA.connDirections[conn.id]) || 'out';
                const newDirA = curDirA === 'out' ? 'in' : 'out';
                if (nA) { if (!nA.connDirections) nA.connDirections = {}; nA.connDirections[conn.id] = newDirA; }
                if (nB) { if (!nB.connDirections) nB.connDirections = {}; nB.connDirections[conn.id] = newDirA === 'out' ? 'in' : 'out'; }

                const idx = nodes.findIndex(n => n.id === selectedNode.id);
                if (idx !== -1) nodes[idx] = selectedNode;
                saveData();
                showNodeInfoModalForEdit();
                showStatus('OUT(후단) 케이블로 변경되었습니다');
            }, '', '변경');
        }
        function getOrderedOutConns(node, nodeConns) {
            const outConns = nodeConns.filter(c => isOutConn(c, node.id));
            if (!node.outOrder || node.outOrder.length === 0) return outConns;
            // outOrder에 있는 것 먼저, 나머지 뒤에 추가
            const ordered = node.outOrder
                .map(id => outConns.find(c => c.id === id))
                .filter(Boolean);
            const unordered = outConns.filter(c => !node.outOrder.includes(c.id));
            return [...ordered, ...unordered];
        }

        // OUT 순서 변경 (dir: -1=위로, +1=아래로)
        function moveOutOrder(connId, dir) {
            const nodeConns = getNodeConns(selectedNode.id);
            const outConns = getOrderedOutConns(selectedNode, nodeConns);
            const idx = outConns.findIndex(c => c.id === connId);
            const newIdx = idx + dir;
            if (idx === -1 || newIdx < 0 || newIdx >= outConns.length) return;

            // outOrder가 없으면 현재 순서로 초기화
            if (!selectedNode.outOrder || selectedNode.outOrder.length === 0) {
                selectedNode.outOrder = outConns.map(c => c.id);
            }

            const ids = [...selectedNode.outOrder];
            // ids 안에 없는 connId는 현재 outConns 순서 기준으로 추가
            outConns.forEach(c => { if (!ids.includes(c.id)) ids.push(c.id); });

            const idxInOrder = ids.indexOf(connId);
            const targetId = ids[idxInOrder + dir];
            if (!targetId) return;
            const targetIdx = ids.indexOf(targetId);
            [ids[idxInOrder], ids[targetIdx]] = [ids[targetIdx], ids[idxInOrder]];

            selectedNode.outOrder = ids;
            const nodeIdx = nodes.findIndex(n => n.id === selectedNode.id);
            if (nodeIdx !== -1) nodes[nodeIdx] = selectedNode;
            saveData();
            showNodeInfoModalForEdit();
        }

        // ==================== 직선도 함수 시작 ====================
        
        // 메뉴에서 직선도 열기
        function showWireMapFromMenu() {
            showWireMap();
        }
        
        // 전역 색상 배열 (함체 직선도 + 국사 케이블 직선도 공용)
        const wireMapTubeColors = [
            { bg: '#d0eaff', border: '#5aaaee', text: '#1a4a7a', name: '청색' },
            { bg: '#ffe4cc', border: '#e8883a', text: '#7a3a00', name: '등색' },
            { bg: '#d4f5d4', border: '#4caf50', text: '#1a5c1a', name: '녹색' },
            { bg: '#ffd5d5', border: '#e05555', text: '#7a1a1a', name: '적색' },
            { bg: '#fff8c0', border: '#d4b800', text: '#6a5500', name: '황색' },
            { bg: '#ead5f5', border: '#9b59b6', text: '#4a1a6a', name: '자색' },
            { bg: '#e8d5c0', border: '#9c6a3a', text: '#5a3010', name: '갈색' },
            { bg: '#e0e0e0', border: '#555',    text: '#222',    name: '흑색' },
            { bg: '#ffffff', border: '#bbb',    text: '#444',    name: '백색' },
            { bg: '#f0f0f0', border: '#999',    text: '#444',    name: '회색' },
            { bg: '#c8f0ff', border: '#3ab8e0', text: '#0a4a6a', name: '연청' },
            { bg: '#ffe8d8', border: '#e0a070', text: '#7a4020', name: '연등' },
        ];
        const wireMapCoreColors = [
            '#2196f3', // 청색
            '#ff8c00', // 등색
            '#4caf50', // 녹색
            '#f44336', // 적색
            '#f0c000', // 황색
            '#9c27b0', // 자색
            '#795548', // 갈색
            '#424242', // 흑색
            '#bdbdbd', // 백색
            '#9e9e9e', // 회색
            '#80d8ff', // 연청
            '#ffccbc', // 연등
        ];

        // OUT 노드별 연결선 색상 (방법 3)
        const outLineColors = ['#e67e22', '#3498db', '#27ae60', '#9b59b6', '#e74c3c'];

        let currentWireMapFromNode = null;
        let currentWireMapToNodes = []; // 후단 노드들 (배열)
        let currentWireMapConnections = []; // 직선도 후단 연결 배열 (전역 선언)
        let currentWireMapUpstreamConns = []; // IN 연결 배열 (IN1, IN2...)
        let currentWireMapUpstreamNodes = []; // IN 노드 배열
        
        // 직선도 보기
        function showWireMap() {
            // 연결된 장비가 2개 이상이어야 함
            const connectedNodes = getNodeConns(selectedNode.id);

            if (connectedNodes.length < 2) {
                showStatus('전단/후단 장비가 연결되어야 직선도를 볼 수 있습니다');
                return;
            }

            // IN 연결들 (inOrder 순서대로 정렬)
            const inConnsRaw = connectedNodes.filter(conn => isInConn(conn, selectedNode.id));
            const inOrder = selectedNode.inOrder || [];
            const upstreamConns = [
                ...inOrder.map(id => inConnsRaw.find(c => c.id === id)).filter(Boolean),
                ...inConnsRaw.filter(c => !inOrder.includes(c.id))
            ];
            const downstreamConns = getOrderedOutConns(selectedNode, connectedNodes);

            if (upstreamConns.length === 0 || downstreamConns.length === 0) {
                showStatus('IN(전단) 케이블이 없습니다. 접속정보에서 IN/OUT을 설정하세요');
                return;
            }

            currentWireMapConnections = downstreamConns;
            // IN1 기준 전단 노드 (대표)
            currentWireMapFromNode = nodes.find(n => n.id === connFrom(upstreamConns[0]));
            // 모든 IN 연결 저장 (IN1, IN2...)
            currentWireMapUpstreamConns = upstreamConns;
            currentWireMapUpstreamNodes = upstreamConns.map(c => nodes.find(n => n.id === connFrom(c)));
            // 모든 후단 사용
            currentWireMapToNodes = downstreamConns.map(conn => nodes.find(n => n.id === connTo(conn)));

            renderWireMap();

            document.getElementById('nodeInfoModal').classList.remove('active');
            document.getElementById('wireMapModal').classList.add('active');
        }
        
        // 직선도 렌더링