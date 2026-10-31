'use strict';
(()=>{const $=id=>document.getElementById(id),KEY='vedoy-voice-builder-v1';
const defs=[{id:'a',title:'Hilsen',trigger:'hei assistent; hei; hallo',reply:'God dag du! Er det noe jeg kan hjelpe med?',audio:'',active:true},{id:'b',title:'Småprat',trigger:'fint vær i dag; været er fint',reply:'Ja, det er deilig. Er det noe jeg kan hjelpe med?',audio:'',active:true},{id:'c',title:'Åpningstider',trigger:'når har dere åpent; åpningstid',reply:'Vi har åpent mandag til fredag fra åtte til seksten.',audio:'',active:true}];
let state={rules:defs,fallback:'Beklager, kan du si det på en annen måte?'},selected='a',db,recorder,parts=[],audio;
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&Array.isArray(s.rules))state=s}catch{}
const id=()=>crypto.randomUUID(),save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));$('saved-status').textContent='Lagret lokalt'}catch{$('saved-status').textContent='Midlertidig lagring'}};
const ico=()=>window.lucide?.createIcons(),div=(cls,text)=>{const e=document.createElement('div');e.className=cls;e.textContent=text;return e};
function move(ruleId,index){const i=state.rules.findIndex(x=>x.id===ruleId);if(i<0||index<0||index>=state.rules.length)return;const [r]=state.rules.splice(i,1);state.rules.splice(index,0,r);selected=ruleId;save();render()}
function render(){
const root=$('flow-rules');root.replaceChildren();$('drop-guide').hidden=state.rules.length>0;
state.rules.forEach((r,i)=>{const c=div('flow-card'+(r.id===selected?' selected':''),'');c.tabIndex=0;c.draggable=true;
const h=div('flow-header','');h.append(div('',r.title));const controls=div('','');
[-1,1].forEach(d=>{const b=document.createElement('button');b.type='button';b.textContent=d<0?'↑':'↓';b.disabled=i+d<0||i+d>=state.rules.length;b.onclick=e=>{e.stopPropagation();move(r.id,i+d)};controls.append(b)});
h.append(controls);c.append(h,div('', 'NÅR: '+(r.trigger||'…')),div('reply','SVAR: '+(r.reply||'…')));
c.onclick=()=>{selected=r.id;render()};c.onkeydown=e=>{if(e.key==='Enter'){selected=r.id;render()}};
c.ondragstart=e=>e.dataTransfer.setData('text/plain',r.id);
c.ondragover=e=>e.preventDefault();c.ondrop=e=>{e.stopPropagation();e.preventDefault();move(e.dataTransfer.getData('text/plain'),i)};root.append(c)});
$('rule-count').textContent=state.rules.length+' regler';const r=state.rules.find(x=>x.id===selected);$('rule-editor').hidden=!r;
if(r){$('rule-title').value=r.title;$('rule-trigger').value=r.trigger;$('rule-reply').value=r.reply;$('rule-active').checked=r.active;$('rule-audio').value=r.audio||''}
$('fallback-reply').value=state.fallback;$('fallback-preview').textContent='«'+state.fallback+'»';ico()
}
function add(type){const t={greeting:defs[0],weather:defs[1],hours:defs[2],custom:{title:'Ny regel',trigger:'',reply:'Er det noe jeg kan hjelpe med?',active:true,audio:''}}[type]||defs[0];const r={...t,id:id()};state.rules.push(r);selected=r.id;save();render()}
document.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>add(x.dataset.add));
document.querySelectorAll('[data-template]').forEach(x=>{x.ondragstart=e=>e.dataTransfer.setData('application/x-template',x.dataset.template)});
$('drop-zone').ondragover=e=>{e.preventDefault();$('drop-zone').classList.add('dragover')};
$('drop-zone').ondragleave=()=>$('drop-zone').classList.remove('dragover');
$('drop-zone').ondrop=e=>{e.preventDefault();$('drop-zone').classList.remove('dragover');const t=e.dataTransfer.getData('application/x-template');if(t)add(t);else move(e.dataTransfer.getData('text/plain'),state.rules.length-1)};
$('new-rule').onclick=()=>add('custom');
$('rule-editor').onsubmit=e=>{e.preventDefault();const r=state.rules.find(x=>x.id===selected);if(!r)return;r.title=$('rule-title').value.trim().slice(0,70);r.trigger=$('rule-trigger').value.trim().slice(0,170);r.reply=$('rule-reply').value.trim().slice(0,650);r.audio=$('rule-audio').value;r.active=$('rule-active').checked;save();render();$('edit-feedback').textContent='Regel lagret lokalt'};
$('delete-rule').onclick=()=>{state.rules=state.rules.filter(x=>x.id!==selected);selected=state.rules[0]?.id;save();render()};
$('reset-rules').onclick=()=>{if(confirm('Gjenopprett eksempelregler?')){state.rules=structuredClone(defs);selected='a';save();render()}};
$('save-fallback').onclick=()=>{state.fallback=$('fallback-reply').value.trim().slice(0,350);save();render()};
$('export-rules').onclick=()=>{const blob=new Blob([JSON.stringify({rules:state.rules,fallback:state.fallback,demo_only:true},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='vedoy-svarregler.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('import-trigger').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file||file.size>100000)return;try{const d=JSON.parse(await file.text());if(!Array.isArray(d.rules)||d.rules.length>50)throw Error('Format');state.rules=d.rules.map(r=>({id:id(),title:String(r.title||'Regel').slice(0,70),trigger:String(r.trigger||'').slice(0,170),reply:String(r.reply||'').slice(0,650),active:r.active!==false,audio:''}));state.fallback=String(d.fallback||state.fallback).slice(0,350);selected=state.rules[0]?.id;save();render()}catch{$('edit-feedback').textContent='Ugyldig importfil'}};
const openDb=()=>new Promise((yes,no)=>{const r=indexedDB.open('vedoy-voice-recordings',1);r.onupgradeneeded=()=>r.result.createObjectStore('clips',{keyPath:'id'});r.onsuccess=()=>yes(r.result);r.onerror=no});
const all=()=>new Promise((yes,no)=>{if(!db)return yes([]);const q=db.transaction('clips').objectStore('clips').getAll();q.onsuccess=()=>yes(q.result);q.onerror=no});
const put=v=>new Promise((yes,no)=>{const q=db.transaction('clips','readwrite').objectStore('clips').put(v);q.onsuccess=yes;q.onerror=no});
const del=id=>new Promise((yes,no)=>{const q=db.transaction('clips','readwrite').objectStore('clips').delete(id);q.onsuccess=yes;q.onerror=no});
async function library(){const clips=await all();const select=$('rule-audio'),old=select.value;select.replaceChildren(new Option('Bruk opplest tekst',''));const root=$('audio-library');root.replaceChildren();clips.forEach(x=>{select.add(new Option(x.name,x.id));const row=div('audio-row','');row.append(div('',x.name));const b=document.createElement('button');b.textContent='▶';b.onclick=()=>play(x.id);const d=document.createElement('button');d.textContent='Slett';d.onclick=async()=>{await del(x.id);state.rules.forEach(r=>{if(r.audio===x.id)r.audio=''});save();await library();render()};row.append(b,d);root.append(row)});if(clips.some(x=>x.id===old))select.value=old;else if(clips.some(x=>x.id===state.rules.find(r=>r.id===selected)?.audio))select.value=state.rules.find(r=>r.id===selected).audio}
function stop(){if(audio){audio.pause();audio=null}speechSynthesis?.cancel()}
async function play(clipId){const x=(await all()).find(x=>x.id===clipId);if(!x)return false;stop();const url=URL.createObjectURL(x.blob);audio=new Audio(url);audio.onended=()=>URL.revokeObjectURL(url);await audio.play();return true}
$('record-start').onclick=async()=>{if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia||!db){$('record-status').textContent='Mikrofon eller lagring utilgjengelig';return}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});parts=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(parts,{type:recorder.mimeType});recorder=null;$('record-start').disabled=false;$('record-stop').disabled=true;if(blob.size>6000000){$('record-status').textContent='Maks 6 MB per opptak';return}await put({id:id(),name:$('clip-name').value.slice(0,70)||'Mitt svar',blob});$('record-status').textContent='Opptak lagret privat i nettleseren';library()};recorder.start();$('record-start').disabled=true;$('record-stop').disabled=false;$('record-status').textContent='Tar opp …';setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},30000)}catch{$('record-status').textContent='Mikrofontillatelse avvist'}};
$('record-stop').onclick=()=>{if(recorder?.state==='recording')recorder.stop()};
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9æøå ]/g,' ').replace(/\s+/g,' ').trim();
async function test(){const input=norm($('test-phrase').value);if(!input)return;const rule=state.rules.find(r=>r.active&&r.trigger.split(';').map(norm).filter(Boolean).some(x=>input===x||input.includes(x)));const answer=rule?.reply||state.fallback;$('test-answer').textContent='«'+answer+'»';$('test-match').textContent=rule?'Matchet: '+rule.title:'Standardsvar';try{if(rule?.audio&&await play(rule.audio))return}catch{}stop();if('speechSynthesis'in window){const u=new SpeechSynthesisUtterance(answer);u.lang='nb-NO';speechSynthesis.speak(u)}}
$('run-test').onclick=test;$('stop-speech').onclick=stop;
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('recognize-speech').disabled=true;$('test-status').textContent='Nettleseren støtter ikke talegjenkjenning. Du kan teste ved å skrive.'}else $('recognize-speech').onclick=()=>{const r=new SR();r.lang='nb-NO';r.onresult=e=>{$('test-phrase').value=e.results[0][0].transcript;test()};r.onerror=()=>$('test-status').textContent='Kunne ikke gjenkjenne tale';r.start()};
openDb().then(d=>{db=d;library()}).catch(()=>{$('record-start').disabled=true;$('record-status').textContent='Denne nettleseren støtter ikke lokal lydlagring'});
render();ico()
})();