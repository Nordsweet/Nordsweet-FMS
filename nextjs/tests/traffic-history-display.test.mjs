import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('History arriving for an uppercase aircraft refreshes the map immediately',async()=>{
  const source=fs.readFileSync('src/runtime/airspaces-map.js','utf8');
  const start=source.indexOf('      async function loadTrafficHistory(');
  const remoteTrafficHistories=new Map();
  let mapRenders=0;
  let detailRenders=0;
  const scope={remoteTrafficHistories,AbortController,window:{setTimeout,clearTimeout},
    COLLECTOR_TRAFFIC_URL:'https://collector.example/traffic',
    state:{selectedTraffic:{hex:'ABCDEF'}},
    normalizeTrafficHistorySamples:rows=>rows,
    renderMap:()=>mapRenders++,renderTrafficMenuDetails:()=>detailRenders++,
    fetch:async url=>{
      assert.equal(url,'https://collector.example/traffic/abcdef/history');
      return {ok:true,json:async()=>({hex:'ABCDEF',history:[{sampledAt:1},{sampledAt:2}]})};
    }};
  vm.createContext(scope);
  vm.runInContext(source.slice(start,source.indexOf('\n      function ',start+1)),scope);
  await scope.loadTrafficHistory({hex:'ABCDEF'});
  assert.equal(remoteTrafficHistories.get('abcdef').samples.length,2);
  assert.equal(mapRenders,1);
  assert.equal(detailRenders,1);
  scope.state.selectedTraffic={hex:'123456'};
  remoteTrafficHistories.clear();
  await scope.loadTrafficHistory({hex:'ABCDEF'});
  assert.equal(mapRenders,1,'Do not redraw a different aircraft after selection changes');
});

test('Selected traffic keeps all remote samples before session and appends new live positions',()=>{
  const source=fs.readFileSync('src/runtime/airspaces-map.js','utf8');
  const start=source.indexOf('      function selectedTrafficHistory(');
  const scope={remoteTrafficHistories:new Map([['abcdef',{samples:[{sampledAt:-2,callsign:'LOT1'},{sampledAt:0,callsign:'LOT2'},{sampledAt:1,callsign:'LOT1'},{sampledAt:2,callsign:'LOT1'}]}]]),
    state:{traffic:{historyById:new Map([['abcdef',[{sampledAt:2,callsign:'LOT1'},{sampledAt:3,callsign:'LOT1'}]]])}},trafficHistoryKey:t=>t.hex,getTrafficCallsign:t=>t.callsign || ''};
  vm.createContext(scope);
  vm.runInContext(source.slice(start,source.indexOf('\n      function ',start+1)),scope);
  const result=scope.selectedTrafficHistory({id:'abcdef',hex:'abcdef',callsign:' lot1 '});
  assert.equal(result.map(p=>p.sampledAt).join(','),'1,2,3');
  assert.equal(scope.selectedTrafficHistory({id:'abcdef',hex:'abcdef',callsign:'LOT2'}).length,0);
  assert.equal(scope.selectedTrafficHistory({id:'abcdef',hex:'abcdef'}).length,0);
});
test('COMMs replaces estimated change and duplicate Next row with a plain suggestion',()=>{
  const source=fs.readFileSync('src/runtime/index.js','utf8');
  const start=source.indexOf('function renderFlightCommsBody(');
  const scope={state:{performancePhase:'cruise'},escapeHtml:String,flightCommsData:{phase:'cruise',receivedAt:Date.now(),
    current:[],next:[{callsign:'Kraków Informacja',serviceId:'fiss',frequencyMhz:'119.275'}]}};
  scope.window=scope;vm.createContext(scope);
  vm.runInContext(fs.readFileSync('public/comms.js','utf8'),scope);
  vm.runInContext(source.slice(start,source.indexOf('\nfunction ',start+1)),scope);
  const html=scope.renderFlightCommsBody();
  assert.ok(html.includes('Suggested frequency change to 119.275 Kraków Informacja (FIS)'));
  assert.ok(!html.includes('Estimated change'));
  assert.equal((html.match(/119.275/g)||[]).length,1);
  scope.flightCommsData.next=[];
  assert.ok(!scope.renderFlightCommsBody().includes('Suggested frequency change'));
});
