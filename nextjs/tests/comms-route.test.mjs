import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scope={console,localStorage:{getItem:()=>null}};
scope.window=scope;
vm.createContext(scope);
for(const file of ['airports.js','airport-frequencies-data.js','airspace-tools.js','comms.js']) {
  vm.runInContext(fs.readFileSync('public/'+file,'utf8'),scope);
}
const engine=fs.readFileSync('src/runtime/airspaces-map.js','utf8');
const names=['normalizeZoneType','isEnrouteInfoZone','serviceMatches','airportRowsByServices',
  'normalizeFrequencyText','frequenciesFromZoneName','commsZoneRows','buildCommsPlan',
  'infoZoneFrequencyRows','normalizeZoneFrequencyRows','uniqueZoneFrequencyRows',
  'frequencyValue','segmentFraction','parseAirspaceAltitude'];
scope.T=scope.AirspaceTools;
scope.AIRSPACE_TYPE_FILTERS=['FIS','FIR','TMA','ATZ'];
scope.state={zones:scope.T.parseOpenAir(fs.readFileSync('public/airspace-data/Poland_Airspaces.txt','utf8'),'test')};
for(const name of names){
  const start=engine.indexOf('      function '+name+'(');
  assert.ok(start>=0,name);
  const end=engine.indexOf('\n      function ',start+1);
  vm.runInContext(engine.slice(start,end),scope);
}
const route=[{id:'EPNT',lat:49.462,lon:20.05,altitudeFt:3000},
  {id:'EPKK',lat:50.0777,lon:19.7848,altitudeFt:3000}];
const plan=points=>scope.buildCommsPlan({phase:'descent',route:points,plannedSpeedKt:120});
const rows=result=>result.routeGroups.flatMap(g=>g.rows);

test('EPNT–EPKK includes West, omits East and includes destination ATIS/TWR/GND',()=>{
  const result=plan(route);
  assert.ok(rows(result).some(r=>r.frequencyMhz==='119.275'));
  assert.ok(!rows(result).some(r=>r.frequencyMhz==='119.950'));
  for(const service of ['atis','tower','ground']){
    assert.ok(result.airportGroups.some(g=>g.rows.some(r=>r.serviceId===service)),service);
  }
  assert.ok(result.airportGroups.some(g=>g.name==='EPKK · APP'));
});
test('Flight below the TMA base does not get APP in groups or phase suggestion',()=>{
  const result=plan(route.map(p=>({...p,altitudeFt:2000})));
  assert.ok(!result.airportGroups.some(g=>g.name.endsWith('APP')));
  assert.ok(!result.routeGroups.some(g=>g.name.startsWith('TMA')));
  assert.ok(result.current.every(r=>r.serviceId!=='zblizanie' && r.serviceId!=='radar'));
});
test('Crossing the East sector includes East; route changes do not retain old sectors',()=>{
  const east=[{id:'A',lat:49.8,lon:21,altitudeFt:3000},{id:'B',lat:50,lon:21,altitudeFt:3000}];
  assert.ok(rows(plan(east)).some(r=>r.frequencyMhz==='119.950'));
  assert.ok(!rows(plan(route)).some(r=>r.frequencyMhz==='119.950'));
});
test('Altitude clipping excludes climb after leaving TMA, handles entry, upper bound and unknown altitude',()=>{
  const zone={shape:'polygon',points:[{lat:-1,lon:0},{lat:1,lon:0},{lat:1,lon:2},{lat:-1,lon:2}]};
  const check=(a,b)=>scope.NordsweetComms.routeIntersectsVolume(
    [{lat:0,lon:-1,altitudeFt:a},{lat:0,lon:5,altitudeFt:b}],zone,3000,5000,scope.T.routeIntersectsZone);
  assert.equal(check(1000,4000),false);
  assert.equal(check(2000,5000),true);
  assert.equal(check(5000,5000),false);
  assert.equal(check(null,4000),false);
  assert.equal(check(3500,3500),true);
});
test('Missing route or altitude never implies TMA entry',()=>{
  assert.equal(plan([]).airportGroups.length,0);
  assert.ok(!plan(route.map(({altitudeFt,...p})=>p)).airportGroups.some(g=>g.name.endsWith('APP')));
});
test('Default JSON database also resolves West without East after duplicate-ring normalization',()=>{
  const original=scope.state.zones;
  try {
    scope.state.zones=JSON.parse(fs.readFileSync('public/airspaces.json','utf8')).zones
      .map(z=>({...z,points:scope.T.normalizeRetracedPolygon(z.points || [])}));
    const result=plan(route);
    assert.ok(rows(result).some(r=>r.frequencyMhz==='119.275'));
    assert.ok(!rows(result).some(r=>r.frequencyMhz==='119.950'));
    for(const service of ['atis','tower','ground','zblizanie']) {
      assert.ok(result.airportGroups.some(g=>g.rows.some(r=>r.serviceId===service)),service);
    }
  } finally {scope.state.zones=original;}
});
test('Polygon normalization preserves separate hole geometry',()=>{
  const outer=[{lat:0,lon:0},{lat:0,lon:4},{lat:4,lon:4},{lat:4,lon:0},{lat:0,lon:0}];
  const hole=[{lat:1,lon:1},{lat:2,lon:1},{lat:2,lon:2},{lat:1,lon:2},{lat:1,lon:1}];
  const points=[...outer,...hole];
  assert.deepEqual(scope.T.normalizeRetracedPolygon(points),points);
});
