// node uitest.js — โหลด index.html จริงด้วย jsdom แล้ว "เล่นเกม" อัตโนมัติ
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8')
  // ตัด CDN supabase ออก (ไม่มีเน็ตใน test) → game.js จะเข้าโหมด offline เอง
  .replace(/<script src="https:\/\/cdn[^"]*"><\/script>/, '');

let fails = 0, logs = [];
function ok(c,m){ if(c) console.log('  PASS  '+m); else { console.log('  FAIL  '+m); fails++; } }

const dom = new JSDOM(html, {
  url: 'http://localhost:8899/',
  runScripts: 'dangerously',
  resources: undefined,
  beforeParse(w) {
    w.confirm = () => true;
    w.alert = () => {};
    w.HTMLMediaElement && (w.HTMLMediaElement.prototype.play = () => {});
    w.AudioContext = function(){ return {
      state:'running', currentTime:0, resume(){},
      createOscillator:()=>({type:'',frequency:{value:0},connect(){},start(){},stop(){}}),
      createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}),
      destination:{} }; };
    const origErr = w.console.error;
    w.console.error = (...a) => { logs.push(String(a[0])); };
    w.addEventListener('error', e => { logs.push('JS ERROR: ' + e.message); });
  }
});

// โหลด local scripts เอง (jsdom ไม่ fetch ไฟล์ relative โดยไม่ตั้ง resource loader)
const w = dom.window;
['data.js','engine.js','game.js'].forEach(f => {
  const code = fs.readFileSync(path.join(__dirname,f),'utf8');
  const s = w.document.createElement('script');
  s.textContent = code;
  w.document.body.appendChild(s);
});

const $ = id => w.document.getElementById(id);
const active = () => [...w.document.querySelectorAll('.screen')].find(s=>s.classList.contains('active')).id;
function click(id){ $(id).dispatchEvent(new w.Event('click',{bubbles:true})); }

