const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../dub-engine');
const PLAN = require('../dub-planner');
const { Clock, FakeVideo, FakeAudio, lectureGroups, makeFakeSpeech } = require('./dub-sim');
function env(settings = {}) {
    const clock = new Clock(), video = new FakeVideo(), audios = [];
    const provider = { id: 'fixture', caps: { prerender: true }, voiceModel: PLAN.DEFAULT_VOICE_MODEL, render: async () => [] };
    const engine = new E.DubEngine({ video, getGroups: lectureGroups, providers: { primary: provider }, now: () => clock.now(),
        setInterval: (f, ms) => clock.setInterval(f, ms), clearInterval: id => clock.clear(id), setTimeout: (f, ms) => clock.setTimeout(f, ms),
        createAudio: () => { const a = new FakeAudio(clock, { duration: 1 }); audios.push(a); return a; },
        createObjectURL: () => 'blob:fixture', revokeObjectURL() {} }, { keepAllSpeech: true, ...settings });
    engine.headAt = 0; engine.entryAt = 0; engine.refresh(true);
    return { engine, clock, video, audios };
}
test('overdue speech waits for audio and is read whole beyond the old hard lag bound', () => {
    const { engine: e } = env();
    const [a,b] = e.plans; e.lastSpokenStart = a.start; e.lastSpokenId = a.id;
    const t = b.start + 30;
    assert.equal(e.nextSpeech(t), null);
    assert.equal(e.lastSpokenStart, a.start);
    e.rendered.set(b.id, { duration: 3 });
    const next = e.nextSpeech(t);
    assert.equal(next.p.id, b.id); assert.equal(next.offset, 0); assert.ok(next.lag >= 30);
    assert.equal(e.stats.dropped, 0);
});
test('a first take that arrives late keeps the original entry and its first word', () => {
    const { engine: e } = env(); const first = e.plans[0];
    assert.equal(e.nextSpeech(first.start + 1), null);
    e.rendered.set(first.id, { duration: 3 });
    const next = e.nextSpeech(first.end + 25);
    assert.equal(next.p.id, first.id); assert.equal(next.offset, 0); assert.equal(e.stats.dropped, 0);
});
test('planning and eviction retain unspoken backlog more than a planning window behind', () => {
    const { engine: e, video } = env(); const [a,b] = e.plans;
    e.lastSpokenStart = a.start; e.lastSpokenId = a.id;
    e.rendered.set(b.id, { duration: 3, url: 'blob:backlog', text: b.text });
    video.currentTime = 600; e.refresh(true); e.releaseOld(600);
    assert.ok(e.planById.has(b.id)); assert.ok(e.rendered.has(b.id));
});
test('an overdue unspoken render is not cancelled because the video passed its source time', () => {
    const { engine: e, clock } = env(); const [a,b] = e.plans; e.lastSpokenStart = a.start;
    e.jobs.set('queued', { t0: clock.now(), planIds: [b.id], orphan: false });
    e.cancelObsoleteJobs(b.end + 60);
    assert.equal(e.jobs.get('queued').orphan, false);
});
test('a user seek resets the entry point and abandons the old queue', () => {
    const { engine: e, video } = env(); const first = e.plans[0];
    e.entryWait = first.id; video.currentTime = 80; e.hardReset('seek'); e.refresh(true);
    assert.equal(e.entryAt, 80); assert.equal(e.entryWait, null); assert.equal(e.lastSpokenStart, null);
    assert.equal(e.queuedPlan(first), false);
});
test('natural video end drains the complete final audio without resuming the video', async () => {
    const { engine: e, clock, video, audios } = env();
    e.start(); const p=e.plans[0]; e.plans=[p]; e.planById=new Map([[p.id,p]]); e.sourceSig='fixed'; e.refresh=()=>false;
    e.schedule=()=>{}; e.rendered.set(p.id,{duration:1,url:'blob:tail'});
    video.currentTime=p.start; video.play(); e.tick();
    for(let i=0;i<8;i++){clock.advance(25,ms=>audios.forEach(a=>a.step(ms)));await Promise.resolve();}
    video.ended=true; video.paused=true; video.emit('pause');
    for(let i=0;i<100;i++){clock.advance(25,ms=>audios.forEach(a=>a.step(ms)));await Promise.resolve();}
    assert.ok(audios[0].ended); assert.equal(e.speech,null); assert.equal(video.paused,true); assert.equal(video.ended,true);
    assert.equal(e.stats.dropped,0); e.stop();
});
test('ordinary manual pause still silences speech immediately', () => {
    const { engine:e,video,audios }=env(); e.start(); const p=e.plans[0];
    e.rendered.set(p.id,{duration:3,url:'blob:pause'});video.currentTime=p.start;video.play();e.tick();video.pause();
    assert.ok(audios.every(a=>a.paused||a.cstFade)); e.stop();
});
test('live fallback reads every phrase in order even when the source clock is far ahead', () => {
    const {engine:e}=env(); const spoken=[],callbacks=[];
    e.provider={caps:{live:true},voiceModel:PLAN.DEFAULT_VOICE_MODEL,speak(text,opts,cb){spoken.push(text);callbacks.push(cb);return{cancel(){}}}};
    const phrase=text=>({text,offset:0,dur:1,rateMul:1,pitchMul:1});
    e.plans=[{id:'one',start:1,end:3,rate:1,pitch:1,phrases:[phrase('First phrase.'),phrase('Second phrase.')]},
        {id:'two',start:4,end:5,rate:1,pitch:1,phrases:[phrase('Third phrase.')]}];
    e.planById=new Map(e.plans.map(p=>[p.id,p]));
    e.tickLive(1,1);callbacks.at(-1).onend();e.tickLive(30,1);callbacks.at(-1).onend();e.tickLive(60,1);callbacks.at(-1).onend();e.tickLive(90,1);
    assert.deepEqual(spoken,['First phrase.','Second phrase.','Third phrase.']); assert.equal(e.stats.dropped,0);
});
test('a large backlog renders near the speech cursor instead of the distant video playhead', () => {
    const {engine:e}=env();const first=e.plans[0];e.lastSpokenStart=first.start;
    const batches=[];e.renderBatch=batch=>batches.push(batch);e.schedule(600);
    assert.ok(batches.length);
    assert.ok(batches.flat().every(p=>p.start<first.start+60));
});
test('a pending earlier translation blocks later speech until its source group is translated', () => {
    const {engine:e}=env();const p=e.plans[0];e.d.getGroups=()=>[{start:0,end:p.start,translated:false,viText:''}];
    e.rendered.set(p.id,{duration:2});assert.equal(e.nextSpeech(p.start+10),null);
    e.d.getGroups=()=>[{start:0,end:p.start,translated:true,viText:'Ready'}];assert.equal(e.nextSpeech(p.start+10).p.id,p.id);
});
test('an actual synthesis failure remains visible and releases the blocked queue', () => {
    const {engine:e}=env();const p=e.plans[0];e.failed.set(p.id,2);e.entryWait=p.id;
    assert.equal(e.nextSpeech(p.end+10),null);assert.equal(e.stats.dropped,1);assert.equal(e.entryWait,null);
    assert.ok(e.events.some(x=>x.k==='drop'&&x.why==='failed'));
});
test('changing speed during the final tail keeps a continuous drain clock', () => {
    const {engine:e,video,clock}=env();video.currentTime=50;video.ended=true;
    assert.equal(e.timelineAt(),50);clock.ms=3000;assert.equal(e.timelineAt(),53);
    video.playbackRate=2;clock.ms=3020;assert.ok(Math.abs(e.timelineAt()-53.04)<1e-9);
});
test('an ad preserves the old speech cursor and its pending jobs instead of skipping to the video', () => {
    const {engine:e,video}=env();const [a,b]=e.plans;let ad=true;e.d.adShowing=()=>ad;
    e.lastSpokenStart=a.start;e.lastSpokenId=a.id;e.lastT=600;e.jobs.set('voice',{t0:0,planIds:[b.id],orphan:false});
    e.adGate();video.currentTime=600;ad=false;e.adGate();e.refresh(true);
    assert.equal(e.lastSpokenStart,a.start);assert.equal(e.entryAt,0);assert.ok(e.planById.has(b.id));assert.equal(e.jobs.get('voice').orphan,false);
    e.adResume={id:b.id,pos:0.9,at:600};e.rendered.set(b.id,{duration:1});
    assert.ok(e.takeAdResume(600),'the last syllable of an ad-interrupted take is kept');
});
test('rendering advances across a long source silence while keeping overdue queue order', () => {
    const {engine:e}=env();const [a,b]=e.plans;e.lastSpokenStart=a.start;e.plans=[a,{...b,start:300,end:305}];
    assert.equal(e.renderAt(250),250);assert.equal(e.renderAt(400),300);
    const batches=[];e.renderBatch=batch=>batches.push(batch);e.schedule(400);
    assert.equal(batches.flat()[0].start,300);
});
