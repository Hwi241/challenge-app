const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),babel=require('@babel/core');
const cache=new Map();
function load(file){const filename=path.resolve(__dirname,'..',file);if(cache.has(filename))return cache.get(filename).exports;const mod={exports:{}};cache.set(filename,mod);const code=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,presets:['babel-preset-expo'],babelrc:false,configFile:false}).code;const req=r=>r.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(filename),r+(path.extname(r)?'':'.js')))):require(r);vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(req,mod,mod.exports);return mod.exports;}
const n=load('utils/growthToolNavigation.js'),c=load('constants/growthToolCatalog.js');
assert.deepEqual(n.GROWTH_TOOL_RAIL_TABS.map(t=>t.key),['owned','new','consistency','growth','rhythm','achievement','balance','relation']);
assert.equal(n.GROWTH_TOOL_RAIL_TABS[0].label,'내 그래프');assert.equal(n.GROWTH_TOOL_RAIL_TABS[1].label,'NEW');assert.equal(n.GROWTH_TOOL_RAIL_TABS[1].dividerBefore,true);assert.equal(n.GROWTH_TOOL_RAIL_TABS[1].dividerAfter,true);
let state=n.createGrowthToolNavigationState();assert.equal(state.selectedTab,'owned');assert.equal(n.getGrowthToolBackResult(state).effect,'navigator');
state=n.selectGrowthToolTab(state,'relation');let detail=n.openGrowthToolDetail(state,'relation_matrix'),back=n.getGrowthToolBackResult(detail);assert.equal(back.state.selectedTab,'relation');
let search={...n.openGrowthToolSearch(state),query:'흐름'};detail=n.openGrowthToolDetail(search,'growth_long_term_trend');back=n.getGrowthToolBackResult(detail);assert.equal(back.state.mode,'search');assert.equal(back.state.query,'흐름');assert.equal(n.getGrowthToolBackResult(back.state).state.selectedTab,'relation');
assert.equal(n.createGrowthToolNavigationState({category:'rhythm'}).selectedTab,'rhythm');assert.equal(c.GROWTH_TOOL_CATALOG.length,42);
console.log('growth tool UI logic tests: PASS');
