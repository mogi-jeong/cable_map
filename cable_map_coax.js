// ==================== 동축 셀 시스템 (coax.js) ====================
// ONU 기반 동축 셀망 장비 배치 및 관리
// 의존: cable_map_map.js (addNode, renderNode, nodes, map 등)

// ── 동축 장비 정의 ──

var COAX_EQUIP_TYPES = {
    // 전원 계통
    'coax_pi':   { label: 'PI',    category: 'power',  gongga: '7', color: '#2196F3' },
    'coax_ups':  { label: 'UPS',   category: 'power',  gongga: '1', color: '#2196F3' },
    'coax_ps':   { label: 'PS',    category: 'power',  gongga: '2', color: '#2196F3' },
    // 증폭기
    'coax_tba':  { label: 'TBA',   category: 'amp',    gongga: '4', color: '#F44336' },
    'coax_tda':  { label: 'TDA',   category: 'amp',    gongga: '4', color: '#F44336' },
    'coax_ea':   { label: 'EA',    category: 'amp',    gongga: '4', color: '#F44336' },
    // 분배기
    'coax_2sp':  { label: '2분배', category: 'split',  gongga: '7', color: '#4CAF50' },
    'coax_3sp':  { label: '3분배', category: 'split',  gongga: '7', color: '#4CAF50' },
    'coax_dc08': { label: 'DC08',  category: 'split',  gongga: '7', color: '#FF9800' },
    // 탭
    'coax_tap8': { label: '8TAP',  category: 'tap',    gongga: '5', color: '#9C27B0' },
    'coax_tap4': { label: '4TAP',  category: 'tap',    gongga: '5', color: '#9C27B0' }
};

// 탭 수치 옵션
var COAX_TAP_VALUES = {
    'coax_tap8': ['8-23', '8-20', '8-17', '8-14', '8-11'],
    'coax_tap4': ['4-20', '4-17', '4-14', '4-11', '4-08']
};

// 장비 상태
var COAX_STATUS = {
    'new':      { label: '신설', color: '#e53935' },
    'existing': { label: '기설', color: '#1a6fd4' },
    'removed':  { label: '철거', color: '#333' }
};

// ── 상태 변수 ──

var _coaxPanelVisible = false;
var _coaxPlacingType = null;     // 현재 배치 중인 장비 타입
var _coaxPlacingStatus = 'new';  // 신설/기설/철거
var _coaxActiveOnu = null;       // 현재 작업 중인 ONU 노드

// ── 동축 장비 타입 판별 ──

function isCoaxType(type) {
    return type && type.indexOf('coax_') === 0;
}

// ── ONU 포트별 위경도 오프셋 ──
// ONU 심볼 크기: 44x33px, viewBox 48x36, 중심 앵커
// OUT1=좌상, OUT2=우상, OUT3=좌하, OUT4=우하
// 반환: { lat, lng } — 포트 위치의 실제 위경도
function getOnuPortLatLng(onuNode, portNum) {
    if (!portNum || !map) return { lat: onuNode.lat, lng: onuNode.lng };
    // 심볼 반크기 (중심 기준 오프셋, px)
    var halfW = 22, halfH = 16.5;
    // 포트별 px 오프셋 (중심 기준)
    var offsets = {
        1: { dx: -halfW, dy: -halfH },  // 좌상
        2: { dx:  halfW, dy: -halfH },  // 우상
        3: { dx: -halfW, dy:  halfH },  // 좌하
        4: { dx:  halfW, dy:  halfH }   // 우하
    };
    var off = offsets[portNum];
    if (!off) return { lat: onuNode.lat, lng: onuNode.lng };

    // 노드 중심의 화면 좌표
    var centerPt = map.latLngToLayerPoint({ lat: onuNode.lat, lng: onuNode.lng });
    // 포트 위치 화면 좌표
    var portPt = { x: centerPt.x + off.dx, y: centerPt.y + off.dy };
    // 위경도로 역변환
    var portLatLng = map.containerPointToLatLng(portPt);
    return { lat: portLatLng.lat, lng: portLatLng.lng };
}

// ── 패널 토글 ──

function toggleCoaxPanel() {
    var panel = document.getElementById('coaxPanel');
    if (!panel) return;
    _coaxPanelVisible = !_coaxPanelVisible;
    panel.style.display = _coaxPanelVisible ? 'block' : 'none';
    var btn = document.getElementById('coaxPanelBtn');
    if (btn) btn.classList.toggle('active', _coaxPanelVisible);
}

// ── 동축 장비 컨텍스트 메뉴 (우클릭 시 커서 옆에 표시) ──

function showCoaxEquipMenu(screenX, screenY, lat, lng) {
    // 기존 메뉴 제거
    var old = document.getElementById('coaxEquipMenu');
    if (old) old.remove();

    var menu = document.createElement('div');
    menu.id = 'coaxEquipMenu';
    menu.style.cssText = 'position:fixed; left:' + screenX + 'px; top:' + screenY + 'px; background:white; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.25); z-index:99999; min-width:160px; overflow:hidden; font-family:"Segoe UI",sans-serif; font-size:12px; user-select:none;';

    // 우클릭 위치 저장
    var _menuLat = lat;
    var _menuLng = lng;

    // 장비 카테고리별 항목
    var categories = [
        { label: '증폭기', items: ['coax_tba', 'coax_tda', 'coax_ea'] },
        { label: '분배기', items: ['coax_2sp', 'coax_3sp', 'coax_dc08'] },
        { label: '탭',     items: ['coax_tap8', 'coax_tap4'] },
        { label: '전원',   items: ['coax_pi', 'coax_ups', 'coax_ps'] }
    ];

    // 장비별 미니 SVG 심볼 생성
    // 컨텍스트 메뉴용 미니 심볼 (한마루 스타일)
    var _S = 18;
    function _miniSvg(typeKey) {
        // 증폭기
        if (typeKey === 'coax_tba') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<clipPath id="mtL"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
                '<clipPath id="mtR"><rect x="11" y="0" width="11" height="22"/></clipPath>' +
                '<circle cx="11" cy="11" r="9" fill="#e53935" clip-path="url(#mtL)"/>' +
                '<circle cx="11" cy="11" r="9" fill="#1a6fd4" clip-path="url(#mtR)"/>' +
                '<circle cx="11" cy="11" r="9" fill="none" stroke="#333" stroke-width="1.5"/></svg>';
        }
        if (typeKey === 'coax_tda') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<clipPath id="mdL"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
                '<clipPath id="mdR"><rect x="11" y="0" width="11" height="22"/></clipPath>' +
                '<circle cx="11" cy="11" r="9" fill="#1a6fd4" clip-path="url(#mdL)"/>' +
                '<circle cx="11" cy="11" r="9" fill="#2E7D32" clip-path="url(#mdR)"/>' +
                '<circle cx="11" cy="11" r="9" fill="none" stroke="#333" stroke-width="1.5"/></svg>';
        }
        if (typeKey === 'coax_ea') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<clipPath id="meL"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
                '<circle cx="11" cy="11" r="9" fill="#e53935" clip-path="url(#meL)"/>' +
                '<circle cx="11" cy="11" r="9" fill="none" stroke="#333" stroke-width="1.5"/></svg>';
        }
        // 분배기
        if (typeKey === 'coax_2sp') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<circle cx="11" cy="11" r="9" fill="#1a6fd4"/>' +
                '<circle cx="11" cy="11" r="9" fill="none" stroke="#1a6fd4" stroke-width="2"/></svg>';
        }
        if (typeKey === 'coax_3sp') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<clipPath id="m3L"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
                '<clipPath id="m3R"><rect x="11" y="0" width="11" height="22"/></clipPath>' +
                '<circle cx="11" cy="11" r="9" fill="#e53935" clip-path="url(#m3L)"/>' +
                '<circle cx="11" cy="11" r="9" fill="#1a6fd4" clip-path="url(#m3R)"/>' +
                '<circle cx="11" cy="11" r="9" fill="none" stroke="#e53935" stroke-width="2"/></svg>';
        }
        if (typeKey === 'coax_dc08') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<clipPath id="mcL"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
                '<clipPath id="mcR"><rect x="11" y="0" width="11" height="22"/></clipPath>' +
                '<circle cx="11" cy="11" r="9" fill="#e53935" clip-path="url(#mcL)"/>' +
                '<circle cx="11" cy="11" r="9" fill="#1a6fd4" clip-path="url(#mcR)"/>' +
                '<circle cx="11" cy="11" r="9" fill="none" stroke="#333" stroke-width="1.5"/></svg>';
        }
        // 탭
        if (typeKey === 'coax_tap8') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<polygon points="11,1 20,5.5 20,16.5 11,21 2,16.5 2,5.5" fill="#9C27B0" stroke="#333" stroke-width="1.5"/></svg>';
        }
        if (typeKey === 'coax_tap4') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<rect x="2" y="2" width="18" height="18" rx="1" fill="#9C27B0" stroke="#333" stroke-width="1.5"/></svg>';
        }
        // 전원
        if (typeKey === 'coax_pi') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<rect x="2" y="2" width="18" height="6" fill="#e53935" stroke="#333" stroke-width="1"/>' +
                '<rect x="2" y="8" width="18" height="6" fill="#FFD600" stroke="#333" stroke-width="1"/>' +
                '<rect x="2" y="14" width="18" height="6" fill="#2E7D32" stroke="#333" stroke-width="1"/></svg>';
        }
        if (typeKey === 'coax_ups') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<rect x="2" y="2" width="18" height="18" rx="2" fill="white" stroke="#e53935" stroke-width="2"/>' +
                '<path d="M12,4 L8,12 L11,12 L10,18 L14,10 L11,10 Z" fill="#e53935"/></svg>';
        }
        if (typeKey === 'coax_ps') {
            return '<svg width="'+_S+'" height="'+_S+'" viewBox="0 0 22 22">' +
                '<rect x="2" y="2" width="18" height="18" rx="2" fill="white" stroke="#1a6fd4" stroke-width="2"/>' +
                '<path d="M12,4 L8,12 L11,12 L10,18 L14,10 L11,10 Z" fill="#1a6fd4"/></svg>';
        }
        return '';
    }

    categories.forEach(function(cat) {
        var catLabel = document.createElement('div');
        catLabel.textContent = cat.label;
        catLabel.style.cssText = 'padding:5px 12px 2px; font-size:10px; font-weight:bold; color:#999;';
        menu.appendChild(catLabel);

        cat.items.forEach(function(typeKey) {
            var def = COAX_EQUIP_TYPES[typeKey];
            var item = document.createElement('div');
            item.style.cssText = 'padding:5px 12px 5px 16px; cursor:pointer; display:flex; align-items:center; gap:8px;';
            item.onmouseenter = function() { item.style.background = '#f5f5f5'; };
            item.onmouseleave = function() { item.style.background = 'white'; };

            var svgWrap = document.createElement('span');
            svgWrap.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; width:22px; height:20px;';
            svgWrap.innerHTML = _miniSvg(typeKey);
            item.appendChild(svgWrap);

            var txt = document.createElement('span');
            txt.textContent = def.label;
            txt.style.cssText = 'color:#333; font-weight:600; font-size:12px;';
            item.appendChild(txt);

            item.onclick = function() {
                closeCoaxEquipMenu();
                // 케이블 그리는 중이면 장비 생성 + 자동 IN 연결
                if (window.connectingMode && window.coaxAutoConnectEquip) {
                    // 탭이면 탭 수치 선택 후 연결
                    if (typeKey === 'coax_tap8' || typeKey === 'coax_tap4') {
                        _coaxShowTapMenuForAutoConnect(typeKey, _menuLat, _menuLng);
                    } else {
                        window.coaxAutoConnectEquip(typeKey, _menuLat, _menuLng, '');
                    }
                } else {
                    coaxStartPlacing(typeKey);
                }
            };
            menu.appendChild(item);
        });
    });

    document.body.appendChild(menu);

    // 화면 밖으로 넘어가면 위치 보정
    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (screenX - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (screenY - rect.height) + 'px';

    // 바깥 클릭 시 닫기
    setTimeout(function() {
        document.addEventListener('mousedown', _coaxEquipMenuOutside);
    }, 0);
}

