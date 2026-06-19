// utils/graphDashboardBridge.js
// Bridge between GRAPH_CATALOG graphs and dashboard renderer widgets.

import { GRAPH_CATALOG, getGraphById } from '../constants/graphCatalog';
import { getWidgetById, supportsWidgetTarget } from '../constants/widgetCatalog';

/**
 * Maps a GRAPH_CATALOG graph.id to the appropriate dashboard renderer widget ID.
 * Multiple graph IDs may map to the same renderer widget.
 */
export const GRAPH_DASHBOARD_WIDGET_ID_BY_GRAPH_ID = {
  line_count_basic: 'line_count_cumulative',
  line_minutes_basic: 'line_minutes',
  line_count_minutes_dual: 'line_count_cumulative',
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
 * Checks if a widget or ID corresponds to a dashboard graph renderer widget.
 * @param {string|object} widgetOrId - Widget ID string or widget object with id/widgetId.
 * @returns {boolean}
 */
export const isDashboardGraphRendererWidget = (widgetOrId) => {
  if (!widgetOrId) return false;
  if (typeof widgetOrId === 'string') {
    return DASHBOARD_GRAPH_RENDERER_WIDGET_IDS.has(widgetOrId);
  }
  const id = widgetOrId?.id || widgetOrId?.widgetId;
  if (typeof id === 'string') {
    return DASHBOARD_GRAPH_RENDERER_WIDGET_IDS.has(id);
  }
  return false;
};

/**
 * Checks if a widget catalog item is a legacy shop item (shop===true).
 * @param {object} widget - Widget catalog item.
 * @returns {boolean}
 */
export const isLegacyWidgetCatalogShopItem = (widget) => {
  return widget?.shop === true;
};

/**
 * Returns the renderer widget ID for a given graph ID.
 * @param {string} graphId - The GRAPH_CATALOG graph.id.
 * @returns {string|undefined} The renderer widget ID, or undefined if not found.
 */
export const getRendererWidgetId = (graphId) => {
  if (!graphId) return undefined;
  return GRAPH_DASHBOARD_WIDGET_ID_BY_GRAPH_ID[String(graphId)];
};

/**
 * Creates a bridge widget object for a GRAPH_CATALOG graph, combining
 * the renderer widget metadata with the graph's catalog metadata.
 * @param {object} graph - A GRAPH_CATALOG graph entry.
 * @param {string} [dashboardTarget] - Optional dashboard target for target filtering.
 * @returns {object|null} A combined widget object, or null if unsupported.
 */
export const getGraphBridgeWidget = (graph, dashboardTarget) => {
  if (!graph || !graph.id) return null;

  const graphId = String(graph.id);
  const rendererWidgetId = GRAPH_DASHBOARD_WIDGET_ID_BY_GRAPH_ID[graphId];
  if (!rendererWidgetId) return null;

  const rendererWidget = getWidgetById(rendererWidgetId);
  if (!rendererWidget) return null;

  // Check target compatibility if provided
  if (dashboardTarget && typeof supportsWidgetTarget === 'function') {
    if (!supportsWidgetTarget(rendererWidget, dashboardTarget)) return null;
  }

  return {
    ...rendererWidget,
    id: graphId,
    widgetId: graphId,
    graphId,
    graphCatalogId: graphId,
    graphTitle: graph.title || graph.name || graphId,
    isGraphCatalogBacked: true,
    title: graph.title || graph.name || rendererWidget.title || graphId,
    name: graph.name || rendererWidget.name || graphId,
    catalogGraph: graph,
    sourceGraphId: graphId,
  };
};

/**
 * Converts a list of purchased graph IDs into bridge widget objects,
 * deduplicating by renderer widget so the same renderer doesn't appear twice.
 * @param {string[]} purchasedGraphIds - Array of GRAPH_CATALOG graph IDs.
 * @param {string} [dashboardTarget] - Optional dashboard target for filtering.
 * @returns {object[]} Array of unique bridge widget objects.
 */
export const getPurchasedGraphWidgets = (purchasedGraphIds = [], dashboardTarget) => {
  if (!Array.isArray(purchasedGraphIds) || purchasedGraphIds.length === 0) return [];

  const seenRendererIds = new Set();
  const bridgeWidgets = [];

  purchasedGraphIds.forEach((graphId) => {
    const graph = getGraphById(graphId);
    if (!graph) return;

    const rendererWidgetId = GRAPH_DASHBOARD_WIDGET_ID_BY_GRAPH_ID[graphId];
    if (!rendererWidgetId || seenRendererIds.has(rendererWidgetId)) return;

    seenRendererIds.add(rendererWidgetId);

    const bridgeWidget = getGraphBridgeWidget(graph, dashboardTarget);
    if (bridgeWidget) {
      bridgeWidgets.push(bridgeWidget);
    }
  });

  return bridgeWidgets;
};
