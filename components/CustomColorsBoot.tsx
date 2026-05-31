/**
 * Applies the user's saved colour overrides on <html> before first paint, so
 * a customised palette never flashes the theme defaults. Mirrors the boot
 * script in ThemeProvider. The logic is duplicated (not imported) on purpose:
 * it has to ship as a tiny synchronous inline string that runs ahead of React.
 * Keep the token prefix + gradient derivation in sync with lib/custom-colors.
 */
const BOOT = `(function(){try{
  var root = document.documentElement;
  // Custom colours only paint the "Personalizar" theme — skip otherwise.
  if(root.getAttribute('data-theme') !== 'personalize') return;
  var raw = localStorage.getItem('touvie:customColors');
  if(!raw) return;
  var map = JSON.parse(raw);
  if(!map || typeof map !== 'object') return;
  Object.keys(map).forEach(function(k){
    if(k.indexOf('--color-') === 0 && typeof map[k] === 'string' && map[k]) {
      root.style.setProperty(k, map[k]);
    }
  });
  var cs = getComputedStyle(root);
  if(map['--color-accent'] || map['--color-accent-2']){
    var a1 = (map['--color-accent'] || cs.getPropertyValue('--color-accent')).trim();
    var a2 = (map['--color-accent-2'] || cs.getPropertyValue('--color-accent-2')).trim();
    root.style.setProperty('--gradient-brand', 'linear-gradient(135deg, '+a1+' 0%, '+a2+' 100%)');
  }
  if(map['--color-bg'] || map['--color-bg-elevated']){
    var bg = (map['--color-bg'] || cs.getPropertyValue('--color-bg')).trim();
    var bgEl = (map['--color-bg-elevated'] || cs.getPropertyValue('--color-bg-elevated')).trim();
    root.style.setProperty('--gradient-bg', 'radial-gradient(ellipse at top, '+bgEl+' 0%, '+bg+' 55%)');
  }
}catch(e){}})();`;

export function CustomColorsBoot() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static string, no user input interpolated into the DOM
      dangerouslySetInnerHTML={{ __html: BOOT }}
    />
  );
}
