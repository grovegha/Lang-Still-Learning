import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { z } from 'zod';
import { contentSchema, learningDay, streak, scheduleReview, grade } from './core.mjs';
import { configured, generate, tutor, extract, youtubeTranscript } from './ai.mjs';
import { demo } from './demo.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.resolve(process.env.DATA_DIR||path.join(root,'data'));mkdirSync(path.join(data,'uploads'),{recursive:true});
const db=new DatabaseSync(path.join(data,'lang.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(`CREATE TABLE IF NOT EXISTS lessons(id TEXT PRIMARY KEY,title TEXT NOT NULL,folder TEXT NOT NULL DEFAULT '',language TEXT NOT NULL DEFAULT 'Indonesia',source TEXT NOT NULL DEFAULT '',content TEXT,files TEXT NOT NULL DEFAULT '[]',kind TEXT NOT NULL DEFAULT 'text',completed TEXT NOT NULL DEFAULT '[]',created INTEGER NOT NULL,updated INTEGER NOT NULL,is_demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS folders(name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS reviews(lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,card INTEGER NOT NULL,state TEXT NOT NULL,PRIMARY KEY(lesson_id,card));
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,day TEXT NOT NULL,xp INTEGER NOT NULL,label TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,mode TEXT NOT NULL,score INTEGER NOT NULL,result TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chats(id INTEGER PRIMARY KEY AUTOINCREMENT,lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,role TEXT NOT NULL,content TEXT NOT NULL,created INTEGER NOT NULL);`);
const decode=row=>row?({id:row.id,title:row.title,folder:row.folder,language:row.language,sourceText:row.source,content:row.content?JSON.parse(row.content):null,files:JSON.parse(row.files).map(({path:_,...f})=>f),kind:row.kind,completed:JSON.parse(row.completed),created:row.created,updated:row.updated,isDemo:!!row.is_demo}):null;
const lesson=id=>{const row=db.prepare('SELECT * FROM lessons WHERE id=?').get(id);if(!row)throw Object.assign(new Error('Pelajaran tidak ditemukan.'),{status:404});return decode(row);};
const event=(id,lessonId,xp,label)=>db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?,?,?,?)').run(id,lessonId,learningDay(),xp,label,Date.now());
const sessions=new Map();const busy=new Set();
const app=express();app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:process.argv.includes('--production')?{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'"],fontSrc:["'self'"],mediaSrc:["'self'",'blob:'],objectSrc:["'none'"],upgradeInsecureRequests:null}}:false}));
app.use('/api',express.json({limit:'3mb'}));
app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)){
 const origin=req.headers.origin;if(origin&&!([`http://${req.headers.host}`,`https://${req.headers.host}`,process.env.PUBLIC_ORIGIN].filter(Boolean).includes(origin)))return res.status(403).json({error:'Asal permintaan tidak diizinkan.'});
 if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Permintaan lintas situs ditolak.'});
 }next();});
