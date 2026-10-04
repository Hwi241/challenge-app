export const GROWTH_PREVIEW_PALETTE=Object.freeze({background:'#FFFFFF',primary:'#0A0A0A',secondary:'#737373',tertiary:'#A3A3A3',light:'#D4D4D4',grid:'#E5E5E5',veryLight:'#F5F5F5'});
export const GROWTH_PREVIEW_RULES=Object.freeze({
  padding:{compact:14,detail:22},grid:{strokeWidth:1,lines:2},axis:{strokeWidth:1},
  line:{primaryWidth:2.25,secondaryWidth:1.5,pointRadius:2.7,dash:'5 4'},
  bar:{gap:6,radius:3},histogram:{gap:1.5,radius:1},heatmap:{gap:3,radius:2},
  donut:{strokeRatio:.13,gap:2,holeRatio:.58},scatter:{pointRadius:2.8},timeline:{nodeRadius:4,lastRadius:6},
  network:{edgeWidths:[1,1.5,2.25],nodeStroke:2},label:{compact:8,detail:10},
  layout:{wide:1.9,medium:1.65,square:1.1},
});
export const GROWTH_PREVIEW_LAYOUT_BY_RENDERER=Object.freeze({line:'wide',area:'wide',calendarHeatmap:'wide',matrixHeatmap:'wide',scatter:'wide',timeline:'wide',network:'wide',intervalStrip:'wide',bar:'medium',histogram:'medium',stackedBar:'medium',donut:'square',progress:'square'});
export const getGrowthToolPreviewLayout=(tool,compact=true)=>{const kind=GROWTH_PREVIEW_LAYOUT_BY_RENDERER[tool?.preview?.renderer]||'wide',aspect=GROWTH_PREVIEW_RULES.layout[kind];return{kind,aspect,compact};};
