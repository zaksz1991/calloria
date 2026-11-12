/**
 * CALLORIA v6.19 — compatibility Vite hook.
 *
 * Department glass is activated directly by the current production-world
 * scene lifecycle in cc0-office-lobby-integration.js. Keep the old plugin
 * export so vite.config.js and plugin ordering remain unchanged, but disable
 * the obsolete v3.3 source-anchor transform.
 */
export function calloriaGlazedDepartmentPartitionsPlugin() {
  return {
    name: 'calloria-glazed-department-partitions-v6-19-runtime',
    enforce: 'post',
    transform() {
      return null;
    }
  };
}
