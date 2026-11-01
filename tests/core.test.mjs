import test from 'node:test';
import assert from 'node:assert/strict';
import {streak,learningDay,scheduleReview,grade,youtubeId,contentSchema} from '../server/core.mjs';
import {demo} from '../server/demo.mjs';
test('streak uses Jakarta day and permits yesterday before today is studied',()=>{
 assert.equal(learningDay(new Date('2026-10-31T18:00:00Z')),'2026-11-01');
 assert.equal(streak(['2026-10-30','2026-10-31'],'2026-11-01'),2);
 assert.equal(streak(['2026-10-29','2026-10-31','2026-11-01'],'2026-11-01'),2);
 assert.equal(streak(['2026-10-29'],'2026-11-01'),0);
});
test('review schedules difficult cards earlier without negative intervals',()=>{
 const now=1000000;assert.equal(scheduleReview(null,'again',now).due,now+60000);
 assert.equal(scheduleReview(null,'good',now).due,now+86400000);
 assert.ok(scheduleReview({interval:4,reviews:2},'easy',now).interval>4);
 assert.equal(scheduleReview(null,'hard',now).due,now+360000);
 assert.throws(()=>scheduleReview(null,'invalid',now));
});
test('grading validates complete submissions and matches the answer key',()=>{
 const result=grade(demo.content.quiz,[2,1,3]);assert.equal(result.score,100);
 assert.equal(grade(demo.content.quiz,[0,1,3]).score,67);
 assert.throws(()=>grade(demo.content.quiz,[2,-1,3]));
 assert.throws(()=>grade(demo.content.quiz,[2,1]));
});
test('YouTube input rejects lookalike hosts and non-video targets',()=>{
 assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),'dQw4w9WgXcQ');
 assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ'),'dQw4w9WgXcQ');
 assert.throws(()=>youtubeId('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'));
 assert.throws(()=>youtubeId('http://127.0.0.1/'));
 assert.throws(()=>youtubeId('file:///etc/passwd'));
});
test('example content meets the same contract as generated lessons',()=>{
 assert.ok(contentSchema.safeParse(demo.content).success);
 assert.equal(contentSchema.safeParse({...demo.content,quiz:[{...demo.content.quiz[0],answer:5}]}).success,false);
});