const authenticated=req=>{if(!process.env.APP_PASSWORD)return true;const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('lang_session='))?.slice(13);const expires=token&&sessions.get(token);return !!expires&&expires>Date.now();};
app.get('/api/session',(req,res)=>res.json({authenticated:authenticated(req),passwordRequired:!!process.env.APP_PASSWORD}));
app.post('/api/login',rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Terlalu banyak percobaan. Coba lagi 15 menit lagi.'}}),(req,res)=>{
 const hash=x=>createHash('sha256').update(String(x||'')).digest();if(!process.env.APP_PASSWORD||!timingSafeEqual(hash(req.body.password),hash(process.env.APP_PASSWORD)))return res.status(401).json({error:'Password tidak sesuai.'});
 for(const [k,v] of sessions)if(v<Date.now())sessions.delete(k);
 const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+7*86400000);res.cookie('lang_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.PUBLIC_ORIGIN?.startsWith('https:'),maxAge:7*86400000,path:'/'}).json({ok:true});
});
app.use('/api',(req,res,next)=>authenticated(req)?next():res.status(401).json({error:'Masuk dahulu untuk membuka ruang belajarmu.'}));
app.post('/api/logout',(req,res)=>{const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('lang_session='))?.slice(13);if(token)sessions.delete(token);res.clearCookie('lang_session').json({ok:true});});
app.get('/api/status',(req,res)=>res.json({aiConfigured:configured(),model:process.env.OPENAI_MODEL||'gpt-4.1-mini',storage:'SQLite server',timezone:'Asia/Jakarta'}));
app.get('/api/dashboard',(req,res)=>{
 const rows=db.prepare('SELECT * FROM lessons ORDER BY updated DESC').all();
 const events=db.prepare('SELECT * FROM events ORDER BY created DESC').all();const xp=events.reduce((s,e)=>s+e.xp,0);
 const reviews=db.prepare('SELECT * FROM reviews').all();const due=rows.reduce((s,r)=>s+(r.content?JSON.parse(r.content).flashcards.reduce((n,_,i)=>{const entry=reviews.find(v=>v.lesson_id===r.id&&v.card===i);return n+(!entry||JSON.parse(entry.state).due<=Date.now()?1:0);},0):0),0);
 res.json({lessons:rows.map(r=>{const l=decode(r);return {...l,sourceText:undefined,content:undefined,chapterCount:l.content?.chapters.length||0,cardCount:l.content?.flashcards.length||0,ready:!!l.content};}),folders:db.prepare('SELECT name FROM folders ORDER BY name').all().map(f=>f.name),stats:{xp,level:Math.floor(xp/100)+1,streak:streak(events.map(e=>e.day)),due,activities:events.length},events:events.slice(0,100),attempts:db.prepare('SELECT a.id,a.mode,a.score,a.created,l.title FROM attempts a JOIN lessons l ON l.id=a.lesson_id ORDER BY a.created DESC LIMIT 30').all()});
});
app.get('/api/lessons/:id',(req,res)=>{const l=lesson(req.params.id);const reviews=Object.fromEntries(db.prepare('SELECT card,state FROM reviews WHERE lesson_id=?').all(l.id).map(r=>[r.card,JSON.parse(r.state)]));res.json({...l,reviews,chats:db.prepare('SELECT role,content,created FROM chats WHERE lesson_id=? ORDER BY id').all(l.id)});});
app.post('/api/folders',(req,res)=>{const name=z.string().trim().min(1).max(60).parse(req.body.name);db.prepare('INSERT OR IGNORE INTO folders VALUES(?)').run(name);res.json({name});});
app.post('/api/demo',(req,res)=>{
 const existing=db.prepare('SELECT id FROM lessons WHERE is_demo=1').get();if(existing)return res.json({id:existing.id});
 const id=randomUUID(),now=Date.now();db.prepare('INSERT OR IGNORE INTO folders VALUES(?)').run(demo.folder);db.prepare('INSERT INTO lessons(id,title,folder,source,content,kind,created,updated,is_demo) VALUES(?,?,?,?,?,?,?,?,1)').run(id,demo.title,demo.folder,demo.sourceText,JSON.stringify(demo.content),'example',now,now);res.json({id});
});
const upload=multer({dest:path.join(data,'uploads'),limits:{fileSize:500*1024*1024,files:5,fieldSize:1024*1024},fileFilter:(req,file,cb)=>{
 const ext=path.extname(file.originalname).toLowerCase();if(!['.txt','.md','.csv','.pdf','.docx','.pptx','.xlsx','.jpg','.jpeg','.png','.webp','.mp3','.wav','.m4a','.ogg','.weba','.mp4','.mov','.webm','.avi','.mkv'].includes(ext))return cb(Object.assign(new Error('Format belum didukung. Gunakan PDF, DOCX, PPTX, XLSX, TXT, MD, CSV, JPG, PNG, WEBP, audio, atau video.'),{status:400}));cb(null,true);
}});
app.post('/api/lessons',upload.array('files',5),async(req,res)=>{
 const files=req.files||[];
 try{
 const input=z.object({title:z.string().trim().min(1).max(160),folder:z.string().max(60).default(''),language:z.enum(['Indonesia','English','العربية','中文']).default('Indonesia'),text:z.string().max(150000).default(''),youtube:z.string().max(2048).default('')}).parse(req.body);
 if(files.reduce((s,f)=>s+f.size,0)>600*1024*1024)throw Object.assign(new Error('Total unggahan maksimal 600 MB.'),{status:413});
 const sources=[];if(input.text.trim())sources.push(input.text.trim());
 for(const file of files){const ext=path.extname(file.originalname).toLowerCase();const max=['.png','.jpg','.jpeg','.webp'].includes(ext)?25:['.pdf','.docx','.pptx','.xlsx','.txt','.md','.csv'].includes(ext)?100:['.mp3','.wav','.m4a','.ogg','.weba'].includes(ext)?300:500;if(file.size>max*1024*1024)throw Object.assign(new Error(`${file.originalname}: batas ukuran ${max} MB.`),{status:413});sources.push(`Sumber: ${file.originalname}\n${await extract(file)}`);}
 if(input.youtube)sources.push(`Sumber: ${input.youtube}\n${await youtubeTranscript(input.youtube)}`);
 const source=sources.join('\n\n');if(source.length>150000)throw Object.assign(new Error('Materi lebih dari 150.000 karakter. Pisahkan ke beberapa pelajaran.'),{status:413});
 const id=randomUUID(),now=Date.now();if(input.folder)db.prepare('INSERT OR IGNORE INTO folders VALUES(?)').run(input.folder);
 const fileList=files.map(f=>({name:f.originalname,size:f.size,path:f.filename}));
 db.prepare('INSERT INTO lessons(id,title,folder,language,source,files,kind,created,updated) VALUES(?,?,?,?,?,?,?,?,?)').run(id,input.title,input.folder,input.language,source,JSON.stringify(fileList),input.youtube?'youtube':files.length?'file':source?'text':'topic',now,now);
 event(`create:${id}`,id,5,'Materi baru disimpan');res.status(201).json({id});
 }catch(e){await Promise.all(files.map(f=>unlink(f.path).catch(()=>{})));throw e;}
});
app.patch('/api/lessons/:id',(req,res)=>{
 const l=lesson(req.params.id);const p=z.object({title:z.string().trim().min(1).max(160).optional(),folder:z.string().max(60).optional(),summary:z.string().max(30000).optional(),sourceText:z.string().max(150000).optional()}).parse(req.body);
 if(p.summary!==undefined&&!l.content)throw Object.assign(new Error('Buat pelajaran terlebih dahulu sebelum menyunting ringkasan.'),{status:400});
 if(p.folder)db.prepare('INSERT OR IGNORE INTO folders VALUES(?)').run(p.folder);if(p.summary!==undefined)l.content.summary=p.summary;
 db.prepare('UPDATE lessons SET title=?,folder=?,source=?,content=?,updated=? WHERE id=?').run(p.title??l.title,p.folder??l.folder,p.sourceText??l.sourceText,l.content?JSON.stringify(l.content):null,Date.now(),l.id);res.json({ok:true});
});
app.delete('/api/lessons/:id',async(req,res)=>{const l=lesson(req.params.id);if(busy.has(l.id))throw Object.assign(new Error('Tunggu proses AI selesai sebelum menghapus.'),{status:409});const files=JSON.parse(db.prepare('SELECT files FROM lessons WHERE id=?').get(l.id).files);db.prepare('DELETE FROM lessons WHERE id=?').run(l.id);await Promise.all(files.map(f=>unlink(path.join(data,'uploads',f.path)).catch(()=>{})));res.json({ok:true});});
app.get('/api/lessons/:id/files/:index',async(req,res)=>{const l=lesson(req.params.id);const files=JSON.parse(db.prepare('SELECT files FROM lessons WHERE id=?').get(l.id).files);const file=files[Number(req.params.index)];if(!file)return res.status(404).json({error:'Berkas tidak ditemukan.'});res.download(path.join(data,'uploads',file.path),file.name);});
const aiLimiter=rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Terlalu banyak permintaan AI. Tunggu satu menit.'}});
app.post('/api/lessons/:id/generate',aiLimiter,async(req,res)=>{
 const l=lesson(req.params.id);if(busy.has(l.id))return res.status(409).json({error:'Pelajaran ini sedang diproses.'});busy.add(l.id);
 try{const content=await generate(l.sourceText,l.language,l.title);db.exec('BEGIN');try{db.prepare('UPDATE lessons SET content=?,completed=?,updated=? WHERE id=?').run(JSON.stringify(content),'[]',Date.now(),l.id);db.prepare('DELETE FROM reviews WHERE lesson_id=?').run(l.id);event(`generate:${l.id}`,l.id,10,'Pelajaran siap dipelajari');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}res.json({ok:true});}finally{busy.delete(l.id);}
});
app.post('/api/lessons/:id/chat',aiLimiter,async(req,res)=>{
 const l=lesson(req.params.id);const question=z.string().trim().min(1).max(4000).parse(req.body.message);const lock=`chat:${l.id}`;if(busy.has(lock))return res.status(409).json({error:'Tutor sedang menjawab. Tunggu sebentar.'});busy.add(lock);
 try{const history=db.prepare('SELECT role,content FROM chats WHERE lesson_id=? ORDER BY id DESC LIMIT 12').all(l.id).reverse();const reply=await tutor(l,history,question);const insert=db.prepare('INSERT INTO chats(lesson_id,role,content,created) VALUES(?,?,?,?)');db.exec('BEGIN');try{insert.run(l.id,'user',question,Date.now());insert.run(l.id,'assistant',reply,Date.now());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}res.json({reply});}finally{busy.delete(lock);}
});
app.post('/api/lessons/:id/chapter',(req,res)=>{const l=lesson(req.params.id);const index=z.number().int().min(0).parse(req.body.index);if(!l.content?.chapters[index])return res.status(400).json({error:'Bab tidak valid.'});const completed=[...new Set([...l.completed,index])];db.prepare('UPDATE lessons SET completed=?,updated=? WHERE id=?').run(JSON.stringify(completed),Date.now(),l.id);event(`chapter:${l.id}:${index}`,l.id,10,'Bab selesai dipelajari');res.json({completed});});
app.post('/api/lessons/:id/review',(req,res)=>{const l=lesson(req.params.id);const p=z.object({card:z.number().int().min(0),rating:z.enum(['again','hard','good','easy'])}).parse(req.body);if(!l.content?.flashcards[p.card])return res.status(400).json({error:'Kartu tidak valid.'});const row=db.prepare('SELECT state FROM reviews WHERE lesson_id=? AND card=?').get(l.id,p.card);const previous=row?JSON.parse(row.state):null;if(previous&&previous.due>Date.now())return res.status(409).json({error:'Kartu ini sudah dijadwalkan. Review lagi saat jatuh tempo.'});const state=scheduleReview(previous,p.rating);db.prepare('INSERT INTO reviews VALUES(?,?,?) ON CONFLICT(lesson_id,card) DO UPDATE SET state=excluded.state').run(l.id,p.card,JSON.stringify(state));event(`review:${l.id}:${p.card}:${state.reviews}`,l.id,3,'Flashcard diulang');res.json({state});});
app.post('/api/lessons/:id/attempt',(req,res)=>{const l=lesson(req.params.id);const p=z.object({mode:z.enum(['quiz','exam']),answers:z.array(z.number().int().min(0).max(3)),requestId:z.string().uuid()}).parse(req.body);const previous=db.prepare('SELECT result,lesson_id,mode FROM attempts WHERE id=?').get(p.requestId);if(previous){if(previous.lesson_id!==l.id||previous.mode!==p.mode)return res.status(409).json({error:'ID pengumpulan tidak valid.'});return res.json(JSON.parse(previous.result));}if(!l.content)throw Object.assign(new Error('Pelajaran belum siap.'),{status:400});const result=grade(l.content[p.mode],p.answers);db.prepare('INSERT INTO attempts VALUES(?,?,?,?,?,?)').run(p.requestId,l.id,p.mode,result.score,JSON.stringify(result),Date.now());event(`attempt:${l.id}:${p.mode}:${learningDay()}`,l.id,15,p.mode==='exam'?'Latihan ujian selesai':'Kuis selesai');res.json(result);});
app.get('/api/export',(req,res)=>{const backup={version:1,exportedAt:new Date().toISOString(),lessons:db.prepare('SELECT * FROM lessons').all().map(decode),folders:db.prepare('SELECT * FROM folders').all(),reviews:db.prepare('SELECT * FROM reviews').all(),events:db.prepare('SELECT * FROM events').all(),attempts:db.prepare('SELECT * FROM attempts').all(),chats:db.prepare('SELECT * FROM chats').all()};res.attachment(`lang-backup-${learningDay()}.json`).json(backup);});
app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint tidak ditemukan.'}));
app.use((err,req,res,next)=>{if(res.headersSent)return next(err);let message=err.message||'Terjadi kesalahan. Coba lagi.';let status=err.status||500;if(err instanceof z.ZodError){status=400;message='Data belum lengkap atau tidak valid. Periksa isianmu.';}if(err instanceof multer.MulterError){status=413;message='Unggahan melebihi batas jumlah (5) atau ukuran (500 MB per berkas).';}if(err.status===401&&configured()){message='API key ditolak penyedia AI. Periksa konfigurasi server.';status=502;}if(err.status===429){message='Batas penggunaan AI tercapai. Periksa kuota API atau coba lagi nanti.';status=429;}if(status>=500&&!['AI belum','API key','Format hasil','Jawaban AI','Tutor tidak','Pemrosesan'].some(prefix=>message.startsWith(prefix)))message='Proses belum berhasil. Periksa koneksi layanan atau konfigurasi server, lalu coba lagi.';res.status(status).json({error:message});});
if(process.argv.includes('--production')){app.use(express.static(path.join(root,'dist')));app.get('/{*path}',(req,res)=>res.sendFile(path.join(root,'dist','index.html')));}else{const {createServer}=await import('vite');const vite=await createServer({root,server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
const host=process.env.HOST||'127.0.0.1';if(!['127.0.0.1','localhost','::1'].includes(host)&&!process.env.APP_PASSWORD)throw new Error('Isi APP_PASSWORD sebelum membuka server ke jaringan.');
const server=app.listen(Number(process.env.PORT)||3000,host,()=>console.log(`Lang — http://${host}:${process.env.PORT||3000} | AI ${configured()?'configured':'not configured'}`));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
