async function loadTitlebar() {
    const res = await fetch("./partials/titlebar.html");
    const html = await res.text();
  
    document.getElementById("titlebar-container").innerHTML = html;
  
    // botones
    document.getElementById("min").onclick = () => window.win.minimize();
  /* document.getElementById("max").onclick = () => window.win.toggleMaximize(); */
  document.getElementById("close").onclick = () => window.win.close();

   // ocultar botón maximizar
  }
  
  document.addEventListener("DOMContentLoaded", loadTitlebar);
  