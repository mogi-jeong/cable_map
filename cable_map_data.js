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

        // clear 없이 put만 — 뷰포트 분할 로드 시 나머지 IDB 전주 보존
        function idbPutMany(db, poleNodes) {
            return new Promise(function(resolve, reject) {
                const tx    = db.transaction('poles', 'readwrite');
                const store = tx.objectStore('poles');
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

        // 뷰포트 범위 내 전주만 IDB에서 로드 — 결과 배열만 반환 (nodes 수정은 호출측에서)
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
                        resolve(result);
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

            // 전주 → IndexedDB (put만, clear 없음 — 뷰포트 분할 로드 시 나머지 전주 보존)
            // nodes에 전주가 없을 때(임포트 직후 등)는 IDB 트랜잭션 생략
            if (poleNodes.length === 0) return;
            const db = await getDB();
            await idbPutMany(db, poleNodes);
        }

        window.loadPolesFromIDB  = loadPolesFromIDB;
        window.loadPolesInBounds = loadPolesInBounds;

        // GitHub Pages 자동 전주 로드 (구역별 분할 파일)
        // progressCb(phase, cur, tot) — phase: 'fetch' | 'import' | 'done'
        window.autoLoadPolesIfNeeded = async function(progressCb) {
            // 1. 인덱스 파일 확인 (없거나 로컬 file:// 환경이면 스킵)
            let index;
            try {
                const r = await fetch('./poles_index.json?_=' + Date.now());
                if (!r.ok) return false;
                index = await r.json();
            } catch(e) { return false; }

            const remoteVersion = index.v;
            const files = index.files;
            if (!remoteVersion || !Array.isArray(files) || files.length === 0) return false;

            const localVersion = localStorage.getItem('polesAutoVersion');
            const db = await getDB();

            // IDB 전주 수 확인
            const poleCount = await new Promise(function(resolve) {
                const req = db.transaction('poles','readonly').objectStore('poles').count();
                req.onsuccess = function() { resolve(req.result); };
                req.onerror   = function() { resolve(0); };
            });

            // 버전 같고 데이터 있으면 스킵
            if (remoteVersion === localVersion && poleCount > 0) return false;

            // 2. IDB 초기화
            await idbClear(db);

            // 3. 구역 파일 순차 다운로드 + 임포트
            const now = Date.now();
            let totalImported = 0;
            let globalIdx = 0;

            for (let fi = 0; fi < files.length; fi++) {
                if (progressCb) progressCb('fetch', fi, files.length);
                let data;
                try {
                    const resp = await fetch('./' + files[fi] + '?_=' + Date.now());
                    if (!resp.ok) continue;
                    data = await resp.json();
                } catch(e) { continue; }

                if (!data.nodes || !Array.isArray(data.nodes)) continue;

                const src   = data.nodes.filter(function(n) {
                    return n.name && n.name.indexOf('추출장비') !== 0;
                });
                const BATCH = 5000;

                for (let i = 0; i < src.length; i += BATCH) {
                    const batch = [];
                    const end   = Math.min(i + BATCH, src.length);
                    for (let j = i; j < end; j++) {
                        const n       = src[j];
                        const poleNum = (n.memo || '').replace('전산화번호: ', '').trim();
                        const region  = n.id ? (n.id.split('_')[1] || '') : '';
                        const off     = window.getPoleRegionOffset && region
                                        ? window.getPoleRegionOffset(region) : null;
                        batch.push({
                            id:     'poll_' + now + '_' + (globalIdx++),
                            type:   'pole_existing',
                            lat:    n.lat + (off ? off.dLat : 0),
                            lng:    n.lng + (off ? off.dLng : 0),
                            name:   n.name  || '',
                            memo:   poleNum ? '전산화번호: ' + poleNum : '',
                            region: region
                        });
                    }
                    await idbPutMany(db, batch);
                    totalImported += batch.length;
                    if (progressCb) progressCb('import', totalImported, 282461);
                    await new Promise(function(r) { setTimeout(r, 0); });
                }
            }

            localStorage.setItem('polesAutoVersion', remoteVersion);
            if (progressCb) progressCb('done', totalImported, totalImported);
            return true;
        };
        window.clearPoleStore    = async function() {
            const db = await getDB();
            await idbClear(db);
        };
        // 임포트 전용: nodes[]를 거치지 않고 IDB에 직접 배치 쓰기
        window.idbWritePolesBatch = async function(poleNodes) {
            const db = await getDB();
            await idbPutMany(db, poleNodes);
        };

        // 전체 IDB 전주에 오프셋 적용 — getOffset(node) → {dLat,dLng} 또는 null
        window.applyOffsetToAllPoles = async function(getOffset, progressCb) {
            const db  = await getDB();
            const all = await idbGetAll(db);
            const BATCH = 3000;
            for (let s = 0; s < all.length; s += BATCH) {
                const batch = all.slice(s, s + BATCH);
                const tx    = db.transaction('poles', 'readwrite');
                const store = tx.objectStore('poles');
                batch.forEach(function(n) {
                    const off = getOffset(n);
                    if (!off || (!off.dLat && !off.dLng)) return;
                    n.lat = Math.round((n.lat + off.dLat) * 1e7) / 1e7;
                    n.lng = Math.round((n.lng + off.dLng) * 1e7) / 1e7;
                    store.put(n);
                });
                await new Promise(function(resolve, reject) {
                    tx.oncomplete = resolve;
                    tx.onerror    = function() { reject(tx.error); };
                });
                if (progressCb) progressCb(Math.min(s + BATCH, all.length), all.length);
                await new Promise(function(r) { setTimeout(r, 0); });
            }
        };

        // 지도 초기화