function _coaxEquipMenuOutside(e) {
    var menu = document.getElementById('coaxEquipMenu');
    if (menu && !menu.contains(e.target)) {
        closeCoaxEquipMenu();
    }
}

function closeCoaxEquipMenu() {
    var menu = document.getElementById('coaxEquipMenu');
    if (menu) menu.remove();
    document.removeEventListener('mousedown', _coaxEquipMenuOutside);
}

// 탭 수치 선택 후 자동 연결 (컨텍스트 메뉴에서 탭 선택 시)
function _coaxShowTapMenuForAutoConnect(typeKey, lat, lng) {
    var values = COAX_TAP_VALUES[typeKey] || [];
    var html = '<div style="text-align:center;padding:20px;">';
    html += '<h3 style="margin:0 0 16px;font-size:16px;color:#333;">탭 수치 선택</h3>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">';
    values.forEach(function(v) {
        html += '<button onclick="coaxConfirmTapAutoConnect(\'' + typeKey + '\',' + lat + ',' + lng + ',\'' + v + '\')" style="padding:10px 18px;border:2px solid #9C27B0;border-radius:8px;background:white;cursor:pointer;font-size:14px;font-weight:bold;color:#9C27B0;transition:all 0.15s;"';
        html += ' onmouseover="this.style.background=\'#9C27B0\';this.style.color=\'white\'"';
        html += ' onmouseout="this.style.background=\'white\';this.style.color=\'#9C27B0\'"';
        html += '>' + v + '</button>';
    });
    html += '</div>';
    html += '<button onclick="coaxCloseTapModal()" style="margin-top:16px;padding:8px 24px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;cursor:pointer;font-size:13px;">취소</button>';
    html += '</div>';

    var modal = document.getElementById('coaxTapModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'coaxTapModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10010;display:flex;justify-content:center;align-items:center;';
        document.body.appendChild(modal);
    }
    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);min-width:260px;';
    box.innerHTML = html;
    modal.innerHTML = '';
    modal.appendChild(box);
    modal.style.display = 'flex';
}

function coaxConfirmTapAutoConnect(typeKey, lat, lng, tapValue) {
    coaxCloseTapModal();
    if (window.coaxAutoConnectEquip) {
        window.coaxAutoConnectEquip(typeKey, lat, lng, tapValue);
    }
}

// ── ONU OUT 포트 선택 모달 ──

function showOnuPortSelect(onuNode) {
    closeMenuModal();

    // ONU에서 나가는 케이블(OUT) 조사 → 포트별 사용 상태
    var portUsed = {}; // { 1: '장비명', 2: null, ... }
    for (var p = 1; p <= 4; p++) portUsed[p] = null;

    connections.forEach(function(c) {
        if (c.nodeA === onuNode.id || c.nodeB === onuNode.id) {
            var dir = onuNode.connDirections && onuNode.connDirections[c.id];
            if (dir === 'out' && c.outPort) {
                var toId = c.nodeA === onuNode.id ? c.nodeB : c.nodeA;
                var toNode = nodes.find(function(n) { return n.id === toId; });
                portUsed[c.outPort] = toNode ? (toNode.name || toNode.type) : '사용중';
            }
        }
    });

    // 모달 생성
    var modal = document.getElementById('onuPortModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'onuPortModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10010;display:flex;justify-content:center;align-items:center;';
        document.body.appendChild(modal);
    }

    var html = '<div style="background:white;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);min-width:240px;padding:20px;text-align:center;">';
    html += '<h3 style="margin:0 0 16px;font-size:15px;color:#333;">ONU OUT 포트 선택</h3>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';

    for (var i = 1; i <= 4; i++) {
        var used = portUsed[i];
        var bgColor = used ? '#f0f0f0' : '#fff';
        var borderColor = used ? '#ccc' : '#FF6D00';
        var textColor = used ? '#999' : '#FF6D00';
        var cursor = used ? 'default' : 'pointer';
        var subText = used ? '<div style="font-size:9px;color:#999;margin-top:2px;">' + used + '</div>' : '';

        html += '<div onclick="' + (used ? '' : 'onuPortSelected(' + i + ')') + '" style="' +
            'padding:12px 8px;border:2px solid ' + borderColor + ';border-radius:8px;' +
            'background:' + bgColor + ';cursor:' + cursor + ';transition:all 0.15s;' +
            '"' +
            (!used ? ' onmouseover="this.style.background=\'#FFF3E0\'" onmouseout="this.style.background=\'white\'"' : '') +
            '>' +
            '<div style="font-size:16px;font-weight:bold;color:' + textColor + ';">OUT ' + i + '</div>' +
            subText +
            '</div>';
    }

    html += '</div>';
    html += '<button onclick="closeOnuPortModal()" style="margin-top:14px;padding:8px 24px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;cursor:pointer;font-size:13px;">취소</button>';
    html += '</div>';

    modal.innerHTML = html;
    modal.style.display = 'flex';

    // 선택한 ONU 임시 저장
    window._onuPortPendingNode = onuNode;
}

function onuPortSelected(portNum) {
    var onuNode = window._onuPortPendingNode;
    closeOnuPortModal();
    if (!onuNode) return;

    // 선택한 포트 번호를 임시 저장 → 케이블 생성 시 사용
    window._coaxCurrentOutPort = portNum;

    // selectedNode 설정 후 startConnecting 호출
    selectedNode = onuNode;
    startConnecting();
}

function closeOnuPortModal() {
    var modal = document.getElementById('onuPortModal');
    if (modal) modal.style.display = 'none';
    window._onuPortPendingNode = null;
}

// ── ONU 선택 → 셀 모드 진입 ──

