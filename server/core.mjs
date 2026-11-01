import { z } from 'zod';

export const questionSchema = z.object({ question:z.string().min(1).max(3000), options:z.array(z.string().min(1).max(1500)).length(4), answer:z.number().int().min(0).max(3), explanation:z.string().min(1).max(5000) });
export const contentSchema = z.object({
  summary:z.string().min(1).max(30000),
  chapters:z.array(z.object({title:z.string().min(1).max(300), body:z.string().min(1).max(20000)})).min(1).max(20),
  flashcards:z.array(z.object({front:z.string().min(1).max(2000),back:z.string().min(1).max(5000)})).min(1).max(50),
  quiz:z.array(questionSchema).min(1).max(30),
  exam:z.array(questionSchema).min(1).max(50),
  mindmap:z.array(z.object({topic:z.string().max(300),points:z.array(z.string().max(1000)).max(12)})).min(1).max(15)
});
export const learningDay=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function streak(days, today=learningDay()) {
 const sorted=[...new Set(days)].sort().reverse();
 const day=new Date(`${today}T00:00:00Z`); let count=0;
 if(!sorted.includes(today)) day.setUTCDate(day.getUTCDate()-1);
 while(sorted.includes(day.toISOString().slice(0,10))){count++;day.setUTCDate(day.getUTCDate()-1);}
 return count;
}
export function scheduleReview(previous, rating, now=Date.now()){
 if(!['again','hard','good','easy'].includes(rating)) throw new Error('Penilaian kartu tidak valid.');
 const days=Math.max(0,Number(previous?.interval)||0);
 const interval=rating==='again'?1/1440:rating==='hard'?Math.max(6/1440,days*1.2):rating==='good'?Math.max(1,days*2.5):Math.max(4,days*3.5);
 return {interval,due:now+Math.round(interval*86400000),reviews:(previous?.reviews||0)+1,rating};
}
export function grade(questions, answers){
 if(!Array.isArray(answers)||answers.length!==questions.length||answers.some(a=>!Number.isInteger(a)||a<0||a>3)) throw Object.assign(new Error('Jawab semua soal sebelum mengumpulkan.'),{status:400});
 const results=questions.map((q,i)=>({...q,selected:answers[i],correct:q.answer===answers[i]}));
 return {score:Math.round(results.filter(q=>q.correct).length/questions.length*100),correct:results.filter(q=>q.correct).length,total:results.length,results};
}
export function youtubeId(value){
 let u;try{u=new URL(value);}catch{throw new Error('Tautan YouTube tidak valid.');}
 if(u.protocol!=='https:') throw new Error('Gunakan tautan HTTPS YouTube.');
 const host=u.hostname.toLowerCase();
 const id=host==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com'].includes(host)?(u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1]):null;
 if(!id||! /^[\w-]{11}$/.test(id))throw new Error('Gunakan URL video youtube.com atau youtu.be yang valid.');
 return id;
}
