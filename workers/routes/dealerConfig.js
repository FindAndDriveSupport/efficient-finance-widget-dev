/**
 * dealerConfig.js — Returns safe dealer config to the frontend
 * GET /api/dealer/config
 * Used by the React app on mount to load theme, branchCode visibility, features.
 * Never exposes secrets — only theme/UI settings.
 */

export async function handleDealerConfig(request, ctx, jsonResponse) {
  const { env, dealerConfig, origin } = ctx;

  return jsonResponse({
    key:         dealerConfig.key,
    name:        dealerConfig.name,
    financeType: dealerConfig.financeType,
    theme:       dealerConfig.theme,
    features:    dealerConfig.features,
    branches:    dealerConfig.branches || null,
  }, 200, origin, env);
}