function coaxSelectOnu(onuNode) {
    _coaxActiveOnu = onuNode;
    var label = document.getElementById('coaxOnuLabel');
    if (label) label.textContent = onuNode.name || 'ONU';
    // 패널 열기
    if (!_coaxPanelVisible) toggleCoaxPanel();
    showStatus('셀 모드: ' + (onuNode.name || 'ONU') + ' — 장비를 선택 후 전주를 클릭하세요');
}

// ── 장비 배치 모드 시작 ──

function coaxStartPlacing(equipType) {
    if (!_coaxActiveOnu) {
        showStatus('먼저 ONU를 선택해주세요 (지도에서 ONU 클릭)');
        return;
    }
    _coaxPlacingType = equipType;
    // 패널 내 버튼 활성화 표시
    _coaxHighlightBtn(equipType);
    var def = COAX_EQUIP_TYPES[equipType];
    showStatus('배치: ' + def.label + ' (' + COAX_STATUS[_coaxPlacingStatus].label + ') — 전주를 클릭하세요 (ESC 취소)');
}

// ── 장비 배치 취소 ──

function coaxCancelPlacing() {
    _coaxPlacingType = null;
    _coaxClearHighlight();
    hideStatus();
}

// ── 전주 클릭 시 장비 배치 ──

function coaxPlaceOnPole(poleNode) {
    if (!_coaxPlacingType || !_coaxActiveOnu) return false;

    var def = COAX_EQUIP_TYPES[_coaxPlacingType];
    if (!def) return false;

    // 탭일 경우 수치 선택 모달
    if (_coaxPlacingType === 'coax_tap8' || _coaxPlacingType === 'coax_tap4') {
        _coaxShowTapModal(poleNode);
        return true;
    }

    _coaxDoPlace(poleNode, '');
    return true;
}

// ── 실제 배치 실행 ──

function _coaxDoPlace(poleNode, tapValue) {
    var equipNode = {
        id: 'coax_' + Date.now().toString(),
        type: _coaxPlacingType,
        lat: poleNode.lat,
        lng: poleNode.lng,
        name: tapValue || COAX_EQUIP_TYPES[_coaxPlacingType].label,
        memo: '',
        snappedPoleId: poleNode.id,
        parentOnu: _coaxActiveOnu.id,
        coaxStatus: _coaxPlacingStatus,  // new/existing/removed
        ofds: [], ports: [], rns: [], inOrder: [], connDirections: {}
    };

    nodes.push(equipNode);
    saveData();
    // 같은 전주의 동축 장비 오프셋 재계산을 위해 전체 리렌더
    rerenderCoaxNodes();

    var statusLabel = COAX_STATUS[_coaxPlacingStatus].label;
    showStatus(COAX_EQUIP_TYPES[_coaxPlacingType].label + ' ' + statusLabel + ' 배치 완료 — 계속 전주를 클릭하거나 ESC로 취소');
}

// ── 탭 수치 선택 모달 ──

function _coaxShowTapModal(poleNode) {
    var values = COAX_TAP_VALUES[_coaxPlacingType] || [];
    var html = '<div style="text-align:center;padding:20px;">';
    html += '<h3 style="margin:0 0 16px;font-size:16px;color:#333;">탭 수치 선택</h3>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">';
    values.forEach(function(v) {
        html += '<button onclick="coaxConfirmTap(\'' + v + '\')" style="padding:10px 18px;border:2px solid #9C27B0;border-radius:8px;background:white;cursor:pointer;font-size:14px;font-weight:bold;color:#9C27B0;transition:all 0.15s;"';
        html += ' onmouseover="this.style.background=\'#9C27B0\';this.style.color=\'white\'"';
        html += ' onmouseout="this.style.background=\'white\';this.style.color=\'#9C27B0\'"';
        html += '>' + v + '</button>';
    });
    html += '</div>';
    html += '<button onclick="coaxCloseTapModal()" style="margin-top:16px;padding:8px 24px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;cursor:pointer;font-size:13px;">취소</button>';
    html += '</div>';

    var modal = document.getElementById('coaxTapModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'coaxTapModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10010;display:flex;justify-content:center;align-items:center;';
        document.body.appendChild(modal);
    }
    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);min-width:260px;';
    box.innerHTML = html;
    modal.innerHTML = '';
    modal.appendChild(box);
    modal.style.display = 'flex';

    // 선택 대기를 위해 poleNode 임시 저장
    window._coaxTapPendingPole = poleNode;
}

function coaxConfirmTap(value) {
    var poleNode = window._coaxTapPendingPole;
    coaxCloseTapModal();
    if (poleNode) {
        _coaxDoPlace(poleNode, value);
    }
}

function coaxCloseTapModal() {
    var modal = document.getElementById('coaxTapModal');
    if (modal) modal.style.display = 'none';
    window._coaxTapPendingPole = null;
}

// ── 상태 전환 (신설/기설/철거) ──

function coaxSetStatus(status) {
    _coaxPlacingStatus = status;
    // 버튼 활성화 갱신
    var btns = document.querySelectorAll('.coax-status-btn');
    btns.forEach(function(b) {
        b.classList.toggle('active', b.dataset.status === status);
    });
}

// ── 패널 내 버튼 하이라이트 ──

function _coaxHighlightBtn(equipType) {
    _coaxClearHighlight();
    var btn = document.querySelector('.coax-equip-btn[data-type="' + equipType + '"]');
    if (btn) btn.classList.add('active');
}

function _coaxClearHighlight() {
    var btns = document.querySelectorAll('.coax-equip-btn.active');
    btns.forEach(function(b) { b.classList.remove('active'); });
}

// ── 동축 장비 마커 HTML 생성 ──

// 탭 수치 → 색상 매핑
var TAP_VALUE_COLORS = {
    '08': '#e53935', '11': '#FFD600', '14': '#ffffff',
    '17': '#1a6fd4', '20': '#2E7D32', '23': '#FF9800'
};

function _getTapColor(name) {
    // name: "8-17", "4-11" 등 → 뒤 2자리로 색상 결정
    if (!name) return '#999';
    var m = name.match(/(\d{2})$/);
    if (m && TAP_VALUE_COLORS[m[1]]) return TAP_VALUE_COLORS[m[1]];
    return '#999';
}

