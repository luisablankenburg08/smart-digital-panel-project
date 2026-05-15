

// =========================
// 🔧 CONFIG INICIAL
// =========================
let playlistRodando = false;
let params = new URLSearchParams(window.location.search);
let preview = params.get("preview") === "true";

let tvId = preview
  ? params.get("tv")
  : localStorage.getItem("tvId");

// controle interno
let ultimaPagina = null;
let intervaloAtual = 2000;
let modoAtual = "iframe";


let ultimoConteudo = "";
let carregandoConteudo = false;
let ultimoRefresh = null;

// timers
let heartbeatInterval = null;
let polling = null;



// =========================
// REGISTRO
// =========================
async function registrar(){

  if(preview) return;

  try{
    let res = await fetch("/register", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ tv: tvId })
    });

    let data = await res.json();

    tvId = data.tv;
    localStorage.setItem("tvId", tvId);

    iniciarHeartbeat();
    await ping();

  }catch(e){
    console.error("Erro register:", e);
  }
}

// =========================
// HEARTBEAT
// =========================
async function ping(){

  if(preview) return;

  try{
    await fetch("/ping", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ tv: tvId }),
      keepalive: true
    });
  }catch(e){
    console.error("Erro ping:", e);
  }
}

function iniciarHeartbeat(){
  if(preview) return;

  if(heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(ping, 5000);
}

// =========================
// DESCONEXÃO
// =========================
function desligar(){

  if(preview) return;

  if(tvId){
    const params = new URLSearchParams();
    params.append('tv', tvId);
    navigator.sendBeacon("/unregister", params);
  }
}

window.addEventListener("beforeunload", desligar);
window.addEventListener("pagehide", desligar);
window.addEventListener("unload", desligar);

// =========================
// PLAYLIST IFRAME
// =========================

async function mostrarConteudo(type, refreshAtual){

  if(carregandoConteudo) return;
  carregandoConteudo = true;

  let frame = document.getElementById("frame");
  let content = document.getElementById("content");


  let res =
    await fetch(`/playlist?tv=${tvId}&type=${type}`);

  let items = await res.json();

  // pega apenas o primeiro item
  let item = items[0];
  let conteudoAtual = JSON.stringify(items);

  if(!item){

    frame.style.display = "none";

    content.style.display = "flex";

    content.innerHTML = `
      <div class="aviso">
        Nenhum conteúdo cadastrado
      </div>
    `;
    carregandoConteudo = false;
    return;
  }


  if(
    ultimoConteudo === conteudoAtual &&
    ultimoRefresh === refreshAtual
  ){
      carregandoConteudo = false;
      return;
  }
  
  ultimoConteudo = conteudoAtual;
  ultimoRefresh = refreshAtual;

  // =========================
  // VÍDEOS
  // =========================
  if(type === "videos"){

    frame.style.display = "block";

    content.style.display = "none";

    frame.src = item.iframe;

    carregandoConteudo = false;
    return;
  }

  // =========================
  // AVISOS
  // =========================
  if(type === "avisos"){

    frame.style.display = "none";

    content.style.display = "block";

    content.innerHTML = `
      <div class="aviso">
        <fieldset class="field-texto">
        <legend> <img src="/layouts/imagem-alerta.png" class="warning-image" > </legend>
          ${item.texto}
        </fieldset>
      </div>
    `;
    carregandoConteudo = false;
    return;
  }

  // =========================
  // MAPA
  // =========================
  if(type === "mapa"){

    frame.style.display = "none";

    content.style.display = "block";

    content.innerHTML = `
      <img
        src="${item.src}"
        class="imagemViewer"
      >
    `;
    carregandoConteudo = false;
    return;
  }

// =========================
// CALENDÁRIO
// =========================
if(type === "calendario"){

    frame.style.display = "none";

    content.style.display = "block";

    content.innerHTML = `
        <iframe
            src="${item.src}"
            style="
                width:80vw;
                height:100vh;
                margin-left: 10vw;
            ">
        </iframe>
    `;
    carregandoConteudo = false;
    return;
}
}

// =========================
// 🔄 LOOP PRINCIPAL
// =========================
async function carregar(){

  try{

    let res = await fetch("/state");
    let state = await res.json();

    if(!tvId || !state[tvId]){

      if(!preview){

        console.log("Re-registrando TV...");

        localStorage.removeItem("tvId");

        await registrar();
      }

      return;
    }

    let config = state[tvId];

    let pagina =
      typeof config === "string"
        ? config
        : config.pagina;

    let frame =
      document.getElementById("frame");

    let content =
      document.getElementById("content");

    // =========================
    // AVISOS
    // =========================
    if(pagina && pagina.includes("avisos")){

      modoAtual = "avisos";

      mostrarConteudo("avisos",config.refresh);
    
      return;
    }

    // =========================
    // VÍDEOS
    // =========================
    if(pagina && pagina.includes("videos",)){

      modoAtual = "videos";

      mostrarConteudo("videos",config.refresh);

      return;
    }

    // =========================
    // MAPA
    // =========================

    if(pagina && pagina.includes("mapa")){

      modoAtual = "mapa";

      mostrarConteudo("mapa",config.refresh);
      
      return;
    }

    // =========================
    // CALENDÁRIO
    // =========================

    if(pagina && pagina.includes("calendario")){

      modoAtual = "calendario";

      mostrarConteudo("calendario",config.refresh);

      return;
    }

    // =========================
    // IFRAME NORMAL
    // =========================
    modoAtual = "iframe";

    frame.style.display = "block";
    content.style.display = "none";

    if(ultimaPagina !== pagina){

      frame.src = pagina;

      ultimaPagina = pagina;
    }

  }catch(e){

    console.error("Erro ao carregar:", e);
  }
}

// =========================
// 🚀 INICIALIZAÇÃO
// =========================
async function iniciar(){

  if(!preview){
    await registrar();
    await carregar();
    polling = setInterval(carregar, 2000);
  }else{
    console.log("Modo preview ativo");
    await carregar();
    polling = setInterval(carregar, 5000);
  }
}

iniciar();

