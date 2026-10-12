/* Route-based radio suggestions. ATC handoffs always take precedence. */
(function (root) {
  function unique(rows) {
    const seen = new Set();
    return (rows || []).filter(r => {
      const key = [r.frequencyMhz, r.callsign, r.sector].join('|');
      if (!r.frequencyMhz || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function key(rows) { return unique(rows).map(r => [r.frequencyMhz,r.callsign,r.sector].join('|')).sort().join(';'); }
  // Clip each leg to the altitude band before checking its horizontal intersection.
  // This avoids counting a TMA crossed below its base or climbed into only after exit.
  function routeIntersectsVolume(route, zone, lowerFt, upperFt, intersects) {
    if (!Number.isFinite(lowerFt) || !(upperFt > lowerFt)) return false;
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i];
      if (!Number.isFinite(a.altitudeFt) || !Number.isFinite(b.altitudeFt)) continue;
      const delta = b.altitudeFt - a.altitudeFt;
      let from = 0, to = 1;
      if (!delta) {
        if (a.altitudeFt < lowerFt || a.altitudeFt >= upperFt) continue;
      } else {
        const first = (lowerFt - a.altitudeFt) / delta;
        const last = (upperFt - a.altitudeFt) / delta;
        from = Math.max(0, Math.min(first, last));
        to = Math.min(1, Math.max(first, last));
        if (from >= to) continue;
      }
      const point = t => ({lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t});
      if (intersects([point(from), point(to)], zone)) return true;
    }
    return false;
  }
  function estimate(input, api) {
    const {phase, sample, route, plannedSpeedKt} = input;
    const fresh = sample && Number.isFinite(sample.latitude) && Number.isFinite(sample.longitude) &&
      Number.isFinite(sample.sampledAt) && Math.abs(Date.now()-sample.sampledAt) < 30000;
    const point = fresh ? {lat:sample.latitude,lon:sample.longitude} : route[0];
    const enroute = point ? unique(api.at(point)) : [];
    const dep = services => unique(api.airport('dep',services));
    const arr = services => unique(api.airport('arr',services));
    const tower = ['tower','radio'];
    const approach = ['zblizanie','radar'];
    const first = (...lists) => lists.find(rows => rows.length) || [];
    const pairs = {
      taxiout:[first(dep(['ground']),dep(tower)),dep(tower)],
      takeoff:[dep(tower),first(dep(approach),enroute)],
      climb:[first(dep(approach),enroute),enroute],
      descent:[first(arr(approach),arr(tower)),arr(tower)],
      landing:[arr(tower),arr(['ground'])],
      taxiin:[first(arr(['ground']),arr(tower)),[]]
    };
    if (phase !== 'cruise') {
      const pair=pairs[phase] || [[],[]];
      return {current:pair[0],next:key(pair[0])===key(pair[1])?[]:pair[1],note:'Change on ATC instruction / published procedure.',distanceNm:null,seconds:null};
    }
    const result={current:enroute,next:[],distanceNm:null,seconds:null,note:'FIS/FIR and ATZ candidates by horizontal sector. Confirm altitude applicability and ATC instructions.'};
    if (!fresh) { result.current=[];result.note='Waiting for a fresh GPS position to identify the current sector and change point.';return result; }
    if (route.length<2) {result.note+=' Add a route for the next frequency.';return result;}
    let best={distance:Infinity,index:0,t:0};
    for(let i=0;i<route.length-1;i++) {
      const t=api.fraction(point,route[i],route[i+1]);
      const p={lat:route[i].lat+(route[i+1].lat-route[i].lat)*t,lon:route[i].lon+(route[i+1].lon-route[i].lon)*t};
      const distance=api.distance(point,p);
      if(distance<best.distance) best={distance,index:i,t};
    }
    if(best.distance>3) {result.note+=' More than 3 NM off route: change time unavailable.';return result;}
    let travelled=0;
    const initial=key(enroute);
    for(let i=best.index;i<route.length-1;i++) {
      const a=route[i],b=route[i+1],length=api.distance(a,b),start=i===best.index?best.t:0;
      const steps=Math.max(1,Math.ceil(length*(1-start)/0.25));
      for(let j=1;j<=steps;j++) {
        const t=start+(1-start)*j/steps;
        const rows=unique(api.at({lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t}));
        if(key(rows)!==initial) {
          result.next=rows;result.distanceNm=travelled+length*(t-start);
          const gpsSpeed=sample.speedKt;
          const speed=Number.isFinite(gpsSpeed)?gpsSpeed:plannedSpeedKt;
          result.speedSource=Number.isFinite(gpsSpeed)?'GPS GS':'planned GS';
          result.speedKt=speed;
          result.seconds=Number.isFinite(speed)&&speed>1?result.distanceNm/speed*3600:null;
          result.note+=' Approximate route crossing (0.25 NM resolution), not an ATC handoff clearance.';
          return result;
        }
      }
      travelled+=length*(1-start);
    }
    result.next=first(arr(approach),arr(tower));
    if(key(result.next)===initial) result.next=[];
    result.note+=' No further mapped sector boundary; contact arrival service as instructed.';
    return result;
  }
  root.NordsweetComms={estimate,unique,routeIntersectsVolume};
})(typeof window==='undefined'?globalThis:window);
