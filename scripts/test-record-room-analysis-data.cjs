const assert=require('node:assert/strict');
process.env.TZ='Asia/Seoul';
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const babel=require('@babel/core');
const root=path.resolve(__dirname,'..');
const analysisFile=path.join(root,'utils/recordRoomAnalysis.js');
const source=fs.readFileSync(analysisFile,'utf8');
const transformed=babel.transformSync(source,{filename:analysisFile,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
const analysisModule=new Module(analysisFile,module);
analysisModule.filename=analysisFile;
analysisModule.paths=Module._nodeModulePaths(path.dirname(analysisFile));
analysisModule._compile(transformed,analysisFile);
const {
  buildRecordRoomActivityCalendar,
  calculateBalanceAnalysis,
  calculateConsistencyAnalysis,
  calculateGrowthAnalysis,
  calculateRhythmAnalysis,
}=analysisModule.exports;
const entriesFile=path.join(root,'utils/recordRoomEntries.js');
const entriesSource=fs.readFileSync(entriesFile,'utf8');
const entriesTransformed=babel.transformSync(entriesSource,{filename:entriesFile,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
const entriesModule=new Module(entriesFile,module);
entriesModule.filename=entriesFile;
entriesModule.paths=Module._nodeModulePaths(path.dirname(entriesFile));
entriesModule._compile(entriesTransformed,entriesFile);
const {parseOwnerScopedRecordRoomEntries}=entriesModule.exports;
assert.doesNotMatch(entriesSource,/getAllKeys\s*\(/);
assert.match(entriesSource,/storage\.multiGet\(entryKeys\)/);
assert.match(entriesSource,/\[\.\.\.cards, \.\.\.hallCards\]/);
assert.match(entriesSource,/trashFamilies\.has\(owner\.familyId\)/);
const now=new Date(2026,9,5,12);
const stamp=(day,hour=12)=>new Date(2026,9,day,hour).toISOString();
const entries=Array.from({length:20},(_,index)=>({id:`h${index}`,challengeId:'h',timestamp:stamp((index%5)+1)}));
const cards=[{id:'c'},{id:'h',type:'habit'},{id:'r',type:'rotation'}];
const result=calculateBalanceAnalysis({cards,hallCards:[],now});
assert.equal(result.counts.challenge,1);
assert.equal(result.counts.habit,1);
assert.equal(result.counts.rotation,1);
assert.equal(result.total,3);
assert.deepEqual(result.shares.map((item)=>item.displayPercent),[33.3,33.3,33.3]);
assert.equal(result.balanceType,null);
assert.equal(result.primary.length,0);
assert.equal(result.summaryLines.length,0);

const cumulativeComposition=calculateBalanceAnalysis({
  cards:[{id:'current-challenge'}],
  hallCards:[
    {id:'hall-challenge-1'},
    {id:'hall-challenge-2'},
    {id:'hall-habit',type:'habit'},
    {id:'hall-rotation',type:'rotation'},
  ],
  now,
});
assert.deepEqual(cumulativeComposition.counts,{challenge:3,habit:1,rotation:1});
assert.equal(cumulativeComposition.total,5);
assert.deepEqual(cumulativeComposition.shares.map((item)=>item.displayPercent),[60,20,20]);

const duplicateComposition=calculateBalanceAnalysis({
  cards:[{id:'same',type:'habit'}],
  hallCards:[{id:'same',type:'habit'}],
  now,
});
assert.equal(duplicateComposition.total,1);
assert.equal(duplicateComposition.counts.habit,1);

const completedComposition=calculateBalanceAnalysis({
  cards:[
    {id:'completed',status:'completed'},
    {id:'archived',archived:true,type:'habit'},
    {id:'claimed',rewardClaimed:true,type:'rotation'},
    {id:'expired',endDate:'2026-10-04'},
  ],
  hallCards:[{id:'completed'}],
  now,
});
assert.equal(completedComposition.total,1);
assert.equal(completedComposition.counts.challenge,1);

const periodIndependentComposition=calculateBalanceAnalysis({cards,hallCards:[],now,mode:'rolling30'});
assert.deepEqual(periodIndependentComposition.counts,result.counts);
assert.deepEqual(periodIndependentComposition.shares,result.shares);
const emptyComposition=calculateBalanceAnalysis({cards:[],hallCards:[],now});
assert.equal(emptyComposition.total,0);
assert.ok(!JSON.stringify(emptyComposition).match(/NaN|Infinity/));

const monday=new Date(2026,9,5,9).toISOString();
const sunday=new Date(2026,9,4,18).toISOString();
const canonicalEntry={id:'en_1',text:'기록',timestamp:monday};
const cleanEntries=parseOwnerScopedRecordRoomEntries({
  cards:[{id:'A'}],
  pairs:[
    ['entries_A',JSON.stringify([canonicalEntry])],
    ['some_cache',JSON.stringify({history:[
      {createdAt:sunday,text:'가짜 1'},
      {createdAt:sunday,text:'가짜 2'},
      {createdAt:sunday,text:'가짜 3'},
    ]})],
    ['unrelated_settings',JSON.stringify({history:[{timestamp:sunday,text:'중첩 가짜'}]})],
  ],
});
assert.equal(cleanEntries.length,1);
assert.equal(cleanEntries[0].challengeId,'A');
assert.equal(cleanEntries[0].timestamp,monday);

const supportedShapes=parseOwnerScopedRecordRoomEntries({cards:[{id:'A'}],pairs:[
  ['entries_A',JSON.stringify([
    {id:'image',imageUri:'file://image.jpg',timestamp:monday},
    {id:'health',linkedRecords:[{type:'steps',value:10}],timestamp:monday},
    {id:'duration',duration:20,timestamp:monday},
    {id:'invalid-date',text:'x',timestamp:'invalid'},
    null,
    {timestamp:monday},
  ])],
]});
assert.deepEqual(supportedShapes.map((entry)=>entry.id),['image','health','duration']);

const duplicateEntries=parseOwnerScopedRecordRoomEntries({cards:[{id:'A'}],pairs:[
  ['entries_A',JSON.stringify([canonicalEntry])],
  ['challenge_A_entries',JSON.stringify({entries:[canonicalEntry]})],
]});
assert.equal(duplicateEntries.length,1);

const ownerMonday={id:'current-1',text:'현재 기록',timestamp:monday};
const trashSunday=[1,2,3].map((id)=>({id:`trash-${id}`,text:'휴지통 기록',timestamp:sunday}));
const hofWednesday={id:'done-1',text:'완료 기록',timestamp:new Date(2026,9,7,12).toISOString()};
const ownerScoped=parseOwnerScopedRecordRoomEntries({
  cards:[{id:'ch_A'}],
  hallCards:[{id:'ch_DONE'}],
  trashCards:[{id:'ch_B'}],
  pairs:[
    ['entries_ch_A',JSON.stringify([ownerMonday])],
    ['entries_ch_B',JSON.stringify(trashSunday)],
    ['entries_ch_OLD',JSON.stringify([{id:'orphan',text:'고아 기록',timestamp:sunday}])],
    ['entries_ch_DONE',JSON.stringify([hofWednesday])],
  ],
});
assert.deepEqual(ownerScoped.map((entry)=>entry.challengeId).sort(),['ch_A','ch_DONE']);
assert.equal(ownerScoped.some((entry)=>entry.id==='orphan'),false);
assert.equal(ownerScoped.some((entry)=>entry.id==='trash-1'),false);

const restored=parseOwnerScopedRecordRoomEntries({
  cards:[{id:'ch_B'}],
  pairs:[['entries_ch_B',JSON.stringify(trashSunday)]],
});
assert.equal(restored.length,3);

const numericAliasEntry={id:'en_alias',text:'별칭 기록',timestamp:monday};
const aliasEntries=parseOwnerScopedRecordRoomEntries({cards:[{id:'ch_123'}],pairs:[
  ['entries_ch_123',JSON.stringify([numericAliasEntry])],
  ['entries_123',JSON.stringify([numericAliasEntry,{id:'en_other',text:'다른 기록',timestamp:monday}])],
]});
assert.equal(aliasEntries.length,2);
assert.ok(aliasEntries.every((entry)=>entry.challengeId==='ch_123'));

const embedded=parseOwnerScopedRecordRoomEntries({cards:[{id:'embedded',logs:[canonicalEntry]}]});
assert.equal(embedded.length,1);
assert.equal(embedded[0].challengeId,'embedded');

const sourceConsistency=calculateConsistencyAnalysis({entries:cleanEntries,now,mode:'monthly'});
const sourceGrowth=calculateGrowthAnalysis({entries:cleanEntries,now,mode:'monthly'});
const sourceRhythm=calculateRhythmAnalysis({entries:cleanEntries,now,mode:'monthly'});
assert.equal(sourceConsistency.metrics.activityDays,1);
assert.equal(sourceConsistency.activity.find((day)=>day.key==='2026-10-04')?.count,0);
assert.equal(sourceGrowth.metrics.currentCount,1);
assert.equal(sourceGrowth.metrics.currentActivityDays,1);
assert.equal(sourceRhythm.totalRecords,1);

const exactEntries=[5,7,10].map((day)=>({id:`exact-${day}`,challengeId:'A',timestamp:stamp(day,12)}));
const exactConsistency=calculateConsistencyAnalysis({entries:exactEntries,now:new Date(2026,9,15,12),mode:'monthly'});
const exactCalendar=buildRecordRoomActivityCalendar(exactConsistency);
const activeKeys=exactCalendar.cells.filter((cell)=>cell.item?.count>0).map((cell)=>cell.key);
assert.deepEqual(activeKeys,['2026-10-05','2026-10-07','2026-10-10']);
assert.equal(exactCalendar.cells.filter((cell)=>cell.date.getDay()===0 && cell.item?.count>0).length,0);
const exactRolling=buildRecordRoomActivityCalendar(calculateConsistencyAnalysis({entries:exactEntries,now:new Date(2026,9,15,12),mode:'rolling30'}));
assert.deepEqual(exactRolling.cells.filter((cell)=>cell.item?.count>0).map((cell)=>cell.key),activeKeys);
const exactRhythm=calculateRhythmAnalysis({entries:exactEntries,now:new Date(2026,9,15,12),mode:'monthly'});
const sundayRhythmTotal=exactRhythm.heatmap.reduce((sum,row)=>sum+(row.values[6]||0),0);
assert.equal(sundayRhythmTotal,0);
exactEntries.forEach((entry)=>{
  const weekday=(new Date(entry.timestamp).getDay()+6)%7;
  assert.equal(exactRhythm.heatmap.reduce((sum,row)=>sum+(row.values[weekday]||0),0),1);
});

const sameLocalDay=[0.5,12,23.5].map((hour,index)=>{
  const whole=Math.floor(hour);
  const minute=hour%1?30:0;
  return {id:`tz-${index}`,text:'시간대 기록',timestamp:new Date(2026,9,5,whole,minute).toISOString()};
});
const normalizedLocal=parseOwnerScopedRecordRoomEntries({cards:[{id:'TZ'}],pairs:[['entries_TZ',JSON.stringify(sameLocalDay)]]});
const timezoneConsistency=calculateConsistencyAnalysis({entries:normalizedLocal,now:new Date(2026,9,5,23,59),mode:'monthly'});
assert.equal(timezoneConsistency.activity.find((day)=>day.key==='2026-10-05')?.count,3);

const monthlyConsistency=calculateConsistencyAnalysis({entries:[],now,mode:'monthly'});
const monthlyCalendar=buildRecordRoomActivityCalendar(monthlyConsistency);
const monthlyDays=monthlyCalendar.cells.filter((cell)=>!cell.filler);
assert.deepEqual(monthlyDays.map((cell)=>cell.date.getDate()),Array.from({length:31},(_,index)=>index+1));
assert.equal(monthlyDays.filter((cell)=>cell.future).length,26);
assert.ok(monthlyDays.filter((cell)=>cell.future).every((cell)=>cell.item===undefined));
assert.equal(monthlyConsistency.metrics.periodDays,5);

const rollingConsistency=calculateConsistencyAnalysis({entries:[],now,mode:'rolling30'});
const rollingCalendar=buildRecordRoomActivityCalendar(rollingConsistency);
const rollingBoundary=rollingCalendar.cells.find((cell)=>cell.monthBoundary);
assert.equal(rollingConsistency.metrics.periodDays,30);
assert.equal(rollingBoundary?.date.getMonth()+1,10);
assert.equal(rollingBoundary?.date.getDate(),1);
const shared=fs.readFileSync(path.join(root,'components/RecordRoomAnalysisPages.js'),'utf8');
assert.match(shared,/이번 달/);
assert.match(shared,/지난달 같은 기간/);
assert.match(shared,/최근 30일을 그 직전 30일과 비교했어요/);
assert.match(shared,/이번 달을 지난달 같은 기간과 비교했어요/);
assert.match(shared,/previousLabel[^\n]*→[^\n]*currentLabel/);
assert.match(shared,/최근/);
assert.match(shared,/이전/);
assert.match(shared,/patternWeekday/);
assert.match(shared,/patternTimeLabel/);
assert.match(shared,/width: '100%'/);
assert.match(source,/future:/);
assert.match(source,/monthBoundary:/);
assert.match(shared,/monthBoundaryCell/);
assert.match(shared,/\$\{date\.getMonth\(\) \+ 1\}\/\$\{date\.getDate\(\)\}/);
assert.doesNotMatch(shared,/현재 진행 중인 카드 기준/);
assert.match(shared,/현재 진행 \+ 명예의 전당 누적 기준/);
assert.match(shared,/formatCompositionPercent\(item\.displayPercent\)/);
assert.match(shared,/item\.share \* 100/);
assert.doesNotMatch(shared,/가장 큰 활동 비중|const leading = \[\.\.\.analysis\.shares\]/);
console.log('record room analysis data tests: PASS');
