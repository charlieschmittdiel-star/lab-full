'use strict';
// ================= Access codes checked against your Google Sheet =================
// Used by all three games (football, basketball, soccer). One unlock covers all three on that computer.
//
// OWNER SETTINGS (only you change these):
//   SL_URL   The web address of your Sheet's code checker (Apps Script > Deploy > Web app). It ends in /exec.
//            Leave it empty ('') and the games work like before: the website is free and the downloaded copy
//            uses the old offline device codes.
//   SL_ON    1 = the games ask for a code and check it against your Sheet. 0 = switched off.
//            (This switch lives here instead of on the Game features page, because players could flip it there.)
//   SL_DAYS  How often, when the computer is online, the game quietly re-asks the Sheet, so a code you turn
//            off stops working. Without internet the game keeps playing.
const SL_URL='',SL_ON=1,SL_DAYS=3;
// ===================================================================================

const SL_A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function slActive(){return !!(SL_ON&&/^https?:\/\/\S+$/.test(SL_URL))}
function slClean(c){return String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function slFmt(c){const k=slClean(c);return k.slice(0,4)+'-'+k.slice(4,8)+'-'+k.slice(8,12)}
// the same device ID the old offline codes use, so nothing changes for anyone who already has one
function slDev(){let d=null;try{d=localStorage.getItem('gddev')}catch(e){}if(!d||slClean(d).length!=8){d='';const a=new Uint32Array(8);try{crypto.getRandomValues(a)}catch(e){for(let i=0;i<8;i++)a[i]=Math.random()*1e9}
 for(let i=0;i<8;i++)d+=SL_A[a[i]%32];d=d.slice(0,4)+'-'+d.slice(4);try{localStorage.setItem('gddev',d)}catch(e){}}return d}
function slGet(){try{const r=JSON.parse(localStorage.getItem('gdsl')||'null');return r&&typeof r=='object'?r:null}catch(e){return null}}
function slSet(r){try{if(r)localStorage.setItem('gdsl',JSON.stringify(r));else localStorage.removeItem('gdsl')}catch(e){}}
function slOK(){const r=slGet();return !!(r&&slClean(r.c).length==12&&slClean(r.d)===slClean(slDev()))}

// ask the Sheet. Resolves {ok:true,name,lim,used} or {ok:false,why:'bad'|'off'|'full'|'net'|'error'}
function slAsk(code,dev){const q=SL_URL+(SL_URL.includes('?')?'&':'?')+'code='+encodeURIComponent(slClean(code))+'&dev='+encodeURIComponent(slClean(dev))+'&v=1&t='+Date.now();
 const tidy=r=>r&&typeof r=='object'&&'ok' in r?r:{ok:false,why:'error'};
 const viaFetch=()=>new Promise((res,rej)=>{let done=0;const ac=typeof AbortController=='function'?new AbortController():null;const to=setTimeout(()=>{if(done)return;done=1;try{ac&&ac.abort()}catch(e){}rej('timeout')},15000);
  fetch(q,{method:'GET',redirect:'follow',cache:'no-store',signal:ac?ac.signal:undefined}).then(x=>x.text()).then(t=>{if(done)return;done=1;clearTimeout(to);res(tidy(JSON.parse(t)))}).catch(e=>{if(done)return;done=1;clearTimeout(to);rej(e)})});
 // backup route for browsers that block the normal request from a downloaded copy
 const viaScript=()=>new Promise((res,rej)=>{const cb='__slcb'+Math.floor(Math.random()*1e9),s=document.createElement('script');let done=0;
  const end=(ok,v)=>{if(done)return;done=1;clearTimeout(to);try{delete window[cb]}catch(e){window[cb]=undefined}s.remove();ok?res(tidy(v)):rej(v)};
  const to=setTimeout(()=>end(0,'timeout'),15000);window[cb]=v=>end(1,v);s.onerror=()=>end(0,'net');s.src=q+'&cb='+cb;document.head.appendChild(s)});
 return viaFetch().catch(()=>viaScript()).catch(()=>({ok:false,why:'net'}))}

const SL_MSG={bad:'That code doesn\'t work. Check it and try again.',off:'This code has been turned off. Ask the person who gave you the game.',
 full:'This code is already being used on its limit of computers. Ask the person who gave you the game to reset it.',
 net:'Couldn\'t reach the code checker. Check your internet connection and try again.',error:'The code checker had a problem. Try again in a minute.'};
function slName(){const p=location.pathname;return /\/hoops\//.test(p)?['Hardwood Lab','HL']:/\/soccer\//.test(p)?['Pitch Lab','PL']:['Gridiron Lab','GL']}

function slShow(msg){if(document.getElementById('slg'))return;const[nm,lg]=slName(),d=document.createElement('div');d.id='slg';
 d.innerHTML=`<div class="slb"><div class="sll">${lg}</div><h1>${nm}</h1><p>Enter the access code you were given to play.</p>
 <input id="sli" maxlength="16" placeholder="XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false"><button id="slk">Unlock</button><p id="sle" class="sle"></p>
 <p class="sls">You need internet the first time. After that, the game remembers this computer.</p><p class="sls">Device ID: <b>${slDev()}</b> (only needed if you ask for help)</p></div>`;document.body.appendChild(d);
 const s=document.createElement('style');s.textContent=`#slg{position:fixed;inset:0;z-index:200;background:radial-gradient(circle at 50% 30%,#1f3a2c,#07100b);display:flex;align-items:center;justify-content:center;font-family:"Trebuchet MS",sans-serif;color:#e8f0ea}
 #slg .slb{background:#0b1410ee;border:2px solid #ffd84d;border-radius:16px;padding:28px 30px;width:min(420px,90vw);text-align:center;box-shadow:0 10px 40px #000a}#slg h1{margin:6px 0 4px;color:#fff}#slg p{color:#e8f0ea}
 #slg .sll{width:64px;height:64px;margin:0 auto;border-radius:50%;background:linear-gradient(#2563eb,#1e3a8a);border:3px solid #ffd84d;display:flex;align-items:center;justify-content:center;font:900 22px "Trebuchet MS",sans-serif;color:#fff}
 #sli{width:100%;box-sizing:border-box;font:700 22px monospace;letter-spacing:3px;text-align:center;padding:10px;border-radius:10px;border:2px solid #475569;background:#f8fafc;color:#0b1410;margin:10px 0}
 #slk{width:100%;padding:12px;font:800 17px "Trebuchet MS",sans-serif;border:0;border-radius:10px;background:#d6402f;color:#fff;cursor:pointer}#slk:disabled{opacity:.6;cursor:wait}
 #slg .sle{color:#fca5a5;min-height:20px;font-weight:700}#slg .sle.ok{color:#86efac}#slg .sls{font-size:12px;color:#9fb5a8;margin:6px 0}#slg .sls b{font-family:monospace;letter-spacing:1px;color:#cbd5e1}`;d.appendChild(s);
 const $i=document.getElementById('sli'),$b=document.getElementById('slk'),$e=document.getElementById('sle');if(msg)$e.textContent=msg;
 const go=()=>{const v=slClean($i.value);if(v.length!=12){$e.className='sle';$e.textContent='Codes have 12 letters and numbers, like ABCD-EFGH-JKLM.';return}
  $b.disabled=true;$b.textContent='Checking…';$e.className='sle';$e.textContent='';const dev=slDev();
  slAsk(v,dev).then(r=>{if(r.ok){slSet({c:slFmt(v),d:dev,t:Date.now(),n:String(r.name||'').slice(0,30)});$e.className='sle ok';$e.textContent='Unlocked'+(r.name?'. Enjoy, '+r.name+'!':'. Enjoy!');setTimeout(()=>d.remove(),900)}
   else{$b.disabled=false;$b.textContent='Unlock';$e.textContent=SL_MSG[r.why]||SL_MSG.bad}})};
 $b.onclick=go;$i.addEventListener('keydown',e=>{e.stopPropagation();if(e.key=='Enter')go()});setTimeout(()=>{try{$i.focus()}catch(e){}},50)}

// every so often (when online), make sure the code is still turned on in the Sheet
function slRecheck(force){const r=slGet();if(!r||!slActive())return Promise.resolve();if(!force&&Date.now()-(+r.t||0)<SL_DAYS*864e5)return Promise.resolve();if(typeof navigator!='undefined'&&navigator.onLine===false)return Promise.resolve();
 return slAsk(r.c,r.d).then(x=>{if(x.ok){r.t=Date.now();if(x.name)r.n=String(x.name).slice(0,30);slSet(r)}else if(x.why=='bad'||x.why=='off'||x.why=='full'){slSet(null);slShow(SL_MSG[x.why])}})}

function slGate(){if(!slActive())return;
 // a downloaded copy keeps separate storage per folder in some browsers, so the unlock is handed over in the link
 try{const q=new URLSearchParams(location.search),h=q.get('sl');if(h){if(!slOK()){const r=JSON.parse(decodeURIComponent(escape(atob(h))));if(r&&slClean(r.c).length==12&&slClean(r.d).length==8){try{localStorage.setItem('gddev',r.d)}catch(e){}slSet(r)}}
  q.delete('sl');const rest=q.toString();history.replaceState(null,'',location.pathname+(rest?'?'+rest:'')+location.hash)}}catch(e){}
 if(slOK()){setTimeout(()=>slRecheck(false),2500);return}slShow('')}

// while the code screen is up, the game ignores the keyboard
addEventListener('keydown',e=>{if(document.getElementById('slg')&&e.target&&e.target.id!='sli'){e.stopImmediatePropagation();e.preventDefault()}},true);
// links between the three games carry the unlock along in the downloaded copy
addEventListener('click',e=>{try{if(location.protocol!=='file:'||!slActive()||!slOK())return;const a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;
 const h=a.getAttribute('href')||'';if(!/(^|\/)(hoops\/|soccer\/)?index\.html(\?|$)/.test(h))return;if(/[?&]sl=/.test(h))return;
 const t=btoa(unescape(encodeURIComponent(JSON.stringify(slGet()))));a.setAttribute('href',h+(h.includes('?')?'&':'?')+'sl='+encodeURIComponent(t))}catch(err){}});
slGate();
