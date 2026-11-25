/* MHSARBIDE · prueba aislada de integración con Cloudflare D1.
 * Sin Supabase ni R2. Adjuntos binarios guardados únicamente en este dispositivo.
 * No se sube nada hasta habilitar expresamente esta copia de pruebas.
 */
(()=>{'use strict';
const API='https://mhsarbide-api.jautar.workers.dev';
const KINDS=['company','client','product','service','invoice','budget','numbering'];
const FIELDS={client:'clients',product:'products',service:'services',invoice:'invoices',budget:'budgets'};
const PREFIX='mhs_cf_stage_v2_';
const state={token:'',ready:false,busy:false,enabled:false,meta:{},lastError:'',timer:null};
const gate=document.getElementById('mhsCloudGate');
if(!gate)return;
const css=document.createElement('style');css.textContent=`
#mhsCloudGate{position:fixed;inset:0;z-index:9999;background:#eef2f6;display:grid;place-items:center;padding:20px;font:16px system-ui;color:#18283a}
#mhsCloudGate[hidden]{display:none}
#mhsCloudGate .cf-card{background:white;border-radius:16px;box-shadow:0 10px 32px #0002;padding:24px;max-width:490px;width:100%}
#mhsCloudGate h2{margin:0 0 7px;font-size:24px}
#mhsCloudGate p{line-height:1.45}
#mhsCloudGate label{display:block;font-weight:600;margin:14px 0 5px}
#mhsCloudGate input{box-sizing:border-box;width:100%;padding:11px;border-radius:7px;border:1px solid #aaa;font:inherit}
#mhsCloudGate button,.mhs-cf-status button{padding:10px 13px;background:#145b97;color:white;border:0;border-radius:7px;cursor:pointer;font:inherit;margin:6px 7px 0 0}
#mhsCloudGate button:disabled{opacity:.5}
#mhsCloudGate .cf-warning{color:#9f371d;font-weight:600}
.mhs-cf-status{padding:9px 16px;background:#edf3fb;border-bottom:1px solid #b8cee0;font:13px system-ui;color:#284360;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.mhs-cf-status button{font-size:12px;padding:5px 9px;margin:0}
`;document.head.append(css);
const status=document.createElement('div');status.className='mhs-cf-status';
const text=document.createElement('span');text.textContent='Cloudflare: esperando acceso';status.append(text);
const retry=document.createElement('button');retry.type='button';retry.textContent='Comprobar / activar nube';retry.onclick=()=>{if(state.token)initialCheck().catch(showError);else loginScreen();};status.append(retry);
const logoutBtn=document.createElement('button');logoutBtn.type='button';logoutBtn.textContent='Cerrar sesión';logoutBtn.onclick=()=>{state.token='';state.ready=false;state.enabled=false;clearInterval(state.timer);loginScreen();};status.append(logoutBtn);
const shell=document.querySelector('.workspace');if(shell)shell.insertBefore(status,shell.firstChild);
const H=t=>{const p=document.createElement('p');p.textContent=t;return p;};
function showError(e){const message=String(e?.message||e||'Error desconocido');state.lastError=message;text.textContent='Cloudflare: '+message;console.warn('MHS Cloudflare:',message);}
function setStatus(s){text.textContent='Cloudflare: '+s;}
function render(kind,notes,buttons=[]){gate.hidden=false;gate.replaceChildren();const card=document.createElement('div');card.className='cf-card';const title=document.createElement('h2');title.textContent=kind;card.append(title);for(const p of notes)card.append(H(p));for(const [label,cb] of buttons){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=cb;card.append(b)}gate.append(card);}
async function request(path,opts={}){
 if(!state.token&&path!=='/api/login')throw Error('Inicia sesión');
 const h={'accept':'application/json'};
 if(opts.body)h['content-type']='application/json';
 if(state.token)h.authorization='Bearer '+state.token;
 let r;try{r=await fetch(API+path,{...opts,headers:{...h,...opts.headers},cache:'no-store'});}catch{throw Error('Sin conexión con Cloudflare. Los datos locales se conservan.');}
 if(r.status===401&&path!=='/api/login'){state.enabled=false;state.token='';loginScreen();throw Error('La sesión ha caducado. Vuelve a iniciar sesión.');}
 let data;try{data=await r.json()}catch{throw Error('Respuesta no válida de Cloudflare');}
 if(!r.ok){if(r.status===409)throw Error('CONFLICTO: cambios en otro dispositivo. No se ha sobrescrito ningún registro.');throw Error(data.error||'Error HTTP '+r.status);}
 return data;
}
function loginScreen(){
 state.token='';state.ready=false;gate.hidden=false;
 render('Acceso a MHSARBIDE — Cloudflare',['Introduce tu correo y contraseña para acceder a esta COPIA DE PRUEBAS. La versión original no se modifica.']);
 const c=gate.firstChild;
 const form=document.createElement('form');
 const l1=document.createElement('label');l1.textContent='Correo electrónico';const email=document.createElement('input');email.type='email';email.required=true;email.autocomplete='username';
 const l2=document.createElement('label');l2.textContent='Contraseña';const pass=document.createElement('input');pass.type='password';pass.required=true;pass.autocomplete='current-password';
 const btn=document.createElement('button');btn.textContent='Entrar';btn.type='submit';const msg=H('');msg.setAttribute('role','status');
 form.append(l1,email,l2,pass,btn,msg);c.append(form);
 form.onsubmit=async e=>{e.preventDefault();btn.disabled=true;msg.textContent='Comprobando…';try{
   const d=await request('/api/login',{method:'POST',body:JSON.stringify({email:email.value.trim(),password:pass.value})});
   if(!d.token)throw Error('Cloudflare no devolvió una sesión');state.token=d.token;pass.value='';
   const health=await request('/api/health');if(health.ok!==true)throw Error('No se confirmó la base de datos');
   await window.MHSApp.ready;state.ready=true;await initialCheck();
 }catch(err){msg.textContent=String(err.message||err);showError(err)}finally{btn.disabled=false;pass.value='';}};
}
// Fotos antiguas y adjuntos NO viajan a Cloudflare. La copia local original NO se modifica.
// Se mantienen datos y firmas/documentos de recepción, logotipo, sello y firma de empresa.
function cloudService(value){
 const copy=structuredClone(value);
 function clean(node){
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const v of node)clean(v);return;}
  for(const [key,v] of Object.entries(node)){
   if(key==='photos'){node[key]={};continue;}
   if(key==='attachments'){node[key]=[];continue;}
   if(typeof v==='string'&&/^data:image\//i.test(v)&&!/(?:signature|firma|seal|sello|logo)/i.test(key)){
     node[key]='';continue;
   }
   if(v&&typeof v==='object')clean(v);
  }
 }
 clean(copy);return copy;
}
function entries(s){const out=new Map();for(const kind of KINDS){if(FIELDS[kind]){
 for(const row of s[FIELDS[kind]]||[]){if(row&&row.id!=null){const id=String(row.id);if(/^[a-zA-Z0-9_.:-]{1,128}$/.test(id))out.set(kind+':'+id,{kind,id,data:kind==='service'?cloudService(row):row});}}
 }else{const data=s[kind]||{};if(Object.keys(data).length)out.set(kind+':main',{kind,id:'main',data});}}
 return out;}
