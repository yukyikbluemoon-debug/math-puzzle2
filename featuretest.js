// featuretest.js — ทดสอบ 5 ฟีเจอร์ใหม่: เสียง / preload / จับเวลา / ขนาดบอส / คลาวด์
const fs=require('fs'),path=require('path');const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8')
  .replace(/<script src="https:\/\/cdn[^"]*"><\/script>/,'');
let fails=0;const ok=(c,m)=>{console.log((c?'  PASS  ':'  FAIL  ')+m);if(!c)fails++;};
const tick=()=>new Promise(r=>setTimeout(r,30));

let toneCalls=0, vibCalls=0, imgLoaded=[];
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',beforeParse(w){
  w.confirm=()=>true;w.alert=()=>{};
  w.navigator.vibrate=()=>{vibCalls++;return true;};
  w.AudioContext=function(){return{state:'running',currentTime:0,resume(){},
    createOscillator:()=>{toneCalls++;return{type:'',frequency:{value:0},connect(){},start(){},stop(){}};},
    createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}),destination:{}};};
  // ดักการโหลดรูปเพื่อพิสูจน์ preload
  const NativeImage=w.Image;
  w.Image=function(){const o={};Object.defineProperty(o,'src',{set(v){imgLoaded.push(v);},get(){return '';}});return o;};
}});
const w=dom.window;
['data.js','engine.js','game.js'].forEach(f=>{const s=w.document.createElement('script');
  s.textContent=fs.readFileSync(path.join(__dirname,f),'utf8');w.document.body.appendChild(s);});
const $=id=>w.document.getElementById(id);