function getCoaxMarkerHTML(type, name, coaxStatus) {
    var def = COAX_EQUIP_TYPES[type];
    if (!def) return '';
    var label = name || def.label;
    // 줌 레벨에 따라 심볼 크기 동적 조절 (zoom = 18 - kakaoLevel)
    var zoom = (map && map.getZoom) ? map.getZoom() : 15;
    var S = zoom >= 17 ? 18 : zoom >= 16 ? 16 : zoom >= 15 ? 14 : zoom >= 14 ? 12 : 8;
    var FS = zoom >= 17 ? 8 : zoom >= 16 ? 7 : zoom >= 15 ? 7 : zoom >= 14 ? 6 : 5; // 라벨 폰트

    // ── 증폭기: 한마루 스타일 원형 ──
    if (type === 'coax_tba') {
        // TBA: 좌빨 우파 반원
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<clipPath id="tbaL"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
            '<clipPath id="tbaR"><rect x="11" y="0" width="11" height="22"/></clipPath>' +
            '<circle cx="11" cy="11" r="9" fill="#e53935" clip-path="url(#tbaL)"/>' +
            '<circle cx="11" cy="11" r="9" fill="#1a6fd4" clip-path="url(#tbaR)"/>' +
            '<circle cx="11" cy="11" r="9" fill="none" stroke="#333" stroke-width="1.5"/>' +
            '</svg>' +
            '<div style="font-size:'+FS+'px;color:#333;text-align:center;font-weight:bold;white-space:nowrap;position:absolute;left:50%;transform:translateX(-50%);top:'+S+'px;">' + label + '</div>';
    }
    if (type === 'coax_tda') {
        // TDA: 좌파 우초록 반원
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<clipPath id="tdaL"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
            '<clipPath id="tdaR"><rect x="11" y="0" width="11" height="22"/></clipPath>' +
            '<circle cx="11" cy="11" r="9" fill="#1a6fd4" clip-path="url(#tdaL)"/>' +
            '<circle cx="11" cy="11" r="9" fill="#2E7D32" clip-path="url(#tdaR)"/>' +
            '<circle cx="11" cy="11" r="9" fill="none" stroke="#333" stroke-width="1.5"/>' +
            '</svg>' +
            '<div style="font-size:'+FS+'px;color:#333;text-align:center;font-weight:bold;white-space:nowrap;position:absolute;left:50%;transform:translateX(-50%);top:'+S+'px;">' + label + '</div>';
    }
    if (type === 'coax_ea') {
        // EA: 빨간 반원 (왼쪽만)
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<clipPath id="eaL"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
            '<circle cx="11" cy="11" r="9" fill="#e53935" clip-path="url(#eaL)"/>' +
            '<circle cx="11" cy="11" r="9" fill="none" stroke="#333" stroke-width="1.5"/>' +
            '</svg>' +
            '<div style="font-size:'+FS+'px;color:#333;text-align:center;font-weight:bold;white-space:nowrap;position:absolute;left:50%;transform:translateX(-50%);top:'+S+'px;">' + label + '</div>';
    }

    // ── 분배기: 한마루 스타일 원형 ──
    if (type === 'coax_2sp') {
        // 2WAY: 파란 원 + 파란 테두리
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<circle cx="11" cy="11" r="9" fill="#1a6fd4"/>' +
            '<circle cx="11" cy="11" r="9" fill="none" stroke="#1a6fd4" stroke-width="2"/>' +
            '<circle cx="11" cy="11" r="5" fill="#1a6fd4"/>' +
            '</svg>';
    }
    if (type === 'coax_3sp') {
        // 3WAY: 빨+파 원 + 빨 테두리
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<clipPath id="3wL"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
            '<clipPath id="3wR"><rect x="11" y="0" width="11" height="22"/></clipPath>' +
            '<circle cx="11" cy="11" r="9" fill="#e53935" clip-path="url(#3wL)"/>' +
            '<circle cx="11" cy="11" r="9" fill="#1a6fd4" clip-path="url(#3wR)"/>' +
            '<circle cx="11" cy="11" r="9" fill="none" stroke="#e53935" stroke-width="2"/>' +
            '</svg>';
    }
    if (type === 'coax_dc08') {
        // DC08: 빨+파 반반 원
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<clipPath id="dcL"><rect x="0" y="0" width="11" height="22"/></clipPath>' +
            '<clipPath id="dcR"><rect x="11" y="0" width="11" height="22"/></clipPath>' +
            '<circle cx="11" cy="11" r="9" fill="#e53935" clip-path="url(#dcL)"/>' +
            '<circle cx="11" cy="11" r="9" fill="#1a6fd4" clip-path="url(#dcR)"/>' +
            '<circle cx="11" cy="11" r="9" fill="none" stroke="#333" stroke-width="1.5"/>' +
            '</svg>';
    }

    // ── 탭: 수치별 색상 ──
    var tapColor = _getTapColor(name);
    var tapStroke = tapColor === '#ffffff' ? '#333' : tapColor;
    if (type === 'coax_tap8') {
        // 8TAP: 육각형
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<polygon points="11,1 20,5.5 20,16.5 11,21 2,16.5 2,5.5" fill="' + tapColor + '" stroke="' + tapStroke + '" stroke-width="1.5"/>' +
            '</svg>' +
            '<div style="font-size:'+FS+'px;color:#333;text-align:center;font-weight:bold;white-space:nowrap;position:absolute;left:50%;transform:translateX(-50%);top:'+S+'px;">' + label + '</div>';
    }
    if (type === 'coax_tap4') {
        // 4TAP: 사각형
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<rect x="2" y="2" width="18" height="18" rx="1" fill="' + tapColor + '" stroke="' + tapStroke + '" stroke-width="1.5"/>' +
            '</svg>' +
            '<div style="font-size:'+FS+'px;color:#333;text-align:center;font-weight:bold;white-space:nowrap;position:absolute;left:50%;transform:translateX(-50%);top:'+S+'px;">' + label + '</div>';
    }

    // ── 전원 ──
    if (type === 'coax_pi') {
        // PI: 빨+노+초 가로줄 (신호등)
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<rect x="2" y="2" width="18" height="6" fill="#e53935" stroke="#333" stroke-width="1"/>' +
            '<rect x="2" y="8" width="18" height="6" fill="#FFD600" stroke="#333" stroke-width="1"/>' +
            '<rect x="2" y="14" width="18" height="6" fill="#2E7D32" stroke="#333" stroke-width="1"/>' +
            '</svg>';
    }
    if (type === 'coax_ups') {
        // UPS: 빨간 사각형 + 번개
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<rect x="2" y="2" width="18" height="18" rx="2" fill="white" stroke="#e53935" stroke-width="2"/>' +
            '<path d="M12,4 L8,12 L11,12 L10,18 L14,10 L11,10 Z" fill="#e53935"/>' +
            '</svg>';
    }
    if (type === 'coax_ps') {
        // PS: 파란 사각형 + 번개
        return '<svg width="' + S + '" height="' + S + '" viewBox="0 0 22 22">' +
            '<rect x="2" y="2" width="18" height="18" rx="2" fill="white" stroke="#1a6fd4" stroke-width="2"/>' +
            '<path d="M12,4 L8,12 L11,12 L10,18 L14,10 L11,10 Z" fill="#1a6fd4"/>' +
            '</svg>';
    }

    return '';
}

// ── 동축 장비 렌더링 (같은 전주 오프셋 포함) ──

function renderCoaxNode(node) {
    if (!isCoaxType(node.type)) return;

    // 같은 전주에 배치된 다른 동축 장비 수 계산 → 오프셋
    var samePoleSiblings = [];
    var myIndex = 0;
    if (node.snappedPoleId) {
        for (var i = 0; i < nodes.length; i++) {
            if (isCoaxType(nodes[i].type) && nodes[i].snappedPoleId === node.snappedPoleId) {
                if (nodes[i].id === node.id) myIndex = samePoleSiblings.length;
                samePoleSiblings.push(nodes[i]);
            }
        }
    }

    var markerHTML = getCoaxMarkerHTML(node.type, node.name, node.coaxStatus);
    if (!markerHTML) return;

    var icon = L.divIcon({
        html: '<div style="min-width:30px;min-height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;">' + markerHTML + '</div>',
        className: 'coax-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    var marker = L.marker([node.lat, node.lng], {
        icon: icon,
        zIndexOffset: 100
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

// ── 동축 장비 전체 리렌더 ──

function rerenderCoaxNodes() {
    // 기존 동축 마커 제거
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (isCoaxType(n.type) && markers[n.id]) {
            map.removeLayer(markers[n.id]);
            delete markers[n.id];
        }
    }
    // 다시 렌더
    for (var j = 0; j < nodes.length; j++) {
        if (isCoaxType(nodes[j].type)) {
            renderCoaxNode(nodes[j]);
        }
    }
}

// ── 같은 전주 장비 연결 ──

function coaxSamePoleConnect(fromNode) {
    if (!fromNode.snappedPoleId) {
        showStatus('전주에 배치된 장비만 사용 가능합니다');
        return;
    }
    // 같은 전주의 다른 동축 장비 + ONU 찾기
    var siblings = [];
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.id === fromNode.id) continue;
        if (n.snappedPoleId === fromNode.snappedPoleId && (isCoaxType(n.type) || n.type === 'onu')) {
            siblings.push(n);
        }
    }
    if (siblings.length === 0) {
        showStatus('같은 전주에 연결 가능한 장비가 없습니다');
        return;
    }
    // 선택 모달 표시
    _coaxShowSamePoleModal(fromNode, siblings);
}

function _coaxShowSamePoleModal(fromNode, siblings) {
    var modal = document.getElementById('coaxSamePoleModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'coaxSamePoleModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10010;display:flex;justify-content:center;align-items:center;';
        document.body.appendChild(modal);
    }

    var fromLabel = fromNode.name || (COAX_EQUIP_TYPES[fromNode.type] ? COAX_EQUIP_TYPES[fromNode.type].label : '장비');
    var html = '<div style="background:white;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);min-width:280px;max-width:360px;overflow:hidden;">';
    html += '<div style="padding:16px 20px 12px;border-bottom:1px solid #f0f0f0;">';
    html += '<div style="font-size:15px;font-weight:bold;color:#333;">' + fromLabel + ' → 연결할 장비</div>';
    html += '<div style="font-size:12px;color:#888;margin-top:4px;">같은 전주 내 장비를 선택하세요</div>';
    html += '</div>';
    html += '<div style="padding:8px 12px;max-height:300px;overflow-y:auto;">';

    siblings.forEach(function(sib) {
        var sibLabel = sib.name || (COAX_EQUIP_TYPES[sib.type] ? COAX_EQUIP_TYPES[sib.type].label : sib.type);
        var statusLabel = sib.coaxStatus ? (COAX_STATUS[sib.coaxStatus] ? COAX_STATUS[sib.coaxStatus].label : '') : '';
        var statusColor = sib.coaxStatus ? (COAX_STATUS[sib.coaxStatus] ? COAX_STATUS[sib.coaxStatus].color : '#333') : '#333';
        html += '<button onclick="coaxSamePoleSelectTarget(\'' + fromNode.id + '\',\'' + sib.id + '\')" style="width:100%;padding:10px 14px;margin:3px 0;border:1.5px solid #e0e0e0;border-radius:8px;background:white;cursor:pointer;font-size:13px;font-weight:600;color:#333;text-align:left;display:flex;align-items:center;gap:8px;transition:all 0.15s;"';
        html += ' onmouseover="this.style.borderColor=\'#FF6D00\';this.style.background=\'#FFF8E1\'"';
        html += ' onmouseout="this.style.borderColor=\'#e0e0e0\';this.style.background=\'white\'">';
        html += '<span style="color:' + statusColor + ';">' + sibLabel + '</span>';
        if (statusLabel) html += '<span style="font-size:10px;color:' + statusColor + ';opacity:0.7;">' + statusLabel + '</span>';
        html += '</button>';
    });

    html += '</div>';
    html += '<div style="padding:8px 12px 12px;border-top:1px solid #f0f0f0;text-align:center;">';
    html += '<button onclick="coaxCloseSamePoleModal()" style="padding:8px 28px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;cursor:pointer;font-size:13px;">취소</button>';
    html += '</div></div>';

    modal.innerHTML = html;
    modal.style.display = 'flex';
}

