import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const engine=fs.readFileSync('src/runtime/index.js','utf8');
function fn(name){const start=engine.indexOf('function '+name+'(');assert.ok(start>=0);return engine.slice(start,engine.indexOf('\nfunction ',start+1));}
test('TOC at and near a waypoint survives profile insertion',()=>{
 const scope={PLANNER_PROFILE_POINT_EPSILON_NM:0.25,toNumber:(v,f)=>Number.isFinite(Number(v))?Number(v):f,lerp:(a,b,t)=>a+(b-a)*t};vm.createContext(scope);
 vm.runInContext(fn('interpolatePlannerPointAlongLeg')+fn('insertPlannerProfilePoints'),scope);
 const points=[0,10,50].map((d,i)=>({id:'P'+i,routeDistanceNm:d,lat:d,lon:d}));
 for(const distance of [10,10.005,20]){
   const result=scope.insertPlannerProfilePoints(points,[{id:'TOC',name:'TOC',routeDistanceNm:distance}]);
   assert.equal(result.filter(p=>p.id==='TOC'||p.profileLabels?.includes('TOC')).length,1);
 }
 assert.equal(points[1].profileLabels,undefined);
});
test('Missing altitude is not a zero-foot restriction',()=>{
 const scope={cleanAtisValue:v=>String(v??'').trim(),getPlannerWaypointKey:p=>p.id,getPlannerWaypointRestriction:()=>scope.restriction};vm.createContext(scope);
 vm.runInContext(fn('getPlannerUserAltitudeRestrictionForPoint'),scope);
 for(const restriction of [null,{}, {speedKt:100},{altitudeFt:null},{altitudeFt:''}]){scope.restriction=restriction;assert.equal(scope.getPlannerUserAltitudeRestrictionForPoint({id:'A'}),null);}
 for(const altitudeFt of [0,4000]){scope.restriction={altitudeFt};assert.equal(scope.getPlannerUserAltitudeRestrictionForPoint({id:'A'}).minFt,altitudeFt);}
});
test('COMMs estimates 5 NM at 120 kt as 150 seconds and suppresses stale GPS',()=>{
 const scope={};vm.createContext(scope);vm.runInContext(fs.readFileSync('public/comms.js','utf8'),scope);
 const rows=[{frequencyMhz:'119.275',callsign:'West'},{frequencyMhz:'119.950',callsign:'East'}];
 const api={distance:(a,b)=>Math.hypot(a.lat-b.lat,a.lon-b.lon),fraction:(p,a,b)=>Math.max(0,Math.min(1,(p.lon-a.lon)/(b.lon-a.lon))),at:p=>[rows[p.lon<10?0:1]],airport:()=>[]};
 const input={phase:'cruise',sample:{latitude:0,longitude:5,sampledAt:Date.now(),speedKt:120},route:[{lat:0,lon:0},{lat:0,lon:20}],plannedSpeedKt:100};
 const estimate=scope.NordsweetComms.estimate(input,api);assert.equal(estimate.distanceNm,5);assert.equal(estimate.seconds,150);
 input.sample.sampledAt=1;assert.equal(scope.NordsweetComms.estimate(input,api).seconds,null);
});