(async()=>{
console.log('=== 1. ปุ่มเปิด/ปิดเสียง ===');
ok($('btn-sound')!==null,'มีปุ่มเสียงในหน้าฐาน');
ok($('btn-sound2')!==null,'มีปุ่มเสียงในสนามรบ');
ok($('btn-sound').textContent==='🔊','เริ่มต้นเสียงเปิด (🔊)');

$('btn-guest').click(); await tick();
w.document.querySelectorAll('.hero-cell')[2].click();
$('btn-hero-ok').click(); await tick();
w.document.querySelectorAll('.area-btn')[0].click(); await tick();

toneCalls=0; vibCalls=0;
$('ans').value=String(w.eval('battle.question.answer'));
$('btn-submit').click(); await tick();
ok(toneCalls>0,`เสียงเปิด -> มีเสียงเล่น (${toneCalls} ครั้ง)`);
ok(vibCalls>0,`เสียงเปิด -> สั่นด้วย (${vibCalls} ครั้ง)`);

$('btn-sound').click();                      // ปิดเสียง
ok(!w.eval('soundOn'),'กดปุ่ม -> soundOn = false');
ok($('btn-sound').textContent==='🔇','ไอคอนเปลี่ยนเป็น 🔇');
ok($('btn-sound2').textContent==='🔇','ปุ่มในสนามรบเปลี่ยนตามกัน');
ok(w.localStorage.getItem('mathrpg_sound')==='0','จำค่าไว้ใน localStorage');

await tick();
toneCalls=0; vibCalls=0;
$('ans').value=String(w.eval('battle.question.answer'));
$('btn-submit').click(); await tick();
ok(toneCalls===0,'ปิดเสียงแล้ว -> ไม่มีเสียงเลย');
ok(vibCalls===0,'ปิดเสียงแล้ว -> ไม่สั่นด้วย');
$('btn-sound').click();
ok(w.eval('soundOn'),'กดอีกที -> เปิดกลับได้');

console.log('\n=== 2. Preload รูปมอนสเตอร์ ===');
ok(imgLoaded.length>0,`โหลดรูปล่วงหน้า ${imgLoaded.length} ไฟล์`);
ok(imgLoaded.every(s=>s.startsWith('image/enemies/')),'preload เฉพาะรูปมอนสเตอร์');
const area1=w.eval('JSON.stringify(AREAS[0].pool)');
ok(imgLoaded.length>=JSON.parse(area1).length,'ครอบคลุมมอนสเตอร์ทั้งพื้นที่แรก');
const before=imgLoaded.length;
w.eval('preloadArea(1)');
ok(imgLoaded.length===before,'เรียกซ้ำไม่โหลดใหม่ (มี cache)');

console.log('\n=== 3. จับเวลาต่อข้อ ===');
const st=JSON.parse(w.localStorage.getItem('mathrpg_stats')||'{}');
ok(Object.keys(st).length>0,'บันทึกสถิติแล้ว: '+Object.keys(st).join(','));
const anyk=Object.keys(st)[0];
ok(st[anyk].n>0 && typeof st[anyk].time==='number',`เก็บ n/correct/time ครบ (${anyk}: n=${st[anyk].n})`);
// ป้อนข้อมูลจำลอง: ทำ "หาร" ให้แย่กว่า "บวก" ชัดเจน
w.localStorage.setItem('mathrpg_stats',JSON.stringify({
  add:{n:10,correct:10,time:20}, div:{n:10,correct:3,time:120}}));
const wk=w.eval('JSON.stringify(weakestType())');
ok(JSON.parse(wk).k==='div',`ระบุจุดอ่อนถูก -> ${JSON.parse(wk).k} (ควรเป็น div)`);
w.localStorage.setItem('mathrpg_stats',JSON.stringify({add:{n:2,correct:1,time:5}}));
ok(w.eval('weakestType()')===null,'ข้อมูลน้อยกว่า 3 ข้อ -> ยังไม่สรุป');

console.log('\n=== 4. ขนาดมอนสเตอร์/บอส ===');
w.eval('player.level=10; battle=createBattle(player,1,true);');
w.eval("startBattle(1,true)"); await tick();
const bossScale=parseFloat(($('b-msprite').style.transform.match(/scale\(([\d.]+)\)/)||[])[1]);
ok($('b-msprite').classList.contains('boss-glow'),'บอสมีเอฟเฟกต์เรืองแสง');
ok(bossScale>=1.4,`บอสตัวใหญ่ scale=${bossScale}`);
w.eval("startBattle(1,false)"); await tick();
const normScale=parseFloat(($('b-msprite').style.transform.match(/scale\(([\d.]+)\)/)||[])[1]);
ok(normScale<bossScale,`มอนธรรมดาเล็กกว่าบอส (${normScale} < ${bossScale})`);
ok(!$('b-msprite').classList.contains('boss-glow'),'มอนธรรมดาไม่เรืองแสง');
ok(normScale<=1.28,`ขนาดมอนธรรมดามีเพดาน (${normScale} <= 1.28)`);

console.log('\n=== 5. สถานะคลาวด์ (โหมด Guest) ===');
ok($('cloud-badge')!==null,'มีป้ายบอกสถานะการบันทึก');
w.eval('goHome()'); await tick();
ok(/Guest/.test($('cloud-badge').textContent),'Guest -> บอกว่าไม่บันทึกออนไลน์: '+$('cloud-badge').textContent.trim());
ok(typeof w.eval('typeof loadCloud')==='string' && w.eval('typeof loadCloud')==='function','มีฟังก์ชัน loadCloud');
ok(w.eval('typeof syncCloud')==='function','มีฟังก์ชัน syncCloud');

console.log('\n=== 6. SQL ที่ต้องรัน ===');
const sql=fs.readFileSync(path.join(__dirname,'supabase_setup.sql'),'utf8');
ok(/CREATE OR REPLACE FUNCTION math_save_score/.test(sql),'SQL สร้าง math_save_score');
ok(/CREATE OR REPLACE FUNCTION math_load_rpg/.test(sql),'SQL สร้าง math_load_rpg');
ok(/DELETE FROM accounts WHERE name = '__probe__'/.test(sql),'SQL ลบ user ทดสอบที่ agent สร้าง');
ok(/RAISE EXCEPTION 'invalid credentials'/.test(sql),'SQL ตรวจ PIN ก่อนบันทึก');
ok(/ADD COLUMN IF NOT EXISTS/.test(sql),'SQL รันซ้ำได้ไม่พัง');
ok(/GRANT EXECUTE/.test(sql),'SQL ให้สิทธิ์ anon เรียกได้');
// พารามิเตอร์ที่เกมส่ง ต้องมีใน SQL ครบ
const params=['p_hero_id','p_gold','p_kills','p_best_combo','p_correct','p_wrong','p_area','p_hp'];
const g=fs.readFileSync(path.join(__dirname,'game.js'),'utf8');
ok(params.every(p=>sql.includes(p)&&g.includes(p)),'พารามิเตอร์ตรงกันทั้งเกมและ SQL');

console.log(fails===0?'\n*** FEATURE TESTS PASSED ***':`\n*** ${fails} FAILED ***`);
process.exit(fails?1:0);
})();
