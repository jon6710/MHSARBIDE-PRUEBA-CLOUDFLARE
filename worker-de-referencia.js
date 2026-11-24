// MHSARBIDE Cloudflare Worker - Preparacion para pruebas. No publicar con datos reales sin auditar y probar.
const TE = new TextEncoder();
const TD = new TextDecoder();
const MAX_BYTES = 1500000;
const KINDS = new Set(['company','client','product','service','invoice','budget','numbering']);
const HEAD = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'};
function json(data,status=200,origin=''){const h={...HEAD}; if(origin){h['access-control-allow-origin']=origin;h['vary']='Origin';h['access-control-allow-headers']='Content-Type,Authorization';h['access-control-allow-methods']='GET,POST,PUT,OPTIONS';}return new Response(JSON.stringify(data),{status,headers:h});}
function b64u(bytes){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function un64u(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}
function eq(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function sha(s){return b64u(new Uint8Array(await crypto.subtle.digest('SHA-256',TE.encode(s))));}
async function hmac(s,secret){const k=await crypto.subtle.importKey('raw',TE.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64u(new Uint8Array(await crypto.subtle.sign('HMAC',k,TE.encode(s))));}
async function pbkdf(pass,salt){const k=await crypto.subtle.importKey('raw',TE.encode(pass),'PBKDF2',false,['deriveBits']);return b64u(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:un64u(salt),iterations:100000},k,256)));}
function emailNormal(e){return typeof e==='string'?e.trim().toLowerCase():'';}
function emailOk(e){return e.length>=5&&e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);}
async function body(req){if(Number(req.headers.get('content-length')||0)>MAX_BYTES)throw Error('size');const s=await req.text();if(TE.encode(s).length>MAX_BYTES)throw Error('size');return JSON.parse(s);}
function ip(req){return req.headers.get('CF-Connecting-IP')||'unknown';}
async function limited(env,key,limit,seconds){const now=Math.floor(Date.now()/1000); const row=await env.DB.prepare('SELECT attempts,window_start FROM login_limits WHERE ip_key=?').bind(key).first();if(row&&now-row.window_start<seconds&&row.attempts>=limit)return true;await env.DB.prepare(`INSERT INTO login_limits(ip_key,attempts,window_start) VALUES (?,1,?) ON CONFLICT(ip_key) DO UPDATE SET attempts=CASE WHEN excluded.window_start-login_limits.window_start >= ? THEN 1 ELSE login_limits.attempts+1 END,window_start=CASE WHEN excluded.window_start-login_limits.window_start >= ? THEN excluded.window_start ELSE login_limits.window_start END`).bind(key,now,seconds,seconds).run();return false;}
async function session(req,env){const a=req.headers.get('authorization')||'';if(!a.startsWith('Bearer '))return null;const parts=a.slice(7).split('.');if(parts.length!==2||!eq(parts[1],await hmac(parts[0],env.SESSION_SECRET)))return null;try{const p=JSON.parse(TD.decode(un64u(parts[0])));if(p.aud!=='mhsarbide'||!Number.isSafeInteger(p.exp)||p.exp<=Date.now()||p.exp>Date.now()+43200001||!Number.isInteger(p.v))return null;const u=await env.DB.prepare('SELECT id,session_version FROM users WHERE id=?').bind(p.uid).first();return u&&u.session_version===p.v?u:null;}catch{return null;}}
async function makeSession(user,env){const payload=b64u(TE.encode(JSON.stringify({aud:'mhsarbide',uid:user.id,v:user.session_version,exp:Date.now()+12*3600000})));return payload+'.'+await hmac(payload,env.SESSION_SECRET);}
async function sendRecovery(env,address,link){const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'authorization':'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:env.EMAIL_FROM,to:[address],subject:'Recuperar contraseña de MHSARBIDE',text:'Has solicitado cambiar tu contraseña de MHSARBIDE. Abre este enlace dentro de los próximos 30 minutos:\n\n'+link+'\n\nSi no lo has solicitado, ignora este mensaje.'})});return r.ok;}
function htmlReset(){return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>Restablecer contraseña · MHSARBIDE</title><style>body{font:16px system-ui;background:#f5f7fa;margin:0;padding:24px}main{max-width:420px;margin:9vh auto;background:white;border-radius:14px;padding:28px;box-shadow:0 6px 30px #0001}input,button{display:block;width:100%;box-sizing:border-box;padding:12px;margin:14px 0;border-radius:8px;font:inherit}input{border:1px solid #aaa}button{border:0;background:#235fb1;color:white;cursor:pointer}p{line-height:1.5}</style></head><body><main><h1>MHSARBIDE</h1><p>Introduce tu nueva contraseña (mínimo 12 caracteres).</p><form id="f"><input id="p" type="password" minlength="12" maxlength="256" autocomplete="new-password" required placeholder="Nueva contraseña"><input id="c" type="password" minlength="12" maxlength="256" autocomplete="new-password" required placeholder="Repetir contraseña"><button>Guardar nueva contraseña</button></form><p id="msg" role="status"></p></main><script>const token=new URLSearchParams(location.hash.substring(1)).get('token');history.replaceState(null,'',location.pathname);document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();let p=document.getElementById('p').value,c=document.getElementById('c').value,m=document.getElementById('msg');if(p!==c){m.textContent='Las contraseñas no coinciden';return;}if(!token){m.textContent='Enlace no válido. Solicita otro.';return;}try{let r=await fetch('/api/password-reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,password:p})});let d=await r.json();m.textContent=d.message||d.error||'Error';if(r.ok)document.getElementById('f').remove();}catch{m.textContent='No se ha podido conectar';}});</script></body></html>`;}

// Pantalla de prueba alojada en el mismo Worker: nunca guarda contraseñas ni sesiones.
function htmlTestLogin(){return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Prueba de acceso · MHSARBIDE</title><style>*{box-sizing:border-box}body{font:16px system-ui,-apple-system,sans-serif;background:#f2f5f9;color:#17243b;margin:0;padding:20px}main{max-width:430px;margin:6vh auto;background:white;padding:28px;border-radius:16px;box-shadow:0 8px 30px #152a4415}h1{font-size:24px;margin:0 0 4px}p{line-height:1.5}small{color:#526076}label{display:block;font-weight:600;margin-top:18px}input,button{width:100%;padding:12px;font:inherit;margin-top:8px;border-radius:8px}input{border:1px solid #a8b3c1}button{border:0;background:#205eaa;color:white;font-weight:650;cursor:pointer;margin-top:20px}button:disabled{opacity:.65}#status{padding:10px 0;min-height:30px}#status.ok{color:#146238}#status.bad{color:#ad3030}.muted{font-size:14px;color:#586778}a{color:#205eaa}</style></head><body><main><h1>MHSARBIDE</h1><p><strong>Prueba de acceso a Cloudflare</strong></p><p class="muted">Esta página comprueba el correo y la contraseña. No modifica hojas, facturas ni clientes y no guarda la contraseña en el equipo.</p><form id="form"><label for="email">Correo electrónico</label><input id="email" type="email" autocomplete="username" required><label for="password">Contraseña</label><input id="password" type="password" autocomplete="current-password" required><button id="submit" type="submit">Comprobar acceso</button></form><p id="status" role="status" aria-live="polite"></p><p class="muted">No envíes capturas con contraseñas ni tokens. La recuperación por correo no está configurada todavía.</p></main><script>const f=document.getElementById('form'),m=document.getElementById('status'),b=document.getElementById('submit');f.addEventListener('submit',async e=>{e.preventDefault();m.className='';m.textContent='Comprobando acceso…';b.disabled=true;const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value;try{const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password}),cache:'no-store',credentials:'omit'});const d=await r.json();if(!r.ok){m.className='bad';m.textContent=(d.error||'No se ha podido iniciar sesión')+(d.codigo?' ('+d.codigo+')':'');return;}if(!d.token){m.className='bad';m.textContent='El servidor no ha devuelto una sesión';return;}const h=await fetch('/api/health',{method:'GET',headers:{authorization:'Bearer '+d.token},cache:'no-store',credentials:'omit'});const status=await h.json();if(h.ok&&status.ok===true){m.className='ok';m.textContent='Acceso correcto. Conexión con la base de datos verificada.';}else{m.className='bad';m.textContent='La contraseña se ha aceptado, pero la comprobación de la base de datos ha fallado.';}}catch(err){m.className='bad';m.textContent='No se pudo conectar con Cloudflare.';}finally{document.getElementById('password').value='';b.disabled=false;}});</script></body></html>`;}
function isId(s){return typeof s==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(s);}
export default {async fetch(req,env){
 const origin=req.headers.get('origin')||'';const allowed=String(env.ALLOWED_ORIGIN||'').replace(/\/$/,'');const url=new URL(req.url);
 if(!env.DB||!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!allowed)return json({error:'Worker sin configurar'},503);
 if(origin&&origin!==allowed&&origin!==url.origin)return json({error:'Origen no autorizado'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':allowed,'access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-max-age':'600','vary':'Origin'}});
 if(url.pathname==='/prueba-acceso'&&req.method==='GET')return new Response(htmlTestLogin(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'"}});
 if(url.pathname==='/reset-password'&&req.method==='GET')return new Response(htmlReset(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'"}});
 if(url.pathname==='/api/login'&&req.method==='POST'){
   // Solo informa de la fase del fallo. No registra credenciales, correos ni claves.
   let fase='CUERPO';
   try{
     const b=await body(req);
     if(!b||typeof b!=='object'||Array.isArray(b))return json({error:'Formato de solicitud incorrecto'},400,origin);
     const email=emailNormal(b.email);
     if(!emailOk(email)||typeof b.password!=='string'||b.password.length<1||b.password.length>256)
       return json({error:'Credenciales incorrectas'},401,origin);
     fase='LIMITES';
     if(await limited(env,await hmac('login:'+ip(req),env.SESSION_SECRET),8,900))
       return json({error:'Demasiados intentos. Espera 15 minutos.'},429,origin);
     fase='CONSULTA';
     const u=await env.DB.prepare('SELECT id,password_hash,password_salt,session_version FROM users WHERE email=?').bind(email).first();
     fase='VERIFICACION';
     const hash=await pbkdf(b.password,u?u.password_salt:'AAAAAAAAAAAAAAAAAAAAAA');
     if(!u||!eq(hash,u.password_hash))return json({error:'Credenciales incorrectas'},401,origin);
     fase='SESION';
     const token=await makeSession(u,env);
     return json({token,expiresInSeconds:43200},200,origin);
   }catch(e){
     // Código no sensible para diagnosticar el fallo; nunca incluir e.message o datos de la petición.
     console.error('MHSARBIDE LOGIN_'+fase+' '+(e&&typeof e.name==='string'?e.name:'Error'));
     return json({error:'No se ha podido completar el inicio de sesión',codigo:'LOGIN_'+fase},503,origin);
   }
 }
 if(url.pathname==='/api/forgot-password'&&req.method==='POST'){
   const message='Si existe esa cuenta, recibirás un enlace de recuperación.';
   try{const b=await body(req),email=emailNormal(b.email);if(!emailOk(email))return json({message},200,origin);
   if(await limited(env,await hmac('recover-ip:'+ip(req),env.SESSION_SECRET),5,3600))return json({message},200,origin);
   if(await limited(env,await hmac('recover-mail:'+email,env.SESSION_SECRET),3,3600))return json({message},200,origin);
   const u=await env.DB.prepare('SELECT id,email FROM users WHERE email=?').bind(email).first();if(!u)return json({message},200,origin);
   if(!env.RESEND_API_KEY||!env.EMAIL_FROM)return json({message},200,origin);
   const raw=b64u(crypto.getRandomValues(new Uint8Array(32))),digest=await sha(raw),expires=Math.floor(Date.now()/1000)+1800;
   await env.DB.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(digest,u.id,expires).run();
   const link=url.origin+'/reset-password#token='+encodeURIComponent(raw);let sent=false;try{sent=await sendRecovery(env,email,link);}catch{}
   if(!sent)await env.DB.prepare('DELETE FROM password_resets WHERE token_hash=?').bind(digest).run();
   return json({message},200,origin);
   }catch{return json({message},200,origin);}
 }
 if(url.pathname==='/api/password-reset'&&req.method==='POST'){
   try{const b=await body(req);if(typeof b.token!=='string'||b.token.length>128||!/^[A-Za-z0-9_-]{40,128}$/.test(b.token)||typeof b.password!=='string'||b.password.length<12||b.password.length>256)return json({error:'Enlace o contraseña no válidos'},400,origin);
   if(await limited(env,await hmac('reset-ip:'+ip(req),env.SESSION_SECRET),12,3600))return json({error:'Demasiados intentos'},429,origin);
   const digest=await sha(b.token),now=Math.floor(Date.now()/1000);const row=await env.DB.prepare('SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>?').bind(digest,now).first();if(!row)return json({error:'Enlace caducado o utilizado. Solicita uno nuevo.'},400,origin);
   const salt=b64u(crypto.getRandomValues(new Uint8Array(16))),hash=await pbkdf(b.password,salt);
   const result=await env.DB.batch([
     env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,session_version=session_version+1,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM password_resets WHERE token_hash=? AND user_id=? AND expires_at>?)').bind(hash,salt,new Date().toISOString(),row.user_id,digest,row.user_id,now),
     env.DB.prepare('DELETE FROM password_resets WHERE token_hash=? AND expires_at>?').bind(digest,now),
     env.DB.prepare('DELETE FROM password_resets WHERE user_id=?').bind(row.user_id)
   ]);
   if(result[0]?.meta?.changes!==1||result[1]?.meta?.changes!==1)return json({error:'Enlace caducado o utilizado.'},400,origin);
   return json({message:'Contraseña cambiada. Ya puedes iniciar sesión con tu correo.'},200,origin);
   }catch{return json({error:'No se ha podido cambiar la contraseña'},400,origin);}
 }
 const u=await session(req,env);if(!u)return json({error:'Sesión requerida'},401,origin);
 if(url.pathname==='/api/health'&&req.method==='GET')return json({ok:true,service:'mhsarbide-d1',files:'no-r2'},200,origin);
 if(url.pathname==='/api/changes'&&req.method==='GET'){const cur=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(cur)||cur<0)return json({error:'Cursor incorrecto'},400,origin);const rows=(await env.DB.prepare('SELECT seq,kind,record_id AS id,revision,changed_at AS changedAt FROM changes WHERE seq>? ORDER BY seq LIMIT 101').bind(cur).all()).results||[];const page=rows.slice(0,100);return json({changes:page,nextCursor:page.at(-1)?.seq??cur,hasMore:rows.length>100},200,origin);}
 if(url.pathname==='/api/records'&&req.method==='GET'){const kind=url.searchParams.get('kind')||'';if(!KINDS.has(kind))return json({error:'Tipo incorrecto'},400,origin);const rows=(await env.DB.prepare('SELECT id,revision,updated_at AS updatedAt FROM records WHERE kind=? ORDER BY id LIMIT 1000').bind(kind).all()).results||[];return json({records:rows},200,origin);}
 const m=url.pathname.match(/^\/api\/record\/([a-z]+)\/([^/]+)$/);if(m){const kind=m[1],id=m[2];if(!KINDS.has(kind)||!isId(id))return json({error:'Identificador incorrecto'},400,origin);
  if(req.method==='GET'){const row=await env.DB.prepare('SELECT data,revision,updated_at AS updatedAt FROM records WHERE kind=? AND id=?').bind(kind,id).first();return row?json({data:JSON.parse(row.data),revision:row.revision,updatedAt:row.updatedAt},200,origin):json({error:'No existe'},404,origin);}
  if(req.method==='PUT'){try{const b=await body(req);if(!b||!Object.hasOwn(b,'data')||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)return json({error:'Datos incorrectos'},400,origin);const value=JSON.stringify(b.data);if(!value||TE.encode(value).length>MAX_BYTES)return json({error:'Registro demasiado grande'},413,origin);
   const now=new Date().toISOString();const old=await env.DB.prepare('SELECT revision FROM records WHERE kind=? AND id=?').bind(kind,id).first();const prev=old?.revision||0;if(prev!==b.expectedRevision)return json({error:'Conflicto de edición',currentRevision:prev},409,origin);const next=prev+1;
   const result=await env.DB.batch([env.DB.prepare('INSERT INTO records(kind,id,data,revision,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at WHERE records.revision=?').bind(kind,id,value,next,now,prev),env.DB.prepare('INSERT INTO changes(kind,record_id,revision,changed_at) SELECT kind,id,revision,updated_at FROM records WHERE kind=? AND id=? AND revision=?').bind(kind,id,next)]);
   if(result[0]?.meta?.changes!==1)return json({error:'Conflicto de edición'},409,origin);return json({ok:true,revision:next,updatedAt:now},200,origin);
  }catch{return json({error:'No se ha podido guardar'},400,origin);}}
 }
 return json({error:'Ruta no encontrada'},404,origin);
}};
