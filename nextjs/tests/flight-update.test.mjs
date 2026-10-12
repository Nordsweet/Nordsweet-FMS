import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('src/runtime/index.js','utf8');
function extract(name){
  const start=source.indexOf('function '+name+'(');
  return source.slice(start,source.indexOf('\nfunction ',start+1));
}
function setup(){
  let reloads=0;
  const classes=new Set(),storage=new Map(),queue=[];
  const context={refs:{flightModal:{hidden:true},flightDebriefModal:{hidden:true}},
    document:{body:{classList:{contains:key=>classes.has(key),toggle:(key,on)=>on?classes.add(key):classes.delete(key)}}},
    window:{setTimeout:fn=>queue.push(fn),sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},location:{reload:()=>reloads++}}};
  vm.createContext(context);
  vm.runInContext('let serviceWorkerRefreshPending=false;const SERVICE_WORKER_REFRESH_KEY="test";'+extract('syncBodyModalState')+extract('reloadAfterServiceWorkerUpdate'),context);
  return {context,queue,reloads:()=>reloads};
}
test('First Start a flight remains open when a background update arrives; reload waits for debrief close',()=>{
  const {context:c,queue,reloads}=setup();
  c.refs.flightModal.hidden=false;c.syncBodyModalState();
  c.reloadAfterServiceWorkerUpdate();c.reloadAfterServiceWorkerUpdate();
  assert.equal(reloads(),0);assert.equal(c.refs.flightModal.hidden,false);
  c.refs.flightDebriefModal.hidden=false;c.refs.flightModal.hidden=true;c.syncBodyModalState();
  assert.equal(queue.length,0);
  c.refs.flightDebriefModal.hidden=true;c.syncBodyModalState();
  queue.shift()();assert.equal(reloads(),1);
});
test('Queued update rechecks an immediately reopened flight',()=>{
  const {context:c,queue,reloads}=setup();
  c.refs.flightModal.hidden=false;c.syncBodyModalState();c.reloadAfterServiceWorkerUpdate();
  c.refs.flightModal.hidden=true;c.syncBodyModalState();
  c.refs.flightModal.hidden=false;c.syncBodyModalState();
  queue.shift()();assert.equal(reloads(),0);
});
test('Updates still reload an idle planner only once',()=>{
  const {context:c,reloads}=setup();
  c.reloadAfterServiceWorkerUpdate();c.reloadAfterServiceWorkerUpdate();
  assert.equal(reloads(),1);
});
