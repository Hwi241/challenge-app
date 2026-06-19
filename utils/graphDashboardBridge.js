// utils/graphDashboardBridge.js
// Bridge between GRAPH_CATALOG graph purchases and dashboard renderer widgets.
// Key principle: widgetId is the renderer widget ID (not the graph catalog ID).
// graphId, graphCatalogId, sourceGraphId hold the graph catalog ID separately.

import { GRAPH_CATALOG, getGraphById } from '../constants/graphCatalog';
import { getWidgetById, supportsWidgetTarget } from '../constants/widgetCatalog';

/**
 * Maps a GRAPH_CATALOG graph.id to the appropriate dashboard renderer widget ID.
 * Multiple graph IDs may map to the same renderer widget.
 * The renderer widget ID is what gets used as id/widgetId on layout items.
 */
export const GRAPH_DASHBOARD_WIDGET_ID_BY_GRAPH_ID = {
  line_count_basic: 'line_count_cumulative',
  line_minutes_basic: 'line_minutes',
  line_dual_count_minutes: 'line_count_cumulative',
  line_streak_tracker: 'line_count_cumulative',
  line_streak_curve: 'line_count_cumulative',
  bar_count_basic: 'weekly_bar',
  bar_goal_compare: 'weekly_bar',
  bar_stacked_category: 'weekly_bar',
  bar_monthly_heat: 'grass_graph',
  pie_category_ratio: 'weekly_bar',
};

/**
 * Set of all dashboard renderer widget IDs derived from the mapping values.
 */
export const DASHBOARD_GRAPH_RENDERER_WIDGET_IDS = new Set(
  Object.values(GRAPH_DASHBOARD_WIDGET_ID_BY_GRAPH_ID)
);

/**
 * Returns the renderer widget ID for a given graph catalog ID.
 * @param {string} graphId - The GRAPH_CATALOG graph.id.
 * @returns {string|undefined}
 */
export function getDashboardGraphRendererWidgetId(graphId) {
  if (!graphId) return undefined;
  return GRAPH_DASHBOARD_WIDGET_ID_BY_GRAPH_ID[String(graphId)];
}

/**
 * Checks if a widget or widget ID corresponds to a dashboard graph renderer widget.
 * @param {string|object} widgetOrId - Widget ID string or widget object with id/widgetId.
 * @returns {boolean}
 */
export function isDashboardGraphRendererWidget(widgetOrId) {
  if (!widgetOrId) return false;
  if (typeof widgetOrId === 'string') {
    return DASHBOARD_GRAPH_RENDERER_WIDGET_IDS.has(widgetOrId);
  }
  const id = widgetOrId?.id || widgetOrId?.widgetId;
  if (typeof id === 'string') {
    return DASHBOARD_GRAPH_RENDERER_WIDGET_IDS.has(id);
  }
  return false;
}

/**
 * Checks if a widget catalog item is a legacy shop item (shop===true).
 * @param {object} widget - Widget catalog item.
 * @returns {boolean}
 */
export function isLegacyWidgetCatalogShopItem(widget) {
  return widget?.shop === true;
}

/**
 * Creates a dashboard-compatible widget object for a GRAPH_CATALOG graph.
 * id/widgetId = rendererWidgetId (not graphId).
 * graphId, graphCatalogId, sourceGraphId hold the graph catalog ID.
 * @param {object|string} graphOrId - A graph object or graph catalog ID.
 * @param {string} [dashboardTarget] - Optional target filter.
 * @returns {object|null}
 */
export function getDashboardGraphWidgetForGraph(graphOrId, dashboardTarget) {
  let graph;
  if (typeof graphOrId === 'string') {
    graph = getGraphById(graphOrId);
  } else {
    graph = graphOrId;
  }

  if (!graph || !graph.id) return null;

  const graphId = String(graph.id);
  const rendererWidgetId = getDashboardGraphRendererWidgetId(graphId);
  if (!rendererWidgetId) return null;

  const rendererWidget = getWidgetById(rendererWidgetId);
  if (!rendererWidget) return null;

  // Check target compatibility
  if (dashboardTarget && typeof supportsWidgetTarget === 'function') {
    if (!supportsWidgetTarget(rendererWidget, dashboardTarget)) return null;
  }

  // Return object with id/widgetId = rendererWidgetId
  return {
    ...rendererWidget,
    id: rendererWidgetId,
    widgetId: rendererWidgetId,
    graphId,
    graphCatalogId: graphId,
    sourceGraphId: graphId,
    graphTitle: graph.title || graph.name || graphId,
    isGraphCatalogBacked: true,
  };
}

/**
 * Converts purchased graph IDs into unique dashboard widget objects.
 * Deduplicates by renderer widget ID so the same renderer doesn't appear twice.
 * @param {string[]} purchasedGraphIds - Array of GRAPH_CATALOG graph IDs owned.
 * @param {string} [dashboardTarget] - Optional target filter.
 * @returns {object[]} Unique bridge widget objects.
 */
export function getPurchasedDashboardGraphWidgets(purchasedGraphIds = [], dashboardTarget) {
  if (!Array.isArray(purchasedGraphIds) || purchasedGraphIds.length === 0) return [];

  const seenRendererIds = new Set();
  const widgets = [];

  for (const graphId of purchasedGraphIds) {
    const graph = getGraphById(graphId);
    if (!graph) continue;

    const rendererWidgetId = getDashboardGraphRendererWidgetId(graphId);
    if (!rendererWidgetId || seenRendererIds.has(rendererWidgetId)) continue;

    seenRendererIds.add(rendererWidgetId);

    const bridgeWidget = getDashboardGraphWidgetForGraph(graph, dashboardTarget);
    if (bridgeWidget) {
      widgets.push(bridgeWidget);
    }
  }

  return widgets;
}

/**
 * Returns all possible dashboard graph widgets (no purchase filter).
 * Useful for picking which graphs are available to add.
 * @param {string} [dashboardTarget] - Optional target filter.
 * @returns {object[]}
 */
export function getAllDashboardGraphWidgets(dashboardTarget) {
  const widgets = [];
  const seenRendererIds = new Set();

  for (const [graphId, rendererWidgetId] of Object.entries(GRAPH_DASHBOARD_WIDGET_ID_BY_GRAPH_ID)) {
    if (seenRendererIds.has(rendererWidgetId)) continue;
    seenRendererIds.add(rendererWidgetId);

    const graph = getGraphById(graphId);
    if (!graph) continue;

    const bridgeWidget = getDashboardGraphWidgetForGraph(graph, dashboardTarget);
    if (bridgeWidget) {
      widgets.push(bridgeWidget);
    }
  }

  return widgets;
}
