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

        function connFrom(conn) {
            const nA = nodes.find(n => n.id === conn.nodeA);
            const dir = (nA && nA.connDirections && nA.connDirections[conn.id]) || 'out';
            return dir === 'out' ? conn.nodeA : conn.nodeB;
        }

        function connTo(conn) {
            return connFrom(conn) === conn.nodeA ? conn.nodeB : conn.nodeA;
        }

        function isInConn(conn, nodeId) {
            return connTo(conn) === nodeId;
        }

        function isOutConn(conn, nodeId) {
            return connFrom(conn) === nodeId;
        }

        function getOtherNodeId(conn, nodeId) {
            return conn.nodeA === nodeId ? conn.nodeB : conn.nodeA;
        }

        function getNodeConns(nodeId) {
            return connections.filter(c => c.nodeA === nodeId || c.nodeB === nodeId);
        }

        function getNodeInConns(nodeId) {
            return connections.filter(c => isInConn(c, nodeId));
        }

        function getNodeOutConns(nodeId) {
            return connections.filter(c => isOutConn(c, nodeId));
        }

        // 전주 타입 판별 (cable_map_map.js와 동일하게 유지)
        function isPoleType(t) {
            return t === 'pole' || t === 'pole_existing' || t === 'pole_new' || t === 'pole_removed';
        }

        // ==================== IndexedDB 헬퍼 ====================

        let _db = null;

        function getDB() {
            if (_db) return Promise.resolve(_db);
            return new Promise(function(resolve, reject) {
                const req = indexedDB.open('cableMapDB', 2); // v2: lat/lng 인덱스 추가
                req.onupgradeneeded = function(e) {
                    const db = e.target.result;
                    // poles store 생성 or 업그레이드
                    let store;
                    if (!db.objectStoreNames.contains('poles')) {
                        store = db.createObjectStore('poles', { keyPath: 'id' });
                    } else {
                        store = e.target.transaction.objectStore('poles');
                    }
                    // lat/lng 인덱스 (뷰포트 필터링용)
                    if (!store.indexNames.contains('lat')) store.createIndex('lat', 'lat', { unique: false });
                    if (!store.indexNames.contains('lng')) store.createIndex('lng', 'lng', { unique: false });
                };
                req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
                req.onerror   = function(e) { reject(e.target.error); };
            });
        }

        function idbGetAll(db) {
            return new Promise(function(resolve, reject) {
                const req = db.transaction('poles', 'readonly').objectStore('poles').getAll();
                req.onsuccess = function() { resolve(req.result); };
                req.onerror   = function() { reject(req.error); };
            });
        }

        function idbReplaceAll(db, poleNodes) {
            return new Promise(function(resolve, reject) {
                const tx    = db.transaction('poles', 'readwrite');
                const store = tx.objectStore('poles');
                store.clear();
                poleNodes.forEach(function(n) { store.put(n); });
                tx.oncomplete = resolve;
                tx.onerror    = function() { reject(tx.error); };
            });
        }

        function idbClear(db) {
            return new Promise(function(resolve, reject) {
                const req = db.transaction('poles', 'readwrite').objectStore('poles').clear();
                req.onsuccess = resolve;
                req.onerror   = function() { reject(req.error); };
            });
        }

        // ==================== 데이터 로드/저장 ====================

        // polesLater: true면 전주 로드 생략 (백그라운드 로드용)
        async function loadData(opts) {
            const polesLater = opts && opts.polesLater;
            const savedVersion = parseInt(localStorage.getItem('fiberDataVersion') || '1');

            if (savedVersion < DATA_VERSION) {
                localStorage.removeItem('fiberNodes');
                localStorage.removeItem('fiberConnections');
                localStorage.setItem('fiberDataVersion', DATA_VERSION.toString());
                const db = await getDB();
                await idbClear(db);
                return;
            }

            // localStorage: 비전주 노드 + connections 로드 (항상 즉시)
            const savedNodes       = localStorage.getItem('fiberNodes');
            const savedConnections = localStorage.getItem('fiberConnections');
            const localNodes       = savedNodes       ? JSON.parse(savedNodes)       : [];
            connections            = savedConnections ? JSON.parse(savedConnections) : [];

            // 마이그레이션: localStorage에 전주가 섞여 있으면 IndexedDB로 이동
            const localPoles  = localNodes.filter(n =>  isPoleType(n.type));
            const localOthers = localNodes.filter(n => !isPoleType(n.type));

            if (localPoles.length > 0) {
                // 구버전 전주를 IndexedDB로 이전
                const db = await getDB();
                const existing = await idbGetAll(db);
                if (existing.length === 0) await idbReplaceAll(db, localPoles);
                localStorage.setItem('fiberNodes', JSON.stringify(localOthers));
                if (!polesLater) nodes = [...localOthers, ...localPoles];
                else nodes = [...localOthers];
            } else {
                nodes = [...localOthers];
                // 전주는 polesLater=false일 때만 여기서 로드
                if (!polesLater) {
                    const db = await getDB();
                    const poleNodes = await idbGetAll(db);
                    nodes = [...localOthers, ...poleNodes];
                }
            }
        }

        // 뷰포트 범위 내 전주만 IDB에서 로드 (lat 인덱스 활용)
        async function loadPolesInBounds(bounds) {
            const db = await getDB();
            const { minLat, maxLat, minLng, maxLng } = bounds;
            return new Promise(function(resolve, reject) {
                const tx    = db.transaction('poles', 'readonly');
                const index = tx.objectStore('poles').index('lat');
                const range = IDBKeyRange.bound(minLat, maxLat);
                const result = [];
                index.openCursor(range).onsuccess = function(e) {
                    const cursor = e.target.result;
                    if (cursor) {
                        const n = cursor.value;
                        if (n.lng >= minLng && n.lng <= maxLng) result.push(n);
                        cursor.continue();
                    } else {
                        // 기존 전주 제거 후 뷰포트 내 전주로 교체
                        nodes = nodes.filter(function(n) { return !isPoleType(n.type); });
                        nodes = nodes.concat(result);
                        resolve(result.length);
                    }
                };
                tx.onerror = function() { reject(tx.error); };
            });
        }

        // 전체 전주 로드 (하위 호환용)
        async function loadPolesFromIDB() {
            const db = await getDB();
            const poleNodes = await idbGetAll(db);
            nodes = nodes.filter(function(n) { return !isPoleType(n.type); });
            nodes = nodes.concat(poleNodes);
        }

        async function saveData() {
            const poleNodes  = nodes.filter(n =>  isPoleType(n.type));
            const otherNodes = nodes.filter(n => !isPoleType(n.type));

            // 비전주 노드 + connections → localStorage (동기, 안정적)
            localStorage.setItem('fiberDataVersion', DATA_VERSION.toString());
            localStorage.setItem('fiberNodes',       JSON.stringify(otherNodes));
            localStorage.setItem('fiberConnections', JSON.stringify(connections));

            // 전주 → IndexedDB (비동기)
            const db = await getDB();
            await idbReplaceAll(db, poleNodes);
        }

        window.loadPolesFromIDB = loadPolesFromIDB;
        window.loadPolesInBounds = loadPolesInBounds;

        // 지도 초기화
