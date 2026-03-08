        // XSS 방지: 사용자 입력값을 HTML에 삽입할 때 사용
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        let map;
        let nodes = [];
        let connections = [];
        let markers = {};
        let polylines = [];
        let addingMode = false;
        let addingType = '';
        let selectedNode = null;
        let connectingMode = false;
        let connectingFromNode = null;
        let connectingToNode = null;
        let draggingWaypoint = false;
        let draggingConnection = null;
        let draggingIndex = null;
        let movingNodeMode = false;
        let movingNode = null;
        let currentOFD = null;
        let currentOFDIndex = null;
        
        // 데이터 구조 버전
        // v2->v3: connection.from/to -> nodeA/nodeB + node.connDirections
        const DATA_VERSION = 3;

        // ==================== 그래프 헬퍼 함수 ====================

        // 연결의 OUT(상류/전단) 노드 ID 반환
        // nodeA.connDirections[connId]==='out' 이면 nodeA가 from, 아니면 nodeB
        function connFrom(conn) {
            const nA = nodes.find(n => n.id === conn.nodeA);
            const dir = (nA && nA.connDirections && nA.connDirections[conn.id]) || 'out';
            return dir === 'out' ? conn.nodeA : conn.nodeB;
        }

        // 연결의 IN(하류/후단) 노드 ID 반환
        function connTo(conn) {
            return connFrom(conn) === conn.nodeA ? conn.nodeB : conn.nodeA;
        }

        // nodeId가 이 연결에서 IN(수신)측인지
        function isInConn(conn, nodeId) {
            return connTo(conn) === nodeId;
        }

        // nodeId가 이 연결에서 OUT(송신)측인지
        function isOutConn(conn, nodeId) {
            return connFrom(conn) === nodeId;
        }

        // 연결에서 반대쪽 노드 ID
        function getOtherNodeId(conn, nodeId) {
            return conn.nodeA === nodeId ? conn.nodeB : conn.nodeA;
        }

        // 특정 노드에 연결된 모든 connections
        function getNodeConns(nodeId) {
            return connections.filter(c => c.nodeA === nodeId || c.nodeB === nodeId);
        }

        // 특정 노드의 IN connections (이 노드가 수신측)
        function getNodeInConns(nodeId) {
            return connections.filter(c => isInConn(c, nodeId));
        }

        // 특정 노드의 OUT connections (이 노드가 송신측)
        function getNodeOutConns(nodeId) {
            return connections.filter(c => isOutConn(c, nodeId));
        }

        // ==================== 데이터 로드/저장 ====================

        function loadData() {
            const savedVersion = parseInt(localStorage.getItem('fiberDataVersion') || '1');

            if (savedVersion < DATA_VERSION) {
                localStorage.removeItem('fiberNodes');
                localStorage.removeItem('fiberConnections');
                localStorage.setItem('fiberDataVersion', DATA_VERSION.toString());
                return;
            }

            const savedNodes = localStorage.getItem('fiberNodes');
            const savedConnections = localStorage.getItem('fiberConnections');

            if (savedNodes) nodes = JSON.parse(savedNodes);
            if (savedConnections) connections = JSON.parse(savedConnections);
        }

        function saveData() {
            localStorage.setItem('fiberDataVersion', DATA_VERSION.toString());
            localStorage.setItem('fiberNodes', JSON.stringify(nodes));
            localStorage.setItem('fiberConnections', JSON.stringify(connections));
        }
        
        // 지도 초기화