function coaxCloseSamePoleModal() {
    var modal = document.getElementById('coaxSamePoleModal');
    if (modal) modal.style.display = 'none';
}

function coaxSamePoleSelectTarget(fromId, toId) {
    coaxCloseSamePoleModal();
    var fromNode = nodes.find(function(n) { return n.id === fromId; });
    var toNode = nodes.find(function(n) { return n.id === toId; });
    if (!fromNode || !toNode) return;

    // 케이블 규격 선택 모달 표시
    window._coaxSamePoleFrom = fromNode;
    window._coaxSamePoleTo = toNode;
    _coaxShowCableTypeModal();
}

function _coaxShowCableTypeModal() {
    var modal = document.getElementById('coaxCableTypeModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'coaxCableTypeModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:10010;display:flex;justify-content:center;align-items:center;';
        document.body.appendChild(modal);
    }

    var html = '<div style="background:white;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);min-width:260px;text-align:center;padding:20px;">';
    html += '<h3 style="margin:0 0 6px;font-size:15px;color:#333;">동축 케이블 규격</h3>';
    // 신설/기설 선택
    html += '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:14px;">';
    html += '<button id="spLineNew" onclick="document.getElementById(\'spLineNew\').classList.add(\'selected\');document.getElementById(\'spLineExist\').classList.remove(\'selected\');" class="fiber-core-btn selected" style="flex:1;max-width:100px;">신설</button>';
    html += '<button id="spLineExist" onclick="document.getElementById(\'spLineExist\').classList.add(\'selected\');document.getElementById(\'spLineNew\').classList.remove(\'selected\');" class="fiber-core-btn" style="flex:1;max-width:100px;">기설</button>';
    html += '</div>';
    // 규격 선택
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:16px;">';
    var opts = [{ label: '12C', value: 12 }, { label: '7C', value: 7 }, { label: '5C', value: 5 }];
    opts.forEach(function(o) {
        html += '<button onclick="coaxConfirmSamePoleConnect(' + o.value + ')" style="padding:10px 22px;border:2px solid #FF6D00;border-radius:8px;background:white;cursor:pointer;font-size:14px;font-weight:bold;color:#FF6D00;transition:all 0.15s;"';
        html += ' onmouseover="this.style.background=\'#FF6D00\';this.style.color=\'white\'"';
        html += ' onmouseout="this.style.background=\'white\';this.style.color=\'#FF6D00\'"';
        html += '>' + o.label + '</button>';
    });
    html += '</div>';
    html += '<button onclick="coaxCloseCableTypeModal()" style="padding:8px 24px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;cursor:pointer;font-size:13px;">취소</button>';
    html += '</div>';

    modal.innerHTML = html;
    modal.style.display = 'flex';
}

function coaxCloseCableTypeModal() {
    var modal = document.getElementById('coaxCableTypeModal');
    if (modal) modal.style.display = 'none';
    window._coaxSamePoleFrom = null;
    window._coaxSamePoleTo = null;
}

function coaxConfirmSamePoleConnect(cableSize) {
    var fromNode = window._coaxSamePoleFrom;
    var toNode = window._coaxSamePoleTo;
    coaxCloseCableTypeModal();
    if (!fromNode || !toNode) return;

    var lineTypeBtn = document.getElementById('spLineNew');
    var lineType = (lineTypeBtn && lineTypeBtn.classList.contains('selected')) ? 'new' : 'existing';

    // connDirections 설정
    if (!fromNode.connDirections) fromNode.connDirections = {};
    if (!toNode.connDirections) toNode.connDirections = {};
    if (!toNode.inOrder) toNode.inOrder = [];

    var connId = Date.now().toString();
    fromNode.connDirections[connId] = 'out';
    toNode.connDirections[connId] = 'in';
    toNode.inOrder.push(connId);

    var connection = {
        id: connId,
        nodeA: fromNode.id,
        nodeB: toNode.id,
        cores: cableSize,
        lineType: lineType,
        cableType: 'coax',
        waypoints: [],
        portMapping: [],
        inFromCableId: null
    };

    connections.push(connection);
    saveData();
    renderAllConnections();

    var fromLabel = fromNode.name || (COAX_EQUIP_TYPES[fromNode.type] ? COAX_EQUIP_TYPES[fromNode.type].label : '장비');
    var toLabel = toNode.name || (COAX_EQUIP_TYPES[toNode.type] ? COAX_EQUIP_TYPES[toNode.type].label : '장비');
    showStatus(fromLabel + ' → ' + toLabel + ' ' + cableSize + 'C 연결 완료');
}

// ── 셀 경계 (다각형) ──

var _coaxBoundaryMode = false;
var _coaxBoundaryOnu = null;
var _coaxBoundaryPoints = [];
var _coaxBoundaryMarkers = [];
var _coaxBoundaryPreview = null;
var _coaxBoundaryPolygons = {};  // onuId → L.polygon

function coaxStartBoundary(onuNode) {
    // 기존 경계가 있으면 삭제 확인
    if (onuNode.cellBoundary && onuNode.cellBoundary.length > 0) {
        if (typeof showConfirm === 'function') {
            showConfirm('기존 셀 경계를 다시 그리시겠습니까?', function() {
                _coaxRemoveBoundaryPolygon(onuNode.id);
                _coaxBeginBoundary(onuNode);
            }, '', '다시 그리기');
        } else {
            _coaxRemoveBoundaryPolygon(onuNode.id);
            _coaxBeginBoundary(onuNode);
        }
        return;
    }
    _coaxBeginBoundary(onuNode);
}

function _coaxBeginBoundary(onuNode) {
    _coaxBoundaryMode = true;
    _coaxBoundaryOnu = onuNode;
    _coaxBoundaryPoints = [];
    _coaxBoundaryMarkers = [];
    _coaxBoundaryPreview = null;
    showStatus('셀 경계 그리기: 지도를 클릭하여 꼭짓점 추가 (Enter=확정, ESC=취소, Ctrl+Z=되돌리기)');
}

function _coaxBoundaryAddPoint(lat, lng) {
    _coaxBoundaryPoints.push({ lat: lat, lng: lng });

    // 꼭짓점 마커
    var m = L.circleMarker([lat, lng], {
        radius: 5, color: '#9C27B0', fillColor: '#9C27B0', fillOpacity: 0.8, weight: 2
    }).addTo(map);
    _coaxBoundaryMarkers.push(m);

    // 프리뷰 폴리곤 갱신
    _coaxUpdateBoundaryPreview();
}

function _coaxUpdateBoundaryPreview() {
    if (_coaxBoundaryPreview) {
        map.removeLayer(_coaxBoundaryPreview);
    }
    if (_coaxBoundaryPoints.length >= 2) {
        var latlngs = _coaxBoundaryPoints.map(function(p) { return [p.lat, p.lng]; });
        _coaxBoundaryPreview = L.polygon(latlngs, {
            color: '#9C27B0', weight: 2, dashArray: '6,4',
            fillColor: '#9C27B0', fillOpacity: 0.1
        }).addTo(map);
    }
}

function _coaxBoundaryUndo() {
    if (_coaxBoundaryPoints.length === 0) return;
    _coaxBoundaryPoints.pop();
    var m = _coaxBoundaryMarkers.pop();
    if (m) map.removeLayer(m);
    _coaxUpdateBoundaryPreview();
}

function coaxConfirmBoundary() {
    if (_coaxBoundaryPoints.length < 3) {
        showStatus('셀 경계는 최소 3개 점이 필요합니다');
        return;
    }
    // ONU 노드에 저장
    _coaxBoundaryOnu.cellBoundary = _coaxBoundaryPoints.map(function(p) {
        return { lat: p.lat, lng: p.lng };
    });
    saveData();

    // 프리뷰/마커 제거 후 확정 폴리곤 렌더
    _coaxClearBoundaryDrawing();
    var confirmedOnu = _coaxBoundaryOnu;
    _coaxBoundaryMode = false;
    _coaxBoundaryOnu = null;

    // 경계선만 렌더 (편집 모드 미진입 — 클릭 시 편집 가능)
    _coaxRenderBoundaryPolygon(confirmedOnu);
    showStatus('셀 경계 저장 완료 (경계선 클릭으로 편집)');
}

function coaxCancelBoundary() {
    _coaxClearBoundaryDrawing();
    _coaxBoundaryMode = false;
    _coaxBoundaryOnu = null;
    hideStatus();
}

