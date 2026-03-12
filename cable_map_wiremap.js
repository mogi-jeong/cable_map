        function renderWireMap() {
            const title = `${selectedNode.name || '장비'} 직선도`;
            document.getElementById('wireMapTitle').textContent = title;
            document.getElementById('wireMapOrderBtns').innerHTML = '';
            
            const content = document.getElementById('wireMapContent');
            content.innerHTML = '';
            
            // RN 정보 초기화
            if (!selectedNode.rns) selectedNode.rns = [];

            // IN 연결들 (currentWireMapUpstreamConns 기반)
            const upConns = currentWireMapUpstreamConns.length > 0
                ? currentWireMapUpstreamConns
                : [connections.find(c => isOutConn(c, currentWireMapFromNode.id) && isInConn(c, selectedNode.id))].filter(Boolean);
            const upNodes = currentWireMapUpstreamNodes.length > 0
                ? currentWireMapUpstreamNodes
                : [currentWireMapFromNode];

            // IN1 기준 (하위 호환)
            const upConnForRender = upConns[0];
            const upstreamPorts = getNodePortData(upNodes[0], null, upConnForRender);

            // 컨테이너 생성
            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.display = 'flex';
            container.style.gap = '120px';
            
            // SVG 캔버스 (연결선 그리기용)
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '3';
            svg.id = 'connectionSvg';
            
            // 전단 컬럼 래퍼 (IN1/IN2 세로 쌓기)
            const leftColumn = document.createElement('div');
            leftColumn.style.flex = '1';
            leftColumn.style.position = 'relative';
            leftColumn.style.zIndex = '2';
            leftColumn.style.display = 'flex';
            leftColumn.style.flexDirection = 'column';
            leftColumn.style.gap = '20px';

            // IN 색상 배열
            const inColors = ['#1a6fd4', '#0d9488'];

            // IN1/IN2 각각 렌더링
            upConns.forEach((upConn, inIdx) => {
                const upNode = upNodes[inIdx];
                const inTag = upConns.length > 1 ? `IN${inIdx + 1}` : 'IN';
                const inColor = inColors[inIdx % inColors.length];

                const inBlock = document.createElement('div');

                const inHeader = document.createElement('div');
                inHeader.style.cssText = `padding:12px 16px; background:${inColor}; color:white; font-weight:700; text-align:center; border-radius:8px 8px 0 0; font-size:14px; display:flex; align-items:center; justify-content:center; gap:8px;`;
                inHeader.innerHTML = `<span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.5px;">${inTag}</span> ${escapeHtml(upNode ? upNode.name || '이름 없음' : '')}`;
                inBlock.appendChild(inHeader);

                const inList = document.createElement('div');
                inList.style.border = `2px solid ${inColor}`;
                inList.style.borderTop = 'none';
                inList.style.borderRadius = '0 0 8px 8px';
                inList.style.background = 'white';
                inList.style.overflow = 'hidden';
                inList.id = `inList-${inIdx}`;

                // 이 IN의 포트 데이터
                // upConn은 upNode에서 나가는 케이블이므로 upNode의 IN 케이블을 따로 찾아 전달
                const thisUpPorts = getNodePortData(upNode, null, upConn);
                const thisMaxCores = upConn ? upConn.cores : 0;
                const thisIsDatacenter = upNode && upNode.type === 'datacenter';
                let thisCablePortSet = null;
                if (thisIsDatacenter && upConn) {
                    thisCablePortSet = new Set();
                    (upNode.ofds || [])
                        .filter(o => o.connectedCable === upConn.id)
                        .forEach(ofd => {
                            if (ofd.cableMapping) ofd.cableMapping.forEach(([, cp]) => thisCablePortSet.add(cp));
                        });
                }

                for (let i = 0; i < thisMaxCores; i++) {
                    const portNum = i + 1;
                    let isPortMapped;
                    if (thisIsDatacenter) {
                        isPortMapped = thisCablePortSet ? thisCablePortSet.has(portNum) : true;
                    } else {
                        isPortMapped = upConn && upConn.portMapping && upConn.portMapping.length > 0
                            && upConn.portMapping.some(m => m[1] === portNum);
                    }

                    let label;
                    if (!upConn || !isPortMapped) {
                        label = '';
                    } else if (!thisIsDatacenter && upConn.portMapping) {
                        const mappingEntry = upConn.portMapping.find(m => m[1] === portNum);
                        const rnSource = mappingEntry && upNode && upNode.rns && upNode.rns.find(r => r.port === mappingEntry[0]);
                        if (mappingEntry && rnSource) {
                            // RN이 있는 포트는 슬롯 체크 우선 (savedLabel 무시)
                            // → 연결 해제됐는데 이전 label이 남아있는 오염 방지
                            const slotInfo = rnSource.outputs ? rnSource.outputs.find(o => o.port === portNum) : null;
                            if (slotInfo) {
                                label = (thisUpPorts[mappingEntry[0] - 1] || '') + '(' + (upNode ? upNode.name : '') + ' ' + rnSource.type + 'RN-' + slotInfo.slotNum + ')';
                            } else {
                                label = ''; // 슬롯 없으면 무조건 빈 문자열 (오염 방지)
                            }
                        } else {
                            label = mappingEntry ? (thisUpPorts[mappingEntry[0] - 1] || '') : '';
                        }
                    } else {
                        label = thisUpPorts[i] || '';
                    }

                    const tubeNum = Math.ceil(portNum / 12);
                    const coreIdx = (portNum - 1) % 12;
                    const rn = selectedNode.rns.find(r => r.port === portNum);

                    if ((portNum - 1) % 12 === 0) {
                        const end = Math.min(portNum + 11, thisMaxCores);
                        const tc = wireMapTubeColors[(tubeNum - 1) % 12];
                        const tubeLabel = document.createElement('div');
                        tubeLabel.style.cssText = `padding:4px 12px; background:${tc.bg}; font-size:11px; font-weight:700; color:${tc.text}; border-top:2px solid ${tc.border}; border-bottom:1px solid ${tc.border}; display:flex; align-items:center; justify-content:space-between; letter-spacing:0.2px;`;
                        const tubeText = document.createElement('span');
                        tubeText.textContent = `튜브 ${tubeNum} ${tc.name}  (${portNum}~${end}번)`;
                        tubeLabel.appendChild(tubeText);
                        // 버튼 묶음 (우측): [튜브 선택][✕ 해제]
                        const btnGroup = document.createElement('div');
                        btnGroup.style.cssText = 'display:flex; align-items:center; gap:4px;';
                        const tubeDisBtn = document.createElement('button');
                        tubeDisBtn.textContent = '해제';
                        tubeDisBtn.style.cssText = `padding:2px 8px; background:rgba(220,38,38,0.1); color:#dc2626; border:1px solid rgba(220,38,38,0.2); border-radius:4px; font-size:10px; font-weight:600; cursor:pointer; transition:background 0.15s;`;
                        tubeDisBtn.onclick = (e) => {
                            e.stopPropagation();
                            const inConn = currentWireMapUpstreamConns[inIdx] || null;
                            let count = 0;
                            for (let p = portNum; p <= end; p++) {
                                currentWireMapConnections.forEach(c => {
                                    const before = c.portMapping.length;
                                    c.portMapping = c.portMapping.filter(m => {
                                        if (m[0] !== p) return true;
                                        if (inConn && c.inFromCableId && c.inFromCableId !== inConn.id) return true;
                                        return false;
                                    });
                                    if (c.portMapping.length < before) count++;
                                });
                            }
                            if (count > 0) { saveWireMapAll(); renderWireMap(); showStatus(`튜브 ${tubeNum} 연결 ${count}개 해제`); }
                            else showStatus(`튜브 ${tubeNum} 해제할 연결 없음`);
                        };
                        btnGroup.appendChild(tubeDisBtn);
                        const tubeBtn = document.createElement('button');
                        tubeBtn.id = `in-tube-${inIdx}-${tubeNum}`;
                        tubeBtn.dataset.inIdx = inIdx;
                        tubeBtn.dataset.tubeNum = tubeNum;
                        tubeBtn.dataset.startPort = portNum;
                        tubeBtn.dataset.endPort = end;
                        tubeBtn.className = 'tube-select-btn in-tube-btn';
                        tubeBtn.textContent = '튜브 선택';
                        tubeBtn.style.cssText = `padding:2px 8px; background:rgba(0,0,0,0.08); color:${tc.text}; border:1px solid rgba(0,0,0,0.08); border-radius:4px; font-size:10px; font-weight:600; cursor:pointer; transition:background 0.15s;`;
                        tubeBtn.onclick = (e) => { e.stopPropagation(); selectInTube(inIdx, tubeNum, portNum, end); };
                        const inLabelToggle = document.createElement('button');
                        inLabelToggle.dataset.show = '0';
                        inLabelToggle.textContent = '👁‍🗨';
                        inLabelToggle.title = '이름표 ON/OFF';
                        inLabelToggle.style.cssText = 'padding:2px 7px; background:rgba(150,150,150,0.7); color:white; border:none; border-radius:4px; font-size:10px; cursor:pointer;';
                        inLabelToggle.onclick = (e) => {
                            e.stopPropagation();
                            const show = inLabelToggle.dataset.show === '1';
                            inLabelToggle.dataset.show = show ? '0' : '1';
                            inLabelToggle.style.background = show ? 'rgba(150,150,150,0.7)' : 'rgba(26,111,212,0.7)';
                            inLabelToggle.textContent = show ? '👁‍🗨' : '👁';
                            document.querySelectorAll(`.wm-namelabel[data-tube="in-${inIdx}-${tubeNum}"]`).forEach(el => {
                                el.style.display = show ? 'none' : '';
                            });
                        };
                        btnGroup.insertBefore(inLabelToggle, btnGroup.firstChild);
                        btnGroup.appendChild(tubeBtn);
                        tubeLabel.appendChild(btnGroup);
                        inList.appendChild(tubeLabel);
                    }

                    const tc = wireMapTubeColors[(tubeNum - 1) % 12];
                    const coreColor = wireMapCoreColors[coreIdx];
                    const textColor = [8,9,10,11].includes(coreIdx) ? '#333' : 'white';

                    const row = document.createElement('div');
                    row.style.cssText = `display:flex; align-items:center; padding:5px 10px; border-bottom:1px solid ${tc.border}18; min-height:40px; background:${tc.bg};`;

                    const labelSpan = document.createElement('span');
                    labelSpan.style.cssText = 'flex:1; font-size:12.5px; color:#334155;';
                    if (rn) {
                        const strong = document.createElement('strong');
                        strong.style.cssText = 'font-size:14px; font-weight:700; color:#1e293b;';
                        strong.textContent = portNum;
                        labelSpan.appendChild(strong);
                        labelSpan.appendChild(document.createTextNode(' ' + label));
                        const rnBadge = document.createElement('span');
                        rnBadge.style.cssText = 'font-size:11px; color:#7c3aed; font-weight:600; margin-left:4px;';
                        rnBadge.textContent = `(${selectedNode.name} ${rn.type}RN)`;
                        labelSpan.appendChild(rnBadge);
                        const delBtn = document.createElement('button');
                        delBtn.title = 'RN 삭제';
                        delBtn.style.cssText = 'margin-left:6px; padding:1px 7px; background:rgba(220,38,38,0.1); color:#dc2626; border:1px solid rgba(220,38,38,0.15); border-radius:4px; cursor:pointer; font-size:10px; font-weight:600; vertical-align:middle;';
                        delBtn.textContent = '✕ RN';
                        delBtn.onclick = (e) => { e.stopPropagation(); removeRN(portNum); };
                        labelSpan.appendChild(delBtn);
                    } else {
                        labelSpan.innerHTML = `<strong style="font-size:14px;font-weight:700;color:#1e293b;">${portNum}</strong> ${escapeHtml(label)}`;
                    }

                    const btn = document.createElement('button');
                    btn.id = `from-${inIdx}-${portNum}`;
                    btn.className = 'port-btn from-port';
                    btn.textContent = portNum;
                    btn.style.cssText = `padding:4px 10px; border:none; border-radius:6px; cursor:pointer; background:${coreColor}; color:${textColor}; font-weight:700; font-size:12px; min-width:40px; box-shadow:0 1px 3px rgba(0,0,0,0.15); transition:transform 0.1s,box-shadow 0.1s;`;
                    btn.onmouseenter = function() { this.style.transform='scale(1.08)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.25)'; };
                    btn.onmouseleave = function() { this.style.transform='none'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.15)'; };
                    btn.dataset.port = portNum;
                    btn.dataset.inIdx = inIdx;
                    btn.onclick = () => selectFromPort(portNum, inIdx);

                    // OUT 뱃지: 이 IN 컬럼(upConn.id)에서 연결된 포트만 표시
                    let crossNodeIndex = -1;
                    currentWireMapConnections.forEach((conn, ni) => {
                        // inFromCableId가 있으면 일치하는 것만, 없으면 IN1(inIdx===0)에서만 표시
                        const matchesIn = conn.inFromCableId
                            ? conn.inFromCableId === upConn.id
                            : inIdx === 0;
                        if (conn.portMapping && matchesIn && conn.portMapping.some(m => m[0] === portNum)) crossNodeIndex = ni;
                    });
                    if (crossNodeIndex >= 0) {
                        row.appendChild(labelSpan);
                        const dcPort = getDcPortNum(selectedNode, portNum);
                        if (dcPort !== null) {
                            const dcInfo = getDcInfo(selectedNode, portNum);
                            const dcBadge = document.createElement('span');
                            dcBadge.className = 'wm-namelabel';
                            dcBadge.dataset.tube = `in-${inIdx}-${tubeNum}`;
                            dcBadge.style.cssText = `font-size:10px; padding:2px 8px; border-radius:10px; margin-right:4px; background:#475569; color:white; white-space:nowrap; font-weight:600; flex-shrink:0; display:none;`;
                            if (dcInfo) {
                                const parts = [dcInfo.dcName, dcInfo.ofdName, `${dcInfo.portNum}번`].filter(Boolean);
                                dcBadge.textContent = parts.join(' ');
                            } else {
                                dcBadge.textContent = `국사 ${dcPort}번`;
                            }
                            row.appendChild(dcBadge);
                        }
                        const badge = document.createElement('span');
                        const badgeColor = outLineColors[crossNodeIndex % outLineColors.length];
                        badge.style.cssText = `font-size:10px; padding:2px 8px; border-radius:10px; margin-right:6px; background:${badgeColor}; color:white; white-space:nowrap; font-weight:600; letter-spacing:0.2px; flex-shrink:0;`;
                        badge.textContent = `→ OUT${crossNodeIndex + 1}`;
                        row.appendChild(badge);
                        row.appendChild(btn);
                    } else {
                        row.appendChild(labelSpan);
                        row.appendChild(btn);
                    }
                    inList.appendChild(row);
                }

                inBlock.appendChild(inList);
                leftColumn.appendChild(inBlock);
            });

            // 하위 호환용 (selectFromPort 등에서 사용)
            const upstreamConn = upConns[0];
            const maxCores = upstreamConn ? upstreamConn.cores : Math.max(...currentWireMapConnections.map(c => c.cores));
            // 기존 leftList 변수 참조 호환 (OUT 뱃지/SVG 등에서 from-포트 ID 사용)
            const leftList = { appendChild: () => {} }; // dummy (위에서 직접 inList에 추가)
            
            
            // 조립 - 후단들을 세로로 배치
            container.insertBefore(svg, container.firstChild);
            container.insertBefore(leftColumn, svg.nextSibling);
            
            // 후단 컨테이너 (세로 배치)
            const rightContainer = document.createElement('div');
            rightContainer.style.flex = '1';
            rightContainer.style.display = 'flex';
            rightContainer.style.flexDirection = 'column';
            rightContainer.style.gap = '20px';
            
            currentWireMapToNodes.forEach((toNode, nodeIndex) => {
                const connection = currentWireMapConnections[nodeIndex];
                
                // 후단 래퍼
                const rightWrapper = document.createElement('div');
                rightWrapper.style.position = 'relative';
                rightWrapper.style.zIndex = '2';
                
                // 포트 매핑 초기화
                if (!connection.portMapping) connection.portMapping = [];
                
                const _downstreamConn = connections.find(c => isInConn(c, toNode.id));
                let _computedLabels = getNodePortData(toNode, null, _downstreamConn || connection);

                // OUT이 국사이고 OFD 라벨이 비어있으면 → IN 라벨 체인에서 역추적
                if (toNode.type === 'datacenter' && _computedLabels.every(l => !l)) {
                    // connection의 portMapping: [[fromPort, toPort], ...]
                    // toPort = 국사 케이블 포트 → OFD에서 해당 cableMapping 역방향 확인
                    const inLabels = getNodePortData(
                        currentWireMapFromNode,
                        null,
                        currentWireMapUpstreamConns[0]
                    );
                    // portMapping으로 함체→국사 연결된 라벨 찾기
                    if (connection.portMapping.length > 0) {
                        const mapped = new Array(connection.cores).fill('');
                        connection.portMapping.forEach(([fromPort, toPort]) => {
                            // fromPort: 현재 함체의 포트(=IN 라벨 기준)
                            // 현재 함체의 fromPort 라벨을 가져옴
                            const fromLabels = getNodePortData(selectedNode, null, null);
                            mapped[toPort - 1] = fromLabels[fromPort - 1] || '';
                        });
                        if (mapped.some(l => l)) _computedLabels = mapped;
                    }
                }

                const downstreamPorts = _computedLabels.map((label) => ({ label: label }));
                
                const rightColumn = document.createElement('div');
                rightColumn.style.position = 'relative';
                
                const rightHeader = document.createElement('div');
                rightHeader.style.cssText = `padding:12px 16px; background:#475569; color:white; font-weight:700; text-align:center; border-radius:8px 8px 0 0; font-size:14px; display:flex; align-items:center; justify-content:center; gap:8px;`;

                const outTag = document.createElement('span');
                outTag.style.cssText = 'background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.5px;';
                const outLabel = currentWireMapToNodes.length > 1 ? `OUT${nodeIndex + 1}` : 'OUT';
                outTag.textContent = outLabel;
                rightHeader.appendChild(outTag);
                const headerText = document.createElement('span');
                headerText.textContent = toNode.name || '이름 없음';
                rightHeader.appendChild(headerText);
                rightColumn.appendChild(rightHeader);
                
                // 순서 변경 버튼 — 상단 툴바에 렌더링
                if (currentWireMapToNodes.length > 1) {
                    const toolbar = document.getElementById('wireMapOrderBtns');
                    // 첫 번째 노드(nodeIndex=0)일 때 툴바 초기화
                    if (nodeIndex === 0) toolbar.innerHTML = '';
                    
                    const label = document.createElement('span');
                    label.style.cssText = 'font-size:11px; font-weight:bold; color:#555; display:flex; align-items:center;';
                    label.textContent = `${toNode.name || '이름없음'}:`;
                    toolbar.appendChild(label);
                    
                    
                    if (nodeIndex < currentWireMapToNodes.length - 1) {
                        const downBtn = document.createElement('button');
                        downBtn.textContent = '⬇ 아래로';
                        downBtn.style.cssText = 'padding:4px 8px; background:#8b5cf6; color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600;';
                        downBtn.onclick = () => swapDownstreamNodes(nodeIndex, nodeIndex + 1);
                        toolbar.appendChild(downBtn);
                    }
                }
                
                const rightList = document.createElement('div');
                rightList.style.border = '2px solid #64748b';
                rightList.style.borderTop = 'none';
                rightList.style.borderRadius = '0 0 8px 8px';
                rightList.style.background = 'white';
                rightList.style.overflow = 'hidden';
                
                // 후단 포트 버튼들 (튜브 색상 + 코어 색상)
                for (let i = 0; i < connection.cores; i++) {
                    const portNum = i + 1;
                    const downstreamLabel = downstreamPorts[portNum - 1]?.label || '';
                    const tubeNum = Math.ceil(portNum / 12);
                    const coreIdx = (portNum - 1) % 12;
                    const tc = wireMapTubeColors[(tubeNum - 1) % 12];
                    const coreColor = wireMapCoreColors[coreIdx];
                    const textColor = [8,9,10,11].includes(coreIdx) ? '#333' : 'white';

                    // 튜브 라벨
                    if ((portNum - 1) % 12 === 0) {
                        const end = Math.min(portNum + 11, connection.cores);
                        const tubeLabel = document.createElement('div');
                        tubeLabel.style.cssText = `padding:4px 12px; background:${tc.bg}; font-size:11px; font-weight:700; color:${tc.text}; border-top:2px solid ${tc.border}; border-bottom:1px solid ${tc.border}; display:flex; align-items:center; gap:8px; letter-spacing:0.2px;`;
                        const tubeBtn = document.createElement('button');
                        tubeBtn.id = `out-tube-${nodeIndex}-${tubeNum}`;
                        tubeBtn.dataset.nodeIndex = nodeIndex;
                        tubeBtn.dataset.tubeNum = tubeNum;
                        tubeBtn.dataset.startPort = portNum;
                        tubeBtn.dataset.endPort = end;
                        tubeBtn.className = 'tube-select-btn out-tube-btn';
                        tubeBtn.textContent = '튜브 선택';
                        tubeBtn.style.cssText = `padding:2px 8px; background:rgba(0,0,0,0.08); color:${tc.text}; border:1px solid rgba(0,0,0,0.08); border-radius:4px; font-size:10px; font-weight:600; cursor:pointer; flex-shrink:0; transition:background 0.15s;`;
                        tubeBtn.onclick = (e) => { e.stopPropagation(); selectOutTube(nodeIndex, tubeNum, portNum, end); };
                        tubeLabel.appendChild(tubeBtn);
                        const tubeText = document.createElement('span');
                        tubeText.textContent = `튜브 ${tubeNum} ${tc.name}  (${portNum}~${end}번)`;
                        tubeLabel.appendChild(tubeText);
                        rightList.appendChild(tubeLabel);
                    }

                    const row = document.createElement('div');
                    row.style.cssText = `display:flex; align-items:center; padding:5px 10px; border-bottom:1px solid ${tc.border}18; min-height:40px; background:${tc.bg};`;

                    const btn = document.createElement('button');
                    btn.id = `to-${nodeIndex}-${portNum}`;
                    btn.className = 'port-btn to-port';
                    btn.textContent = portNum;
                    btn.style.cssText = `padding:4px 10px; border:none; border-radius:6px; cursor:pointer; background:${coreColor}; color:${textColor}; font-weight:700; font-size:12px; min-width:40px; box-shadow:0 1px 3px rgba(0,0,0,0.15); transition:transform 0.1s,box-shadow 0.1s;`;
                    btn.onmouseenter = function() { this.style.transform='scale(1.08)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.25)'; };
                    btn.onmouseleave = function() { this.style.transform='none'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.15)'; };
                    btn.dataset.port = portNum;
                    btn.dataset.nodeIndex = nodeIndex;
                    btn.onclick = () => selectToPort(portNum, nodeIndex);

                    const labelSpan = document.createElement('span');
                    labelSpan.style.cssText = 'flex:1; margin-left:10px; font-size:12.5px; color:#334155;';
                    labelSpan.innerHTML = `<strong style="font-size:14px;font-weight:700;color:#1e293b;">${portNum}</strong> ${escapeHtml(downstreamLabel)}`;

                    row.appendChild(btn);
                    row.appendChild(labelSpan);
                    rightList.appendChild(row);
                }
                
                rightColumn.appendChild(rightList);
                rightWrapper.appendChild(rightColumn);
                rightContainer.appendChild(rightWrapper);
            });
            
            container.appendChild(rightContainer);
            content.appendChild(container);
            
            // 기존 연결 표시 (DOM 렌더링 후)
            setTimeout(() => updateConnectionDisplay(), 100);
        }
        
        let selectedFromPort = null;
        
        // 전단 포트 선택
        // 현재 선택된 IN 컬럼 인덱스 (전역)
        let selectedFromInIdx = 0;

        // ==================== 튜브 단위 연결 ====================
        // 선택된 IN 튜브 정보 { inIdx, tubeNum, startPort, endPort }
        let selectedInTube = null;

        function selectInTube(inIdx, tubeNum, startPort, endPort) {
            // 이미 같은 튜브 선택 시 취소
            if (selectedInTube && selectedInTube.inIdx === inIdx && selectedInTube.tubeNum === tubeNum) {
                selectedInTube = null;
                _updateTubeBtnStyles();
                showStatus('IN 튜브 선택 취소');
                return;
            }
            selectedInTube = { inIdx, tubeNum, startPort, endPort };
            selectedFromPort = null; // 코어 단위 선택 해제
            _updateTubeBtnStyles();
            showStatus(`IN 튜브 ${tubeNum} (${startPort}~${endPort}번) 선택됨. OUT 튜브를 선택하세요.`);
        }

        function selectOutTube(nodeIndex, tubeNum, startPort, endPort) {
            if (!selectedInTube) {
                showStatus('먼저 IN 튜브를 선택하세요.');
                return;
            }
            // IN 튜브 코어 수와 OUT 튜브 코어 수 계산
            const inCount = selectedInTube.endPort - selectedInTube.startPort + 1;
            const outCount = endPort - startPort + 1;
            const count = Math.min(inCount, outCount);

            const inConn = currentWireMapUpstreamConns[selectedInTube.inIdx] || null;
            const outConn = currentWireMapConnections[nodeIndex];
            if (!outConn) { showStatus('OUT 연결을 찾을 수 없습니다.'); return; }

            // 덮어쓰기: 해당 IN 포트 범위 + OUT 포트 범위 기존 매핑 제거
            const inStart = selectedInTube.startPort;
            const outStart = startPort;
            for (let i = 0; i < count; i++) {
                const fromPort = inStart + i;
                const toPort = outStart + i;
                // 해당 fromPort 기존 매핑 제거 (덮어쓰기)
                currentWireMapConnections.forEach(c => {
                    c.portMapping = c.portMapping.filter(m => !(m[0] === fromPort));
                });
                // 해당 toPort 기존 매핑 제거 (이 OUT conn에서만)
                outConn.portMapping = outConn.portMapping.filter(m => m[1] !== toPort);
                // 새 매핑 추가
                outConn.inFromCableId = inConn ? inConn.id : null;
                outConn.portMapping.push([fromPort, toPort]);
            }

            saveWireMapAll();
            renderWireMap();
            selectedInTube = null;
            showStatus(`튜브 연결: IN ${inStart}~${inStart+count-1}번 → OUT ${outStart}~${outStart+count-1}번 (${count}코어)`);
        }

        function _updateTubeBtnStyles() {
            document.querySelectorAll('.in-tube-btn').forEach(btn => {
                const inIdx = parseInt(btn.dataset.inIdx);
                const tubeNum = parseInt(btn.dataset.tubeNum);
                const isSelected = selectedInTube &&
                    selectedInTube.inIdx === inIdx &&
                    selectedInTube.tubeNum === tubeNum;
                btn.style.background = isSelected ? '#e67e22' : 'rgba(0,0,0,0.15)';
                btn.style.color = isSelected ? 'white' : btn.closest('div')?.style.color || '';
                btn.textContent = isSelected ? '✓ 선택됨' : '튜브 선택';
            });
        }

        function selectFromPort(portNum, inIdx = 0) {
            selectedFromInIdx = inIdx;
            const upConn = currentWireMapUpstreamConns[inIdx] || null;

            // RN 체크
            const rn = selectedNode.rns ? selectedNode.rns.find(r => r.port === portNum) : null;

            if (!rn) {
                // 일반 포트: 이미 연결된 경우 연결 해제
                let hasConnection = false;
                currentWireMapConnections.forEach(conn => {
                    const existingMapping = conn.portMapping.find(m => m[0] === portNum && (!conn.inFromCableId || conn.inFromCableId === (upConn && upConn.id)));
                    if (existingMapping) {
                        conn.portMapping = conn.portMapping.filter(m => !(m[0] === portNum && (!conn.inFromCableId || conn.inFromCableId === (upConn && upConn.id))));
                        hasConnection = true;
                    }
                });

                if (hasConnection) {
                    saveWireMapAll();
                    renderWireMap();
                    showStatus(`${portNum}번 연결이 해제되었습니다`);
                    return;
                }
            }
            // RN 포트는 항상 선택 상태로 진행 (연결/해제는 후단 팝업에서만)

            selectedFromPort = portNum;
            
            // 모든 전단 버튼 색상 업데이트
            document.querySelectorAll('.from-port').forEach(btn => {
                const port = parseInt(btn.dataset.port);
                let isConnected = false;
                currentWireMapConnections.forEach(conn => {
                    if (conn.portMapping.some(m => m[0] === port)) {
                        isConnected = true;
                    }
                });
                
                const cIdx = (port - 1) % 12;
                const cColor = wireMapCoreColors[cIdx];
                const tColor = [8,9,10,11].includes(cIdx) ? '#333' : 'white';
                if (port === portNum) {
                    btn.style.background = '#e67e22';
                    btn.style.borderColor = '#e67e22';
                    btn.style.outline = 'none';
                    btn.style.color = 'white';
                } else {
                    btn.style.background = cColor;
                    btn.style.borderColor = isConnected ? '#fff' : cColor;
                    btn.style.outline = isConnected ? '2px solid #222' : 'none';
                    btn.style.color = tColor;
                }
            });
            
            showStatus(`전단 ${portNum}번 선택됨. 후단 포트를 클릭하세요.`);
        }
        
        // RN 연결 실행
        function doRNConnect(portNum, nodeIndex, rn) {
            const connection = currentWireMapConnections[nodeIndex];
            const toNode = currentWireMapToNodes[nodeIndex];
            const maxOutputs = parseInt(rn.type.split(':')[1]);
            const currentOutputs = rn.outputs ? rn.outputs.length : 0;

            if (currentOutputs >= maxOutputs) {
                showStatus(`${rn.type} RN은 최대 ${maxOutputs}개까지만 연결 가능합니다`);
                return;
            }

            // 같은 후단 포트에 이미 연결된 기존 연결 해제 (1:1 또는 다른 RN)
            connection.portMapping.forEach(m => {
                if (m[1] === portNum) {
                    const existingRN = selectedNode.rns ? selectedNode.rns.find(r => r.port === m[0]) : null;
                    if (existingRN && existingRN.outputs) {
                        existingRN.outputs = existingRN.outputs.filter(o => !(o.nodeIndex === nodeIndex && o.port === portNum));
                    }
                }
            });
            connection.portMapping = connection.portMapping.filter(m => m[1] !== portNum);

            if (!rn.outputs) rn.outputs = [];
            const usedSlots = new Set(rn.outputs.map(o => o.slotNum));
            let rnNum = 1;
            while (usedSlots.has(rnNum)) rnNum++;
            rn.outputs.push({ nodeIndex, port: portNum, slotNum: rnNum });
            connection.portMapping.push([selectedFromPort, portNum]);

            const fromPorts = getNodePortData(currentWireMapFromNode, null, connections.find(c => isOutConn(c, currentWireMapFromNode.id) && isInConn(c, selectedNode.id)));
            const fromLabel = fromPorts[selectedFromPort - 1] || '';
            if (!toNode.ports) toNode.ports = [];
            while (toNode.ports.length < portNum) toNode.ports.push({ number: toNode.ports.length + 1, label: '' });
            toNode.ports[portNum - 1].label = `${fromLabel}(${selectedNode.name} ${rn.type}RN-${rnNum})`;

            saveWireMapAll();
            renderWireMap();
            showStatus(`RN ${selectedFromPort}번 → ${portNum}번 연결 (${rnNum}/${maxOutputs})`);
            selectedFromPort = null; // 연결 후 전단 선택 해제
        }

        // RN 해제 실행
        function doRNDisconnect(portNum, nodeIndex, rn) {
            const connection = currentWireMapConnections[nodeIndex];
            const toNode = currentWireMapToNodes[nodeIndex];

            const mapping = connection.portMapping.find(m => m[1] === portNum);
            const fromPort = mapping ? mapping[0] : selectedFromPort;

            if (toNode && toNode.ports && toNode.ports[portNum - 1]) {
                toNode.ports[portNum - 1].label = '';
            }
            connection.portMapping = connection.portMapping.filter(m => !(m[0] === fromPort && m[1] === portNum));
            if (rn.outputs) {
                rn.outputs = rn.outputs.filter(o => o.port !== portNum);
            }

            saveWireMapAll();
            renderWireMap();
            showStatus(`RN ${fromPort}번 → ${portNum}번 연결 해제됨`);
            selectedFromPort = null;
        }

        // RN 팝업 닫기
        function closeRNPopup() {
            const popup = document.getElementById('rnPopup');
            if (popup) popup.remove();
        }

        // 후단 포트 선택
        function selectToPort(portNum, nodeIndex) {
            if (!selectedFromPort) {
                showStatus('먼저 전단 포트를 선택하세요');
                return;
            }

            // RN 포트인 경우 팝업 표시
            const rnCheck = selectedNode.rns ? selectedNode.rns.find(r => r.port === selectedFromPort) : null;
            if (rnCheck) {
                const connection = currentWireMapConnections[nodeIndex];
                const isAlreadyConnected = connection && connection.portMapping.some(m => m[0] === selectedFromPort && m[1] === portNum);
                const maxOutputs = parseInt(rnCheck.type.split(':')[1]);
                const currentOutputs = rnCheck.outputs ? rnCheck.outputs.length : 0;

                // 기존 팝업 제거
                closeRNPopup();

                const popup = document.createElement('div');
                popup.id = 'rnPopup';
                popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:white; border-radius:12px; padding:24px; box-shadow:0 8px 30px rgba(0,0,0,0.3); z-index:9999; min-width:260px; text-align:center;';

                const progress = document.createElement('div');
                progress.style.cssText = 'display:flex; justify-content:center; gap:6px; margin-bottom:16px;';
                for (let p = 1; p <= maxOutputs; p++) {
                    const dot = document.createElement('div');
                    dot.style.cssText = `width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:13px; background:${p <= currentOutputs ? '#3498db' : '#ddd'}; color:${p <= currentOutputs ? 'white' : '#999'};`;
                    dot.textContent = `${p}/${maxOutputs}`;
                    progress.appendChild(dot);
                }
                popup.appendChild(progress);

                const title = document.createElement('div');
                title.style.cssText = 'font-size:15px; font-weight:bold; color:#333; margin-bottom:6px;';
                title.textContent = `${rnCheck.type} RN - 전단 ${selectedFromPort}번 → 후단 ${portNum}번`;
                popup.appendChild(title);

                const sub = document.createElement('div');
                sub.style.cssText = 'font-size:12px; color:#888; margin-bottom:18px;';
                sub.textContent = isAlreadyConnected ? '이미 연결된 포트입니다' : `현재 ${currentOutputs}/${maxOutputs} 연결됨`;
                popup.appendChild(sub);

                const btnRow = document.createElement('div');
                btnRow.style.cssText = 'display:flex; gap:10px;';

                if (isAlreadyConnected) {
                    const disconnBtn = document.createElement('button');
                    disconnBtn.style.cssText = 'flex:1; padding:10px; background:#e74c3c; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:14px;';
                    disconnBtn.textContent = '🔌 연결 해제';
                    disconnBtn.onclick = () => { closeRNPopup(); doRNDisconnect(portNum, nodeIndex, rnCheck); };
                    btnRow.appendChild(disconnBtn);
                } else {
                    const connBtn = document.createElement('button');
                    connBtn.style.cssText = 'flex:1; padding:10px; background:#3498db; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:14px;';
                    connBtn.textContent = '🔗 연결';
                    connBtn.onclick = () => { closeRNPopup(); doRNConnect(portNum, nodeIndex, rnCheck); };
                    btnRow.appendChild(connBtn);
                }

                const cancelBtn = document.createElement('button');
                cancelBtn.style.cssText = 'flex:1; padding:10px; background:#95a5a6; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:14px;';
                cancelBtn.textContent = '취소';
                cancelBtn.onclick = closeRNPopup;
                btnRow.appendChild(cancelBtn);

                popup.appendChild(btnRow);
                document.body.appendChild(popup);
                return;
            }
            
            const connection = currentWireMapConnections[nodeIndex];
            const toNode = currentWireMapToNodes[nodeIndex];
            
            // 같은 후단 포트에 이미 연결된 다른 전단 포트 해제 (중복 방지)
            // 해제되는 전단 포트가 RN이면 outputs에서도 제거
            connection.portMapping.forEach(m => {
                if (m[1] === portNum) {
                    const relatedRN = selectedNode.rns ? selectedNode.rns.find(r => r.port === m[0]) : null;
                    if (relatedRN && relatedRN.outputs) {
                        relatedRN.outputs = relatedRN.outputs.filter(o => !(o.nodeIndex === nodeIndex && o.port === portNum));
                    }
                }
            });
            connection.portMapping = connection.portMapping.filter(m => m[1] !== portNum);
            
            // RN 확인 - RN 포트는 특별 처리
            const rn = selectedNode.rns ? selectedNode.rns.find(r => r.port === selectedFromPort) : null;
            if (rn) {
                // RN 연결 개수 체크
                const maxOutputs = parseInt(rn.type.split(':')[1]); // "1:4" → 4
                const currentOutputs = rn.outputs ? rn.outputs.length : 0;
                
                if (currentOutputs >= maxOutputs) {
                    showStatus(`${rn.type} RN은 최대 ${maxOutputs}개까지만 연결 가능합니다`);
                    return;
                }
                
                // RN 연결: 데이터에 RN 정보 포함
                const fromPorts = getNodePortData(currentWireMapFromNode, null, connections.find(c => isOutConn(c, currentWireMapFromNode.id) && isInConn(c, selectedNode.id)));
                const fromLabel = fromPorts[selectedFromPort - 1] || '';
                
                // RN 출력 번호 계산 (1부터 시작)
                if (!rn.outputs) rn.outputs = [];
                const usedSlots = new Set(rn.outputs.map(o => o.slotNum));
                let rnNum = 1;
                while (usedSlots.has(rnNum)) rnNum++;
                rn.outputs.push({ nodeIndex, port: portNum, slotNum: rnNum });
                
                // 연결 생성
                connection.portMapping.push([selectedFromPort, portNum]);
                // 어느 IN에서 왔는지 기록 (항상 최신 IN으로 업데이트)
                const ucRn = currentWireMapUpstreamConns[selectedFromInIdx];
                if (ucRn) connection.inFromCableId = ucRn.id;

                // 데이터 복사 (RN 정보 포함)
                if (!toNode.ports) toNode.ports = [];
                while (toNode.ports.length < portNum) {
                    toNode.ports.push({
                        number: toNode.ports.length + 1,
                        label: ''
                    });
                }
                toNode.ports[portNum - 1].label = `${fromLabel}(${selectedNode.name} ${rn.type}RN-${rnNum})`;
                
                // RN은 계속 선택 상태 유지
                showStatus(`RN ${selectedFromPort}번 → ${portNum}번 연결 (${rnNum}/${maxOutputs})`);
                
            } else {
                // 일반 연결
                connection.portMapping.push([selectedFromPort, portNum]);
                // 어느 IN에서 왔는지 기록 (항상 최신 IN으로 업데이트)
                const ucNormal = currentWireMapUpstreamConns[selectedFromInIdx];
                if (ucNormal) connection.inFromCableId = ucNormal.id;

                // 데이터 복사: IN 전단 체인을 역추적해서 정확한 라벨 계산
                const inUpConnForLabel = currentWireMapUpstreamConns[selectedFromInIdx]
                    ? connections.find(c => c.id === currentWireMapUpstreamConns[selectedFromInIdx].id)
                    : connections.find(c => isInConn(c, selectedNode.id));
                const inUpNodeForLabel = inUpConnForLabel ? nodes.find(n => n.id === connFrom(inUpConnForLabel)) : null;
                let fromLabel = '';
                if (inUpConnForLabel && inUpNodeForLabel) {
                    const upLabels = getNodePortData(inUpNodeForLabel, null, inUpConnForLabel);
                    const mapping = inUpConnForLabel.portMapping && inUpConnForLabel.portMapping.find(m => m[1] === selectedFromPort);
                    fromLabel = mapping ? (upLabels[mapping[0] - 1] || '') : (upLabels[selectedFromPort - 1] || '');
                }
                
                if (!toNode.ports) toNode.ports = [];
                while (toNode.ports.length < portNum) {
                    toNode.ports.push({
                        number: toNode.ports.length + 1,
                        label: ''
                    });
                }
                toNode.ports[portNum - 1].label = fromLabel;
                
                // 일반 포트는 선택 해제
                selectedFromPort = null;
                showStatus(`연결이 생성되었습니다`);
            }
            
            // 저장 및 업데이트
            saveWireMapAll();
            
            // 화면 갱신
            renderWireMap();
        }
        
        // 연결 상태 업데이트
        function updateConnectionDisplay() {
            // 버튼 색상 업데이트 - 코어 색상 유지, 연결 시 테두리 강조
            document.querySelectorAll('.from-port').forEach(btn => {
                const port = parseInt(btn.dataset.port);
                const coreIdx = (port - 1) % 12;
                const coreColor = wireMapCoreColors[coreIdx];
                const textColor = [8,9,10,11].includes(coreIdx) ? '#333' : 'white';
                let isConnected = false;
                currentWireMapConnections.forEach(conn => {
                    if (conn.portMapping.some(m => m[0] === port)) isConnected = true;
                });
                btn.style.background = coreColor;
                btn.style.borderColor = isConnected ? '#fff' : coreColor;
                btn.style.outline = isConnected ? '2px solid #222' : 'none';
                btn.style.color = textColor;
            });
            
            document.querySelectorAll('.to-port').forEach(btn => {
                const port = parseInt(btn.dataset.port);
                const nodeIndex = parseInt(btn.dataset.nodeIndex);
                const connection = currentWireMapConnections[nodeIndex];
                const isConnected = connection && connection.portMapping.some(m => m[1] === port);
                const coreIdx = (port - 1) % 12;
                const coreColor = wireMapCoreColors[coreIdx];
                const textColor = [8,9,10,11].includes(coreIdx) ? '#333' : 'white';
                btn.style.background = coreColor;
                btn.style.borderColor = isConnected ? '#fff' : coreColor;
                btn.style.outline = isConnected ? '2px solid #222' : 'none';
                btn.style.color = textColor;
            });
            
            // SVG 선 그리기
            const svg = document.getElementById('connectionSvg');
            if (!svg) return;
            
            svg.innerHTML = '';

            currentWireMapConnections.forEach((connection, nodeIndex) => {
                connection.portMapping.forEach(mapping => {
                    const [fromPort, toPort] = mapping;

                    // inFromCableId로 어느 IN 컬럼인지 찾기, 없으면 IN1(0) 기본
                    let inIdx = 0;
                    if (connection.inFromCableId) {
                        const found = currentWireMapUpstreamConns.findIndex(c => c.id === connection.inFromCableId);
                        if (found !== -1) inIdx = found;
                    }
                    const fromBtn = document.getElementById(`from-${inIdx}-${fromPort}`);
                    const toBtn = document.getElementById(`to-${nodeIndex}-${toPort}`);

                    if (!fromBtn || !toBtn) return;

                    const fromRect = fromBtn.getBoundingClientRect();
                    const toRect = toBtn.getBoundingClientRect();
                    const containerRect = svg.parentElement.getBoundingClientRect();

                    const x1 = fromRect.right - containerRect.left;
                    const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
                    const x2 = toRect.left - containerRect.left;
                    const y2 = toRect.top + toRect.height / 2 - containerRect.top;
                    const mx = (x1 + x2) / 2;
                    const my = (y1 + y2) / 2;

                    // IN 코어색 (왼쪽 절반)
                    var fromColor = wireMapCoreColors[(fromPort - 1) % wireMapCoreColors.length];
                    var line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line1.setAttribute('x1', x1);
                    line1.setAttribute('y1', y1);
                    line1.setAttribute('x2', mx);
                    line1.setAttribute('y2', my);
                    line1.setAttribute('stroke', fromColor);
                    line1.setAttribute('stroke-width', '3');
                    line1.setAttribute('opacity', '0.85');
                    svg.appendChild(line1);

                    // OUT 코어색 (오른쪽 절반)
                    var toColor = wireMapCoreColors[(toPort - 1) % wireMapCoreColors.length];
                    var line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line2.setAttribute('x1', mx);
                    line2.setAttribute('y1', my);
                    line2.setAttribute('x2', x2);
                    line2.setAttribute('y2', y2);
                    line2.setAttribute('stroke', toColor);
                    line2.setAttribute('stroke-width', '3');
                    line2.setAttribute('opacity', '0.85');
                    svg.appendChild(line2);
                });
            });
        }
        
        // 노드의 포트 데이터 가져오기
        function getDcPortNum(node, portNum, visited) {
            if (!visited) visited = new Set();
            if (visited.has(node.id)) return null;
            visited.add(node.id);
            const upConn = connections.find(c => isInConn(c, node.id));
            if (!upConn) return null;
            const upNode = nodes.find(n => n.id === connFrom(upConn));
            if (!upNode) return null;
            if (upNode.type === 'datacenter') return portNum;
            if (!upConn.portMapping) return null;
            const mapping = upConn.portMapping.find(m => m[1] === portNum);
            if (!mapping) return null;
            return getDcPortNum(upNode, mapping[0], visited);
        }

        // 배지용: 국사명 + OFD명 + 포트번호 반환
        function getDcInfo(node, portNum, visited) {
            if (!visited) visited = new Set();
            if (visited.has(node.id)) return null;
            visited.add(node.id);
            const upConn = connections.find(c => isInConn(c, node.id));
            if (!upConn) return null;
            const upNode = nodes.find(n => n.id === connFrom(upConn));
            if (!upNode) return null;
            if (upNode.type === 'datacenter') {
                // 해당 포트에 연결된 OFD 찾기
                const ofd = (upNode.ofds || []).find(o =>
                    o.connectedCable === upConn.id &&
                    o.cableMapping && o.cableMapping.some(([, cp]) => cp === portNum)
                );
                const ofdName = ofd
                    ? (ofd.customName ? `${ofd.name}(${ofd.customName})` : ofd.name)
                    : null;
                return { dcName: upNode.name || '국사', ofdName, portNum };
            }
            if (!upConn.portMapping) return null;
            const mapping = upConn.portMapping.find(m => m[1] === portNum);
            if (!mapping) return null;
            return getDcInfo(upNode, mapping[0], visited);
        }

        function getNodePortData(node, _visited, connectionToNode) {
            // 무한루프 방지 (순환 연결 대비)
            if (!_visited) _visited = new Set();
            if (_visited.has(node.id)) return [];
            _visited.add(node.id);

            // 국사인 경우: cableMapping을 사용해 케이블 포트 번호 기준 라벨 배열 반환
            if (node.type === 'datacenter' && node.ofds && node.ofds.length > 0) {
                // connectionToNode가 있으면 해당 케이블에 연결된 OFD들의 cableMapping 사용
                if (connectionToNode) {
                    const connectedOFDs = node.ofds.filter(o => o.connectedCable === connectionToNode.id);
                    if (connectedOFDs.length > 0) {
                        const result = new Array(connectionToNode.cores).fill('');
                        connectedOFDs.forEach(ofd => {
                            if (ofd.cableMapping && ofd.cableMapping.length > 0) {
                                ofd.cableMapping.forEach(([ofdPort, cablePort]) => {
                                    if (cablePort >= 1 && cablePort <= connectionToNode.cores) {
                                        result[cablePort - 1] = (ofd.ports && ofd.ports[ofdPort - 1])
                                            ? (ofd.ports[ofdPort - 1].label || '')
                                            : '';
                                    }
                                });
                            }
                        });
                        return result;
                    }
                }
                // connectionToNode 없거나 해당 케이블에 OFD 없으면 ofds[0] 폴백
                return node.ofds[0].ports.map(p => p.label);
            }

            // 일반 노드: 전단 연결의 portMapping을 재귀적으로 추적 (IN1/IN2 모두 처리)
            // → node.ports(오염 가능)에 의존하지 않고 연결 체인을 직접 계산
            const upConns = connections.filter(c => isInConn(c, node.id));
            // connectionToNode가 주어진 경우 해당 연결만, 아니면 전체 IN 처리
            // 단, connectionToNode가 이 노드에서 나가는 케이블(from===node.id)이면 무시
            const validConn = (connectionToNode && isInConn(connectionToNode, node.id)) ? connectionToNode : null;
            const targetUpConns = validConn ? [validConn] : upConns;
            const upConn = targetUpConns[0] || null; // 하위 호환용

            // IN 연결이 있고 portMapping이 있으면 전단 라벨을 portMapping으로 변환
            if (upConn && upConn.portMapping && upConn.portMapping.length > 0) {
                const upNode = nodes.find(n => n.id === connFrom(upConn));
                if (upNode) {
                    // 전단 라벨 가져오기: 국사면 cableMapping, 일반 함체면 재귀 추적
                    let upLabels;
                    if (upNode.type === 'datacenter') {
                        upLabels = getNodePortData(upNode, _visited, upConn);
                    } else {
                        // 전단 함체의 IN 케이블을 찾아 재귀 추적
                        const upNodeInConn = connections.find(c => isInConn(c, upNode.id));
                        upLabels = getNodePortData(upNode, _visited, upNodeInConn || null);
                    }
                    const maxPort = Math.max(...upConn.portMapping.map(m => m[1]));
                    const result = new Array(maxPort).fill('');

                    // portMapping에 있는 포트만 라벨 전달 (해제된 포트는 빈값 유지)
                    upConn.portMapping.forEach(([fromPort, toPort]) => {
                        const rn = upNode.rns && upNode.rns.find(r => r.port === fromPort);
                        if (rn) {
                            // RN이 있는 포트는 슬롯 체크 우선 (savedLabel 무시)
                            // → 연결 해제됐는데 이전 label이 남아있는 오염 방지
                            const slotInfo = rn.outputs ? rn.outputs.find(o => o.port === toPort) : null;
                            if (slotInfo) {
                                const baseLabel = upLabels[fromPort - 1] || '';
                                result[toPort - 1] = baseLabel + '(' + upNode.name + ' ' + rn.type + 'RN-' + slotInfo.slotNum + ')';
                            } else {
                                result[toPort - 1] = ''; // 슬롯 없으면 무조건 빈 문자열
                            }
                        } else {
                            result[toPort - 1] = upLabels[fromPort - 1] || '';
                        }
                    });
                    return result;
                }
            }

            // 전단 연결은 있지만 portMapping이 없는 경우 (국사가 직접 전단인 경우)
            if (upConn) {
                const upNode = nodes.find(n => n.id === connFrom(upConn));
                if (upNode && upNode.type === 'datacenter') {
                    return getNodePortData(upNode, _visited, upConn);
                }
            }

            // 전단 없거나 portMapping 없으면 node.ports 사용 (최후 수단)
            if (node.ports && node.ports.length > 0) {
                return node.ports.map(p => p.label || '');
            }

            return [];
        }
        
        // 전체 연결 해제
        function clearAllConnections() {
            showConfirm(
                '모든 포트 연결을 해제하시겠습니까?',
                () => {
                    currentWireMapConnections.forEach(conn => {
                        conn.portMapping = [];
                        conn.inFromCableId = null;
                    });
                    // 후단 노드 포트 라벨 초기화
                    currentWireMapToNodes.forEach(toNode => {
                        if (toNode && toNode.ports) toNode.ports.forEach(p => { p.label = ''; });
                    });
                    // selectedNode 포트 라벨 초기화
                    if (selectedNode && selectedNode.ports) selectedNode.ports.forEach(p => { p.label = ''; });
                    saveWireMapAll();
                    renderWireMap();
                    showStatus('모든 연결이 해제되었습니다');
                },
                '포트 매핑과 라벨이 모두 삭제됩니다.',
                '전체 해제'
            );
        }

        // 1:1 자동 연결 (IN1/IN2 순서대로 OUT에 배분)
        function autoConnect11() {
            // 모든 후단 연결 portMapping 초기화
            currentWireMapConnections.forEach(conn => { conn.portMapping = []; conn.inFromCableId = null; });

            // IN 연결들 (currentWireMapUpstreamConns 기반)
            const upConnsForAuto = currentWireMapUpstreamConns.length > 0
                ? currentWireMapUpstreamConns
                : [connections.find(c => isOutConn(c, currentWireMapFromNode.id) && isInConn(c, selectedNode.id))].filter(Boolean);

            // IN별 포트 풀 생성 [{conn, remaining}]
            const inPools = upConnsForAuto.map(c => ({ conn: c, cores: c.cores, nextPort: 1 }));
            let inPoolIdx = 0; // 현재 IN 풀 인덱스

            currentWireMapConnections.forEach(outConn => {
                for (let toPort = 1; toPort <= outConn.cores; toPort++) {
                    // 현재 IN 풀이 소진되면 다음 IN으로
                    while (inPoolIdx < inPools.length && inPools[inPoolIdx].nextPort > inPools[inPoolIdx].cores) {
                        inPoolIdx++;
                    }
                    if (inPoolIdx >= inPools.length) break;

                    const pool = inPools[inPoolIdx];
                    outConn.portMapping.push([pool.nextPort, toPort]);
                    // inFromCableId 기록 (첫 push 시)
                    if (!outConn.inFromCableId) outConn.inFromCableId = pool.conn.id;
                    pool.nextPort++;
                }
            });

            saveWireMapAll();
            renderWireMap();
            showStatus('1:1 자동 연결 및 저장되었습니다');
        }
        
        // 전단 포트 데이터를 후단으로 복사 (IN1/IN2 모두 처리)
        function copyPortDataDownstream() {
            currentWireMapConnections.forEach((conn, index) => {
                const toNode = currentWireMapToNodes[index];
                if (!toNode) return;
                if (!toNode.ports) toNode.ports = [];

                // inFromCableId로 IN 전단 체인 역추적
                const inConnCpd = conn.inFromCableId
                    ? connections.find(c => c.id === conn.inFromCableId)
                    : connections.find(c => isInConn(c, selectedNode.id));
                const inUpNodeCpd = inConnCpd ? nodes.find(n => n.id === connFrom(inConnCpd)) : null;
                const upLabelsCpd = (inConnCpd && inUpNodeCpd)
                    ? getNodePortData(inUpNodeCpd, null, inConnCpd) : [];

                conn.portMapping.forEach(([fromPort, toPort]) => {
                    let fromLabel = '';
                    if (inConnCpd) {
                        const mapping = inConnCpd.portMapping && inConnCpd.portMapping.find(m => m[1] === fromPort);
                        fromLabel = mapping ? (upLabelsCpd[mapping[0] - 1] || '') : (upLabelsCpd[fromPort - 1] || '');
                    }
                    while (toNode.ports.length < toPort) {
                        toNode.ports.push({ number: toNode.ports.length + 1, label: '' });
                    }
                    toNode.ports[toPort - 1].label = fromLabel;
                });

                const toIndex = nodes.findIndex(n => n.id === toNode.id);
                if (toIndex !== -1) nodes[toIndex] = toNode;
            });
        }
        
        // 직선도 저장
        function saveWireMapAll() {
            // inFromCableId가 없는 conn은 IN1 케이블로 채우기 (기존 데이터 호환)
            const defaultInConn = currentWireMapUpstreamConns[0];
            if (defaultInConn) {
                currentWireMapConnections.forEach(conn => {
                    if (!conn.inFromCableId) conn.inFromCableId = defaultInConn.id;
                });
            }

            // 모든 connection 업데이트
            currentWireMapConnections.forEach((conn, index) => {
                const connIndex = connections.findIndex(c => c.id === conn.id);
                if (connIndex !== -1) {
                    connections[connIndex] = conn;
                }

                // 후단 노드 ports 초기화 후 portMapping 기준으로 재저장
                // → 연결 해제 시 toNode.ports 라벨도 반드시 지워야 함
                const toNode = currentWireMapToNodes[index];
                if (!toNode.ports) toNode.ports = [];
                // 전체 초기화 (RN 라벨은 별도로 아래서 다시 씀)
                toNode.ports.forEach(p => { p.label = ''; });

                if (conn.portMapping && conn.portMapping.length > 0) {
                    // inFromCableId로 어느 IN에서 왔는지 파악 후 해당 IN의 전단 연결로 라벨 계산
                    const inConnForOut = conn.inFromCableId
                        ? connections.find(c => c.id === conn.inFromCableId)
                        : connections.find(c => isInConn(c, selectedNode.id));
                    const inUpNodeForOut = inConnForOut ? nodes.find(n => n.id === connFrom(inConnForOut)) : null;

                    conn.portMapping.forEach(([fromPort, toPort]) => {
                        while (toNode.ports.length < toPort) {
                            toNode.ports.push({ number: toNode.ports.length + 1, label: '' });
                        }
                        const rn = selectedNode.rns && selectedNode.rns.find(r => r.port === fromPort);

                        // 라벨 계산: IN 전단 체인을 재귀 추적
                        let fromLabel = '';
                        if (inConnForOut && inUpNodeForOut) {
                            const upLabels = getNodePortData(inUpNodeForOut, null, inConnForOut);
                            // inConnForOut.portMapping에서 fromPort(현재함체 IN포트)→전단포트 역추적
                            const mapping = inConnForOut.portMapping && inConnForOut.portMapping.find(m => m[1] === fromPort);
                            fromLabel = mapping ? (upLabels[mapping[0] - 1] || '') : (upLabels[fromPort - 1] || '');
                        }

                        if (rn) {
                            const slotInfo = rn.outputs ? rn.outputs.find(o => o.port === toPort) : null;
                            if (slotInfo) {
                                toNode.ports[toPort - 1].label = fromLabel + '(' + selectedNode.name + ' ' + rn.type + 'RN-' + slotInfo.slotNum + ')';
                            } else {
                                toNode.ports[toPort - 1].label = ''; // RN 있는데 슬롯 없으면 빈칸
                            }
                        } else {
                            toNode.ports[toPort - 1].label = fromLabel;
                        }
                    });
                }

                const toIndex = nodes.findIndex(n => n.id === toNode.id);
                if (toIndex !== -1) {
                    nodes[toIndex] = toNode;
                }

                // Bug 4 fix: OUT이 국사인 경우 → 해당 OFD cableMapping 자동 전파
                if (toNode.type === 'datacenter' && conn.portMapping && conn.portMapping.length > 0) {
                    const dcOFD = (toNode.ofds || []).find(o => o.connectedCable === conn.id);
                    if (dcOFD) {
                        // inFromCableId 기준 IN 라벨 계산
                        const inConnForDc = conn.inFromCableId
                            ? connections.find(c => c.id === conn.inFromCableId)
                            : connections.find(c => isInConn(c, selectedNode.id));
                        const inUpNodeForDc = inConnForDc ? nodes.find(n => n.id === connFrom(inConnForDc)) : null;

                        // OFD ports 라벨 업데이트
                        if (!dcOFD.ports) dcOFD.ports = [];
                        dcOFD.cableMapping = [];
                        conn.portMapping.forEach(([fromPort, toPort]) => {
                            // toPort = 국사 케이블 포트 번호 = OFD 포트 번호로 사용
                            while (dcOFD.ports.length < toPort) {
                                dcOFD.ports.push({ number: dcOFD.ports.length + 1, label: '' });
                            }
                            let label = '';
                            if (inConnForDc && inUpNodeForDc) {
                                const upLabels = getNodePortData(inUpNodeForDc, null, inConnForDc);
                                const mapping = inConnForDc.portMapping &&
                                    inConnForDc.portMapping.find(m => m[1] === fromPort);
                                label = mapping
                                    ? (upLabels[mapping[0] - 1] || '')
                                    : (upLabels[fromPort - 1] || '');
                            }
                            dcOFD.ports[toPort - 1].label = label;
                            dcOFD.cableMapping.push([toPort, toPort]); // ofdPort=toPort, cablePort=toPort
                        });

                        const dcIdx = nodes.findIndex(n => n.id === toNode.id);
                        if (dcIdx !== -1) nodes[dcIdx] = toNode;
                    }
                }
            });
            
            // selectedNode.ports: IN1/IN2 모든 연결의 portMapping 기준으로 재저장
            const upConnsForSave = connections.filter(conn => isInConn(conn, selectedNode.id));
            if (upConnsForSave.length > 0) {
                if (!selectedNode.ports) selectedNode.ports = [];
                // 기존 라벨 전체 초기화
                selectedNode.ports.forEach(p => { p.label = ''; });

                // IN1/IN2 각각 처리
                upConnsForSave.forEach(upConnForSave => {
                    if (!upConnForSave.portMapping || upConnForSave.portMapping.length === 0) return;
                    const upNodeForSave = nodes.find(n => n.id === connFrom(upConnForSave));
                    if (!upNodeForSave) return;
                    const fromPortLabels = getNodePortData(upNodeForSave, null, upConnForSave);

                    upConnForSave.portMapping.forEach(([fromPort, toPort]) => {
                        while (selectedNode.ports.length < toPort) {
                            selectedNode.ports.push({ number: selectedNode.ports.length + 1, label: '' });
                        }
                        const rn = upNodeForSave.rns && upNodeForSave.rns.find(r => r.port === fromPort);
                        if (rn) {
                            const slotInfo = rn.outputs ? rn.outputs.find(o => o.port === toPort) : null;
                            if (slotInfo) {
                                const baseLabel = fromPortLabels[fromPort - 1] || '';
                                selectedNode.ports[toPort - 1].label = baseLabel + '(' + upNodeForSave.name + ' ' + rn.type + 'RN-' + slotInfo.slotNum + ')';
                            } else {
                                selectedNode.ports[toPort - 1].label = ''; // RN 있는데 슬롯 없으면 빈칸
                            }
                        } else {
                            selectedNode.ports[toPort - 1].label = fromPortLabels[fromPort - 1] || '';
                        }
                    });
                });
            }
            
            // 현재 노드 저장
            const currentIndex = nodes.findIndex(n => n.id === selectedNode.id);
            if (currentIndex !== -1) {
                nodes[currentIndex] = selectedNode;
            }
            
            saveData();
        }
        

        function cascadeLabels(nodeId, visited) {
            if (!visited) visited = new Set();
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            const fromNode = nodes.find(n => n.id === nodeId);
            if (!fromNode) return;
            connections.filter(c => isOutConn(c, nodeId)).forEach(conn => {
                if (!conn.portMapping || !conn.portMapping.length) return;
                const toNode = nodes.find(n => n.id === connTo(conn));
                if (!toNode) return;
                const fromLabels = getNodePortData(fromNode, null, conn);
                if (!toNode.ports) toNode.ports = [];
                toNode.ports.forEach(p => { p.label = ''; });
                conn.portMapping.forEach(([fp, tp]) => {
                    while (toNode.ports.length < tp) toNode.ports.push({ number: toNode.ports.length + 1, label: '' });
                    const rn = fromNode.rns && fromNode.rns.find(r => r.port === fp);
                    if (rn) {
                        const si = rn.outputs ? rn.outputs.find(o => o.port === tp) : null;
                        toNode.ports[tp-1].label = si ? (fromLabels[fp-1]||'')+'('+fromNode.name+' '+rn.type+'RN-'+si.slotNum+')' : '';
                    } else {
                        toNode.ports[tp-1].label = fromLabels[fp-1] || '';
                    }
                });
                const ti = nodes.findIndex(n => n.id === toNode.id);
                if (ti !== -1) nodes[ti] = toNode;
                cascadeLabels(toNode.id, visited);
            });
        }
        function saveWireMap() { saveWireMapAll(); showStatus('직선도가 저장되었습니다'); }
        
        // 직선도 닫기
        function closeWireMap() {
            document.getElementById('wireMapModal').classList.remove('active');
            currentWireMapConnections = [];
            currentWireMapFromNode = null;
            currentWireMapToNodes = [];
            currentWireMapUpstreamConns = [];
            currentWireMapUpstreamNodes = [];
            selectedFromPort = null;
            selectedInTube = null;
        }
        
        // ==================== RN 관련 함수 ====================
        
        // 후단 노드 순서 변경
        function swapDownstreamNodes(index1, index2) {
            // 배열 순서 변경
            [currentWireMapToNodes[index1], currentWireMapToNodes[index2]] = 
            [currentWireMapToNodes[index2], currentWireMapToNodes[index1]];
            
            [currentWireMapConnections[index1], currentWireMapConnections[index2]] = 
            [currentWireMapConnections[index2], currentWireMapConnections[index1]];
            
            // 화면 갱신
            renderWireMap();
            showStatus('순서가 변경되었습니다');
        }
        
        // RN 추가 모달 표시
        function showAddRNModal() {
            document.getElementById('rnModal').classList.add('active');
        }
        
        // RN 추가 모달 닫기
        function closeRNModal() {
            document.getElementById('rnModal').classList.remove('active');
            document.getElementById('rnPort').value = '';
        }
        
        // RN 추가
        function addRN() {
            const type = document.getElementById('rnType').value;
            const port = parseInt(document.getElementById('rnPort').value);
            
            if (!port || port < 1) {
                showStatus('올바른 포트 번호를 입력하세요');
                return;
            }
            
            // 이미 RN이 있는지 확인
            if (!selectedNode.rns) selectedNode.rns = [];
            const existing = selectedNode.rns.find(r => r.port === port);
            if (existing) {
                showStatus('이미 RN이 추가된 포트입니다');
                return;
            }
            
            // RN 추가
            selectedNode.rns.push({
                port: port,
                type: type,
                outputs: []
            });
            
            // 저장
            const index = nodes.findIndex(n => n.id === selectedNode.id);
            if (index !== -1) {
                nodes[index] = selectedNode;
            }
            saveData();
            
            // 화면 갱신
            renderWireMap();
            closeRNModal();
            showStatus(`${port}번 포트에 ${type} RN이 추가되었습니다`);
        }
        

        // RN 삭제 (직선도에서 ✕ RN 버튼 클릭 시)
        function removeRN(portNum) {
            if (!selectedNode.rns) return;
            const rnIdx = selectedNode.rns.findIndex(r => r.port === portNum);
            if (rnIdx === -1) return;

            currentWireMapConnections.forEach((conn, ni) => {
                const toNode = currentWireMapToNodes[ni];
                conn.portMapping.filter(m => m[0] === portNum).forEach(m => {
                    if (toNode && toNode.ports && toNode.ports[m[1] - 1]) {
                        toNode.ports[m[1] - 1].label = '';
                    }
                });
                conn.portMapping = conn.portMapping.filter(m => m[0] !== portNum);
            });

            selectedNode.rns.splice(rnIdx, 1);
            const index = nodes.findIndex(n => n.id === selectedNode.id);
            if (index !== -1) nodes[index] = selectedNode;
            saveWireMapAll();
            renderWireMap();
            showStatus(`${portNum}번 포트 RN이 삭제되었습니다`);
        }

        // ==================== RN 함수 끝 ====================

        // ==================== PDF 출력 ====================
        async function exportWireMapPDF() {
            if (!selectedNode || !currentWireMapUpstreamConns.length) {
                showStatus('직선도 데이터가 없습니다');
                return;
            }

            showStatus('PDF 생성 중...');

            if (!window.jspdf || !window.jspdf.jsPDF) {
                showStatus('PDF 라이브러리가 로드되지 않았습니다. 페이지를 새로고침 해주세요.');
                return;
            }
            var jsPDF = window.jspdf.jsPDF;
            // A4 세로: 210×297mm
            var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            var pageW = 210, pageH = 297;
            var margin = 6;
            var contentW = pageW - margin * 2;
            var contentH = pageH - margin * 2;

            // IN 기준 최대 코어수
            var upConns = currentWireMapUpstreamConns;
            var upNodes = currentWireMapUpstreamNodes;
            var maxCores = upConns[0] ? upConns[0].cores : 0;
            var totalTubes = Math.ceil(maxCores / 12);
            var tubesPerPage = 2;
            var totalPages = Math.ceil(totalTubes / tubesPerPage);

            // 히든 렌더 컨테이너 (A4 세로 비율)
            var renderBox = document.createElement('div');
            renderBox.id = '_pdfRenderBox';
            renderBox.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;background:white;font-family:sans-serif;';
            document.body.appendChild(renderBox);

            // 현재 직선도의 OUT 데이터 미리 계산 (첫 번째 OUT만)
            var outConn = currentWireMapConnections[0];
            var outNode = currentWireMapToNodes[0];
            var _outLabels = [];
            if (outConn && outNode) {
                var _downConn = connections.find(function(c) { return isInConn(c, outNode.id); });
                _outLabels = getNodePortData(outNode, null, _downConn || outConn);
                if (outNode.type === 'datacenter' && _outLabels.every(function(l) { return !l; })) {
                    if (outConn.portMapping && outConn.portMapping.length > 0) {
                        var mapped = new Array(outConn.cores).fill('');
                        outConn.portMapping.forEach(function(m) {
                            var fromLabels = getNodePortData(selectedNode, null, null);
                            mapped[m[1] - 1] = fromLabels[m[0] - 1] || '';
                        });
                        if (mapped.some(function(l) { return l; })) _outLabels = mapped;
                    }
                }
            }

            try {
                for (var page = 0; page < totalPages; page++) {
                    var startTube = page * tubesPerPage + 1;
                    var endTube = Math.min(startTube + tubesPerPage - 1, totalTubes);
                    var startPort = (startTube - 1) * 12 + 1;
                    var endPort = Math.min(endTube * 12, maxCores);

                    renderBox.innerHTML = '';

                    // 페이지 제목
                    var titleDiv = document.createElement('div');
                    titleDiv.style.cssText = 'padding:8px 14px;font-size:15px;font-weight:700;color:#1e293b;border-bottom:2px solid #1a6fd4;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;';
                    titleDiv.innerHTML = '<span>' + escapeHtml(selectedNode.name || '장비') + ' 직선도</span>' +
                        '<span style="font-size:11px;font-weight:500;color:#64748b;">튜브 ' + startTube + '~' + endTube + ' (' + startPort + '~' + endPort + '번) | ' + (page + 1) + '/' + totalPages + '</span>';
                    renderBox.appendChild(titleDiv);

                    // 좌우 컨테이너
                    var row = document.createElement('div');
                    row.style.cssText = 'display:flex;gap:60px;position:relative;';

                    // === IN 컬럼 (첫 번째 IN만) ===
                    var inCol = document.createElement('div');
                    inCol.style.cssText = 'flex:1;position:relative;z-index:1;';

                    var upConn = upConns[0];
                    var upNode = upNodes[0];
                    var inTag = upConns.length > 1 ? 'IN1' : 'IN';
                    var inColor = '#1a6fd4';

                    var inBlock = document.createElement('div');
                    var hdr = document.createElement('div');
                    hdr.style.cssText = 'padding:7px 10px;background:' + inColor + ';color:white;font-weight:700;font-size:12px;border-radius:5px 5px 0 0;text-align:center;';
                    hdr.innerHTML = '<span style="background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:3px;font-size:9px;margin-right:5px;">' + inTag + '</span>' + escapeHtml(upNode ? upNode.name || '' : '');
                    inBlock.appendChild(hdr);

                    var inList = document.createElement('div');
                    inList.style.cssText = 'border:1.5px solid ' + inColor + ';border-top:none;border-radius:0 0 5px 5px;overflow:hidden;background:white;';

                    var thisUpPorts = getNodePortData(upNode, null, upConn);

                    for (var i = startPort - 1; i < endPort; i++) {
                        var portNum = i + 1;
                        var tubeNum = Math.ceil(portNum / 12);
                        var coreIdx = (portNum - 1) % 12;
                        var tc = wireMapTubeColors[(tubeNum - 1) % 12];
                        var coreColor = wireMapCoreColors[coreIdx];
                        var textColor = [8, 9, 10, 11].includes(coreIdx) ? '#333' : 'white';

                        if ((portNum - 1) % 12 === 0) {
                            var tubeEnd = Math.min(portNum + 11, maxCores);
                            var tl = document.createElement('div');
                            tl.style.cssText = 'padding:2px 8px;background:' + tc.bg + ';font-size:9px;font-weight:700;color:' + tc.text + ';border-top:1.5px solid ' + tc.border + ';border-bottom:1px solid ' + tc.border + ';';
                            tl.textContent = '튜브 ' + tubeNum + ' ' + tc.name + ' (' + portNum + '~' + tubeEnd + '번)';
                            inList.appendChild(tl);
                        }

                        // 라벨 계산
                        var label = '';
                        var isPortMapped = upConn && upConn.portMapping && upConn.portMapping.some(function(m) { return m[1] === portNum; });
                        if (isPortMapped && upConn.portMapping) {
                            var mappingEntry = upConn.portMapping.find(function(m) { return m[1] === portNum; });
                            var rn = mappingEntry && upNode && upNode.rns && upNode.rns.find(function(r) { return r.port === mappingEntry[0]; });
                            if (rn) {
                                var slotInfo = rn.outputs ? rn.outputs.find(function(o) { return o.port === portNum; }) : null;
                                if (slotInfo) label = (thisUpPorts[mappingEntry[0] - 1] || '') + '(' + (upNode ? upNode.name : '') + ' ' + rn.type + 'RN-' + slotInfo.slotNum + ')';
                            } else if (mappingEntry) {
                                label = thisUpPorts[mappingEntry[0] - 1] || '';
                            }
                        } else {
                            label = thisUpPorts[i] || '';
                        }

                        // OUT 뱃지 확인
                        var crossNodeIndex = -1;
                        currentWireMapConnections.forEach(function(conn, ni) {
                            var matchesIn = conn.inFromCableId ? conn.inFromCableId === upConn.id : true;
                            if (conn.portMapping && matchesIn && conn.portMapping.some(function(m) { return m[0] === portNum; })) crossNodeIndex = ni;
                        });

                        var pRow = document.createElement('div');
                        pRow.className = 'pdf-in-row';
                        pRow.dataset.port = portNum;
                        pRow.style.cssText = 'display:flex;align-items:center;padding:2px 6px;min-height:28px;background:' + tc.bg + ';border-bottom:1px solid ' + tc.border + '18;font-size:10px;';

                        var lbl = document.createElement('span');
                        lbl.style.cssText = 'flex:1;color:#334155;';
                        var rnInfo = selectedNode.rns ? selectedNode.rns.find(function(r) { return r.port === portNum; }) : null;
                        lbl.innerHTML = '<strong style="font-size:11px;font-weight:700;color:#1e293b;">' + portNum + '</strong> ' + escapeHtml(label);
                        if (rnInfo) lbl.innerHTML += ' <span style="font-size:8px;color:#7c3aed;font-weight:600;">(' + selectedNode.name + ' ' + rnInfo.type + 'RN)</span>';
                        pRow.appendChild(lbl);

                        // OFD 선번 뱃지 (이름표 ON 상태인 튜브만)
                        if (crossNodeIndex >= 0) {
                            var labelToggleBtn = document.querySelector('#inList-0 button[data-show][title="이름표 ON/OFF"]');
                            // 튜브별 토글 찾기
                            var allToggles = document.querySelectorAll('#inList-0 button[data-show][title="이름표 ON/OFF"]');
                            var thisTubeToggle = allToggles[tubeNum - 1];
                            var isLabelOn = thisTubeToggle && thisTubeToggle.dataset.show === '1';

                            if (isLabelOn) {
                                var dcInfo = getDcInfo(selectedNode, portNum);
                                if (dcInfo) {
                                    var dcBadge = document.createElement('span');
                                    dcBadge.style.cssText = 'font-size:7.5px;padding:1px 5px;border-radius:6px;background:#475569;color:white;font-weight:600;margin-right:2px;white-space:nowrap;';
                                    var parts = [dcInfo.dcName, dcInfo.ofdName, dcInfo.portNum + '번'].filter(Boolean);
                                    dcBadge.textContent = parts.join(' ');
                                    pRow.appendChild(dcBadge);
                                }
                            }

                            var badge = document.createElement('span');
                            var badgeColor = outLineColors[crossNodeIndex % outLineColors.length];
                            badge.style.cssText = 'font-size:8px;padding:1px 5px;border-radius:6px;background:' + badgeColor + ';color:white;font-weight:600;margin-right:3px;white-space:nowrap;';
                            badge.textContent = '→OUT' + (crossNodeIndex + 1);
                            pRow.appendChild(badge);
                        }

                        var cBtn = document.createElement('span');
                        cBtn.className = 'pdf-in-btn';
                        cBtn.dataset.port = portNum;
                        cBtn.style.cssText = 'display:inline-block;width:26px;height:19px;border-radius:3px;background:' + coreColor + ';color:' + textColor + ';font-weight:700;font-size:9px;text-align:center;line-height:19px;flex-shrink:0;';
                        cBtn.textContent = portNum;
                        pRow.appendChild(cBtn);

                        inList.appendChild(pRow);
                    }

                    inBlock.appendChild(inList);
                    inCol.appendChild(inBlock);
                    row.appendChild(inCol);

                    // === OUT 컬럼 (첫 번째 OUT만, OUT 자체 코어수까지만) ===
                    var outMaxPort = outConn ? Math.min(endPort, outConn.cores) : 0;
                    var outStartPort = Math.min(startPort, outMaxPort + 1);

                    if (outConn && outNode && outStartPort <= outMaxPort) {
                        var outColDiv = document.createElement('div');
                        outColDiv.style.cssText = 'flex:1;position:relative;z-index:1;';

                        var outBlock = document.createElement('div');
                        var outHdr = document.createElement('div');
                        outHdr.style.cssText = 'padding:7px 10px;background:#475569;color:white;font-weight:700;font-size:12px;border-radius:5px 5px 0 0;text-align:center;';
                        var outTagLabel = currentWireMapToNodes.length > 1 ? 'OUT1' : 'OUT';
                        outHdr.innerHTML = '<span style="background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:3px;font-size:9px;margin-right:5px;">' + outTagLabel + '</span>' + escapeHtml(outNode.name || '이름 없음');
                        outBlock.appendChild(outHdr);

                        var outList = document.createElement('div');
                        outList.style.cssText = 'border:1.5px solid #64748b;border-top:none;border-radius:0 0 5px 5px;overflow:hidden;background:white;';

                        for (var i = outStartPort - 1; i < outMaxPort; i++) {
                            var portNum = i + 1;
                            var tubeNum = Math.ceil(portNum / 12);
                            var coreIdx = (portNum - 1) % 12;
                            var tc = wireMapTubeColors[(tubeNum - 1) % 12];
                            var coreColor = wireMapCoreColors[coreIdx];
                            var textColor = [8, 9, 10, 11].includes(coreIdx) ? '#333' : 'white';

                            if ((portNum - 1) % 12 === 0) {
                                var tubeEnd = Math.min(portNum + 11, outConn.cores);
                                var tl = document.createElement('div');
                                tl.style.cssText = 'padding:2px 8px;background:' + tc.bg + ';font-size:9px;font-weight:700;color:' + tc.text + ';border-top:1.5px solid ' + tc.border + ';border-bottom:1px solid ' + tc.border + ';';
                                tl.textContent = '튜브 ' + tubeNum + ' ' + tc.name + ' (' + portNum + '~' + tubeEnd + '번)';
                                outList.appendChild(tl);
                            }

                            var downLabel = (portNum <= _outLabels.length) ? (_outLabels[portNum - 1] || '') : '';

                            var pRow = document.createElement('div');
                            pRow.className = 'pdf-out-row';
                            pRow.dataset.port = portNum;
                            pRow.style.cssText = 'display:flex;align-items:center;padding:2px 6px;min-height:28px;background:' + tc.bg + ';border-bottom:1px solid ' + tc.border + '18;font-size:10px;';

                            var cBtn = document.createElement('span');
                            cBtn.className = 'pdf-out-btn';
                            cBtn.dataset.port = portNum;
                            cBtn.style.cssText = 'display:inline-block;width:26px;height:19px;border-radius:3px;background:' + coreColor + ';color:' + textColor + ';font-weight:700;font-size:9px;text-align:center;line-height:19px;flex-shrink:0;';
                            cBtn.textContent = portNum;
                            pRow.appendChild(cBtn);

                            var lbl = document.createElement('span');
                            lbl.style.cssText = 'flex:1;margin-left:6px;color:#334155;';
                            lbl.innerHTML = '<strong style="font-size:11px;font-weight:700;color:#1e293b;">' + portNum + '</strong> ' + escapeHtml(downLabel);
                            pRow.appendChild(lbl);

                            outList.appendChild(pRow);
                        }

                        outBlock.appendChild(outList);
                        outColDiv.appendChild(outBlock);
                        row.appendChild(outColDiv);
                    } else if (outConn && outNode && startPort > outConn.cores) {
                        // OUT 포트 범위 초과 페이지: 빈 OUT 컬럼 (IN만 있는 페이지)
                        var outColDiv = document.createElement('div');
                        outColDiv.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;';
                        outColDiv.textContent = outNode.name + ' (' + outConn.cores + '코어) 범위 초과';
                        row.appendChild(outColDiv);
                    }

                    renderBox.appendChild(row);

                    // === 연결선 SVG 그리기 (DOM 렌더 후) ===
                    // row를 relative로 설정하고 SVG 오버레이
                    row.style.position = 'relative';
                    var svgNS = 'http://www.w3.org/2000/svg';
                    var connSvg = document.createElementNS(svgNS, 'svg');
                    connSvg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:visible;';
                    row.appendChild(connSvg);

                    // DOM 레이아웃 반영 대기
                    await new Promise(function(r) { setTimeout(r, 50); });

                    // portMapping에서 이 페이지 범위 내 연결선 그리기
                    if (outConn && outConn.portMapping) {
                        var rowRect = row.getBoundingClientRect();
                        outConn.portMapping.forEach(function(m) {
                            var fromPort = m[0], toPort = m[1];
                            if (fromPort < startPort || fromPort > endPort) return;
                            if (toPort < outStartPort || toPort > outMaxPort) return;

                            var fromBtn = row.querySelector('.pdf-in-btn[data-port="' + fromPort + '"]');
                            var toBtn = row.querySelector('.pdf-out-btn[data-port="' + toPort + '"]');
                            if (!fromBtn || !toBtn) return;

                            var fRect = fromBtn.getBoundingClientRect();
                            var tRect = toBtn.getBoundingClientRect();

                            var x1 = fRect.right - rowRect.left;
                            var y1 = fRect.top + fRect.height / 2 - rowRect.top;
                            var x2 = tRect.left - rowRect.left;
                            var y2 = tRect.top + tRect.height / 2 - rowRect.top;
                            var mx = (x1 + x2) / 2;
                            var my = (y1 + y2) / 2;

                            var fromColor = wireMapCoreColors[(fromPort - 1) % wireMapCoreColors.length];
                            var line1 = document.createElementNS(svgNS, 'line');
                            line1.setAttribute('x1', x1);
                            line1.setAttribute('y1', y1);
                            line1.setAttribute('x2', mx);
                            line1.setAttribute('y2', my);
                            line1.setAttribute('stroke', fromColor);
                            line1.setAttribute('stroke-width', '2');
                            line1.setAttribute('opacity', '0.75');
                            connSvg.appendChild(line1);

                            var toColor = wireMapCoreColors[(toPort - 1) % wireMapCoreColors.length];
                            var line2 = document.createElementNS(svgNS, 'line');
                            line2.setAttribute('x1', mx);
                            line2.setAttribute('y1', my);
                            line2.setAttribute('x2', x2);
                            line2.setAttribute('y2', y2);
                            line2.setAttribute('stroke', toColor);
                            line2.setAttribute('stroke-width', '2');
                            line2.setAttribute('opacity', '0.75');
                            connSvg.appendChild(line2);
                        });
                    }

                    // html2canvas 캡처
                    var canvas = await html2canvas(renderBox, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        width: 794,
                        windowWidth: 794
                    });

                    if (page > 0) pdf.addPage();

                    var imgData = canvas.toDataURL('image/png');
                    var imgW = contentW;
                    var imgH = canvas.height * contentW / canvas.width;
                    if (imgH > contentH) {
                        imgH = contentH;
                        imgW = canvas.width * contentH / canvas.height;
                    }
                    var x = margin + (contentW - imgW) / 2;
                    var y = margin;
                    pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
                }

                var fileName = (selectedNode.name || '직선도') + '_직선도.pdf';
                pdf.save(fileName);
                showStatus('PDF 저장 완료: ' + fileName);

            } catch (err) {
                console.error('PDF 생성 오류:', err);
                showStatus('PDF 생성 중 오류가 발생했습니다');
            } finally {
                document.body.removeChild(renderBox);
            }
        }

        // ==================== PDF 출력 끝 ====================

        // 케이블 코어 수 변경 - 모달 열기
        let _coreChangeConnId = null;
        function changeCoreCount(connectionId) {
            const conn = connections.find(c => c.id === connectionId);
            if (!conn) return;
            _coreChangeConnId = connectionId;

            const fromNode = nodes.find(n => n.id === connFrom(conn));
            const toNode = nodes.find(n => n.id === connTo(conn));
            const _isCoaxC = conn.cableType === 'coax';
            const _coreUnit = _isCoaxC ? 'C' : '코어';
            document.getElementById('coreChangeInfo').textContent =
                `${fromNode?.name || '장비'} ↔ ${toNode?.name || '장비'} | 현재: ${conn.cores}${_coreUnit}`;

            const validCores = _isCoaxC ? [12, 7, 5] : [12, 24, 48, 72, 144, 288, 432];
            const container = document.getElementById('coreChangeSelection');
            container.innerHTML = '';
            validCores.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'fiber-core-btn' + (c === conn.cores ? ' selected' : '');
                btn.textContent = c + _coreUnit;
                btn.dataset.cores = c;
                btn.onclick = () => {
                    container.querySelectorAll('.fiber-core-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                };
                container.appendChild(btn);
            });

            document.getElementById('coreChangeModal').classList.add('active');
        }

        function closeCoreChangeModal() {
            document.getElementById('coreChangeModal').classList.remove('active');
            _coreChangeConnId = null;
        }

        function confirmCoreChange() {
            const selected = document.querySelector('#coreChangeSelection .fiber-core-btn.selected');
            if (!selected) { showStatus('코어 수를 선택하세요'); return; }

            const conn = connections.find(c => c.id === _coreChangeConnId);
            if (!conn) { closeCoreChangeModal(); return; }

            const newCores = parseInt(selected.dataset.cores);
            if (newCores === conn.cores) {
                closeCoreChangeModal();
                showStatus('동일한 코어 수입니다');
                return;
            }

            const isReducing = newCores < conn.cores;
            const fromNode = nodes.find(n => n.id === connFrom(conn));

            const overPortMapping = isReducing && conn.portMapping &&
                conn.portMapping.some(([f, t]) => f > newCores || t > newCores);
            const overCableMapping = isReducing && fromNode && fromNode.ofds &&
                fromNode.ofds.some(ofd =>
                    ofd.connectedCable === conn.id &&
                    ofd.cableMapping && ofd.cableMapping.some(([, cp]) => cp > newCores)
                );

            const doChange = () => {
                conn.cores = newCores;
                if (conn.portMapping)
                    conn.portMapping = conn.portMapping.filter(([f, t]) => f <= newCores && t <= newCores);
                if (fromNode && fromNode.ofds) {
                    fromNode.ofds.forEach(ofd => {
                        if (ofd.connectedCable === conn.id && ofd.cableMapping)
                            ofd.cableMapping = ofd.cableMapping.filter(([, cp]) => cp <= newCores);
                    });
                }
                const toNode = nodes.find(n => n.id === connTo(conn));
                if (toNode) {
                    if (isReducing && toNode.ports && toNode.ports.length > newCores)
                        toNode.ports = toNode.ports.slice(0, newCores);
                    clearDownstreamLabels(toNode.id, new Set([connFrom(conn)]));
                }
                saveData();
                renderAllConnections();
                showStatus(`코어 수가 ${newCores}으로 변경되었습니다${isReducing ? ' (초과 매핑 정리됨)' : ''}`);
            };

            closeCoreChangeModal();

            if (isReducing && (overPortMapping || overCableMapping)) {
                showConfirm(
                    `코어 수를 ${conn.cores} → ${newCores}으로 줄이면\n초과된 포트 매핑이 삭제됩니다.\n계속할까요?`,
                    doChange,
                    '',
                    '변경'
                );
            } else {
                doChange();
            }
        }

        // ==================== 케이블 직선도 함수 ====================
        
        // OFD 케이블 업데이트
        function updateOFDCable(ofdIndex, cableId) {
            selectedNode.ofds[ofdIndex].connectedCable = cableId;
            
            const index = nodes.findIndex(n => n.id === selectedNode.id);
            if (index !== -1) {
                nodes[index] = selectedNode;
            }
            saveData();
        }
        
        // 케이블 직선도 보기
        function showCableWireMap(ofdIndex) {
            const ofd = selectedNode.ofds[ofdIndex];
            
            if (!ofd.connectedCable) {
                showStatus('먼저 연결 케이블을 선택하세요');
                return;
            }
            
            const cable = connections.find(c => c.id === ofd.connectedCable);
            if (!cable) {
                showStatus('케이블 정보를 찾을 수 없습니다');
                return;
            }
            
            renderCableWireMap(cable);
            
            document.getElementById('ofdModal').classList.remove('active');
            document.getElementById('cableWireMapModal').classList.add('active');
        }
        
        // ==================== 국사 케이블 직선도 (클릭 방식) ====================
        let currentCableWireMapCable = null;       // 현재 보고 있는 케이블
        let selectedOFDPort = null;                 // 선택된 OFD 포트 {ofdIndex, portNum}

        // 케이블 직선도 렌더링 (클릭 방식)
        function renderCableWireMap(cable) {
            currentCableWireMapCable = cable;
            selectedOFDPort = null;

            const targetNodeId = isOutConn(cable, selectedNode.id) ? connTo(cable) : connFrom(cable);
            const targetNode = nodes.find(n => n.id === targetNodeId);
            document.getElementById('cableWireMapTitle').textContent =
                `${selectedNode.name || '국사'} → ${targetNode?.name || '함체'} 케이블 직선도`;

            const content = document.getElementById('cableWireMapContent');
            content.innerHTML = '';

            // 이 케이블에 연결된 OFD들 찾기
            const connectedOFDs = selectedNode.ofds.filter(ofd => ofd.connectedCable === cable.id);

            if (connectedOFDs.length === 0) {
                content.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">이 케이블에 연결된 OFD가 없습니다</p>';
                return;
            }

            // cableMapping 초기화 (ofd별로 {ofdPort → cablePort} 배열)
            connectedOFDs.forEach(ofd => {
                if (!ofd.cableMapping) ofd.cableMapping = [];
            });

            // 안내 문구
            const hint = document.createElement('div');
            hint.style.cssText = 'padding:10px 15px; background:#fff3cd; border-left:4px solid #f39c12; margin-bottom:15px; border-radius:4px; font-size:14px; color:#856404;';
            hint.textContent = '💡 OFD 포트 클릭 → 케이블 포트 클릭 순서로 연결하세요. 연결된 포트를 다시 클릭하면 해제됩니다.';
            content.appendChild(hint);

            // 메인 컨테이너
            const container = document.createElement('div');
            container.style.cssText = 'display:flex; gap:80px; align-items:flex-start;';

            // SVG: content 기준 absolute (hint div 아래에 오지 않도록 content에 직접 붙임)
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.cssText = 'position:absolute; top:0; left:0; pointer-events:none; z-index:10; overflow:visible;';
            svg.id = 'cableSvg';
            content.style.position = 'relative';
            content.appendChild(svg);

            // ── 좌측: OFD 컬럼 ──
            const leftColumn = document.createElement('div');
            leftColumn.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:20px; position:relative; z-index:2;';

            connectedOFDs.forEach((ofd, ofdIdx) => {
                const section = document.createElement('div');
                section.style.cssText = 'border:3px solid #667eea; border-radius:5px; overflow:hidden;';

                const header = document.createElement('div');
                header.style.cssText = 'padding:0 15px; background:#667eea; color:white; font-weight:bold; font-size:15px; height:52px; display:flex; align-items:center;';
                const displayName = ofd.customName ? `${escapeHtml(ofd.name)} (${escapeHtml(ofd.customName)})` : escapeHtml(ofd.name);
                header.textContent = displayName;
                section.appendChild(header);

                const portList = document.createElement('div');
                portList.style.background = 'white';

                for (let i = 1; i <= 72; i++) {
                    const port = ofd.ports[i - 1];
                    const isConnected = ofd.cableMapping.some(m => m[0] === i);
                    const tubeNum = Math.ceil(i / 12);

                    // 튜브 시작마다 라벨 삽입
                    if ((i - 1) % 12 === 0) {
                        const end = Math.min(i + 11, 72);
                        const tubeLabel = document.createElement('div');
                        tubeLabel.style.cssText = 'padding:4px 12px; background:#f5f5f5; font-size:11px; font-weight:700; color:#555; border-top:2px solid #bbb; border-bottom:1px solid #ddd; letter-spacing:0.2px;';
                        tubeLabel.textContent = `튜브 ${tubeNum}  (${i}~${end}번)`;
                        portList.appendChild(tubeLabel);
                    }

                    const row = document.createElement('div');
                    row.style.cssText = `display:flex; align-items:center; padding:5px 10px; border-bottom:${i % 12 === 0 || i === 72 ? 'none' : '1px solid #eee'}; min-height:40px;`;

                    const labelSpan = document.createElement('span');
                    labelSpan.style.cssText = 'flex:1; font-size:12.5px; color:#334155;';
                    labelSpan.innerHTML = `<strong style="font-size:14px;font-weight:700;color:#1e293b;">${i}</strong> ${escapeHtml(port?.label || '')}`;

                    const btn = document.createElement('button');
                    btn.id = `ofd-${ofdIdx}-${i}`;
                    btn.className = 'cable-ofd-btn';
                    btn.dataset.ofdIdx = ofdIdx;
                    btn.dataset.portNum = i;
                    btn.textContent = i;
                    btn.style.cssText = `padding:4px 10px; border:none; border-radius:6px; cursor:pointer; background:${isConnected ? '#3498db' : '#95a5a6'}; color:white; font-weight:700; font-size:12px; min-width:40px; box-shadow:0 1px 3px rgba(0,0,0,0.15); transition:transform 0.1s;`;
                    btn.onclick = () => selectOFDPort(ofdIdx, i, ofd);

                    if (isConnected) {
                        const mapping = ofd.cableMapping.find(m => m[0] === i);
                        const connLabel = document.createElement('span');
                        connLabel.style.cssText = 'font-size:11px; color:#3498db; margin-left:5px; min-width:30px;';
                        connLabel.textContent = `→${mapping[1]}`;
                        row.appendChild(labelSpan);
                        row.appendChild(btn);
                        row.appendChild(connLabel);
                    } else {
                        row.appendChild(labelSpan);
                        row.appendChild(btn);
                    }

                    portList.appendChild(row);
                }

                section.appendChild(portList);
                leftColumn.appendChild(section);
            });

            // ── 우측: 케이블 컬럼 ──
            const rightColumn = document.createElement('div');
            rightColumn.style.cssText = 'flex:1; border:2px solid #64748b; border-radius:8px; overflow:hidden; position:relative; z-index:2;';

            const rightHeader = document.createElement('div');
            rightHeader.style.cssText = 'padding:0 16px; background:#475569; color:white; font-weight:700; font-size:14px; height:48px; display:flex; justify-content:space-between; align-items:center;';
            rightHeader.innerHTML = `<span>${cable.cores}C 케이블</span>
                <button onclick="autoCableMapping()" style="padding:5px 12px; background:rgba(255,255,255,0.15); color:white; border:1px solid rgba(255,255,255,0.25); border-radius:6px; cursor:pointer; font-weight:600; font-size:12px; transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">⚡ 순서대로 연결</button>`;
            rightColumn.appendChild(rightHeader);

            const cableList = document.createElement('div');
            cableList.style.background = 'white';

            // 모든 OFD의 매핑에서 어떤 케이블 포트가 사용 중인지 수집
            const usedCablePorts = {};
            connectedOFDs.forEach((ofd, ofdIdx) => {
                ofd.cableMapping.forEach(m => {
                    const portLabel = ofd.ports && ofd.ports[m[0]-1] ? (ofd.ports[m[0]-1].label || '') : '';
                    usedCablePorts[m[1]] = { ofdIdx, ofdPort: m[0], ofd, portLabel };
                });
            });

            // 튜브 색상: 전역 wireMapTubeColors 사용
            const tubeColorMap = wireMapTubeColors;

            for (let i = 1; i <= cable.cores; i++) {
                const isUsed = usedCablePorts[i];
                const tubeNum = Math.ceil(i / 12);
                const tc = tubeColorMap[(tubeNum - 1) % 12];

                // 튜브 시작 라벨
                if ((i - 1) % 12 === 0) {
                    const end = Math.min(i + 11, cable.cores);
                    const tubeLabel = document.createElement('div');
                    const isOfdBoundary = i > 1 && (i - 1) % 72 === 0;
                    // 경계면 spacer div를 앞에 추가 (높이는 렌더링 후 동적 계산)
                    if (isOfdBoundary) {
                        const spacer = document.createElement('div');
                        spacer.className = 'ofd-boundary-spacer';
                        spacer.dataset.ofdIdx = Math.floor((i - 1) / 72); // 몇 번째 경계인지
                        cableList.appendChild(spacer);
                    }
                    tubeLabel.style.cssText = `padding:4px 12px; background:${tc.bg}; font-size:11px; font-weight:700; color:${tc.text}; border-top:2px solid ${tc.border}; border-bottom:1px solid ${tc.border}; letter-spacing:0.2px;`;
                    tubeLabel.textContent = `튜브 ${tubeNum} ${tc.name}  (${i}~${end}번)`;
                    cableList.appendChild(tubeLabel);
                }

                const row = document.createElement('div');
                row.style.cssText = `display:flex; align-items:center; padding:5px 10px; border-bottom:${i % 12 === 0 || i === cable.cores ? 'none' : `1px solid ${tc.border}18`}; min-height:40px; background:${tc.bg};`;

                const btn = document.createElement('button');
                btn.id = `cable-port-${i}`;
                btn.className = 'cable-core-btn';
                btn.dataset.cablePort = i;
                btn.textContent = i;

                const coreIdx = (i - 1) % 12;
                const coreColor = wireMapCoreColors[coreIdx];
                const textColor = [8,9,10,11].includes(coreIdx) ? '#333' : 'white';

                btn.style.cssText = `padding:4px 10px; border:none; border-radius:6px; cursor:pointer; background:${coreColor}; color:${textColor}; font-weight:700; font-size:12px; min-width:40px; box-shadow:0 1px 3px rgba(0,0,0,0.15); transition:transform 0.1s,box-shadow 0.1s;`;
                btn.onmouseenter = function() { this.style.transform='scale(1.08)'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.25)'; };
                btn.onmouseleave = function() { this.style.transform='none'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.15)'; };
                btn.onclick = () => selectCablePort(i);

                const labelSpan = document.createElement('span');
                labelSpan.style.cssText = 'flex:1; font-size:12.5px; color:#334155; margin-left:8px;';

                if (isUsed) {
                    const u = isUsed;
                    const ofdDisplayName = u.ofd.customName ? `${escapeHtml(u.ofd.name)}(${escapeHtml(u.ofd.customName)})` : escapeHtml(u.ofd.name);
                    // 실제 선번(라벨)이 있으면 우선 표시, 없으면 'OFD명 N번' 표시
                    const displayText = u.portLabel ? escapeHtml(u.portLabel) : `${ofdDisplayName} ${u.ofdPort}번`;
                    labelSpan.innerHTML = `<span style="color:#3498db;">${displayText}</span>`;
                }

                row.appendChild(btn);
                row.appendChild(labelSpan);
                cableList.appendChild(row);
            }

            rightColumn.appendChild(cableList);

            container.appendChild(leftColumn);
            container.appendChild(rightColumn);
            content.appendChild(container);

            setTimeout(() => {
                updateCableConnectionLines();
                // OFD 경계 spacer 높이 동적 계산
                document.querySelectorAll('.ofd-boundary-spacer').forEach(spacer => {
                    const ofdIdx = parseInt(spacer.dataset.ofdIdx); // 0-based: 0=첫번째경계(OFD-A끝)
                    // ofdIdx번째 OFD 섹션의 다음 OFD 헤더+튜브라벨 위치 찾기
                    const ofdHeaders = leftColumn.querySelectorAll('div[style*="background:#667eea"]');
                    const nextHeader = ofdHeaders[ofdIdx + 1]; // 다음 OFD 섹션 헤더
                    if (!nextHeader) return;
                    // 케이블 spacer의 현재 top vs nextHeader의 top 차이로 높이 결정
                    const spacerRect = spacer.getBoundingClientRect();
                    const headerRect = nextHeader.getBoundingClientRect();
                    // 다음 OFD 헤더 바로 아래 튜브라벨까지 내려가야 함
                    const nextTubeLabel = nextHeader.parentElement.querySelector('div[style*="border-top:2px"]');
                    const targetRect = nextTubeLabel ? nextTubeLabel.getBoundingClientRect() : headerRect;
                    const diff = targetRect.top - spacerRect.top;
                    if (diff > 0) spacer.style.height = diff + 'px';
                });
            }, 100);
        }

        // OFD 포트 선택
        function selectOFDPort(ofdIdx, portNum, ofd) {
            const cable = currentCableWireMapCable;
            // 이미 연결된 경우 → 연결 해제
            const existingIdx = ofd.cableMapping.findIndex(m => m[0] === portNum);
            if (existingIdx !== -1) {
                ofd.cableMapping.splice(existingIdx, 1);
                selectedOFDPort = null;
                saveCableWireMap();
                renderCableWireMap(cable);
                showStatus(`OFD 포트 ${portNum}번 연결이 해제되었습니다`);
                return;
            }

            // 새로 선택
            selectedOFDPort = { ofdIdx, portNum, ofd };

            // 모든 OFD 버튼 색상 업데이트
            document.querySelectorAll('.cable-ofd-btn').forEach(btn => {
                const bOfdIdx = parseInt(btn.dataset.ofdIdx);
                const bPort = parseInt(btn.dataset.portNum);
                const bOfd = selectedNode.ofds.filter(o => o.connectedCable === cable.id)[bOfdIdx];
                const isConn = bOfd && bOfd.cableMapping.some(m => m[0] === bPort);

                if (bOfdIdx === ofdIdx && bPort === portNum) {
                    btn.style.background = '#e67e22';
                    btn.style.borderColor = '#e67e22';
                } else if (isConn) {
                    btn.style.background = '#3498db';
                    btn.style.borderColor = '#3498db';
                } else {
                    btn.style.background = '#95a5a6';
                    btn.style.borderColor = '#95a5a6';
                }
            });

            showStatus(`OFD 포트 ${portNum}번 선택됨. 케이블 포트를 클릭하세요.`);
        }

        // 케이블 포트 선택
        function selectCablePort(cablePort) {
            if (!selectedOFDPort) {
                showStatus('먼저 OFD 포트를 클릭하세요');
                return;
            }

            const cable = currentCableWireMapCable;
            const { ofdIdx, portNum, ofd } = selectedOFDPort;

            // 같은 케이블 포트에 이미 다른 OFD 포트가 연결된 경우 해제
            const connectedOFDs = selectedNode.ofds.filter(o => o.connectedCable === cable.id);
            connectedOFDs.forEach(o => {
                o.cableMapping = o.cableMapping.filter(m => m[1] !== cablePort);
            });

            // 연결 추가
            ofd.cableMapping.push([portNum, cablePort]);

            selectedOFDPort = null;
            saveCableWireMap();
            renderCableWireMap(cable);
            showStatus(`OFD 포트 ${portNum}번 → 케이블 ${cablePort}번 연결됨`);
        }

        // 순서대로 자동 연결
        function autoCableMapping() {
            const cable = currentCableWireMapCable;
            const connectedOFDs = selectedNode.ofds.filter(ofd => ofd.connectedCable === cable.id);

            // 초기화
            connectedOFDs.forEach(ofd => { ofd.cableMapping = []; });

            let cablePort = 1;
            connectedOFDs.forEach(ofd => {
                for (let p = 1; p <= 72 && cablePort <= cable.cores; p++, cablePort++) {
                    ofd.cableMapping.push([p, cablePort]);
                }
            });

            saveCableWireMap();
            renderCableWireMap(cable);
            showStatus('순서대로 자동 연결되었습니다');
        }

        // 케이블 직선도 데이터 저장
        function saveCableWireMap() {
            const idx = nodes.findIndex(n => n.id === selectedNode.id);
            if (idx !== -1) nodes[idx] = selectedNode;
            saveData();
        }

        // SVG 연결선 그리기 (직선 - 스크롤 보정 포함)
        function updateCableConnectionLines() {
            const svg = document.getElementById('cableSvg');
            if (!svg) return;
            svg.innerHTML = '';

            const cable = currentCableWireMapCable;
            if (!cable) return;
            const connectedOFDs = selectedNode.ofds.filter(ofd => ofd.connectedCable === cable.id);

            const scrollContainer = document.getElementById('cableWireMapContent');
            const containerRect = scrollContainer.getBoundingClientRect();
            const scrollTop = scrollContainer.scrollTop;
            const scrollLeft = scrollContainer.scrollLeft;

            svg.setAttribute('width', scrollContainer.scrollWidth);
            svg.setAttribute('height', scrollContainer.scrollHeight);

            connectedOFDs.forEach((ofd, ofdIdx) => {
                ofd.cableMapping.forEach(([ofdPort, cablePort]) => {
                    const fromBtn = document.getElementById(`ofd-${ofdIdx}-${ofdPort}`);
                    const toBtn = document.getElementById(`cable-port-${cablePort}`);
                    if (!fromBtn || !toBtn) return;

                    const fromRect = fromBtn.getBoundingClientRect();
                    const toRect = toBtn.getBoundingClientRect();

                    const x1 = fromRect.right - containerRect.left + scrollLeft;
                    const y1 = fromRect.top + fromRect.height / 2 - containerRect.top + scrollTop;
                    const x2 = toRect.left - containerRect.left + scrollLeft;
                    const y2 = toRect.top + toRect.height / 2 - containerRect.top + scrollTop;

                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', x1);
                    line.setAttribute('y1', y1);
                    line.setAttribute('x2', x2);
                    line.setAttribute('y2', y2);
                    line.setAttribute('stroke', '#e67e22');
                    line.setAttribute('stroke-width', '1.5');
                    line.setAttribute('opacity', '0.85');
                    svg.appendChild(line);
                });
            });
        }

        // 케이블 직선도 닫기
        function closeCableWireMap() {
            document.getElementById('cableWireMapModal').classList.remove('active');
            document.getElementById('ofdModal').classList.add('active');
            selectedOFDPort = null;
        }
        
        // ==================== 케이블 직선도 함수 끝 ====================
        
        // ==================== 직선도 함수 끝 ====================

        // ==================== 데이터 백업(내보내기/불러오기) 기능 ====================

        // 데이터 파일로 내보내기 (Blob 방식 - data URI 크기 제한 없음)
        function resetAllData() {
            // 1단계 확인
            showConfirm(
                '⚠️ 전체 데이터 초기화',
                () => {
                    // 2단계 최종 확인
                    showConfirm(
                        '정말로 모든 장비와 연결 데이터를 삭제하시겠습니까?',
                        () => {
                            localStorage.removeItem('fiberNodes');
                            localStorage.removeItem('fiberConnections');
                            localStorage.removeItem('fiberDataVersion');
                            nodes = [];
                            connections = [];
                            // markers는 {nodeId: marker} 객체
                            Object.values(markers).forEach(m => map.removeLayer(m));
                            polylines.forEach(item => {
                                if (item.line) map.removeLayer(item.line);
                                if (item.label) map.removeLayer(item.label);
                                if (item.marker) map.removeLayer(item.marker);
                            });
                            markers = {};
                            polylines = [];
                            showStatus('모든 데이터가 초기화되었습니다');
                        },
                        '이 작업은 되돌릴 수 없습니다.',
                        '전체 삭제'
                    );
                },
                '진행 전 💾 내보내기로 백업을 권장합니다.',
                '계속'
            );
        }

        function exportData() {
            if (nodes.length === 0) {
                showStatus('내보낼 데이터가 없습니다.');
                return;
            }

            const data = { nodes: nodes, connections: connections };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const date = new Date();
            const dateString = date.getFullYear().toString() +
                               (date.getMonth() + 1).toString().padStart(2, '0') +
                               date.getDate().toString().padStart(2, '0');

            const a = document.createElement('a');
            a.href = url;
            a.download = 'fiber_backup_' + dateString + '.json';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showStatus('데이터가 다운로드 폴더에 저장되었습니다.');
        }

        // 데이터 파일 불러오기
        function importData(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);

                    if (Array.isArray(importedData.nodes) && Array.isArray(importedData.connections)) {
                        showConfirm(
                            '데이터를 불러오시겠습니까?',
                            () => {
                                nodes = importedData.nodes;
                                connections = importedData.connections;
                                saveData();

                                for (let id in markers) {
                                    map.removeLayer(markers[id]);
                                }
                                markers = {};

                                polylines.forEach(item => {
                                    if (item.line) map.removeLayer(item.line);
                                    if (item.label) map.removeLayer(item.label);
                                    if (item.marker) map.removeLayer(item.marker);
                                });
                                polylines = [];

                                renderAllNodes();
                                renderAllConnections();

                                // 열려있는 모든 모달 닫기 + 선택 상태 초기화
                                document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
                                selectedNode = null;
                                connectingFromNode = null;
                                connectingMode = false;

                                event.target.value = '';
                                showStatus('데이터를 성공적으로 불러왔습니다.');
                            },
                            '현재 데이터는 지워지고 파일 데이터로 덮어씌워집니다.',
                            '불러오기'
                        );
                    } else {
                        event.target.value = '';
                        showStatus('올바른 광케이블 백업 파일(.json)이 아닙니다.');
                    }
                } catch (error) {
                    event.target.value = '';
                    showStatus('파일을 읽는 중 오류가 발생했습니다.');
                }
            };
            reader.readAsText(file);
        }

        // ==================== 데이터 백업 기능 끝 ====================

        // 초기화는 cable_map.html의 kakao.maps.load 콜백에서 실행
    