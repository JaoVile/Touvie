/**
 * Define data-quality no <html> ANTES do primeiro paint, pra não piscar os
 * efeitos pesados (cursor/blur/animações) antes do React montar. Espelha o
 * CustomColorsBoot: string síncrona e minúscula que roda à frente do React.
 * Mantém a heurística em sincronia com detectQuality() de lib/quality.ts
 * (duplicada de propósito — tem que ser inline, sem import).
 */
const BOOT = `(function(){try{
  var root=document.documentElement;
  var q=localStorage.getItem('touvie:quality');
  if(q!=='completo'&&q!=='desempenho'){
    q='completo';
    try{
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){ q='desempenho'; }
      else { var c=navigator.hardwareConcurrency||8, m=navigator.deviceMemory||8; if(c<=4||m<=4){ q='desempenho'; } }
    }catch(e){}
  }
  root.setAttribute('data-quality', q);
}catch(e){}})();`;

export function QualityBoot() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static string, no user input
      dangerouslySetInnerHTML={{ __html: BOOT }}
    />
  );
}
