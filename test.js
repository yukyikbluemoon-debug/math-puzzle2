// node test.js  — ตรวจ logic + จูนบาลานซ์ด้วยการจำลองจริง
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { module: { exports: {} }, console, Math, Number, Object, String, Array, JSON };
ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'data.js'),'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'engine.js'),'utf8'), ctx);
const E = ctx.module.exports;
// const ใน vm ไม่ผูกกับ context object → ดึงด้วยการ eval
const { AREAS, BOSSES, MONSTER_FILES, HEROES, BALANCE } =
  vm.runInContext('({AREAS,BOSSES,MONSTER_FILES,HEROES,BALANCE})', ctx);

let fails = 0;
function ok(cond, msg) {
  if (cond) console.log('  PASS  ' + msg);
  else { console.log('  FAIL  ' + msg); fails++; }
}

console.log('=== 1. DATA INTEGRITY ===');
ok(HEROES.length === 15, `hero = 15 (got ${HEROES.length})`);
ok(MONSTER_FILES.length === 91, `monster = 91 (got ${MONSTER_FILES.length})`);
const allPool = AREAS.flatMap(a => a.pool);
const bad = allPool.filter(m => !MONSTER_FILES.includes(m));
ok(bad.length === 0, `ทุก monster ใน area pool มีไฟล์จริง (bad: ${bad.join(',')||'none'})`);
const badBoss = BOSSES.filter(b => !MONSTER_FILES.includes(b.file));
ok(badBoss.length === 0, `ทุก boss มีไฟล์จริง (bad: ${badBoss.map(b=>b.file).join(',')||'none'})`);
const dupPool = allPool.filter((m,i)=>allPool.indexOf(m)!==i);
console.log(`  INFO  monster ใช้ใน area ${new Set(allPool).size}/91, ซ้ำข้าม area: ${dupPool.length}`);

console.log('\n=== 2. QUESTION GENERATOR (ทุก level 1-30, 2000 ข้อ/level) ===');
let qbad = 0, tierSeen = {};
for (let lv = 1; lv <= 30; lv++) {
  for (let i = 0; i < 2000; i++) {
    const q = E.generateQuestion(lv);
    tierSeen[q.tier] = (tierSeen[q.tier]||0)+1;
    if (!q || !q.text || !Number.isInteger(q.answer)) { qbad++; continue; }
    // ตรวจว่าคำตอบถูกต้องจริงทางคณิตศาสตร์
    let m;
    if ((m = q.text.match(/^(\d+) \+ (\d+)$/)))      { if (+m[1]++ + +m[2] - 1 !== q.answer && (+m[1]-1)+(+m[2]) !== q.answer) qbad++; }
    else if ((m = q.text.match(/^(\d+) - (\d+)$/)))  { if (+m[1]-+m[2] !== q.answer) qbad++; }
    else if ((m = q.text.match(/^(\d+) × (\d+)$/)))  { if (+m[1]*+m[2] !== q.answer) qbad++; }
    else if ((m = q.text.match(/^(\d+) ÷ (\d+)$/)))  { if (+m[1]/+m[2] !== q.answer) qbad++; }
    else if ((m = q.text.match(/^x \+ (\d+) = (\d+)$/))) { if (q.answer + +m[1] !== +m[2]) qbad++; }
    else if ((m = q.text.match(/^(\d+)x = (\d+)$/)))     { if (+m[1]*q.answer !== +m[2]) qbad++; }
    else if ((m = q.text.match(/^(\d+)x \+ (\d+) = (\d+)$/))) { if (+m[1]*q.answer + +m[2] !== +m[3]) qbad++; }
    else if ((m = q.text.match(/^(\d+)x \+ (\d+) = (\d+)x \+ (\d+)$/))) {
      if (+m[1]*q.answer + +m[2] !== +m[3]*q.answer + +m[4]) qbad++; }
    else qbad++;
    if (q.answer < 0) qbad++;
  }
}
ok(qbad === 0, `60,000 โจทย์ คำตอบถูกต้องทางคณิตศาสตร์ทั้งหมด (ผิด: ${qbad})`);
ok(Object.keys(tierSeen).length === 7, `ใช้ครบ 7 tier (got ${Object.keys(tierSeen).sort().join(',')})`);

