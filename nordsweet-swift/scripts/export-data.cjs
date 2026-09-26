const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'), source=path.resolve(root,'../nordsweet-ios/web-src');
const output=path.join(root,'Packages/NordsweetCore/Sources/NordsweetCore/Resources');
const fixtures=path.join(root,'Packages/NordsweetCore/Tests/NordsweetCoreTests/Fixtures');
fs.mkdirSync(output,{recursive:true});fs.mkdirSync(fixtures,{recursive:true});
function write(name,value,dir=output){fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(value,null,2)+'\n');}
const context={window:{},console};vm.createContext(context);
for(const file of ['airports.js','airports-cz-sk.js','navdata.js','aircraft-data/p2006t-performance.js']) vm.runInContext(fs.readFileSync(path.join(source,file),'utf8'),context,{filename:file});
const airports=context.window.TECNAM_DATA.airports;
write('airports',airports.filter(a=>Number.isFinite(a.lat)&&Number.isFinite(a.lon)).map(a=>({icao:a.icao,name:a.name||a.icao,elevation:Number.isFinite(a.elevation)?a.elevation:null,lat:a.lat,lon:a.lon})));
write('waypoints',Object.entries(context.window.NORDSWEET_NAVDATA.waypoints).map(([code,p])=>({code,name:p.name||code,lat:p.lat,lon:p.lon})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)));
const data=context.window.P2006T_PERFORMANCE;write('p2006t-takeoff',data);
const profiles=[];context.window.NORDSWEET_AIRCRAFT_DATA={register:p=>profiles.push(p)};
for(const file of fs.readdirSync(path.join(source,'aircraft-data')).filter(n=>/data\.js$/.test(n))) vm.runInContext(fs.readFileSync(path.join(source,'aircraft-data',file),'utf8'),context);
write('checklists',profiles.filter(p=>p.checklists?.length).map((p,i)=>({id:p.type+'-'+i,type:p.type,name:p.displayName||p.type,checklists:p.checklists})));
const html=fs.readFileSync(path.join(source,'index.html'),'utf8').replace(/\r\n/g,'\n');
function functionSource(name){const start=html.indexOf('function '+name+'(');if(start<0)throw Error(name);return html.slice(start,html.indexOf('\nfunction ',start+1));}
Object.assign(context,{P2006T_PERFORMANCE:data,P2006T_WEIGHTS_KG:Object.keys(data.weightsKg).map(Number).sort((a,b)=>a-b),lerp:(a,b,t)=>a+(b-a)*t,roundTo:(v,n)=>Math.round(v*10**n)/10**n,toNumber:(v,d)=>Number.isFinite(Number(v))?Number(v):d,getRunwayToraM:r=>r.tora});
for(const name of ['getBracket','getCeilingValue','getIsaTemperature','getP2006TWeightTable','getP2006TTemperaturePoints','getCeilingTemperaturePoint','interpolatePointsByTemperature','interpolateMetricForWeightTable','interpolateSettingByWeight','getConservativeMetricForWeightTable','applyP2006TCorrections','getP2006TConservativeTableRead','getP2006TTakeoffPerformance'])vm.runInContext(functionSource(name),context);
const weights=context.P2006T_WEIGHTS_KG,tests=[];
for(const weight of [weights[0],(weights[0]+weights.at(-1))/2,weights.at(-1)])for(const [altitude,temperature,headwind,paved,slope] of [[0,15,0,false,0],[1750,22,8,true,1],[6000,-5,-5,false,0],[10000,35,0,true,2]]){
const result=context.getP2006TTakeoffPerformance(weight,altitude,temperature,{surface:paved?'paved':'grass',slope,tora:1000},{headwind});
tests.push({weight,altitude,temperature,headwind,paved,slope,groundRollM:result.correctedGroundRollM,obstacle50ftM:result.correctedObstacle50ftM});
}
write('takeoff-oracle',tests,fixtures);
console.log(JSON.stringify({airports:airports.length,waypoints:Object.keys(context.window.NORDSWEET_NAVDATA.waypoints).length,oracleCases:tests.length,weights}));
