// Naver Maps Leaflet-compatible shim (OverlayView 방식)
// Client ID: yxe95cu6k2
(function(){
    var _gIW = null;

    function ptSeg(p,p1,p2){var dx=p2.x-p1.x,dy=p2.y-p1.y,l=dx*dx+dy*dy;if(!l)return Math.hypot(p.x-p1.x,p.y-p1.y);var t=Math.max(0,Math.min(1,((p.x-p1.x)*dx+(p.y-p1.y)*dy)/l));return Math.hypot(p.x-(p1.x+t*dx),p.y-(p1.y+t*dy));}
    function NLatLng(lat,lng){return new naver.maps.LatLng(lat,lng);}

    /* KMap */
    function KMap(nm){this._m=nm;this._ls={};}
    KMap.prototype={
        setView:function(ll,z){this._m.setCenter(NLatLng(ll[0],ll[1]));this._m.setZoom(z);return this;},
        getLevel:function(){return this._m.getZoom();},
        _wfn:function(fn){return function(me){if(me&&me.coord)fn({latlng:{lat:me.coord.lat(),lng:me.coord.lng()}});else fn({});};},
        on:function(ev,fn){
            var self=this,nm=this._m;
            if(ev==='moveend'){naver.maps.Event.addListener(nm,'center_changed',function(){fn({});});naver.maps.Event.addListener(nm,'zoom_changed',function(){fn({});});return this;}
            if(ev==='click'){var w=function(me){fn({latlng:{lat:me.coord.lat(),lng:me.coord.lng()}});};if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push({fn:fn,w:w});naver.maps.Event.addListener(nm,ev,w);return this;}
            var w2=this._wfn(fn);if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push({fn:fn,w:w2});naver.maps.Event.addListener(nm,ev,w2);return this;
        },
        once:function(ev,fn){var self=this;var w=function(me){self._rm(ev,fn);if(me&&me.coord)fn({latlng:{lat:me.coord.lat(),lng:me.coord.lng()}});else fn({});};if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push({fn:fn,w:w});naver.maps.Event.addListener(this._m,ev,w);return this;},
        off:function(ev,fn){this._rm(ev,fn);return this;},
        _rm:function(ev,fn){if(!this._ls[ev])return;var i=this._ls[ev].findIndex(function(l){return l.fn===fn;});if(i!==-1){naver.maps.Event.removeListener(this._ls[ev][i].w);this._ls[ev].splice(i,1);}},
        removeLayer:function(l){if(l&&typeof l.setMap==='function')l.setMap(null);return this;},
        closePopup:function(){if(_gIW){_gIW.close();_gIW=null;}return this;},
        latLngToLayerPoint:function(ll){
            var proj=this._m.getProjection();
            // fromCoordToOffset은 타일 기준 전체 픽셀 좌표
            // 컨테이너 기준으로 변환: 현재 중심점 offset 차이를 빼고 컨테이너 중심을 더함
            var targetOfs = proj.fromCoordToOffset(NLatLng(ll.lat,ll.lng));
            var centerOfs = proj.fromCoordToOffset(this._m.getCenter());
            var el = this._m.getElement();
            var cx = el.offsetWidth/2, cy = el.offsetHeight/2;
            return {x: targetOfs.x - centerOfs.x + cx, y: targetOfs.y - centerOfs.y + cy};
        },
        containerPointToLatLng:function(pt){var coord=this._m.getProjection().fromOffsetToCoord(new naver.maps.Point(pt.x,pt.y));return{lat:coord.lat(),lng:coord.lng()};},
        getContainer:function(){return this._m.getElement();}
    };

    /* HtmlOverlay — OverlayView 기반 (카카오 CustomOverlay와 동일 방식) */
    function HtmlOverlay(lat,lng,el,zIdx){
        this._pos=NLatLng(lat,lng);this._el=el;this._zIdx=zIdx||0;
    }
    HtmlOverlay.prototype=new naver.maps.OverlayView();
    HtmlOverlay.prototype.onAdd=function(){
        var pane=this.getPanes().overlayLayer;
        this._el.style.position='absolute';
        this._el.style.left='0';
        this._el.style.top='0';
        this._el.style.willChange='transform';
        this._el.style.zIndex=this._zIdx;
        pane.appendChild(this._el);
    };
    HtmlOverlay.prototype.draw=function(){
        if(!this.getMap())return;
        var pt=this.getProjection().fromCoordToOffset(this._pos);
        this._el.style.transform='translate('+pt.x+'px,'+pt.y+'px)';
    };
    HtmlOverlay.prototype.onRemove=function(){
        if(this._el&&this._el.parentNode)this._el.parentNode.removeChild(this._el);
    };
    HtmlOverlay.prototype.setPosition=function(lat,lng){this._pos=NLatLng(lat,lng);this.draw();};

    /* Mkr */
    function Mkr(lat,lng,html,z){this._lat=lat;this._lng=lng;this._html=html;this._z=z||0;this._ov=null;this._mr=null;this._ls={};}
    Mkr.prototype={
        addTo:function(mw){
            var self=this;this._mr=mw;
            var d=document.createElement('div');
            d.innerHTML=this._html;
            d.style.cssText='pointer-events:all;position:absolute;';
            d.addEventListener('click',function(e){e.stopPropagation();if(self._ls.click)self._ls.click.forEach(function(f){f();});});
            this._ov=new HtmlOverlay(this._lat,this._lng,d,10+Math.floor(this._z/1000));
            this._ov.setMap(mw._m);
            return this;
        },
        setMap:function(m){if(this._ov)this._ov.setMap(m?m._m:null);return this;},
        on:function(ev,fn){if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push(fn);return this;},
        bindPopup:function(h){
            var self=this;
            if(!this._ls.click)this._ls.click=[];
            this._ls.click.push(function(){
                if(_gIW){_gIW.close();_gIW=null;}
                _gIW=new naver.maps.InfoWindow({content:'<div style="padding:8px;min-width:120px;">'+h+'</div>',borderWidth:0,backgroundColor:'white',zIndex:99999});
                _gIW.open(self._mr._m,NLatLng(self._lat,self._lng));
            });
            return this;
        }
    };

    /* Ply */
    function Ply(ll,s){this._ll=ll;this._s=s||{};this._line=null;this._ls={};}
    Ply.prototype={
        addTo:function(mw){
            var self=this,path=this._ll.map(function(p){return NLatLng(p[0],p[1]);}),s=this._s;
            this._line=new naver.maps.Polyline({map:mw._m,path:path,strokeColor:s.color||'#F00',strokeWeight:s.weight||3,strokeOpacity:s.opacity!=null?s.opacity:0.8,strokeStyle:s.dashArray?'shortdash':'solid',clickable:true});
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

    /* CMkr — waypoint 원형 마커 */
    function CMkr(lat,lng,s){this._lat=lat;this._lng=lng;this._s=s||{};this._ov=null;this._mr=null;this._ph=null;}
    CMkr.prototype={
        addTo:function(mw){
            var self=this,s=this._s,r=(s.radius||5)*2,op=s.fillOpacity!=null?s.fillOpacity:1;
            this._mr=mw;
            var d=document.createElement('div');
            d.style.cssText='width:'+r+'px;height:'+r+'px;border-radius:50%;background:'+(s.fillColor||'#f00')+';border:'+(s.weight||2)+'px solid '+(s.color||'#fff')+';opacity:'+(op>0?1:0)+';cursor:'+(op>0?'pointer':'default')+';pointer-events:all;position:absolute;';
            d.addEventListener('click',function(e){
                e.stopPropagation();
                if(self._ph){if(_gIW){_gIW.close();_gIW=null;}_gIW=new naver.maps.InfoWindow({content:'<div style="padding:8px;min-width:120px;">'+self._ph+'</div>',borderWidth:0,backgroundColor:'white',zIndex:99999});_gIW.open(self._mr._m,NLatLng(self._lat,self._lng));}
            });
            var half=-r/2;
            this._ov=new HtmlOverlay(this._lat,this._lng,d,9+Math.floor((s.zIndexOffset||0)/1000));
            // 센터 오프셋을 draw에 반영
            (function(ov,h){
                ov.draw=function(){
                    if(!this.getMap())return;
                    var pt=this.getProjection().fromCoordToOffset(this._pos);
                    this._el.style.transform='translate('+(pt.x+h)+'px,'+(pt.y+h)+'px)';
                };
            })(this._ov, half);
            this._ov.setMap(mw._m);
            return this;
        },
        setMap:function(m){if(this._ov)this._ov.setMap(m?m._m:null);return this;},
        bindPopup:function(h){this._ph=h;return this;},
        on:function(){return this;}
    };

    /* Pop */
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

    /* NMaps 유틸 */
    window.NMaps={
        addListener:    function(target,ev,fn){return naver.maps.Event.addListener(target,ev,fn);},
        removeListener: function(listener){if(listener)naver.maps.Event.removeListener(listener);},
        LatLng:         function(lat,lng){return new naver.maps.LatLng(lat,lng);},
        Circle:function(opts){return new naver.maps.Circle({map:opts.map||null,center:opts.center,radius:opts.radius||10,strokeColor:opts.strokeColor||'#aaa',strokeWeight:opts.strokeWeight||1,strokeOpacity:opts.strokeOpacity!=null?opts.strokeOpacity:0.8,strokeStyle:opts.strokeStyle||'solid',fillColor:opts.fillColor||'#ccc',fillOpacity:opts.fillOpacity!=null?opts.fillOpacity:0.15,clickable:false});},
        MapTypeId:{ROADMAP:naver.maps.MapTypeId.NORMAL,HYBRID:naver.maps.MapTypeId.HYBRID},
        setDraggable:function(mapInst,bool){mapInst.setOptions({draggable:bool});},
        getLevel:function(mapInst){return mapInst.getZoom();},
        setMapTypeId:function(mapInst,typeId){mapInst.setMapTypeId(typeId);}
    };

    /* L — Leaflet 호환 */
    window.L={
        map:function(id){var nm=new naver.maps.Map(document.getElementById(id),{center:new naver.maps.LatLng(37.3835,128.6642),zoom:14,mapTypeId:naver.maps.MapTypeId.NORMAL});return new KMap(nm);},
        tileLayer:function(){return{addTo:function(){}};},
        divIcon:function(o){return{html:o.html||''};},
        marker:function(ll,o){var lat=Array.isArray(ll)?ll[0]:ll.lat,lng=Array.isArray(ll)?ll[1]:ll.lng;return new Mkr(lat,lng,(o&&o.icon&&o.icon.html)||'',(o&&o.zIndexOffset)||0);},
        polyline:function(ll,s){return new Ply(ll,s);},
        circleMarker:function(ll,s){var lat=Array.isArray(ll)?ll[0]:ll.lat,lng=Array.isArray(ll)?ll[1]:ll.lng;return new CMkr(lat,lng,s);},
        latLng:function(a,b){return{lat:a,lng:b};},
        popup:function(){return new Pop();},
        DomEvent:{stopPropagation:function(e){if(e&&e.stopPropagation)e.stopPropagation();if(e&&e.originalEvent&&e.originalEvent.stopPropagation)e.originalEvent.stopPropagation();}},
        LineUtil:{pointToSegmentDistance:ptSeg,isFlat:function(){return true;}},
        point:function(x,y){return{x:x,y:y};}
    };
})();