function _coaxClearBoundaryDrawing() {
    _coaxBoundaryMarkers.forEach(function(m) { map.removeLayer(m); });
    _coaxBoundaryMarkers = [];
    if (_coaxBoundaryPreview) {
        map.removeLayer(_coaxBoundaryPreview);
        _coaxBoundaryPreview = null;
    }
    _coaxBoundaryPoints = [];
}

// ── 셀 경계 렌더링 ──

function _coaxRenderBoundaryPolygon(onuNode) {
    _coaxRemoveBoundaryPolygon(onuNode.id);
    var pts = onuNode.cellBoundary;
    if (!pts || pts.length < 3) return;

    var latlngs = pts.map(function(p) { return [p.lat, p.lng]; });
    var polygon = L.polygon(latlngs, {
        color: '#9C27B0', weight: 2, opacity: 0.7,
        fillColor: '#9C27B0', fillOpacity: 0
    }).addTo(map);

    // 클릭 → 편집 모드 진입
    polygon.on('click', function() {
        _coaxEnterBoundaryEdit(onuNode);
    });
    // 더블클릭 → 클릭 위치에 꼭짓점 추가
    polygon.on('dblclick', function(e) {
        _coaxAddVertexAtPosition(onuNode, e.latlng);
    });

    // 중앙에 ONU 이름 라벨 (설계모드에서는 숨김)
    var label = null;
    if (_coaxMode !== 'design') {
        var center = polygon.getBounds().getCenter();
        label = L.marker(center, {
            icon: L.divIcon({
                className: 'coax-boundary-label',
                html: '<div style="font-size:11px;font-weight:bold;color:#9C27B0;white-space:nowrap;text-shadow:1px 1px 2px white,-1px -1px 2px white,1px -1px 2px white,-1px 1px 2px white;">' + (onuNode.name || 'ONU') + '</div>',
                iconSize: [0, 0]
            }),
            interactive: false
        }).addTo(map);
    }

    _coaxBoundaryPolygons[onuNode.id] = { polygon: polygon, label: label };

    // 편집 모드 중이면 핸들 갱신
    if (_coaxBoundaryEditOnu && _coaxBoundaryEditOnu.id === onuNode.id) {
        _coaxRenderEditHandles(onuNode);
    }
}

function _coaxRemoveBoundaryPolygon(onuId) {
    var entry = _coaxBoundaryPolygons[onuId];
    if (entry) {
        if (entry.polygon) map.removeLayer(entry.polygon);
        if (entry.label) map.removeLayer(entry.label);
        delete _coaxBoundaryPolygons[onuId];
    }
}

// 모든 ONU의 셀 경계 렌더 (데이터 로드 시 호출)
function coaxRenderAllBoundaries() {
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.type === 'onu' && n.cellBoundary && n.cellBoundary.length >= 3) {
            _coaxRenderBoundaryPolygon(n);
        }
    }
}

// ── 셀 경계 편집 (꼭짓점 드래그 / 더블클릭 점 추가) ──

var _coaxBoundaryEditOnu = null;
var _coaxBoundaryVtxHandles = [];   // [{ov, div}]
var _coaxBoundaryMidHandles = [];   // [{ov, div}]
var _coaxBdragIdx = -1;
var _coaxBdragActive = false;

function _coaxEnterBoundaryEdit(onuNode) {
    if (_coaxBoundaryEditOnu && _coaxBoundaryEditOnu.id === onuNode.id) return;
    _coaxExitBoundaryEdit();
    _coaxBoundaryEditOnu = onuNode;
    _coaxRenderEditHandles(onuNode);
    showStatus('셀 경계 편집: 꼭짓점 드래그로 이동, 변 위 ◇ 클릭으로 점 추가, ESC로 종료');
}

function _coaxExitBoundaryEdit() {
    _coaxClearEditHandles();
    _coaxBoundaryEditOnu = null;
    _coaxBdragActive = false;
    _coaxBdragIdx = -1;
}

function _coaxRenderEditHandles(onuNode) {
    _coaxClearEditHandles();
    var pts = onuNode.cellBoundary;
    if (!pts || pts.length < 3) return;

    // 꼭짓점 핸들 (드래그 가능)
    for (var i = 0; i < pts.length; i++) {
        (function(idx) {
            var d = document.createElement('div');
            d.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#9C27B0;border:2px solid white;cursor:move;pointer-events:all;position:relative;z-index:9500;box-shadow:0 1px 3px rgba(0,0,0,0.3);';
            d.addEventListener('mousedown', function(e) {
                e.stopPropagation();
                e.preventDefault();
                _coaxBdragIdx = idx;
                _coaxBdragActive = true;
                map._m.setDraggable(false);
            });
            // 우클릭 → 꼭짓점 삭제 (최소 3개 유지)
            d.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (pts.length <= 3) { showStatus('최소 3개 꼭짓점이 필요합니다'); return; }
                pts.splice(idx, 1);
                saveData();
                _coaxRenderBoundaryPolygon(onuNode);
            });
            var ov = new kakao.maps.CustomOverlay({
                position: new kakao.maps.LatLng(pts[idx].lat, pts[idx].lng),
                content: d, map: map._m, zIndex: 20, yAnchor: 0.5, xAnchor: 0.5
            });
            _coaxBoundaryVtxHandles.push({ ov: ov, div: d });
        })(i);
    }

    // 변 중간점 핸들 (클릭 → 꼭짓점 추가)
    for (var i = 0; i < pts.length; i++) {
        (function(idx) {
            var j = (idx + 1) % pts.length;
            var mLat = (pts[idx].lat + pts[j].lat) / 2;
            var mLng = (pts[idx].lng + pts[j].lng) / 2;
            var d = document.createElement('div');
            d.style.cssText = 'width:9px;height:9px;border-radius:50%;background:rgba(156,39,176,0.35);border:1.5px solid rgba(156,39,176,0.6);cursor:pointer;pointer-events:all;position:relative;z-index:9400;transition:background 0.15s;';
            d.addEventListener('mouseenter', function() { d.style.background = 'rgba(156,39,176,0.7)'; });
            d.addEventListener('mouseleave', function() { d.style.background = 'rgba(156,39,176,0.35)'; });
            d.addEventListener('mousedown', function(e) { e.stopPropagation(); });
            d.addEventListener('click', function(e) {
                e.stopPropagation();
                pts.splice(idx + 1, 0, { lat: mLat, lng: mLng });
                saveData();
                _coaxRenderBoundaryPolygon(onuNode);
            });
            var ov = new kakao.maps.CustomOverlay({
                position: new kakao.maps.LatLng(mLat, mLng),
                content: d, map: map._m, zIndex: 19, yAnchor: 0.5, xAnchor: 0.5
            });
            _coaxBoundaryMidHandles.push({ ov: ov, div: d });
        })(i);
    }
}

function _coaxClearEditHandles() {
    _coaxBoundaryVtxHandles.forEach(function(h) { h.ov.setMap(null); });
    _coaxBoundaryVtxHandles = [];
    _coaxBoundaryMidHandles.forEach(function(h) { h.ov.setMap(null); });
    _coaxBoundaryMidHandles = [];
}

// 경계선 더블클릭 → 가장 가까운 변에 꼭짓점 삽입
function _coaxAddVertexAtPosition(onuNode, latlng) {
    var pts = onuNode.cellBoundary;
    if (!pts || pts.length < 3) return;
    var bestDist = Infinity, bestIdx = 0;
    for (var i = 0; i < pts.length; i++) {
        var j = (i + 1) % pts.length;
        var d = _coaxDistToSeg(latlng, pts[i], pts[j]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    pts.splice(bestIdx + 1, 0, { lat: latlng.lat, lng: latlng.lng });
    saveData();
    _coaxBoundaryEditOnu = onuNode;
    _coaxRenderBoundaryPolygon(onuNode);
}

function _coaxDistToSeg(p, a, b) {
    var dx = b.lng - a.lng, dy = b.lat - a.lat;
    var l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(p.lng - a.lng, p.lat - a.lat);
    var t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / l2));
    return Math.hypot(p.lng - (a.lng + t * dx), p.lat - (a.lat + t * dy));
}

// ── 꼭짓점 드래그 (document-level 마우스 핸들러) ──

