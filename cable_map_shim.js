// Naver Maps Leaflet-compatible shim
(function(){
    var _gIW=null;
    function _openIW(m,pos,html){
        if(_gIW)_gIW.close();
        _gIW=new naver.maps.InfoWindow({content:'<div style="padding:8px;min-width:120px;">'+html+'</div>',borderWidth:1,anchorSize:{width:10,height:8}});
        _gIW.open(m,pos);
    }
    function ptSeg(p,p1,p2){var dx=p2.x-p1.x,dy=p2.y-p1.y,l=dx*dx+dy*dy;if(!l)return Math.hypot(p.x-p1.x,p.y-p1.y);var t=Math.max(0,Math.min(1,((p.x-p1.x)*dx+(p.y-p1.y)*dy)/l));return Math.hypot(p.x-(p1.x+t*dx),p.y-(p1.y+t*dy));}

    // ── NaverCustomOverlay: naver.maps.OverlayView 서브클래스 ──
    function NaverCustomOverlay(opts){
        this._position=opts.position;
        this._content=opts.content; // DOM element
        this._zIndex=opts.zIndex||0;
        this._xAnchor=opts.xAnchor!=null?opts.xAnchor:0.5;
        this._yAnchor=opts.yAnchor!=null?opts.yAnchor:0.5;
        this._div=null;
        if(opts.map)this.setMap(opts.map);
    }
    NaverCustomOverlay.prototype=new naver.maps.OverlayView();
    NaverCustomOverlay.prototype.constructor=NaverCustomOverlay;
    NaverCustomOverlay.prototype.onAdd=function(){
        var el=this._content;
        if(typeof el==='string'){var d=document.createElement('div');d.innerHTML=el;el=d;}
        this._div=el;
        this._div.style.position='absolute';
        this._div.style.zIndex=this._zIndex;
        this.getPanes().floatPane.appendChild(this._div);
    };
    NaverCustomOverlay.prototype.draw=function(){
        if(!this._div||!this.getMap())return;
        var proj=this.getProjection();
        var pos=proj.fromCoordToOffset(this._position);
        var w=this._div.offsetWidth||0, h=this._div.offsetHeight||0;
        this._div.style.left=(pos.x - w*this._xAnchor)+'px';
        this._div.style.top=(pos.y - h*this._yAnchor)+'px';
    };
    NaverCustomOverlay.prototype.onRemove=function(){
        if(this._div&&this._div.parentNode){this._div.parentNode.removeChild(this._div);}
        this._div=null;
    };
    NaverCustomOverlay.prototype.setPosition=function(pos){this._position=pos;this.draw();};
    NaverCustomOverlay.prototype.getPosition=function(){return this._position;};

    // ── KMap: 지도 래퍼 ──
    function KMap(nm){this._m=nm;this._ls={};}
    KMap.prototype={
        setView:function(ll,z){this._m.setCenter(new naver.maps.LatLng(ll[0],ll[1]));this._m.setZoom(z);return this;},
        _wfn:function(fn){return function(e){var lat=null,lng=null;if(e&&e.coord){lat=e.coord.lat();lng=e.coord.lng();}fn(lat!=null?{latlng:{lat:lat,lng:lng}}:{});};},
        on:function(ev,fn){
            if(ev==='moveend'){
                var h1=naver.maps.Event.addListener(this._m,'idle',function(){fn({});});
                if(!this._ls[ev])this._ls[ev]=[];
                this._ls[ev].push({fn:fn,handles:[h1]});
                return this;
            }
            if(ev==='move'){
                var h=naver.maps.Event.addListener(this._m,'drag',function(){fn({});});
                if(!this._ls[ev])this._ls[ev]=[];
                this._ls[ev].push({fn:fn,handles:[h]});
                return this;
            }
            if(ev==='zoomend'){
                var h=naver.maps.Event.addListener(this._m,'zoom_changed',function(){fn({});});
                if(!this._ls[ev])this._ls[ev]=[];
                this._ls[ev].push({fn:fn,handles:[h]});
                return this;
            }
            var w=this._wfn(fn);
            var h=naver.maps.Event.addListener(this._m,ev,w);
            if(!this._ls[ev])this._ls[ev]=[];
            this._ls[ev].push({fn:fn,handles:[h]});
            return this;
        },
        once:function(ev,fn){
            var self=this;
            var w=function(e){
                self.off(ev,fn);
                var lat=null,lng=null;
                if(e&&e.coord){lat=e.coord.lat();lng=e.coord.lng();}
                fn(lat!=null?{latlng:{lat:lat,lng:lng}}:{});
            };
            var h=naver.maps.Event.addListener(this._m,ev,w);
            if(!this._ls[ev])this._ls[ev]=[];
            this._ls[ev].push({fn:fn,handles:[h]});
            return this;
        },
        off:function(ev,fn){
            if(!this._ls[ev])return this;
            var i=this._ls[ev].findIndex(function(l){return l.fn===fn;});
            if(i!==-1){
                this._ls[ev][i].handles.forEach(function(h){naver.maps.Event.removeListener(h);});
                this._ls[ev].splice(i,1);
            }
            return this;
        },
        removeLayer:function(l){if(l&&typeof l.setMap==='function')l.setMap(null);return this;},
        closePopup:function(){if(_gIW)_gIW.close();return this;},
        latLngToLayerPoint:function(ll){
            var proj=this._m.getProjection(),coord=new naver.maps.LatLng(ll.lat,ll.lng);
            var off=proj.fromCoordToOffset(coord),cOff=proj.fromCoordToOffset(this._m.getCenter()),sz=this._m.getSize();
            return{x:off.x-cOff.x+sz.width/2, y:off.y-cOff.y+sz.height/2};
        },
        containerPointToLatLng:function(pt){
            var proj=this._m.getProjection(),cOff=proj.fromCoordToOffset(this._m.getCenter()),sz=this._m.getSize();
            var c=proj.fromOffsetToCoord(new naver.maps.Point(pt.x-sz.width/2+cOff.x, pt.y-sz.height/2+cOff.y));
            return{lat:c.lat(),lng:c.lng()};
        },
        getContainer:function(){return this._m.getElement();},
        getZoom:function(){return this._m.getZoom();},
        getBounds:function(){
            var b=this._m.getBounds();
            return{
                getSW:function(){return{lat:function(){return b.getSW().lat();},lng:function(){return b.getSW().lng();}};},
                getNE:function(){return{lat:function(){return b.getNE().lat();},lng:function(){return b.getNE().lng();}};}
            };
        },
        // 확장 메서드 (직접 kakao 호출 대체용)
        setDraggable:function(v){this._m.setOptions({draggable:v});},
        setMapType:function(type){this._m.setMapTypeId(type==='skyview'?naver.maps.MapTypeId.HYBRID:naver.maps.MapTypeId.NORMAL);},
        setCenter:function(lat,lng){this._m.setCenter(new naver.maps.LatLng(lat,lng));},
        setLevel:function(lv){this._m.setZoom(18-lv);},
        getCenter:function(){var c=this._m.getCenter();return{lat:c.lat(),lng:c.lng()};},
        getNativeMap:function(){return this._m;}
    };

    // ── Mkr: 마커 (CustomOverlay 기반) ──
    function Mkr(lat,lng,html,z){this._lat=lat;this._lng=lng;this._html=html;this._z=z||0;this._ov=null;this._mr=null;this._ls={};}
    Mkr.prototype={
        addTo:function(mw){
            var self=this;this._mr=mw;
            var d=document.createElement('div');
            d.innerHTML=this._html;
            var noClick=this._z<0;
            d.style.cssText='pointer-events:'+(noClick?'none':'all')+';position:relative;z-index:'+(noClick?'1':'9999')+';';
            if(!noClick)d.addEventListener('click',function(e){e.stopPropagation();if(self._ls.click)self._ls.click.forEach(function(f){f();});});
            this._ov=new NaverCustomOverlay({position:new naver.maps.LatLng(this._lat,this._lng),content:d,map:mw._m,zIndex:10+Math.floor(this._z/1000),yAnchor:0.5,xAnchor:0.5});
            return this;
        },
        setMap:function(m){if(this._ov)this._ov.setMap(m?m._m:null);return this;},
        on:function(ev,fn){if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push(fn);return this;},
        bindPopup:function(h){var self=this;if(!this._ls.click)this._ls.click=[];this._ls.click.push(function(){_openIW(self._mr._m,new naver.maps.LatLng(self._lat,self._lng),h);});return this;}
    };

    // ── Ply: 폴리라인 ──
    function Ply(ll,s){this._ll=ll;this._s=s||{};this._line=null;this._ls={};}
    Ply.prototype={
        addTo:function(mw){
            var self=this,path=this._ll.map(function(p){return new naver.maps.LatLng(p[0],p[1]);});
            this._line=new naver.maps.Polyline({map:mw._m,path:path,strokeColor:this._s.color||'#F00',strokeWeight:this._s.weight||3,strokeOpacity:this._s.opacity!=null?this._s.opacity:0.8,strokeStyle:this._s.dashArray?'shortdash':'solid',clickable:true});
            var last=0;
            naver.maps.Event.addListener(this._line,'click',function(e){
                if(!e||!e.coord)return;
                var ev={latlng:{lat:e.coord.lat(),lng:e.coord.lng()},originalEvent:e},now=Date.now();
                if(self._ls.click)self._ls.click.forEach(function(f){f(ev);});
                if(now-last<400&&self._ls.dblclick)self._ls.dblclick.forEach(function(f){f(ev);});
                last=now;
            });
            return this;
        },
        on:function(ev,fn){if(ev.startsWith('touch'))return this;if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push(fn);return this;},
        setMap:function(m){if(this._line)this._line.setMap(m?m._m:null);return this;}
    };

    // ── CMkr: 원형 마커 (CustomOverlay 기반) ──
    function CMkr(lat,lng,s){this._lat=lat;this._lng=lng;this._s=s||{};this._ov=null;this._mr=null;this._ph=null;}
    CMkr.prototype={
        addTo:function(mw){
            var self=this,s=this._s,r=(s.radius||5)*2,op=s.fillOpacity!=null?s.fillOpacity:1;
            this._mr=mw;
            var d=document.createElement('div');
            d.style.cssText='width:'+r+'px;height:'+r+'px;border-radius:50%;background:'+(s.fillColor||'#f00')+';border:'+(s.weight||2)+'px solid '+(s.color||'#fff')+';opacity:'+(op>0?1:0)+';cursor:'+(op>0?'pointer':'default')+';pointer-events:all;position:relative;z-index:8999;';
            d.addEventListener('click',function(e){e.stopPropagation();if(self._ph){_openIW(self._mr._m,new naver.maps.LatLng(self._lat,self._lng),self._ph);}});
            this._ov=new NaverCustomOverlay({position:new naver.maps.LatLng(this._lat,this._lng),content:d,map:mw._m,zIndex:9+Math.floor((s.zIndexOffset||0)/1000),yAnchor:0.5,xAnchor:0.5});
            return this;
        },
        setMap:function(m){if(this._ov)this._ov.setMap(m?m._m:null);return this;},
        bindPopup:function(h){this._ph=h;return this;},
        on:function(){return this;}
    };

    // ── Pgn: 폴리곤 ──
    function Pgn(ll,s){this._ll=ll;this._s=s||{};this._pgn=null;this._ls={};}
    Pgn.prototype={
        addTo:function(mw){
            var self=this;
            var path=this._ll.map(function(p){return new naver.maps.LatLng(p[0],p[1]);});
            this._pgn=new naver.maps.Polygon({map:mw._m,paths:[path],strokeColor:this._s.color||'#F00',strokeWeight:this._s.weight||3,strokeOpacity:this._s.opacity!=null?this._s.opacity:0.8,strokeStyle:this._s.dashArray?'shortdash':'solid',fillColor:this._s.fillColor||'#F00',fillOpacity:this._s.fillOpacity!=null?this._s.fillOpacity:0.2});
            var last=0;
            naver.maps.Event.addListener(this._pgn,'click',function(e){
                if(!e||!e.coord)return;
                var ev={latlng:{lat:e.coord.lat(),lng:e.coord.lng()}},now=Date.now();
                if(self._ls.click)self._ls.click.forEach(function(f){f(ev);});
                if(now-last<400&&self._ls.dblclick)self._ls.dblclick.forEach(function(f){f(ev);});
                last=now;
            });
            return this;
        },
        setMap:function(m){if(this._pgn)this._pgn.setMap(m?m._m:null);return this;},
        setPath:function(ll){
            this._ll=ll;
            if(this._pgn){var path=ll.map(function(p){return new naver.maps.LatLng(p[0],p[1]);});this._pgn.setPaths([path]);}
        },
        getBounds:function(){
            var lats=this._ll.map(function(p){return p[0];}),lngs=this._ll.map(function(p){return p[1];});
            var minLat=Math.min.apply(null,lats),maxLat=Math.max.apply(null,lats),minLng=Math.min.apply(null,lngs),maxLng=Math.max.apply(null,lngs);
            return{getCenter:function(){return{lat:(minLat+maxLat)/2,lng:(minLng+maxLng)/2};}};
        },
        on:function(ev,fn){if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push(fn);return this;}
    };

    // ── Pop: 팝업 (InfoWindow) ──
    function Pop(){this._ll=null;this._c=null;}
    Pop.prototype={
        setLatLng:function(ll){this._ll=ll;return this;},
        setContent:function(c){this._c=c;return this;},
        openOn:function(mw){_openIW(mw._m,new naver.maps.LatLng(this._ll.lat,this._ll.lng),this._c);return this;}
    };

    // ── NaverCustomOverlay 글로벌 노출 (coax 등에서 직접 사용) ──
    window.NaverCustomOverlay = NaverCustomOverlay;

    // ── 이벤트 호환 레이어 (kakao.maps.event → naver.maps.Event 핸들 매핑) ──
    // kakao: addListener(target, event, fn) / removeListener(target, event, fn)
    // naver: addListener(target, event, fn) → handle / removeListener(handle)
    window._nEvent = {
        add: function(target, event, fn) {
            var handle = naver.maps.Event.addListener(target, event, fn);
            if (!fn.__nHandles) fn.__nHandles = [];
            fn.__nHandles.push(handle);
            return handle;
        },
        remove: function(target, event, fn) {
            if (fn.__nHandles && fn.__nHandles.length) {
                naver.maps.Event.removeListener(fn.__nHandles.pop());
            }
        }
    };

    // ── L.* 글로벌 인터페이스 ──
    window.L={
        map:function(id){var nm=new naver.maps.Map(document.getElementById(id),{center:new naver.maps.LatLng(37.3422,127.9202),zoom:13});return new KMap(nm);},
        tileLayer:function(){return{addTo:function(){}};},
        divIcon:function(o){return{html:o.html||''};},
        marker:function(ll,o){var lat=Array.isArray(ll)?ll[0]:ll.lat,lng=Array.isArray(ll)?ll[1]:ll.lng;return new Mkr(lat,lng,(o&&o.icon&&o.icon.html)||'',(o&&o.zIndexOffset)||0);},
        polyline:function(ll,s){return new Ply(ll,s);},
        polygon:function(ll,s){return new Pgn(ll,s);},
        circleMarker:function(ll,s){var lat=Array.isArray(ll)?ll[0]:ll.lat,lng=Array.isArray(ll)?ll[1]:ll.lng;return new CMkr(lat,lng,s);},
        latLng:function(a,b){return{lat:a,lng:b};},
        popup:function(){return new Pop();},
        DomEvent:{stopPropagation:function(e){if(e&&e.stopPropagation)e.stopPropagation();if(e&&e.originalEvent&&e.originalEvent.stopPropagation)e.originalEvent.stopPropagation();}},
        LineUtil:{pointToSegmentDistance:ptSeg,isFlat:function(){return true;}},
        point:function(x,y){return{x:x,y:y};}
    };
})();
