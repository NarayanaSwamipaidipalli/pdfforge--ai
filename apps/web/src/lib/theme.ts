/** Server-safe bootstrap: keep this value outside a client-component module. */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var s=localStorage.getItem('doxera_theme');
  var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark',d);
}catch(e){}})();
`;
