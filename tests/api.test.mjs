import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
let server,dir,cookie='',base='http://127.0.0.1:3197';
async function call(route,method='GET',body){
 const res=await fetch(base+'/api'+route,{method,headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});return {status:res.status,body:await res.json(),headers:res.headers};
}
before(async()=>{
 dir=await mkdtemp(path.join(tmpdir(),'lang-test-'));
 server=spawn(process.execPath,['server/index.mjs','--production'],{cwd:process.cwd(),env:{...process.env,PORT:'3197',HOST:'127.0.0.1',DATA_DIR:dir,OPENAI_API_KEY:'',APP_PASSWORD:'testing-only-long-password'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Server did not start')),15000);server.stdout.on('data',d=>{if(String(d).includes('http://')){clearTimeout(t);resolve();}});server.on('error',reject);server.on('exit',code=>{clearTimeout(t);reject(new Error('Server exited '+code));});});
});
after(async()=>{if(server){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}if(dir)await rm(dir,{recursive:true,force:true});});
test('private session, persistent learning and missing-key behavior',async()=>{
 assert.equal((await call('/dashboard')).status,401);
 assert.equal((await call('/login','POST',{password:'wrong'})).status,401);
 const login=await call('/login','POST',{password:'testing-only-long-password'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('/status')).body.aiConfigured,false);
 assert.equal((await call('/dashboard')).body.lessons.length,0);
 const demo=await call('/demo','POST',{});assert.equal(demo.status,200);const id=demo.body.id;
 assert.equal((await call('/demo','POST',{})).body.id,id);
 const l=(await call('/lessons/'+id)).body;assert.equal(l.isDemo,true);assert.equal(l.content.chapters.length,3);
 await call(`/lessons/${id}/chapter`,'POST',{index:0});await call(`/lessons/${id}/chapter`,'POST',{index:0});
 assert.equal((await call('/dashboard')).body.stats.xp,10);
 assert.equal((await call(`/lessons/${id}/review`,'POST',{card:0,rating:'good'})).status,200);
 assert.equal((await call(`/lessons/${id}/review`,'POST',{card:0,rating:'good'})).status,409);
 const attemptId=randomUUID();const result=await call(`/lessons/${id}/attempt`,'POST',{mode:'quiz',answers:[2,1,3],requestId:attemptId});assert.equal(result.body.score,100);
 await call(`/lessons/${id}/attempt`,'POST',{mode:'quiz',answers:[2,1,3],requestId:attemptId});assert.equal((await call('/dashboard')).body.attempts.length,1);
 assert.equal((await call(`/lessons/${id}/attempt`,'POST',{mode:'exam',answers:[1],requestId:randomUUID()})).status,400);
 const form=new FormData();form.set('title','Aljabar');form.set('text','Persamaan linear satu variabel.');form.set('language','Indonesia');form.set('folder','Matematika');
 const created=await call('/lessons','POST',form);assert.equal(created.status,201);const draftId=created.body.id;
 assert.equal((await call(`/lessons/${draftId}/generate`,'POST',{})).status,503);
 assert.equal((await call(`/lessons/${draftId}/chat`,'POST',{message:'Jelaskan'})).status,503);
 assert.equal((await call(`/lessons/${draftId}`)).body.sourceText,'Persamaan linear satu variabel.');
 const txt=new FormData();txt.set('title','Berkas');txt.append('files',new Blob(['Materi dari file teks.'],{type:'text/plain'}),'catatan.txt');
 const uploaded=await call('/lessons','POST',txt);assert.equal(uploaded.status,201);assert.match((await call('/lessons/'+uploaded.body.id)).body.sourceText,/Materi dari file teks/);
 const cross=await fetch(base+`/api/lessons/${id}/chapter`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify({index:1})});assert.equal(cross.status,403);
 const exp=await call('/export');assert.equal(exp.body.version,1);assert.equal(exp.body.lessons.length,3);
 const patched=await call('/lessons/'+draftId,'PATCH',{title:'Aljabar dasar',folder:'Matematika'});assert.equal(patched.status,200);assert.equal((await call('/lessons/'+draftId)).body.title,'Aljabar dasar');
 assert.equal((await call('/lessons/'+draftId,'DELETE')).status,200);assert.equal((await call('/lessons/'+draftId)).status,404);
 const dashboard=(await call('/dashboard')).body;assert.equal(dashboard.stats.streak,1);assert.equal(dashboard.stats.due,3);
 await call('/logout','POST',{});assert.equal((await call('/dashboard')).status,401);
});
