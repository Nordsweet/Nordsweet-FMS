import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('Selected traffic keeps all remote samples before session and appends new live positions',()=>{
  const source=fs.readFileSync('src/runtime/airspaces-map.js','utf8');
  const start=source.indexOf('      function selectedTrafficHistory(');
  const scope={remoteTrafficHistories:new Map([['abcdef',{samples:[{sampledAt:1},{sampledAt:2}]}]]),
    state:{traffic:{historyById:new Map([['abcdef',[{sampledAt:2},{sampledAt:3}]]])}},trafficHistoryKey:t=>t.hex};
  vm.createContext(scope);
  vm.runInContext(source.slice(start,source.indexOf('\n      function ',start+1)),scope);
  const result=scope.selectedTrafficHistory({id:'abcdef',hex:'abcdef'});
  assert.equal(result.map(p=>p.sampledAt).join(','),'1,2,3');
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