async function fingerprint(data){const textData=JSON.stringify(data);const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(textData));return Array.from(new Uint8Array(d),x=>x.toString(16).padStart(2,'0')).join('');}
function loadMeta(){try{return JSON.parse(localStorage.getItem(PREFIX+'meta')||'{}')}catch{return {}}}
function saveMeta(){localStorage.setItem(PREFIX+'meta',JSON.stringify(state.meta));}
async function remoteIndex(){const rows=new Map();for(const kind of KINDS){const data=await request('/api/records?kind='+kind);if(data.records.length>=1000)throw Error('Límite de listado alcanzado. No sincronizar más hasta ampliar paginación.');for(const r of data.records)rows.set(kind+':'+r.id,{kind,id:r.id,revision:r.revision});}return rows;}
async function remoteGet(r){return (await request('/api/record/'+r.kind+'/'+encodeURIComponent(r.id))).data;}
async function localState(){await window.MHSApp.ready;return window.MHSApp.getState();}
function anyData(s){return !!(s.services?.length||s.clients?.length||s.products?.length||s.invoices?.length||s.budgets?.length||Object.values(s.company||{}).some(Boolean)||(Number(s.numbering?.serviceNext||26001)!==26001));}
async function initialCheck(){
 setStatus('comprobando registros, sin subir nada');
 const remote=await remoteIndex();const local=await localState();const localRows=entries(local);const realLocal=anyData(local);
 state.meta=loadMeta();
 // Primera conexión de una copia sin datos: puede descargar los registros de la nube con seguridad.
 if(remote.size>0 && !realLocal){
   await downloadRows([...remote.values()]);state.enabled=true;gate.hidden=true;setStatus('conectado; datos de la nube recuperados');start();return;
 }
 // No conectar automáticamente dos conjuntos diferentes sin una decisión explícita.
 if(remote.size>0 && realLocal && Object.keys(state.meta).length===0){
   render('Datos diferentes: revisión necesaria',['Hay datos tanto en esta copia como en Cloudflare. Para evitar sobrescrituras no se ha sincronizado nada. Exporta el JSON y revisa antes de continuar.'],[['Volver a comprobar',()=>initialCheck().catch(showError)]]);
   setStatus('revisión necesaria; ningún dato sobrescrito');return;
 }
 if(remote.size===0 && realLocal && Object.keys(state.meta).length===0){
   render('Primera copia en Cloudflare',['Hay datos locales y la nube está vacía. Solo se subirán si autorizas esta copia de pruebas. Las fotografías antiguas y adjuntos no se enviarán. Se conservan firmas, sello y logotipo de empresa.'],[
    ['Autorizar subida a Cloudflare',async()=>{if(!confirm('¿Subir a Cloudflare los registros de ESTA COPIA DE PRUEBAS?'))return;state.enabled=true;gate.hidden=true;await run().catch(showError);start();}],
    ['Abrir MHSARBIDE sin subir datos',()=>{state.enabled=false;gate.hidden=true;setStatus('solo local; nube pendiente de autorización');}]
   ]);return;
 }
 // Si están vacíos, NO dar consentimiento tácito para subir datos futuros.
 render('Prueba Cloudflare preparada',[
  'La nube no tiene registros. Puedes abrir la aplicación, importar una COPIA JSON o crear datos de prueba.',
  'El guardado local funciona desde ahora; para subir datos pulsa Comprobar / activar nube y confirma la operación.'
 ],[['Abrir MHSARBIDE sin subir datos',()=>{state.enabled=false;gate.hidden=true;setStatus('solo local; nube pendiente de autorización');}]]);
 return;
}
async function downloadRows(list){const existing=entries(await localState());const updates=[];
 for(const r of list){const data=await remoteGet(r),key=r.kind+':'+r.id,local=existing.get(key),base=state.meta[key],fp=await fingerprint(data);
   if(local && !(r.kind==='numbering' && !anyData(await localState()))){const lf=await fingerprint(local.data);
     if(!base&&lf!==fp)throw Error('CONFLICTO al recibir '+key+'. Conserva ambas copias.');
     if(base&&lf!==base.hash&&lf!==fp)throw Error('CONFLICTO local al recibir '+key+'. No se ha sobrescrito.');
   }
   updates.push({...r,data});state.meta[key]={revision:r.revision,hash:fp};
 }
 if(updates.length)await window.MHSApp.applyCloudRecords(updates);saveMeta();
}
async function run(){
 if(!state.token||!state.ready||!state.enabled||state.busy||!navigator.onLine)return;
 state.busy=true;try{
  const remote=await remoteIndex();const local=entries(await localState());let received=0,sent=0;
  // Revisar primero cambios externos, antes de enviar modificaciones locales.
  const incoming=[];
  for(const [key,r] of remote){const base=state.meta[key];if(base?.revision===r.revision)continue;
   const here=local.get(key);
   if(here&&base){const fp=await fingerprint(here.data);if(fp!==base.hash)throw Error('CONFLICTO en '+key+': el otro dispositivo ha cambiado el registro. Ningún dato sobrescrito.');}
   if(here&&!base){const data=await remoteGet(r);if(await fingerprint(data)!==await fingerprint(here.data))throw Error('CONFLICTO inicial en '+key+'; no se sobrescribe.');state.meta[key]={revision:r.revision,hash:await fingerprint(data)};continue;}
   incoming.push(r);
  }
  if(incoming.length){await downloadRows(incoming);received=incoming.length;}
  const updatedLocal=entries(await localState());
  for(const [key,row] of updatedLocal){const fp=await fingerprint(row.data);const base=state.meta[key];if(base?.hash===fp)continue;
    const remoteRec=remote.get(key);if(remoteRec&&(!base||base.revision!==remoteRec.revision))throw Error('CONFLICTO en '+key+'; copia local y nube distintas.');
    const body={data:row.data,expectedRevision:base?.revision||0};
    const length=new TextEncoder().encode(JSON.stringify(body)).length;
    if(length>1450000)throw Error('Registro '+key+' demasiado grande para D1. Reduce fotos o adjuntos antes de sincronizar.');
    const result=await request('/api/record/'+row.kind+'/'+encodeURIComponent(row.id),{method:'PUT',body:JSON.stringify(body)});
    state.meta[key]={hash:fp,revision:result.revision};saveMeta();sent++;
  }
  for(const key of Object.keys(state.meta))if(!updatedLocal.has(key)&&remote.has(key)){
    setStatus('aviso: borrados pendientes de sincronización; conserva copia JSON');
    throw Error('Los borrados aún no se sincronizan entre dispositivos. No se ha borrado nada en la nube.');
  }
  setStatus('conectado · '+sent+' enviados · '+received+' recibidos · '+new Date().toLocaleTimeString('es-ES'));
 }catch(e){showError(e);throw e;}finally{state.busy=false;}
}
let debounce;
function onLocalSave(){if(!state.enabled)return;clearTimeout(debounce);debounce=setTimeout(()=>run().catch(()=>{}),1800);}
function start(){clearInterval(state.timer);state.timer=setInterval(()=>run().catch(()=>{}),60000);window.addEventListener('online',()=>run().catch(()=>{}),{once:false});}
window.MHSCloud={onLocalSave,retry:()=>run()};loginScreen();
})();
