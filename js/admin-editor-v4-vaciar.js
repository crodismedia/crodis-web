(function(){
'use strict';
function vaciarEditor(){
  const url=new URL(window.location.href);
  url.searchParams.set('limpio',Date.now().toString());
  window.location.replace(url.pathname+'?'+url.searchParams.toString());
}
document.addEventListener('DOMContentLoaded',function(){
  const btn=document.getElementById('v4-vaciar-editor');
  if(btn)btn.addEventListener('click',vaciarEditor);
});
})();