document.addEventListener('mousemove', function(e) {
    if (!_coaxBdragActive || _coaxBdragIdx < 0 || !_coaxBoundaryEditOnu) return;
    var container = map.getContainer();
    var rect = container.getBoundingClientRect();
    var ll = map.containerPointToLatLng({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    var pts = _coaxBoundaryEditOnu.cellBoundary;
    pts[_coaxBdragIdx] = { lat: ll.lat, lng: ll.lng };

    // 폴리곤 실시간 갱신
    var entry = _coaxBoundaryPolygons[_coaxBoundaryEditOnu.id];
    if (entry && entry.polygon) {
        entry.polygon.setPath(pts.map(function(p) { return [p.lat, p.lng]; }));
    }
    // 핸들 위치 갱신
    var handle = _coaxBoundaryVtxHandles[_coaxBdragIdx];
    if (handle) handle.ov.setPosition(new kakao.maps.LatLng(ll.lat, ll.lng));
});

document.addEventListener('mouseup', function() {
    if (_coaxBdragActive && _coaxBoundaryEditOnu) {
        map._m.setDraggable(true);
        _coaxBdragActive = false;
        _coaxBdragIdx = -1;
        saveData();
        // 중간점 핸들, 라벨 위치 갱신
        _coaxRenderBoundaryPolygon(_coaxBoundaryEditOnu);
    }
    _coaxBdragActive = false;
    _coaxBdragIdx = -1;
});

// ── ESC / Enter / Ctrl+Z 키 처리 ──

document.addEventListener('keydown', function(e) {
    if (_coaxBoundaryMode) {
        if (e.key === 'Escape') {
            coaxCancelBoundary();
            return;
        }
        if (e.key === 'Enter') {
            coaxConfirmBoundary();
            return;
        }
        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            _coaxBoundaryUndo();
            return;
        }
    }
    if (e.key === 'Escape' && _coaxBoundaryEditOnu) {
        _coaxExitBoundaryEdit();
        hideStatus();
        return;
    }
    if (e.key === 'Escape' && _coaxPlacingType) {
        coaxCancelPlacing();
    }
});

// ── 패널 드래그 이동 ──

(function() {
    var _dragging = false, _dx = 0, _dy = 0;
    document.addEventListener('mousedown', function(e) {
        var header = document.getElementById('coaxPanelHeader');
        if (!header || !header.contains(e.target)) return;
        var panel = document.getElementById('coaxPanel');
        if (!panel) return;
        _dragging = true;
        var rect = panel.getBoundingClientRect();
        _dx = e.clientX - rect.left;
        _dy = e.clientY - rect.top;
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!_dragging) return;
        var panel = document.getElementById('coaxPanel');
        if (!panel) return;
        panel.style.left = (e.clientX - _dx) + 'px';
        panel.style.top  = (e.clientY - _dy) + 'px';
        panel.style.right = 'auto';
    });
    document.addEventListener('mouseup', function() {
        _dragging = false;
    });
})();

// ==================== 도면보기 / 설계 모드 ====================

var _coaxMode = null; // null | 'view' | 'design'
var _coaxModeOnu = null;

// ── 도면보기: 기설만 표시, 편집 불가 ──

function coaxEnterViewMode(onuNode) {
    _coaxExitMode();
    _coaxMode = 'view';
    _coaxModeOnu = onuNode;

    // 해당 ONU 셀의 장비/케이블만 기설 표시
    var cellEquipIds = _getCoaxCellNodeIds(onuNode.id);
    cellEquipIds.push(onuNode.id);

    // 동축 장비: 기설만 보이고, 신설/철거 숨김
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (isCoaxType(n.type) && n.parentOnu === onuNode.id && markers[n.id]) {
            var show = (n.coaxStatus === 'existing');
            markers[n.id].setMap(show ? map : null);
        }
    }

    // 동축 케이블: 기설만 표시
    renderAllConnections();

    // 셀 경계 표시
    _coaxRenderBoundaryPolygon(onuNode);

    _coaxShowModeBar('도면보기: ' + (onuNode.name || 'ONU'));
}

// ── 설계: 전부 표시 + 편집 가능 ──

function coaxEnterDesignMode(onuNode) {
    _coaxExitMode();
    _coaxMode = 'design';
    _coaxModeOnu = onuNode;

    // ONU를 활성 ONU로 설정 (패널은 우클릭 시 열림)
    _coaxActiveOnu = onuNode;

    // 모든 장비 표시
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (isCoaxType(n.type) && n.parentOnu === onuNode.id && markers[n.id]) {
            markers[n.id].setMap(map);
        }
    }

    // 셀 경계 표시
    _coaxRenderBoundaryPolygon(onuNode);

    renderAllConnections();
    _coaxShowModeBar('설계 모드: ' + (onuNode.name || 'ONU'));
    showStatus('장비 배치/케이블 연결 가능');
}

// ── 모드 바 (좌측 상단) ──

function _coaxShowModeBar(label) {
    _coaxRemoveModeBar();
    var bar = document.createElement('div');
    bar.id = 'coaxModeBar';
    bar.style.cssText = 'position:fixed;top:60px;left:12px;z-index:10001;display:flex;align-items:center;gap:10px;background:white;border:2px solid #9C27B0;border-radius:8px;padding:8px 14px;box-shadow:0 2px 12px rgba(0,0,0,0.18);font-family:"Segoe UI",sans-serif;';
    var icon = _coaxMode === 'design'
        ? '<svg width="16" height="16" viewBox="0 0 40 40"><path d="M8,32 L28,12 L32,16 L12,36 L6,38Z" fill="none" stroke="#FF6D00" stroke-width="3" stroke-linejoin="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 40 40"><circle cx="20" cy="20" r="10" fill="none" stroke="#0055ff" stroke-width="3"/><circle cx="20" cy="20" r="3" fill="#0055ff"/></svg>';
    var color = _coaxMode === 'design' ? '#FF6D00' : '#0055ff';
    bar.innerHTML = icon + '<span style="font-size:13px;font-weight:700;color:' + color + ';">' + label + '</span>';

    var closeBtn = document.createElement('div');
    closeBtn.style.cssText = 'width:24px;height:24px;border-radius:50%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-left:4px;';
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="#666" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke="#666" stroke-width="2" stroke-linecap="round"/></svg>';
    closeBtn.onmouseover = function() { closeBtn.style.background = '#e0e0e0'; };
    closeBtn.onmouseout = function() { closeBtn.style.background = '#f0f0f0'; };
    closeBtn.onclick = function() { _coaxExitMode(); hideStatus(); };
    bar.appendChild(closeBtn);

    document.body.appendChild(bar);
}

function _coaxRemoveModeBar() {
    var el = document.getElementById('coaxModeBar');
    if (el) el.remove();
}

// ── 모드 종료 ──

function _coaxExitMode() {
    if (_coaxMode === 'view') {
        // 숨겨둔 장비 복원
        if (_coaxModeOnu) {
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (isCoaxType(n.type) && n.parentOnu === _coaxModeOnu.id && markers[n.id]) {
                    markers[n.id].setMap(map);
                }
            }
        }
        renderAllConnections();
    }
    if (_coaxMode === 'design') {
        coaxCancelPlacing();
        _coaxExitBoundaryEdit();
    }
    _coaxMode = null;
    _coaxModeOnu = null;
    _coaxRemoveModeBar();
}

// 도면보기 모드에서 렌더링 필터 (renderConnection에서 호출)
function coaxIsViewFiltered(connection) {
    if (_coaxMode !== 'view' || !_coaxModeOnu) return false;
    if (connection.cableType !== 'coax') return false;
    // 해당 셀의 케이블인지 확인
    var cellIds = _getCoaxCellNodeIds(_coaxModeOnu.id);
    cellIds.push(_coaxModeOnu.id);
    var fromId = typeof connFrom === 'function' ? connFrom(connection) : connection.nodeA;
    var toId = typeof connTo === 'function' ? connTo(connection) : connection.nodeB;
    if (cellIds.indexOf(fromId) === -1 && cellIds.indexOf(toId) === -1) return false;
    // 기설 케이블만 표시
    return connection.coaxStatus !== 'existing';
}

// 셀 소속 동축 장비 ID 목록
function _getCoaxCellNodeIds(onuId) {
    var ids = [];
    for (var i = 0; i < nodes.length; i++) {
        if (isCoaxType(nodes[i].type) && nodes[i].parentOnu === onuId) {
            ids.push(nodes[i].id);
        }
    }
    return ids;
}

// ── 공가 신청서 자동생성 (동축 셀 단위) ──