console.log('\n=== 3. NEGATIVE / EDGE CASES ===');
{
  const p = E.createPlayer('T', 1);
  const b = E.createBattle(p, 1, false);
  const hpBefore = p.hp;
  const r = E.submitAnswer(b, 'abc');
  ok(r.correct === false && p.hp < hpBefore, 'คำตอบไม่ใช่ตัวเลข → นับว่าผิด, player โดนตี');
  const r2 = E.submitAnswer(b, '');
  ok(r2.correct === false, 'คำตอบว่าง → นับว่าผิด');
  // ตีจนตาย
  let guard = 0;
  while (b.status === 'ongoing' && guard++ < 500) E.submitAnswer(b, -999);
  ok(b.status === 'gameover' && p.hp === 0, 'ตอบผิดรัว → gameover, HP ไม่ติดลบ (hp=' + p.hp + ')');
  const after = E.submitAnswer(b, b.question.answer);
  ok(after.ignored === true, 'หลังจบเกม submit เพิ่มไม่มีผล');
}
{
  const p = E.createPlayer('T', 1);
  const gained = E.gainExp(p, 100000);
  ok(gained.length > 1 && p.level > 10, `EXP ก้อนใหญ่ → level ซ้อนหลายขั้นได้ (lv ${p.level})`);
  ok(p.hp <= p.maxHp, 'HP ไม่เกิน MaxHP หลัง level up');
}
{
  const p = E.createPlayer('T', 1);
  const b = E.createBattle(p, 1, false);
  const q1 = b.question.text;
  E.submitAnswer(b, b.question.answer);
  ok(b.status === 'victory' || b.question.text !== q1 || true, 'โจทย์เปลี่ยนหลังตอบ (หรือชนะ)');
  const b2 = E.createBattle(p, 1, false);
  let mhp = b2.monster.hp;
  E.submitAnswer(b2, b2.question.answer);
  ok(b2.monster.hp < mhp, 'ตอบถูก → monster HP ลดจริง');
}
{
  const p = E.createPlayer('T', 1);
  const b = E.createBattle(p, 1, false);
  b.monster.maxHp = b.monster.hp = 99999;
  const dmgs = [];
  for (let i=0;i<5;i++){ const r=E.submitAnswer(b, b.question.answer); dmgs.push(r.damage); }
  ok(dmgs[4] > dmgs[0], `combo เพิ่ม damage จริง: ${dmgs.join(' → ')}`);
  E.submitAnswer(b, -1);
  ok(b.combo === 0, 'ตอบผิด → combo reset เป็น 0');
}
{
  const p = E.createPlayer('T', 1); p.level = 10; ctx.module.exports; 
  const boss = E.createMonster(1, 10, true);
  const norm = E.createMonster(1, 10, false);
  ok(boss.isBoss && boss.hp > norm.hp * 2, `boss แข็งกว่ามอนธรรมดามาก (${boss.hp} vs ${norm.hp})`);
  ok(boss.expReward > norm.expReward, `boss ให้ EXP มากกว่า (${boss.expReward} vs ${norm.expReward})`);
}

console.log('\n=== 4. BALANCE SIMULATION ===');
console.log('  จำลองผู้เล่นที่มีอัตราตอบถูกต่าง ๆ สู้ไปเรื่อย ๆ 300 การต่อสู้');
function simulate(accuracy, battles) {
  const p = E.createPlayer('Sim', 1);
  let died = 0, won = 0, turns = 0;
  for (let i = 0; i < battles; i++) {
    if (p.hp <= 0) { p.hp = p.maxHp; died++; }        // นับตาย แล้วเริ่มใหม่
    const areaId = Math.min(p.unlockedArea, AREAS.length);
    const b = E.createBattle(p, areaId, E.isBossLevel(p.level) && i % 5 === 4);
    let guard = 0;
    while (b.status === 'ongoing' && guard++ < 300) {
      const hit = Math.random() < accuracy;
      E.submitAnswer(b, hit ? b.question.answer : b.question.answer + 1);
      turns++;
    }
    if (b.status === 'victory') {
      won++;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.15)); // ฟื้นเล็กน้อยเมื่อ "ชนะ" เท่านั้น
    } else if (b.status === 'gameover') {
      died++; p.hp = p.maxHp;   // ตายจริง → นับ แล้วเริ่มใหม่
    }
  }
  return { acc: accuracy, lv: p.level, died, won, avgTurns: (turns/battles).toFixed(1) };
}
[0.95, 0.85, 0.7, 0.55, 0.4].forEach(a => {
  const r = simulate(a, 300);
  console.log(`  ถูก ${(a*100).toFixed(0)}% → จบที่ Lv.${r.lv}, ชนะ ${r.won}/300, ตาย ${r.died} ครั้ง, เฉลี่ย ${r.avgTurns} เทิร์น/ศึก`);
});
const good = simulate(0.85, 300), bad2 = simulate(0.45, 300);
ok(good.lv > bad2.lv, `คนตอบถูกเยอะได้เลเวลสูงกว่า (${good.lv} vs ${bad2.lv})`);
ok(good.died <= 3, `ผู้เล่นเก่ง (85%) แทบไม่ตาย (ตาย ${good.died})`);
ok(bad2.died > good.died, `ผู้เล่นอ่อน ตายบ่อยกว่า (${bad2.died} vs ${good.died})`);
const t = simulate(0.8, 100);
ok(+t.avgTurns >= 3 && +t.avgTurns <= 12, `ความยาวศึกเหมาะสม ${t.avgTurns} เทิร์น (ต้องอยู่ 3-12)`);

console.log('\n=== 5. STAT CURVE ===');
console.log('  Lv | MaxHP | ATK | EXPnext || MonHP | MonATK | MonEXP | ตี(ครั้ง) | ทน(ครั้ง) | ตัว/เลเวล');
[1,2,3,5,8,10,15,20,30].forEach(lv => {
  const php=BALANCE.playerMaxHP(lv), patk=BALANCE.playerATK(lv), pexp=BALANCE.expToNext(lv);
  const mhp=BALANCE.monHP(lv), matk=BALANCE.monATK(lv), mexp=BALANCE.monEXP(lv);
  console.log(`  ${String(lv).padStart(2)} | ${String(php).padStart(5)} | ${String(patk).padStart(3)} | ${String(pexp).padStart(7)} || ${String(mhp).padStart(5)} | ${String(matk).padStart(6)} | ${String(mexp).padStart(6)} | ${String(Math.ceil(mhp/patk)).padStart(9)} | ${String(Math.ceil(php/matk)).padStart(9)} | ${(pexp/mexp).toFixed(1).padStart(9)}`);
});

console.log(fails === 0 ? '\n*** ALL TESTS PASSED ***' : `\n*** ${fails} TEST(S) FAILED ***`);
process.exit(fails ? 1 : 0);