(async () => {
console.log('=== UI FLOW TEST (jsdom, DOM จริง) ===');
ok(logs.filter(l=>l.startsWith('JS ERROR')).length===0, 'โหลดสคริปต์ไม่มี JS error');
ok(active()==='screen-auth','เปิดมาเจอหน้า login');

// --- guest login ---
click('btn-guest');
await new Promise(r=>setTimeout(r,50));
ok(active()==='screen-hero','กด Guest → ไปหน้าเลือกฮีโร่');

// --- hero grid ---
const cells = w.document.querySelectorAll('.hero-cell');
ok(cells.length===15, `แสดงฮีโร่ครบ 15 ตัว (got ${cells.length})`);
const srcs = [...cells].map(c=>c.querySelector('img').getAttribute('src'));
ok(srcs.every(s=>s.startsWith('image/hero/')&&s.endsWith('.png')), 'path รูปฮีโร่ถูกต้องทุกตัว');
ok($('btn-hero-ok').disabled===true,'ปุ่มยืนยันถูกล็อกไว้ก่อนเลือก');
cells[4].dispatchEvent(new w.Event('click',{bubbles:true}));
ok($('btn-hero-ok').disabled===false,'เลือกฮีโร่ → ปุ่มยืนยันใช้งานได้');
ok(cells[4].classList.contains('sel'),'ช่องที่เลือกมีไฮไลต์');

click('btn-hero-ok');
await new Promise(r=>setTimeout(r,50));
ok(active()==='screen-home','ยืนยันฮีโร่ → เข้าหน้าฐาน');

// --- home ---
ok($('home-lv').textContent==='1','เริ่มที่ Lv.1');
ok($('home-hp').textContent==='80/80','HP เริ่มต้น 80/80');
ok($('home-atk').textContent==='10','ATK เริ่มต้น 10');
const areas = w.document.querySelectorAll('.area-btn');
ok(areas.length===6,`แสดง 6 พื้นที่ (got ${areas.length})`);
ok(w.document.querySelectorAll('.area-btn.lock').length===5,'Lv.1 ปลดล็อกแค่พื้นที่แรก');

// --- enter battle ---
areas[0].dispatchEvent(new w.Event('click',{bubbles:true}));
await new Promise(r=>setTimeout(r,50));
ok(active()==='screen-battle','กดพื้นที่ → เข้าหน้าต่อสู้');
ok($('b-msprite').getAttribute('src').startsWith('image/enemies/'),'รูปมอนสเตอร์ path ถูก: '+$('b-msprite').getAttribute('src'));
ok($('b-psprite').getAttribute('src').startsWith('image/hero/'),'รูปฮีโร่โผล่ในสนามรบ');
ok(/\S/.test($('b-q').textContent),'มีโจทย์แสดง: '+$('b-q').textContent);

// --- keypad ---
const keys = [...w.document.querySelectorAll('.keypad button[data-k]')];
keys.find(b=>b.dataset.k==='7').dispatchEvent(new w.Event('click',{bubbles:true}));
keys.find(b=>b.dataset.k==='3').dispatchEvent(new w.Event('click',{bubbles:true}));
ok($('ans').value==='73','แป้นตัวเลขพิมพ์ได้ (73)');
keys.find(b=>b.dataset.k==='del').dispatchEvent(new w.Event('click',{bubbles:true}));
ok($('ans').value==='7','ปุ่มลบทำงาน');
keys.find(b=>b.dataset.k==='-').dispatchEvent(new w.Event('click',{bubbles:true}));
ok($('ans').value==='-7','ปุ่ม ± ทำงาน');
$('ans').value='';

// --- ตอบผิด → HP ผู้เล่นลด ---
const hpBefore = $('b-phptxt').textContent;
$('ans').value = '999999';
click('btn-submit');
await new Promise(r=>setTimeout(r,900));
ok($('b-phptxt').textContent !== hpBefore, `ตอบผิด → HP ผู้เล่นลด (${hpBefore} → ${$('b-phptxt').textContent})`);
ok($('b-log').textContent.includes('ผิด'), 'ขึ้นข้อความว่าตอบผิด');
ok($('b-hint').textContent.includes('💡'), 'โชว์คำใบ้เมื่อตอบผิด');

// --- ตอบถูก → HP มอนลด + combo ---
function answerRight(){
  const t = $('b-q').textContent;
  const ans = w.eval('battle.question.answer');
  $('ans').value = String(ans);
  click('btn-submit');
  return t;
}
const mhpBefore = $('b-mhptxt').textContent;
answerRight();
await new Promise(r=>setTimeout(r,900));
ok($('b-mhptxt').textContent !== mhpBefore, `ตอบถูก → HP มอนลด (${mhpBefore} → ${$('b-mhptxt').textContent})`);
ok($('b-log').textContent.includes('ถูกต้อง'),'ขึ้นข้อความว่าตอบถูก');

answerRight(); await new Promise(r=>setTimeout(r,900));
ok($('b-combo').textContent.includes('COMBO'), 'ตอบถูก 2 ครั้งติด → โชว์ COMBO: '+$('b-combo').textContent.trim());

// --- ฆ่าให้ตาย → หน้า victory ---
let guard=0;
while(active()==='screen-battle' && guard++<40){ answerRight(); await new Promise(r=>setTimeout(r,700)); }
ok(active()==='screen-result', 'ฆ่ามอนสเตอร์ → ไปหน้าผลลัพธ์');
ok($('r-title').textContent.includes('VICTORY'), 'แสดง VICTORY: '+$('r-title').textContent);
ok($('r-reward').textContent.includes('EXP'), 'แสดงรางวัล EXP/ทอง');
const lvAfter = w.eval('player.level'), goldAfter = w.eval('player.gold');
ok(goldAfter>0, `ได้ทองจริง (${goldAfter})`);
ok(w.eval('player.exp')>0 || lvAfter>1, `ได้ EXP จริง (exp=${w.eval('player.exp')}, lv=${lvAfter})`);

// --- save/load ---
ok(w.localStorage.getItem('mathrpg_save_Guest')!==null,'บันทึกลง localStorage แล้ว');
const saved = JSON.parse(w.localStorage.getItem('mathrpg_save_Guest'));
ok(saved.heroId===5 && saved.gold===goldAfter,'ข้อมูลเซฟตรงกับสถานะจริง');

// --- สู้ต่อ ---
click('btn-again');
await new Promise(r=>setTimeout(r,60));
ok(active()==='screen-battle','ปุ่ม "สู้ต่อ" เริ่มศึกใหม่');
click('btn-flee');
await new Promise(r=>setTimeout(r,60));
ok(active()==='screen-home','ปุ่ม "หนี" กลับหน้าฐาน');

// --- game over path ---
areas2 = w.document.querySelectorAll('.area-btn');
areas2[0].dispatchEvent(new w.Event('click',{bubbles:true}));
await new Promise(r=>setTimeout(r,60));
guard=0;
while(active()==='screen-battle' && guard++<60){
  $('ans').value='888888'; click('btn-submit'); await new Promise(r=>setTimeout(r,700));
}
ok(active()==='screen-result','ตอบผิดจนตาย → หน้าผลลัพธ์');
ok($('r-title').textContent.includes('GAME OVER'),'แสดง GAME OVER');
ok(w.eval('player.hp')>0,'หลัง Game Over ฟื้นให้เล่นต่อได้ (hp='+w.eval('player.hp')+')');

const errs = logs.filter(l=>l.startsWith('JS ERROR'));
ok(errs.length===0, 'ไม่มี JS error ตลอดการเล่น'+(errs.length?': '+errs.join(' | '):''));

console.log(fails===0 ? '\n*** UI TESTS ALL PASSED ***' : `\n*** ${fails} UI TEST(S) FAILED ***`);
process.exit(fails?1:0);
})();