function coaxExtractGongga(onuNode) {
    // 셀 내 동축 장비 + 케이블 수집
    var cellEquip = nodes.filter(function(n) {
        return isCoaxType(n.type) && n.parentOnu === onuNode.id;
    });
    var cellNodeIds = _getCoaxCellNodeIds(onuNode.id);
    cellNodeIds.push(onuNode.id);

    var cellConns = connections.filter(function(c) {
        if (c.cableType !== 'coax') return false;
        var from = typeof connFrom === 'function' ? connFrom(c) : c.nodeA;
        var to = typeof connTo === 'function' ? connTo(c) : c.nodeB;
        return cellNodeIds.indexOf(from) !== -1 || cellNodeIds.indexOf(to) !== -1;
    });

    // 전주 수집: 장비의 snappedPoleId + 케이블 경유점의 snappedPole
    var poleIdSet = {};
    // ONU 자체의 전주
    if (onuNode.snappedPoleId) poleIdSet[onuNode.snappedPoleId] = true;
    // 장비들의 전주
    cellEquip.forEach(function(eq) {
        if (eq.snappedPoleId) poleIdSet[eq.snappedPoleId] = true;
    });
    // 케이블 경유점 전주
    cellConns.forEach(function(c) {
        if (c.waypoints) {
            c.waypoints.forEach(function(wp) {
                if (wp.snappedPole) poleIdSet[wp.snappedPole] = true;
            });
        }
    });

    // 전주 노드 수집
    var poleList = [];
    var poleIds = Object.keys(poleIdSet);
    poleIds.forEach(function(pid) {
        var pNode = nodes.find(function(n) { return n.id === pid; });
        if (pNode && isPoleType(pNode.type)) poleList.push(pNode);
    });

    if (poleList.length === 0) {
        showStatus('이 셀에 스냅된 전주가 없습니다');
        return;
    }

    // 전주별 동축 장비 매핑 (snappedPoleId 기준)
    var equipByPoleId = {};
    // ONU → 전주에 매핑
    if (onuNode.snappedPoleId) {
        if (!equipByPoleId[onuNode.snappedPoleId]) equipByPoleId[onuNode.snappedPoleId] = [];
        equipByPoleId[onuNode.snappedPoleId].push({ type: 'onu', name: onuNode.name || '' });
    }
    // 동축 장비 → 전주에 매핑
    cellEquip.forEach(function(eq) {
        if (!eq.snappedPoleId) return;
        if (!equipByPoleId[eq.snappedPoleId]) equipByPoleId[eq.snappedPoleId] = [];
        var def = COAX_EQUIP_TYPES[eq.type];
        equipByPoleId[eq.snappedPoleId].push({
            type: eq.type,
            name: eq.name || (def ? def.label : ''),
            gonggaCode: def ? def.gongga : ''
        });
    });

    // 대표 케이블 규격 (가장 많이 사용된 규격)
    var coreCounts = {};
    cellConns.forEach(function(c) {
        var k = String(c.cores || 12);
        coreCounts[k] = (coreCounts[k] || 0) + 1;
    });
    var mainCores = '12';
    var maxCount = 0;
    for (var k in coreCounts) {
        if (coreCounts[k] > maxCount) { maxCount = coreCounts[k]; mainCores = k; }
    }

    // gonggaParsePoles 호출 — 동축 장비의 기기코드 매핑 추가
    // EQUIP_CODE에 동축 장비 코드 추가 (gongga 값 사용)
    var COAX_EQUIP_CODE = {};
    for (var t in COAX_EQUIP_TYPES) {
        COAX_EQUIP_CODE[t] = COAX_EQUIP_TYPES[t].gongga;
    }
    COAX_EQUIP_CODE['onu'] = '3'; // ONU

    // equipByPoleId의 각 장비에 type 대신 기기코드를 넣어서 gonggaParsePoles에 전달
    var equipForGongga = {};
    for (var pid in equipByPoleId) {
        equipForGongga[pid] = equipByPoleId[pid].map(function(eq) {
            return { type: eq.type, name: eq.name, gonggaCode: COAX_EQUIP_CODE[eq.type] || '' };
        });
    }

    // gonggaParsePoles 호출
    var poles = gonggaParsePoles(poleList, {
        cores: mainCores,
        lineType: 'coax',
        equipByPoleId: equipForGongga
    });

    // 장표 로딩 후 신청서 생성
    gonggaLoadInvs(function(invsData) {
        gonggaBuildApplication(poles, invsData, onuNode, null);
    });
}

// ── ONU 장비 이동 (전주 스냅) ──

function startMovingNodeToPole(onuNode) {
    closeMenuModal();
    showStatus('이동할 전주를 선택하세요 (ESC: 취소)');

    // 임시 모드: addingMode 활용하지 않고 별도 플래그
    window._onuMoveTarget = onuNode;

    var _onuMoveHandler = function(node) {
        if (!window._onuMoveTarget) return;
        if (!isPoleType(node.type)) {
            showStatus('전주를 선택해 주세요');
            return;
        }

        // 기존 전주 장비리스트에서 제거 (snappedPoleId 갱신)
        var onu = window._onuMoveTarget;
        onu.lat = node.lat;
        onu.lng = node.lng;
        onu.snappedPoleId = node.id;

        // 마커 리렌더
        if (markers[onu.id]) {
            map.removeLayer(markers[onu.id]);
            delete markers[onu.id];
        }
        renderNode(onu);
        renderAllConnections();
        saveData();

        window._onuMoveTarget = null;
        window._onuMoveClickHandler = null;
        showStatus('장비가 이동되었습니다');
    };

    window._onuMoveClickHandler = _onuMoveHandler;
}

// ── ONU 삭제 (셀 전체 삭제) ──

// ── 동축 케이블 그리기 지원 (ui.js에서 이동) ──

var COAX_SNAP_RADIUS_M = 15;

// 동축 설계 모드 여부
function _isCoaxDesignConnecting() {
    return typeof _coaxMode !== 'undefined' && _coaxMode === 'design';
}

// 동축 경유 피드백 표시
var _coaxRouteLabel = null;
function _showCoaxRouteLabel(poleName, lat, lng) {
    _clearCoaxRouteLabel();
    var d = document.createElement('div');
    d.style.cssText = 'background:#FF6D00;color:white;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);';
    d.textContent = poleName + ' 경유';
    _coaxRouteLabel = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(lat, lng),
        content: d, map: map._m, zIndex: 30, yAnchor: 2.5, xAnchor: 0.5
    });
}
function _clearCoaxRouteLabel() {
    if (_coaxRouteLabel) { _coaxRouteLabel.setMap(null); _coaxRouteLabel = null; }
}

// 동축망/셀 숨김 토글
var _coaxHidden = false;
function toggleCoaxVisible() {
    _coaxHidden = !_coaxHidden;
    var btn = document.getElementById('hideCoaxBtn');
    if (btn) {
        btn.classList.toggle('active', _coaxHidden);
        var lbl = btn.querySelector('.tb-label');
        if (lbl) lbl.textContent = _coaxHidden ? '셀표시' : '셀숨김';
    }
    // 동축 케이블 렌더링 갱신
    renderAllConnections();
    // 동축 장비 마커 숨김/표시
    for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (isCoaxType(n.type) && markers[n.id]) {
            markers[n.id].setMap(_coaxHidden ? null : map);
        }
    }
    // 셀 경계 폴리곤 숨김/표시
    if (typeof _coaxBoundaryPolygons !== 'undefined') {
        for (var key in _coaxBoundaryPolygons) {
            var entry = _coaxBoundaryPolygons[key];
            if (entry.polygon) entry.polygon.setMap(_coaxHidden ? null : map);
            if (entry.label) entry.label.setMap(_coaxHidden ? null : map);
        }
    }
}
window.toggleCoaxVisible = toggleCoaxVisible;

// ── ONU 삭제 (셀 전체 삭제) ──

function deleteOnuWithCell(onuNode) {
    // 셀에 속한 장비 수 카운트
    var cellEquip = nodes.filter(function(n) {
        return isCoaxType(n.type) && n.parentOnu === onuNode.id;
    });
    var cellConns = connections.filter(function(c) {
        if (c.cableType !== 'coax') return false;
        var ids = _getCoaxCellNodeIds(onuNode.id);
        ids.push(onuNode.id);
        var from = typeof connFrom === 'function' ? connFrom(c) : c.nodeA;
        var to = typeof connTo === 'function' ? connTo(c) : c.nodeB;
        return ids.indexOf(from) !== -1 || ids.indexOf(to) !== -1;
    });

    var msg = "'" + (onuNode.name || 'ONU') + "' 셀을 삭제하시겠습니까?\n\n";
    if (cellEquip.length > 0) msg += '동축 장비 ' + cellEquip.length + '개 ';
    if (cellConns.length > 0) msg += '케이블 ' + cellConns.length + '건 ';
    msg += '함께 삭제됩니다.';

    showConfirm(msg, function() {
        // 셀 장비 삭제
        cellEquip.forEach(function(n) {
            if (markers[n.id]) {
                map.removeLayer(markers[n.id]);
                delete markers[n.id];
            }
        });
        // 셀 케이블 삭제
        var cellConnIds = cellConns.map(function(c) { return c.id; });
        connections = connections.filter(function(c) { return cellConnIds.indexOf(c.id) === -1; });
        // 셀 장비 노드 삭제
        var cellEquipIds = cellEquip.map(function(n) { return n.id; });
        nodes = nodes.filter(function(n) { return cellEquipIds.indexOf(n.id) === -1; });

        // ONU 자신의 연결도 삭제
        connections = connections.filter(function(c) {
            return c.nodeA !== onuNode.id && c.nodeB !== onuNode.id;
        });

        // 셀 경계 폴리곤 제거
        _coaxRemoveBoundaryPolygon(onuNode.id);
        if (onuNode.cellBoundary) delete onuNode.cellBoundary;

        // ONU 마커 삭제
        if (markers[onuNode.id]) {
            map.removeLayer(markers[onuNode.id]);
            delete markers[onuNode.id];
        }
        nodes = nodes.filter(function(n) { return n.id !== onuNode.id; });

        saveData();
        renderAllConnections();
        selectedNode = null;
        showStatus('셀이 삭제되었습니다');
    }, '셀 전체가 삭제됩니다', '삭제');
}
