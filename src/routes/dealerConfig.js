/**
 * dealerConfig.js — Returns safe dealer config to the frontend
 * GET /api/dealer/config
 * Used by the React app on mount to load theme, branchCode visibility, features.
 * Never exposes secrets — only theme/UI settings.
 */

export async function handleDealerConfig(request, ctx, jsonResponse) {
  const { env, dealerConfig, origin } = ctx;

  // Only expose safe, UI-facing properties — never secrets
  return jsonResponse({
    key:    dealerConfig.key,
    name:   dealerConfig.name,
    theme:  dealerConfig.theme,
    features: dealerConfig.features,
  }, 200, origin, env);
}
