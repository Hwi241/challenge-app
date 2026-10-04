export const GROWTH_TOOL_RAIL_TABS = Object.freeze([
  { key:'owned', label:'내 그래프' }, { key:'new', label:'NEW', dividerBefore:true, dividerAfter:true }, { key:'consistency', label:'꾸준함' }, { key:'growth', label:'성장' },
  { key:'rhythm', label:'리듬' }, { key:'achievement', label:'성취' }, { key:'balance', label:'균형' },
  { key:'relation', label:'관계' },
]);
const validTabs=new Set(GROWTH_TOOL_RAIL_TABS.map((tab)=>tab.key));
export const createGrowthToolNavigationState = ({ category, selectedTab, scope = 'all' } = {}) => ({
  mode:'dashboard', selectedTab:validTabs.has(selectedTab||category)?selectedTab||category:'owned',
  scopePreset:scope, query:'', detailToolId:null, detailReturnMode:null,
});
export const selectGrowthToolTab = (state, selectedTab) => validTabs.has(selectedTab)
  ? { ...state, mode:'dashboard', selectedTab, scopePreset:'all', detailToolId:null, detailReturnMode:null }
  : state;
export const openGrowthToolSearch = (state) => ({ ...state, mode:'search', query:'', detailToolId:null, detailReturnMode:null });
export const openGrowthToolDetail = (state, detailToolId) => ({ ...state, mode:'detail', detailToolId, detailReturnMode:state.mode });
export const getGrowthToolBackResult = (state) => {
  if(state.mode==='detail')return { effect:'internal', state:{...state,mode:state.detailReturnMode||'dashboard',detailToolId:null,detailReturnMode:null} };
  if(state.mode==='search')return { effect:'internal', state:{...state,mode:'dashboard',query:'',detailToolId:null,detailReturnMode:null} };
  return { effect:'navigator', state };
};
