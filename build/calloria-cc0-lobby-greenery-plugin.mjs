/**
 * CALLORIA v6.18 — compatibility Vite hook.
 *
 * Lobby greenery is now activated inside the v6.17.1 lobby lifecycle. This
 * plugin remains as a no-op so existing vite.config.js imports and plugin order
 * are preserved without running the obsolete v3.2 source-anchor transform.
 */
export function calloriaCC0LobbyGreeneryPlugin() {
  return {
    name: 'calloria-cc0-lobby-greenery-v6-18-runtime',
    enforce: 'post',
    transform() {
      return null;
    }
  };
}
