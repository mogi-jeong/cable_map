// Naver Maps Leaflet-compatible shim
// Client ID: yxe95cu6k2
(function(){
    var _gIW = null; // 열려있는 InfoWindow

    /* ── 유틸 ── */
    function ptSeg(p,p1,p2){var dx=p2.x-p1.x,dy=p2.y-p1.y,l=dx*dx+dy*dy;if(!l)return Math.hypot(p.x-p1.x,p.y-p1.y);var t=Math.max(0,Math.min(1,((p.x-p1.x)*dx+(p.y-p1.y)*dy)/l));return Math.hypot(p.x-(p1.x+t*dx),p.y-(p1.y+t*dy));}
    function NLatLng(lat,lng){return new naver.maps.LatLng(lat,lng);}

    /* ══════════════════════════════════════════
       KMap — 네이버 지도 래퍼 (Leaflet 호환)
       ══════════════════════════════════════════ */
    function KMap(nm){ this._m=nm; this._ls={}; }
    KMap.prototype={
        /* 줌: Leaflet z → 네이버 zoom (카카오는 역방향이었으나 네이버는 정방향 1~21) */
        setView:function(ll,z){
            this._m.setCenter(NLatLng(ll[0],ll[1]));
            this._m.setZoom(z);
            return this;
        },
        getLevel:function(){ return this._m.getZoom(); }, // 전주 라벨 레벨 체크용
        _wfn:function(fn){
            return function(me){
                if(me && me.coord) fn({latlng:{lat:me.coord.lat(),lng:me.coord.lng()}});
                else fn({});
            };
        },
        on:function(ev,fn){
            var self=this, nm=this._m;
            if(ev==='moveend'){
                naver.maps.Event.addListener(nm,'center_changed',function(){fn({});});
                naver.maps.Event.addListener(nm,'zoom_changed',function(){fn({});});
                return this;
            }
            if(ev==='click'){
                var w=function(me){fn({latlng:{lat:me.coord.lat(),lng:me.coord.lng()}});};
                if(!this._ls[ev])this._ls[ev]=[];
                this._ls[ev].push({fn:fn,w:w});
                naver.maps.Event.addListener(nm,ev,w);
                return this;
            }
            var w2=this._wfn(fn);
            if(!this._ls[ev])this._ls[ev]=[];
            this._ls[ev].push({fn:fn,w:w2});
            naver.maps.Event.addListener(nm,ev,w2);
            return this;
        },
        once:function(ev,fn){
            var self=this;
            var w=function(me){
                self._rm(ev,fn);
                if(me&&me.coord) fn({latlng:{lat:me.coord.lat(),lng:me.coord.lng()}});
                else fn({});
            };
            if(!this._ls[ev])this._ls[ev]=[];
            this._ls[ev].push({fn:fn,w:w});
            naver.maps.Event.addListener(this._m,ev,w);
            return this;
        },
        off:function(ev,fn){this._rm(ev,fn);return this;},
        _rm:function(ev,fn){
            if(!this._ls[ev])return;
            var i=this._ls[ev].findIndex(function(l){return l.fn===fn;});
            if(i!==-1){naver.maps.Event.removeListener(this._ls[ev][i].w);this._ls[ev].splice(i,1);}
        },
        removeLayer:function(l){if(l&&typeof l.setMap==='function')l.setMap(null);return this;},
        closePopup:function(){if(_gIW){_gIW.close();_gIW=null;}return this;},
        latLngToLayerPoint:function(ll){
            var pt=this._m.getProjection().fromCoordToOffset(NLatLng(ll.lat,ll.lng));
            return{x:pt.x,y:pt.y};
        },
        containerPointToLatLng:function(pt){
            var coord=this._m.getProjection().fromOffsetToCoord(new naver.maps.Point(pt.x,pt.y));
            return{lat:coord.lat(),lng:coord.lng()};
        },
        getContainer:function(){return this._m.getElement();}
    };

    /* ══════════════════════════════════════════
       Mkr — 커스텀 오버레이 마커
       ══════════════════════════════════════════ */
    function Mkr(lat,lng,html,z){this._lat=lat;this._lng=lng;this._html=html;this._z=z||0;this._ov=null;this._mr=null;this._ls={};}
    Mkr.prototype={
        addTo:function(mw){
            var self=this; this._mr=mw;
            var d=document.createElement('div');
            d.innerHTML=this._html;
            d.style.cssText='pointer-events:all;position:relative;';
            d.addEventListener('click',function(e){
                e.stopPropagation();
                if(self._ls.click)self._ls.click.forEach(function(f){f();});
            });
            this._ov=new naver.maps.CustomControl(null,{});
            // CustomControl 대신 Marker with icon 방식 사용
            this._ov=new naver.maps.Marker({
                position:NLatLng(this._lat,this._lng),
                map:mw._m,
                icon:{content:d,anchor:new naver.maps.Point(0,0)},
                zIndex:10+Math.floor(this._z/1000)
            });
            return this;
        },
        setMap:function(m){if(this._ov)this._ov.setMap(m?m._m:null);return this;},
        on:function(ev,fn){if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push(fn);return this;},
        bindPopup:function(h){
            var self=this;
            if(!this._ls.click)this._ls.click=[];
            this._ls.click.push(function(){
                if(_gIW){_gIW.close();_gIW=null;}
                _gIW=new naver.maps.InfoWindow({content:'<div style="padding:8px;min-width:120px;">'+h+'</div>',borderWidth:0,disableAnchor:false,backgroundColor:'white',zIndex:99999});
                _gIW.open(self._mr._m,NLatLng(self._lat,self._lng));
            });
            return this;
        }
    };

    /* ══════════════════════════════════════════
       Ply — 폴리라인
       ══════════════════════════════════════════ */
    function Ply(ll,s){this._ll=ll;this._s=s||{};this._line=null;this._ls={};}
    Ply.prototype={
        addTo:function(mw){
            var self=this;
            var path=this._ll.map(function(p){return NLatLng(p[0],p[1]);});
            var s=this._s;
            this._line=new naver.maps.Polyline({
                map:mw._m, path:path,
                strokeColor:s.color||'#F00',
                strokeWeight:s.weight||3,
                strokeOpacity:s.opacity!=null?s.opacity:0.8,
                strokeStyle:s.dashArray?'shortdash':'solid',
                clickable:true
            });
            var last=0;
            naver.maps.Event.addListener(this._line,'click',function(me){
                var ev={latlng:{lat:me.coord.lat(),lng:me.coord.lng()},originalEvent:me},now=Date.now();
                if(self._ls.click)self._ls.click.forEach(function(f){f(ev);});
                if(now-last<400&&self._ls.dblclick)self._ls.dblclick.forEach(function(f){f(ev);});
                last=now;
            });
            return this;
        },
        on:function(ev,fn){if(ev.startsWith('touch'))return this;if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push(fn);return this;},
        setMap:function(m){if(this._line)this._line.setMap(m?m._m:null);return this;}
    };

    /* ══════════════════════════════════════════
       CMkr — 원형 마커 (waypoint 등)
       ══════════════════════════════════════════ */
    function CMkr(lat,lng,s){this._lat=lat;this._lng=lng;this._s=s||{};this._ov=null;this._mr=null;this._ph=null;}
    CMkr.prototype={
        addTo:function(mw){
            var self=this,s=this._s,r=(s.radius||5)*2,op=s.fillOpacity!=null?s.fillOpacity:1;
            this._mr=mw;
            var d=document.createElement('div');
            d.style.cssText='width:'+r+'px;height:'+r+'px;border-radius:50%;background:'+(s.fillColor||'#f00')+';border:'+(s.weight||2)+'px solid '+(s.color||'#fff')+';opacity:'+(op>0?1:0)+';cursor:'+(op>0?'pointer':'default')+';pointer-events:all;';
            d.addEventListener('click',function(e){
                e.stopPropagation();
                if(self._ph){
                    if(_gIW){_gIW.close();_gIW=null;}
                    _gIW=new naver.maps.InfoWindow({content:'<div style="padding:8px;min-width:120px;">'+self._ph+'</div>',borderWidth:0,backgroundColor:'white',zIndex:99999});
                    _gIW.open(self._mr._m,NLatLng(self._lat,self._lng));
                }
            });
            this._ov=new naver.maps.Marker({
                position:NLatLng(this._lat,this._lng),
                map:mw._m,
                icon:{content:d,anchor:new naver.maps.Point(r/2,r/2)},
                zIndex:9+Math.floor((s.zIndexOffset||0)/1000),
                clickable:op>0
            });
            return this;
        },
        setMap:function(m){if(this._ov)this._ov.setMap(m?m._m:null);return this;},
        bindPopup:function(h){this._ph=h;return this;},
        on:function(){return this;}
    };

    /* ══════════════════════════════════════════
       Pop — Popup (InfoWindow 래퍼)
       ══════════════════════════════════════════ */
    function Pop(){this._ll=null;this._c=null;}
    Pop.prototype={
        setLatLng:function(ll){this._ll=ll;return this;},
        setContent:function(c){this._c=c;return this;},
        openOn:function(mw){
            if(_gIW){_gIW.close();_gIW=null;}
            _gIW=new naver.maps.InfoWindow({content:'<div style="padding:8px;min-width:150px;">'+this._c+'</div>',borderWidth:0,backgroundColor:'white',zIndex:99999});
            _gIW.open(mw._m,NLatLng(this._ll.lat,this._ll.lng));
            return this;
        }
    };

    /* ══════════════════════════════════════════
       네이버 전용 유틸 — kakao 직접 참조 대체
       ══════════════════════════════════════════ */
    // map.js / ui.js의 kakao.maps.XXX 직접 참조를 window.NMaps로 대체
    window.NMaps = {
        // 이벤트
        addListener:   function(target,ev,fn){ return naver.maps.Event.addListener(target,ev,fn); },
        removeListener: function(listener){ naver.maps.Event.removeListener(listener); },

        // LatLng
        LatLng: function(lat,lng){ return new naver.maps.LatLng(lat,lng); },

        // 원 (스냅 표시, 함체 반경)
        Circle: function(opts){
            return new naver.maps.Circle({
                map:       opts.map||null,
                center:    opts.center,
                radius:    opts.radius||10,
                strokeColor:   opts.strokeColor||'#aaa',
                strokeWeight:  opts.strokeWeight||1,
                strokeOpacity: opts.strokeOpacity!=null?opts.strokeOpacity:0.8,
                strokeStyle:   opts.strokeStyle||'solid',
                fillColor:     opts.fillColor||'#ccc',
                fillOpacity:   opts.fillOpacity!=null?opts.fillOpacity:0.15,
                clickable: false
            });
        },

        // 지도 타입
        MapTypeId: {
            ROADMAP: naver.maps.MapTypeId.NORMAL,
            HYBRID:  naver.maps.MapTypeId.HYBRID
        },

        // 드래그 제어
        setDraggable: function(mapInst, bool){
            mapInst.setOptions({draggable:bool});
        },

        // 지도 레벨(줌) 읽기
        getLevel: function(mapInst){ return mapInst.getZoom(); },

        // 지도 타입 변경
        setMapTypeId: function(mapInst, typeId){ mapInst.setMapTypeId(typeId); }
    };

    /* ══════════════════════════════════════════
       L (Leaflet 호환 API)
       ══════════════════════════════════════════ */
    window.L={
        map:function(id){
            var nm=new naver.maps.Map(document.getElementById(id),{
                center:new naver.maps.LatLng(37.3835,128.6642),
                zoom:14,
                mapTypeId:naver.maps.MapTypeId.NORMAL
            });
            return new KMap(nm);
        },
        tileLayer:function(){return{addTo:function(){}};},
        divIcon:function(o){return{html:o.html||''};},
        marker:function(ll,o){
            var lat=Array.isArray(ll)?ll[0]:ll.lat,lng=Array.isArray(ll)?ll[1]:ll.lng;
            return new Mkr(lat,lng,(o&&o.icon&&o.icon.html)||'',(o&&o.zIndexOffset)||0);
        },
        polyline:function(ll,s){return new Ply(ll,s);},
        circleMarker:function(ll,s){
            var lat=Array.isArray(ll)?ll[0]:ll.lat,lng=Array.isArray(ll)?ll[1]:ll.lng;
            return new CMkr(lat,lng,s);
        },
        latLng:function(a,b){return{lat:a,lng:b};},
        popup:function(){return new Pop();},
        DomEvent:{stopPropagation:function(e){if(e&&e.stopPropagation)e.stopPropagation();if(e&&e.originalEvent&&e.originalEvent.stopPropagation)e.originalEvent.stopPropagation();}},
        LineUtil:{pointToSegmentDistance:ptSeg,isFlat:function(){return true;}},
        point:function(x,y){return{x:x,y:y};}
    };
})();
