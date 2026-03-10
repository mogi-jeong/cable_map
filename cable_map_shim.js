// Kakao Maps Leaflet-compatible shim
(function(){
    var _gIW=null;
    function _openIW(m,pos,html){if(_gIW)_gIW.close();_gIW=new kakao.maps.InfoWindow({position:pos,content:html,removable:true,zIndex:99999});_gIW.open(m);}
    function ptSeg(p,p1,p2){var dx=p2.x-p1.x,dy=p2.y-p1.y,l=dx*dx+dy*dy;if(!l)return Math.hypot(p.x-p1.x,p.y-p1.y);var t=Math.max(0,Math.min(1,((p.x-p1.x)*dx+(p.y-p1.y)*dy)/l));return Math.hypot(p.x-(p1.x+t*dx),p.y-(p1.y+t*dy));}

    function KMap(km){this._m=km;this._ls={};}
    KMap.prototype={
        setView:function(ll,z){this._m.setCenter(new kakao.maps.LatLng(ll[0],ll[1]));this._m.setLevel(Math.max(1,Math.min(14,18-z)));return this;},
        _wfn:function(fn){return function(me){var lat=me&&me.latLng?me.latLng.getLat():null,lng=me&&me.latLng?me.latLng.getLng():null;fn(lat!=null?{latlng:{lat:lat,lng:lng}}:{});};},
        on:function(ev,fn){
            if(ev==='moveend'){
                kakao.maps.event.addListener(this._m,'center_changed',function(){fn({});});
                kakao.maps.event.addListener(this._m,'zoom_changed',function(){fn({});});
                return this;
            }
            if(ev==='move'){
                // 카카오맵은 드래그 중 'drag' 이벤트 발생
                kakao.maps.event.addListener(this._m,'drag',function(){fn({});});
                return this;
            }
            if(ev==='zoomend'){
                // zoom_changed: 줌 레벨이 바뀐 시점 (애니메이션 시작)
                kakao.maps.event.addListener(this._m,'zoom_changed',function(){fn({});});
                return this;
            }
            var w=this._wfn(fn);
            if(!this._ls[ev])this._ls[ev]=[];
            this._ls[ev].push({fn:fn,w:w});
            kakao.maps.event.addListener(this._m,ev,w);
            return this;
        },
        once:function(ev,fn){var self=this,w=function(me){self._rm(ev,fn);var lat=me&&me.latLng?me.latLng.getLat():null,lng=me&&me.latLng?me.latLng.getLng():null;fn(lat!=null?{latlng:{lat:lat,lng:lng}}:{});};if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push({fn:fn,w:w});kakao.maps.event.addListener(this._m,ev,w);return this;},
        off:function(ev,fn){this._rm(ev,fn);return this;},
        _rm:function(ev,fn){if(!this._ls[ev])return;var i=this._ls[ev].findIndex(function(l){return l.fn===fn;});if(i!==-1){kakao.maps.event.removeListener(this._m,ev,this._ls[ev][i].w);this._ls[ev].splice(i,1);}},
        removeLayer:function(l){if(l&&typeof l.setMap==='function')l.setMap(null);return this;},
        closePopup:function(){if(_gIW)_gIW.close();return this;},
        latLngToLayerPoint:function(ll){var p=this._m.getProjection().containerPointFromCoords(new kakao.maps.LatLng(ll.lat,ll.lng));return{x:p.x,y:p.y};},
        containerPointToLatLng:function(pt){var c=this._m.getProjection().coordsFromContainerPoint(new kakao.maps.Point(pt.x,pt.y));return{lat:c.getLat(),lng:c.getLng()};},
        getContainer:function(){return this._m.getNode();},
        getZoom:function(){return 18-this._m.getLevel();},
        getBounds:function(){
            var b=this._m.getBounds();
            var sw=b.getSouthWest();
            var ne=b.getNorthEast();
            return{
                getSW:function(){return{lat:function(){return sw.getLat();},lng:function(){return sw.getLng();}};},
                getNE:function(){return{lat:function(){return ne.getLat();},lng:function(){return ne.getLng();}};}
            };
        }
    };

    function Mkr(lat,lng,html,z){this._lat=lat;this._lng=lng;this._html=html;this._z=z||0;this._ov=null;this._mr=null;this._ls={};}
    Mkr.prototype={
        addTo:function(mw){
            var self=this;this._mr=mw;
            var d=document.createElement('div');
            d.innerHTML=this._html;
            var noClick=this._z<0;
            d.style.cssText='pointer-events:'+(noClick?'none':'all')+';position:relative;z-index:'+(noClick?'1':'9999')+';';
            if(!noClick)d.addEventListener('click',function(e){e.stopPropagation();if(self._ls.click)self._ls.click.forEach(function(f){f();});});
            this._ov=new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(this._lat,this._lng),content:d,map:mw._m,zIndex:10+Math.floor(this._z/1000),yAnchor:0.5,xAnchor:0.5});
            return this;
        },
        setMap:function(m){if(this._ov)this._ov.setMap(m?m._m:null);return this;},
        on:function(ev,fn){if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push(fn);return this;},
        bindPopup:function(h){var self=this;if(!this._ls.click)this._ls.click=[];this._ls.click.push(function(){_openIW(self._mr._m,new kakao.maps.LatLng(self._lat,self._lng),'<div style="padding:5px;min-width:120px;">'+h+'</div>');});return this;}
    };

    function Ply(ll,s){this._ll=ll;this._s=s||{};this._line=null;this._ls={};}
    Ply.prototype={
        addTo:function(mw){
            var self=this,path=this._ll.map(function(p){return new kakao.maps.LatLng(p[0],p[1]);});
            this._line=new kakao.maps.Polyline({map:mw._m,path:path,strokeColor:this._s.color||'#F00',strokeWeight:this._s.weight||3,strokeOpacity:this._s.opacity!=null?this._s.opacity:0.8,strokeStyle:this._s.dashArray?'shortdash':'solid'});
            var last=0;
            kakao.maps.event.addListener(this._line,'click',function(me){
                if(!me||!me.latLng)return; // 카카오 내부 이벤트 null 방어
                var ev={latlng:{lat:me.latLng.getLat(),lng:me.latLng.getLng()},originalEvent:me},now=Date.now();
                if(self._ls.click)self._ls.click.forEach(function(f){f(ev);});
                if(now-last<400&&self._ls.dblclick)self._ls.dblclick.forEach(function(f){f(ev);});
                last=now;
            });
            return this;
        },
        on:function(ev,fn){if(ev.startsWith('touch'))return this;if(!this._ls[ev])this._ls[ev]=[];this._ls[ev].push(fn);return this;},
        setMap:function(m){if(this._line)this._line.setMap(m?m._m:null);return this;}
    };

    function CMkr(lat,lng,s){this._lat=lat;this._lng=lng;this._s=s||{};this._ov=null;this._mr=null;this._ph=null;}
    CMkr.prototype={
        addTo:function(mw){
            var self=this,s=this._s,r=(s.radius||5)*2,op=s.fillOpacity!=null?s.fillOpacity:1;
            this._mr=mw;
            var d=document.createElement('div');
            d.style.cssText='width:'+r+'px;height:'+r+'px;border-radius:50%;background:'+(s.fillColor||'#f00')+';border:'+(s.weight||2)+'px solid '+(s.color||'#fff')+';opacity:'+(op>0?1:0)+';cursor:'+(op>0?'pointer':'default')+';pointer-events:all;position:relative;z-index:8999;';
            d.addEventListener('click',function(e){e.stopPropagation();if(self._ph){_openIW(self._mr._m,new kakao.maps.LatLng(self._lat,self._lng),'<div style="padding:5px;min-width:120px;">'+self._ph+'</div>');}});
            this._ov=new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(this._lat,this._lng),content:d,map:mw._m,zIndex:9+Math.floor((s.zIndexOffset||0)/1000),yAnchor:0.5,xAnchor:0.5});
            return this;
        },
        setMap:function(m){if(this._ov)this._ov.setMap(m?m._m:null);return this;},
        bindPopup:function(h){this._ph=h;return this;},
        on:function(){return this;}
    };

    function Pop(){this._ll=null;this._c=null;}
    Pop.prototype={
        setLatLng:function(ll){this._ll=ll;return this;},
        setContent:function(c){this._c=c;return this;},
        openOn:function(mw){_openIW(mw._m,new kakao.maps.LatLng(this._ll.lat,this._ll.lng),'<div style="padding:5px;min-width:150px;">'+this._c+'</div>');return this;}
    };

    window.L={
        map:function(id){var km=new kakao.maps.Map(document.getElementById(id),{center:new kakao.maps.LatLng(37.3422,127.9202),level:5});return new KMap(km);},
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
