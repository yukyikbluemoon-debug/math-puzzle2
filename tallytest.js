// tallytest.js — ตรวจกล่องสรุป ถูก/ผิด/ความแม่นยำ บน DOM จริง
const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8')
  .replace(/<script src="https:\/\/cdn[^"]*"><\/script>/,'');
let fails=0;const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m);if(!c)fails++;};
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',beforeParse(w){
  w.confirm=()=>true;w.alert=()=>{};
  w.AudioContext=function(){return{state:'running',currentTime:0,resume(){},
    createOscillator:()=>({type:'',frequency:{value:0},connect(){},start(){},stop(){}}),
    createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}),destination:{}};};
}});
const w=dom.window;
['data.js','engine.js','game.js'].forEach(f=>{const s=w.document.createElement('script');
  s.textContent=fs.readFileSync(path.join(__dirname,f),'utf8');w.document.body.appendChild(s);});
const $=id=>w.document.getElementById(id);
const act=()=>[...w.document.querySelectorAll('.screen')].find(s=>s.classList.contains('active')).id;

console.log('=== TALLY (สรุปถูก/ผิด) ===');
$('btn-guest').click();
w.document.querySelectorAll('.hero-cell')[3].click();
$('btn-hero-ok').click();
w.document.querySelectorAll('.area-btn')[0].click();

// --- ชนะ: ถูก 7 ผิด 2 -> 78% ---
w.eval("player.totalCorrect=7; player.totalWrong=2; battle.monster.hp=1; endBattle(true, submitAnswer(battle, battle.question.answer));");
ok(act()==='screen-result','ไปหน้าผลลัพธ์');
const cards=[...$('r-tally').querySelectorAll('.t')];
ok(cards.length===3,`มี 3 การ์ด (got ${cards.length})`);
const nums=cards.map(c=>c.querySelector('.n').textContent);
const labs=cards.map(c=>c.querySelector('.l').textContent);
ok(nums[0]==='8'||nums[0]==='7',`การ์ดถูก = ${nums[0]}`);
ok(nums[1]==='2',`การ์ดผิด = ${nums[1]}`);
ok(/%$/.test(nums[2]),`การ์ดความแม่นยำ = ${nums[2]}`);
ok(labs.join(',')==='ตอบถูก,ตอบผิด,ความแม่นยำ','ป้ายกำกับครบ: '+labs.join(' / '));
const c=+nums[0],wr=+nums[1];
ok(nums[2]===Math.round(c/(c+wr)*100)+'%',`คำนวณ % ถูกต้อง (${nums[2]})`);
ok(cards[0].classList.contains('ok')&&cards[1].classList.contains('no'),'มี class สี เขียว/แดง');
ok($('r-note').textContent==='','ตอนชนะไม่มีข้อความเล็กซ้ำซ้อนแล้ว');

// --- แพ้ ---
w.document.querySelectorAll('.area-btn')[0].click();
w.eval("player.hp=1; endBattle(false, submitAnswer(battle,-99999));");
ok($('r-tally').querySelectorAll('.t').length===3,'หน้าแพ้ก็มีกล่องสรุป 3 การ์ด');

// --- หาร 0 ---
w.eval("player.totalCorrect=0; player.totalWrong=0; renderTally();");
ok($('r-tally').querySelector('.acc .n').textContent==='0%','ยังไม่ตอบเลย -> 0% ไม่ NaN');

// --- ขนาดฟอนต์ที่ประกาศใน CSS ---
const css=fs.readFileSync(path.join(__dirname,'style.css'),'utf8');
const m=css.match(/\.tally \.t \.n\{font-size:(\d+)px/);
ok(m&&+m[1]>=30,`ตัวเลขสรุปใหญ่ ${m?m[1]:'?'}px (เดิมทั้งบรรทัด 14px)`);
const hp=css.match(/\.unit \.hpnum\{font-size:(\d+)px/);
ok(hp&&+hp[1]>=16,`HP ใต้หลอด ${hp?hp[1]:'?'}px (เดิม 11px)`);
const kp=css.match(/\.keypad button\{[^}]*font-size:(\d+)px/);
ok(kp&&+kp[1]>=26,`คีย์แพด ${kp?kp[1]:'?'}px (เดิม 19px)`);
const mh=css.match(/\.keypad button\{[^}]*min-height:(\d+)px/);
ok(mh&&+mh[1]>=60,`ปุ่มคีย์แพดสูง ${mh?mh[1]:'?'}px`);

// --- หน้าฐาน: รูปฮีโร่ + แถบ HP/EXP ---
console.log('\n=== HOME LAYOUT ===');
const heroCss = css.match(/\.hero-head #home-hero\{height:(\d+)px/);
ok(heroCss && +heroCss[1] >= 100, `รูปฮีโร่หน้าฐาน ${heroCss?heroCss[1]:'?'}px (เดิม 74px)`);
const homeHtml = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
// แถบทั้งสองต้องเป็นลูกโดยตรงของ .card (ไม่อยู่ในคอลัมน์ข้างรูป) จึงจะกว้างเท่ากัน
const headBlock = homeHtml.slice(homeHtml.indexOf('<div class="hero-head">'),
                                homeHtml.indexOf('<button id="btn-rest"'));
ok(!/<div class="bar exp"/.test(headBlock.slice(0, headBlock.indexOf('</div>\n      </div>'))),
   'แถบ EXP ถูกย้ายออกจากคอลัมน์ข้างรูปฮีโร่แล้ว');
const barsAtSameLevel = /<div class="bar hp"[^>]*>[\s\S]*?<div class="bar exp"/.test(homeHtml);
ok(barsAtSameLevel, 'แถบ HP และ EXP อยู่ระดับเดียวกันใน DOM (กว้างเท่ากัน)');
ok(!/style="height:74px"/.test(homeHtml), 'ไม่มี inline height:74px เดิมค้างอยู่');
ok($('home-expbar')!==null && $('home-hpbar')!==null, 'id แถบทั้งสองยังอยู่ครบ (JS อัปเดตได้)');

console.log(fails===0?'\n*** TALLY TESTS PASSED ***':`\n*** ${fails} FAILED ***`);
process.exit(fails?1:0);
