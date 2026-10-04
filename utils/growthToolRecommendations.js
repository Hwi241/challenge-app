import { GROWTH_TOOL_CATALOG } from '../constants/growthToolCatalog';
export const NEW_GROWTH_TOOL_IDS = Object.freeze([]);

const unownedStars = (ownedIds) => {
  const owned = new Set((ownedIds || []).map(String));
  return GROWTH_TOOL_CATALOG.filter((tool) => tool.acquisition === 'stars' && !owned.has(tool.id));
};
export const getRecommendedGrowthTools = ({ currentLevel=1, ownedToolIds=[], limit=2 }={}) => {
  const candidates = unownedStars(ownedToolIds).sort((a,b) => {
    const aReached=a.recommendedLevel<=currentLevel,bReached=b.recommendedLevel<=currentLevel;
    if(aReached!==bReached)return aReached?-1:1;
    const distanceA=Math.abs(a.recommendedLevel-currentLevel),distanceB=Math.abs(b.recommendedLevel-currentLevel);
    return distanceA-distanceB||a.sortOrder-b.sortOrder;
  });
  const selected=[], used=new Set();
  candidates.forEach((tool)=>{if(selected.length<limit&&!used.has(tool.analysisCategory)){selected.push(tool);used.add(tool.analysisCategory);}});
  candidates.forEach((tool)=>{if(selected.length<limit&&!selected.includes(tool))selected.push(tool);});
  return selected;
};
export const GROWTH_TOOL_CATEGORY_FEATURE_IDS = Object.freeze({
  consistency:'consistency_record_calendar', growth:'growth_long_term_trend', rhythm:'rhythm_weekday_time_heatmap',
  achievement:'achievement_goal_progress', balance:'balance_activity_composition', relation:'relation_behavior_network',
});
export const PROFILE_ANALYSIS_DISCOVERY_IDS = Object.freeze({
  consistency:'consistency_change_curve', growth:'growth_long_term_trend', rhythm:'rhythm_weekday_time_heatmap',
  balance:'balance_weekly_composition_change', achievement:'achievement_target_pace',
});
export const getGrowthToolDiscoveries = (options={}) => {
  const candidates=getRecommendedGrowthTools({...options,limit:3});
  return { hero:candidates[0]||null, secondary:candidates.slice(1,3) };
};
export const getGrowthToolCategoryFeature = (category) => GROWTH_TOOL_CATALOG.find((tool)=>tool.id===GROWTH_TOOL_CATEGORY_FEATURE_IDS[category])||null;
export const getProfileAnalysisDiscoveryTool = (category) => GROWTH_TOOL_CATALOG.find((tool)=>tool.id===PROFILE_ANALYSIS_DISCOVERY_IDS[category])||null;
export const getReachedRecommendedGrowthTools = ({ currentLevel=1, ownedToolIds=[], limit=3 }={}) => unownedStars(ownedToolIds).filter((tool)=>tool.recommendedLevel<=currentLevel).sort((a,b)=>a.sortOrder-b.sortOrder).slice(0,limit);
export const filterGrowthToolsForUi = (tools, { category='all', scope='all', query='' }={}) => {
  const needle=String(query).trim().toLocaleLowerCase();
  return (tools||[]).filter((tool)=>(category==='all'||tool.analysisCategory===category)&&(scope==='all'||tool.scope===scope||tool.scope==='both')&&(!needle||`${tool.title} ${tool.description} ${tool.discovery?.headline||''} ${tool.discovery?.summary||''}`.toLocaleLowerCase().includes(needle)));
};
export const sortGrowthToolsForUi = (tools,{currentLevel=1,ownedToolIds=[]}={}) => {const owned=new Set(ownedToolIds);return [...tools].sort((a,b)=>Number(owned.has(b.id))-Number(owned.has(a.id))||Number(b.recommendedLevel<=currentLevel)-Number(a.recommendedLevel<=currentLevel)||a.sortOrder-b.sortOrder);};
