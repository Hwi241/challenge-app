const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),babel=require('@babel/core');
const values=new Map();
const storage={getItem:async k=>values.has(k)?values.get(k):null,setItem:async(k,v)=>values.set(k,String(v)),removeItem:async k=>values.delete(k)};
const cache=new Map();
function load(file){const filename=path.resolve(__dirname,'..',file);if(cache.has(filename))return cache.get(filename).exports;const module={exports:{}};cache.set(filename,module);const code=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,presets:[['babel-preset-expo',{jsxRuntime:'automatic'}]],babelrc:false,configFile:false}).code;const localRequire=request=>request==='@react-native-async-storage/async-storage'?{__esModule:true,default:storage}:request.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(filename),request+(path.extname(request)?'':'.js')))):require(request);vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(localRequire,module,module.exports);return module.exports;}
(async()=>{
 const c=load('constants/growthToolCatalog.js'),o=load('utils/growthToolOwnership.js'),w=load('utils/starWallet.js');
 const tools=c.GROWTH_TOOL_CATALOG;
 assert.equal(tools.length,42);assert.equal(new Set(tools.map(x=>x.id)).size,42);assert.ok(tools.every(x=>x.id));
 assert.deepEqual(c.getGrowthToolCategoryCounts(),{consistency:8,growth:8,rhythm:8,achievement:7,balance:5,relation:6});
 assert.equal(c.getInitialFreeGrowthTools().length,3);assert.equal(c.getExperienceRewardGrowthTools().length,3);assert.equal(c.getStarPurchaseGrowthTools().length,36);
 assert.ok(tools.filter(x=>x.acquisition!=='stars').every(x=>x.basePrice===0));
 const expected={1:20,5:40,10:60,15:90,20:130,30:200};
 c.getStarPurchaseGrowthTools().forEach(x=>assert.equal(x.basePrice,expected[x.recommendedLevel]));
 [[5,60],[10,90],[15,135],[20,195],[30,300]].forEach(([level,current])=>{const tool=tools.find(x=>x.acquisition==='stars'&&x.recommendedLevel===level);assert.equal(c.getGrowthToolCurrentPrice(tool,1),current);assert.equal(c.getGrowthToolCurrentPrice(tool,level),tool.basePrice);assert.equal(o.getGrowthToolPurchaseState({tool,currentLevel:1,starBalance:current,ownedToolIds:[]}).canPurchase,true);});
 assert.ok(tools.filter(x=>x.analysisCategory==='relation').every(x=>x.associationOnly));assert.ok(tools.every(x=>x.minimumData&&x.minimumData.kind&&x.minimumData.label));
 const initial=await o.getOwnedGrowthToolIds();assert.equal(initial.length,3);
 const granted=await Promise.all([o.grantGrowthTool('consistency_streak'),o.grantGrowthTool('consistency_streak')]);assert.equal(granted.filter(x=>x.granted).length,1);assert.equal((await o.getOwnedGrowthToolIds()).filter(x=>x==='consistency_streak').length,1);
 values.set('purchased_graphs',JSON.stringify(['overall_progress','month_calendar','goal_black_box']));const before=values.get('purchased_graphs');const migration1=await o.migrateLegacyGrowthToolOwnership();const migration2=await o.migrateLegacyGrowthToolOwnership();assert.equal(migration1.mapped.length,2);assert.equal(migration2.migrated,false);assert.equal(values.get('purchased_graphs'),before);assert.deepEqual(await o.getLegacyOwnedGraphIds(),['overall_progress','month_calendar','goal_black_box']);
 await w.grantStars(300,'test');const lv30=tools.find(x=>x.recommendedLevel===30);const purchase=await o.purchaseGrowthTool(lv30.id);assert.equal(purchase.price,300);assert.equal((await o.purchaseGrowthTool(lv30.id)).reason,'owned');
 const scopes=tools.reduce((a,x)=>(a[x.scope]=(a[x.scope]||0)+1,a),{});console.log('growth tool tests: PASS',JSON.stringify(scopes));
})().catch(e=>{console.error(e);process.exitCode=1});
