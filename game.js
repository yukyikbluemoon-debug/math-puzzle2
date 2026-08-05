// ============================================
// Math Battle RPG — UI + Save layer
// ใช้ Supabase project เดียวกับ math-puzzle (RPC: math_login)
// ============================================

const SUPABASE_URL = 'https://pwrhnmvhwhellfbznczb.supabase.co';
const SUPABASE_ANON_KEY = window.__MATH_APP_CONFIG__?.SUPABASE_ANON_KEY
  || 'sb_publishable_zmIZ9aucZsRMJrySDe0uIQ_W4OgndeO';

let db = null;
try { db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
catch (e) { console.warn('Supabase init failed → offline mode', e); }

// ---- state ----
let account = null;      // { id, name, pin } จาก Supabase
let player  = null;      // โครงสร้าง Player ของเกม
let battle  = null;
let pendingHero = null;
let busy = false;

const $ = id => document.getElementById(id);
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}
function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

// ---- sound (ปิด/เปิดได้ จำค่าไว้) ----
let soundOn = (localStorage.getItem('mathrpg_sound') ?? '1') === '1';
function setSound(on) {
  soundOn = on;
  try { localStorage.setItem('mathrpg_sound', on ? '1' : '0'); } catch(e){}
  document.querySelectorAll('.snd-btn').forEach(b => {
    b.textContent = on ? '🔊' : '🔇';
    b.title = on ? 'ปิดเสียง' : 'เปิดเสียง';
  });
}
let _ac=null;
function tone(f,d=.13,t='sine'){if(!soundOn)return;try{_ac=_ac||new(window.AudioContext||window.webkitAudioContext)();
 if(_ac.state==='suspended')_ac.resume();const o=_ac.createOscillator(),g=_ac.createGain();
 o.type=t;o.frequency.value=f;g.gain.setValueAtTime(.001,_ac.currentTime);
 g.gain.exponentialRampToValueAtTime(.22,_ac.currentTime+.01);
 g.gain.exponentialRampToValueAtTime(.001,_ac.currentTime+d);
 o.connect(g);g.connect(_ac.destination);o.start();o.stop(_ac.currentTime+d);}catch(e){}}
function sHit(){tone(880,.1,'triangle');setTimeout(()=>tone(1320,.14,'triangle'),40);}
function sBad(){tone(200,.25,'sawtooth');}
function sWin(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle'),i*110));}
function sLose(){[440,349,262].forEach((f,i)=>setTimeout(()=>tone(f,.32,'sawtooth'),i*180));}
function sClick(){tone(520,.05,'square');}
function vib(p){if(!soundOn)return;try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}

// ---- preload รูปมอนสเตอร์ของพื้นที่ที่ปลดล็อกแล้ว (กันรูปโหลดช้าตอนเข้าศึก) ----
const _preloaded = new Set();
function preloadArea(areaId) {
  const a = AREAS.find(x => x.id === areaId);
  if (!a) return;
  a.pool.forEach(f => {
    const src = `image/enemies/${f}.png`;
    if (_preloaded.has(src)) return;
    _preloaded.add(src);
    const img = new Image();
    img.src = src;
  });
}

// ============================================
// SAVE / LOAD  (localStorage เสมอ + Supabase ถ้าล็อกอิน)
// ============================================
function saveKey(){ return 'mathrpg_save_' + (account?.name || 'guest'); }

function saveLocal() {
  if (!player) return;
  try { localStorage.setItem(saveKey(), JSON.stringify(player)); } catch(e){}
  syncCloud();
}
function loadLocal() {
  try { const r = localStorage.getItem(saveKey()); return r ? JSON.parse(r) : null; } catch(e){ return null; }
}

// sync ความคืบหน้าขึ้น Supabase (ต้องรัน supabase_setup.sql ก่อน)
let cloudState = 'idle';   // idle | ok | missing | error
async function syncCloud() {
  if (!db || !account || account.guest) return;
  try {
    const { error } = await db.rpc('math_save_score', {
      p_name: account.name, p_pin: account.pin,
      p_xp: totalXpOf(player), p_level: player.level,
      p_hero_id: player.heroId, p_gold: player.gold,
      p_kills: player.monstersKilled, p_best_combo: player.bestCombo,
      p_correct: player.totalCorrect, p_wrong: player.totalWrong,
      p_area: player.unlockedArea, p_hp: player.hp
    });
    if (error) throw error;
    // เขียนลง math_scores (ตารางอันดับดึงจากนี้)
    // ใช้ delete+insert แทน upsert เพื่อไม่ต้องพึ่ง unique index
    const xpVal = totalXpOf(player);
    const { error: delErr } = await db.from('math_scores').delete().eq('name', account.name);
    if (delErr) console.warn('math_scores delete:', delErr.message);
    const { error: insErr } = await db.from('math_scores').insert({
      name: account.name,
      pin: account.pin,
      xp: xpVal,
      level: player.level,
      games_played: 1,
      total_correct: player.totalCorrect,
      account_id: account.id
    });
    if (insErr) console.warn('math_scores insert:', insErr.message);
    cloudState = 'ok';
  } catch (e) {
    // 404 = ยังไม่ได้รัน supabase_setup.sql -> เกมยังเล่นได้ด้วย localStorage
    const msg = String(e.message || e);
    cloudState = /not find|404|does not exist/i.test(msg) ? 'missing' : 'error';
    console.warn('cloud sync:', cloudState, msg);
  }
  updateCloudBadge();
}

// โหลดเซฟจากคลาวด์ (เล่นต่อข้ามเครื่อง) — คืน player object หรือ null
async function loadCloud() {
  if (!db || !account || account.guest) return null;
  try {
    const { data, error } = await db.rpc('math_load_rpg',
      { p_name: account.name, p_pin: account.pin });
    if (error) throw error;
    if (!data || !data.length || !data[0].hero_id) return null;
    const d = data[0];
    const p = createPlayer(account.name, d.hero_id);
    p.level = Math.max(1, d.level || 1);
    applyLevelStats(p);
    // แปลง xp สะสมรวม -> exp ในเลเวลปัจจุบัน
    let rest = d.xp || 0;
    for (let l = 1; l < p.level; l++) rest -= BALANCE.expToNext(l);
    p.exp = Math.max(0, Math.min(rest, p.expToNext - 1));
    p.gold = d.gold || 0;
    p.monstersKilled = d.kills || 0;
    p.bestCombo = d.best_combo || 0;
    p.totalCorrect = d.correct || 0;
    p.totalWrong = d.wrong || 0;
    p.unlockedArea = Math.max(1, d.area || 1);
    p.hp = (d.hp && d.hp > 0) ? Math.min(d.hp, p.maxHp) : p.maxHp;
    cloudState = 'ok';
    return p;
  } catch (e) {
    const msg = String(e.message || e);
    cloudState = /not find|404|does not exist/i.test(msg) ? 'missing' : 'error';
    console.warn('cloud load:', cloudState, msg);
    return null;
  }
}

function updateCloudBadge() {
  const el = document.getElementById('cloud-badge');
  if (!el) return;
  if (account && account.guest) { el.textContent = '👤 โหมด Guest (ไม่บันทึกออนไลน์)'; el.className = 'cloud warn'; return; }
  if (cloudState === 'ok')      { el.textContent = '☁️ บันทึกออนไลน์แล้ว'; el.className = 'cloud ok'; return; }
  if (cloudState === 'missing') { el.textContent = '⚠️ ยังไม่ได้ตั้งค่าฐานข้อมูล — เซฟในเครื่องเท่านั้น'; el.className = 'cloud warn'; return; }
  if (cloudState === 'error')   { el.textContent = '⚠️ เชื่อมต่อคลาวด์ไม่ได้ — เซฟในเครื่องแทน'; el.className = 'cloud warn'; return; }
  el.textContent = ''; el.className = 'cloud';
}
function totalXpOf(p) {
  let t = p.exp;
  for (let l = 1; l < p.level; l++) t += BALANCE.expToNext(l);
  return t;
}

// ============================================
// AUTH
// ============================================
$('btn-login').onclick = async () => {
  const name = $('auth-name').value.trim();
  const pin  = $('auth-pin').value.trim();
  const err  = $('auth-error');
  if (!name || !pin) { err.textContent = 'กรุณากรอกชื่อและ PIN'; return; }
  if (!/^\d{4,6}$/.test(pin)) { err.textContent = 'PIN ต้องเป็นตัวเลข 4-6 หลัก'; return; }
  err.textContent = 'กำลังเชื่อมต่อ...';
  sClick();

  if (!db) { err.textContent = 'ต่อฐานข้อมูลไม่ได้ — เล่นแบบ Guest ได้'; return; }
  try {
    const { data, error } = await db.rpc('math_login', { p_name: name, p_pin: pin });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('ไม่พบข้อมูลผู้เล่น');
    account = { ...data[0], name, pin };
    err.textContent = '';
    afterAuth();
  } catch (e) {
    err.textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + (e.message || 'ตรวจชื่อ/PIN อีกครั้ง');
  }
};

$('btn-guest').onclick = () => { sClick(); account = { name:'Guest', guest:true }; afterAuth(); };

$('btn-logout').onclick = () => {
  saveLocal(); account = null; player = null;
  $('auth-pin').value = ''; showScreen('screen-auth');
};

async function afterAuth() {
  const local = loadLocal();
  const cloud = await loadCloud();          // null ถ้ายังไม่ตั้งค่า DB / เล่น Guest

  // เลือกตัวที่คืบหน้ามากกว่า (กันเซฟเก่าทับเซฟใหม่)
  let saved = local;
  if (cloud && (!local || totalXpOf(cloud) > totalXpOf(local))) saved = cloud;

  if (saved && saved.heroId) {
    player = saved;
    applyLevelStats(player);                // เผื่อปรับสูตรบาลานซ์ภายหลัง
    player.hp = Math.min(player.hp || player.maxHp, player.maxHp);
    if (player.hp <= 0) player.hp = Math.max(1, Math.round(player.maxHp * 0.3));
    saveLocal();
    goHome();
  } else {
    buildHeroGrid();
    showScreen('screen-hero');
  }
  updateCloudBadge();
}

// ============================================
// HERO SELECT
// ============================================
function buildHeroGrid() {
  const g = $('hero-grid'); g.innerHTML = '';
  HEROES.forEach(h => {
    const d = document.createElement('div');
    d.className = 'hero-cell';
    d.innerHTML = `<img src="${h.img}" alt="${h.name}" loading="lazy">`;
    d.onclick = () => {
      sClick();
      document.querySelectorAll('.hero-cell').forEach(c => c.classList.remove('sel'));
      d.classList.add('sel');
      pendingHero = h;
      $('hero-name').textContent = h.name;
      $('btn-hero-ok').disabled = false;
    };
    g.appendChild(d);
  });
}

$('btn-hero-ok').onclick = () => {
  if (!pendingHero) return;
  sClick();
  player = createPlayer(account.name, pendingHero.id);
  saveLocal(); syncCloud();
  goHome();
};

// ============================================
// HOME
// ============================================
function goHome() {
  renderHome();
  preloadArea(player.unlockedArea);            // เตรียมรูปไว้ล่วงหน้า
  showScreen('screen-home');
  loadLeaderboard();
  saveLocal();
}

function renderHome() {
  $('home-hero').src   = player.heroImg;
  $('home-name').textContent = player.name;
  $('home-lv').textContent   = player.level;
  $('home-gold').textContent = player.gold;
  $('home-hp').textContent   = `${player.hp}/${player.maxHp}`;
  $('home-atk').textContent  = player.atk;
  $('home-kill').textContent = player.monstersKilled;
  $('home-hpbar').style.width  = (player.hp / player.maxHp * 100) + '%';
  $('home-expbar').style.width = (player.exp / player.expToNext * 100) + '%';
  $('home-exptxt').textContent = `${player.exp}/${player.expToNext} EXP`;

  const list = $('area-list'); list.innerHTML = '';
  AREAS.forEach(a => {
    const locked = player.level < a.unlockLv;
    const boss = isBossLevel(player.level) && !locked && a.id === player.unlockedArea;
    const d = document.createElement('div');
    d.className = 'area-btn' + (locked ? ' lock' : '');
    d.innerHTML = `<span class="ic">${a.icon}</span>
      <div style="flex:1">
        <div class="nm">${a.name} <span style="color:var(--dim);font-weight:400">${a.en}</span></div>
        <div class="lv">${locked ? '🔒 ปลดล็อกที่ Lv.'+a.unlockLv : 'มอนสเตอร์ Lv.'+a.minLv+'-'+a.maxLv+(boss?' · ⚠️ มีบอสรออยู่':'')}</div>
      </div>`;
    if (!locked) d.onclick = () => { sClick(); startBattle(a.id, boss); };
    list.appendChild(d);
  });
}

$('btn-rest').onclick = () => {
  if (player.hp >= player.maxHp) { flash('HP เต็มอยู่แล้ว'); return; }
  if (player.gold < 10) { flash('ทองไม่พอ (ต้องมี 10)'); return; }
  player.gold -= 10; player.hp = player.maxHp;
  sWin(); renderHome(); saveLocal();
};
function flash(msg){ const n=$('home-name'); const o=n.textContent; n.textContent=msg;
  setTimeout(()=>n.textContent=o,1100); }

async function loadLeaderboard() {
  const el = $('leaderboard-list');
  if (!db) { el.innerHTML = '<div class="muted">โหมดออฟไลน์</div>'; return; }
  el.innerHTML = '<div class="muted">กำลังโหลด...</div>';
  try {
    const { data, error } = await db.from('math_leaderboard')
      .select('name, xp, level').order('xp', { ascending:false }).limit(10);
    if (error) throw error;
    if (!data || !data.length) { el.innerHTML = '<div class="muted">ยังไม่มีใครเล่น เป็นคนแรกสิ! 🚀</div>'; return; }
    el.innerHTML = data.map((u,i) => {
      const ic = ['🥇','🥈','🥉'][i] || (i+1);
      const me = account && u.name === account.name;
      return `<div class="lb-row ${me?'me':''}"><span>${ic} ${esc(u.name)}</span>
              <span>Lv.${u.level||1} · ${u.xp||0} XP</span></div>`;
    }).join('');
  } catch (e) { el.innerHTML = '<div class="muted">โหลดอันดับไม่ได้</div>'; }
}

// ============================================
// BATTLE
// ============================================
let lastArea = 1;

function startBattle(areaId, forceBoss) {
  if (player.hp <= 0) player.hp = Math.max(1, Math.round(player.maxHp * 0.3));
  lastArea = areaId;
  battle = createBattle(player, areaId, forceBoss);
  busy = false;
  $('b-psprite').src = player.heroImg;
  $('b-pname').textContent = `${player.name} Lv.${player.level}`;
  $('b-msprite').src = battle.monster.img;
  // ขนาดตามความน่ากลัว: มอนธรรมดา 100%, ตัวแรง/บอสใหญ่ขึ้น
  const m0 = battle.monster;
  const scale = m0.isBoss ? 1.5 : Math.min(1.28, 0.92 + m0.level * 0.02);
  $('b-msprite').style.transform = `scale(${scale.toFixed(2)})`;
  $('b-msprite').style.transformOrigin = 'bottom center';
  $('b-msprite').classList.toggle('boss-glow', !!m0.isBoss);
  $('b-msprite').onerror = () => { $('b-msprite').style.visibility='hidden'; };
  $('b-msprite').style.visibility = 'visible';
  $('b-mname').innerHTML = `${esc(battle.monster.name)} Lv.${battle.monster.level}` +
      (battle.monster.isBoss ? '<span class="boss-tag">BOSS</span>' : '');
  $('b-log').textContent = battle.monster.isBoss ? '⚠️ บอสปรากฏตัว!' : 'มอนสเตอร์ปรากฏตัว!';
  $('ans').value = '';
  renderBattle();
  qStart = Date.now();
  showScreen('screen-battle');
  setTimeout(()=>$('ans').focus(), 200);
}

// ---- จับเวลาต่อข้อ: รู้ว่าเด็กติดโจทย์แบบไหน ----
let qStart = null;
const TYPE_TH = { add:'บวก', sub:'ลบ', mul:'คูณ', div:'หาร',
                  eq1:'สมการ x+a=b', eq2:'สมการ ax=b',
                  eq3:'สมการ ax+b=c', eq4:'สมการ 2 ฝั่ง' };
function loadStats() {
  try { return JSON.parse(localStorage.getItem('mathrpg_stats') || '{}'); } catch(e){ return {}; }
}
function recordTiming(q, correct, secs) {
  if (!q || !q.type) return;
  const s = loadStats();
  const k = q.type;
  s[k] = s[k] || { n:0, correct:0, time:0 };
  s[k].n++;
  if (correct) s[k].correct++;
  s[k].time += Math.min(secs, 60);      // กันค่าเพี้ยนถ้าเดินออกจากจอ
  try { localStorage.setItem('mathrpg_stats', JSON.stringify(s)); } catch(e){}
}
// คืนประเภทโจทย์ที่ "ช้าที่สุด" และ "ผิดบ่อยสุด"
function weakestType() {
  const s = loadStats();
  let worst = null;
  Object.keys(s).forEach(k => {
    const d = s[k];
    if (d.n < 3) return;                       // ข้อมูลน้อยเกินไป ยังไม่สรุป
    const acc = d.correct / d.n;
    const avg = d.time / d.n;
    const score = (1 - acc) * 2 + Math.min(avg / 10, 1);   // ผิดสำคัญกว่าช้า
    if (!worst || score > worst.score) worst = { k, score, acc, avg, n: d.n };
  });
  return worst;
}

function renderBattle() {
  const p = battle.player, m = battle.monster;
  $('b-phpbar').style.width = (p.hp/p.maxHp*100)+'%';
  $('b-phptxt').textContent = `${p.hp}/${p.maxHp}`;
  $('b-mhpbar').style.width = (m.hp/m.maxHp*100)+'%';
  $('b-mhptxt').textContent = `${m.hp}/${m.maxHp}`;
  $('b-q').textContent = battle.question.text;
  // หมายเหตุ: ไม่ล้าง b-hint ที่นี่ เพราะ renderBattle ถูกเรียกหลังตอบผิด
  // (คำใบ้จะถูกล้างตอนเริ่มตอบข้อใหม่ใน doSubmit แทน)
  $('b-combo').textContent = battle.combo >= 2
    ? `🔥 COMBO x${battle.combo}  (ดาเมจ ×${BALANCE.comboMult(battle.combo)})` : '';
}

function floatText(host, txt, cls) {
  const s = document.createElement('span');
  s.className = 'float ' + cls; s.textContent = txt;
  host.appendChild(s); setTimeout(()=>s.remove(), 950);
}

function doSubmit() {
  if (busy || !battle || battle.status !== 'ongoing') return;
  const raw = $('ans').value;
  if (raw === '' || raw === '-') { $('b-log').textContent = 'ใส่คำตอบก่อน'; return; }
  busy = true;
  $('b-hint').textContent = '';     // ล้างคำใบ้ของข้อก่อนหน้า

  const q = battle.question;
  const secs = qStart ? (Date.now() - qStart) / 1000 : 0;
  const r = submitAnswer(battle, raw);
  recordTiming(q, r.correct, secs);
  $('ans').value = '';

  const pBox = $('b-psprite').parentElement;
  const mBox = $('b-msprite').parentElement;

  if (r.correct) {
    sHit(); vib(90);
    $('b-psprite').classList.add('anim-atk-r');
    setTimeout(() => {
      $('b-msprite').classList.add('anim-hurt');
      floatText(mBox, '-' + r.damage, 'dmg-mon');
      renderBattle();
    }, 170);
    $('b-log').textContent = `✅ ถูกต้อง! โจมตี ${r.damage} ดาเมจ`;
  } else {
    sBad(); vib([50,50,50]);
    $('b-msprite').classList.add('anim-atk-l');
    setTimeout(() => {
      $('b-psprite').classList.add('anim-hurt');
      floatText(pBox, '-' + r.damage, 'dmg-ply');
      renderBattle();
    }, 170);
    $('b-log').textContent = `❌ ผิด! คำตอบคือ ${r.expected} — โดน ${r.damage} ดาเมจ`;
    $('b-hint').textContent = '💡 ' + q.hint;
  }

  setTimeout(() => {
    ['anim-atk-r','anim-atk-l','anim-hurt'].forEach(c => {
      $('b-psprite').classList.remove(c); $('b-msprite').classList.remove(c);
    });
    busy = false;
    saveLocal();
    if (r.status === 'victory') endBattle(true, r);
    else if (r.status === 'gameover') endBattle(false, r);
    else { renderBattle(); qStart = Date.now(); $('ans').focus(); }
  }, 620);
}

$('btn-submit').onclick = doSubmit;
$('ans').addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
document.querySelectorAll('.keypad button[data-k]').forEach(b => {
  b.onclick = () => {
    sClick();
    const k = b.dataset.k, a = $('ans');
    if (k === 'del') a.value = a.value.slice(0, -1);
    else if (k === '-') a.value = a.value.startsWith('-') ? a.value.slice(1) : '-' + a.value;
    else a.value += k;
    a.focus();
  };
});
$('btn-flee').onclick = () => {
  if (!confirm('หนีจากการต่อสู้? จะไม่ได้ EXP')) return;
  sClick(); battle = null; goHome();
};

// ============================================
// RESULT
// ============================================
// สรุปถูก/ผิด/ความแม่นยำ แบบตัวใหญ่อ่านชัด
function renderTally() {
  const c = player.totalCorrect, w = player.totalWrong, t = c + w;
  const acc = t ? Math.round(c / t * 100) : 0;
  $('r-tally').innerHTML =
    `<div class="t ok"><div class="n">${c}</div><div class="l">ตอบถูก</div></div>` +
    `<div class="t no"><div class="n">${w}</div><div class="l">ตอบผิด</div></div>` +
    `<div class="t acc"><div class="n">${acc}%</div><div class="l">ความแม่นยำ</div></div>`;

  // บอกจุดที่ควรฝึกเพิ่ม (จากเวลาและความถูกต้องจริง)
  const wk = weakestType();
  const el = $('r-weak');
  if (el) {
    if (wk) {
      el.innerHTML = `📌 ควรฝึกเพิ่ม: <b>${TYPE_TH[wk.k] || wk.k}</b> ` +
        `<span>(ถูก ${Math.round(wk.acc*100)}% · เฉลี่ย ${wk.avg.toFixed(1)} วิ/ข้อ)</span>`;
      el.style.display = 'block';
    } else { el.style.display = 'none'; }
  }
}

function endBattle(win, r) {
  const m = battle.monster;
  if (win) { sWin(); vib([100,60,140]); } else { sLose(); vib([300]); }

  $('r-title').textContent = win ? (m.isBoss ? '👑 BOSS DEFEATED!' : '🎉 VICTORY!') : '💀 GAME OVER';
  $('r-title').className = 'big ' + (win ? 'win' : 'lose');
  $('r-sprite').src = win ? player.heroImg : m.img;

  const lv = $('r-lvup');
  lv.innerHTML = (r.levelUps && r.levelUps.length)
    ? r.levelUps.map(l => `<div class="lvup">⬆️ LEVEL UP! → Lv.${l}</div>`).join('') : '';

  const rw = $('r-reward');
  if (win) {
    rw.innerHTML = `
      <div><span>ล้ม</span><b>${esc(m.name)} Lv.${m.level}</b></div>
      <div><span>EXP ที่ได้</span><b style="color:var(--exp)">+${r.rewards.exp}</b></div>
      <div><span>ทองที่ได้</span><b style="color:var(--gold)">+${r.rewards.gold}</b></div>
      <div><span>คอมโบสูงสุด</span><b style="color:var(--combo)">x${player.bestCombo}</b></div>
      <div><span>สถานะตอนนี้</span><b>Lv.${player.level} · HP ${player.hp}/${player.maxHp} · ATK ${player.atk}</b></div>
      <div><span>EXP</span><b>${player.exp}/${player.expToNext}</b></div>`;
    renderTally();
    $('r-note').textContent = '';
    $('btn-again').textContent = 'สู้ต่อ';
  } else {
    player.hp = Math.max(1, Math.round(player.maxHp * 0.3));
    rw.innerHTML = `
      <div><span>พ่ายแพ้ให้</span><b>${esc(m.name)} Lv.${m.level}</b></div>
      <div><span>เลเวลปัจจุบัน</span><b>Lv.${player.level}</b></div>
      <div><span>ตอบถูก / ผิด</span><b>${player.totalCorrect} / ${player.totalWrong}</b></div>
      <div><span>ฟื้นคืนชีพ</span><b style="color:var(--hp)">HP ${player.hp}/${player.maxHp}</b></div>`;
    renderTally();
    $('r-note').textContent = 'เลเวลและของไม่หาย — ลองอีกครั้งได้เลย';
    $('btn-again').textContent = 'ลองใหม่';
  }

  saveLocal(); syncCloud();
  showScreen('screen-result');
}

$('btn-again').onclick = () => { sClick(); startBattle(lastArea, false); };

// ---- ปุ่มเปิด/ปิดเสียง ----
['btn-sound','btn-sound2'].forEach(id => {
  const b = document.getElementById(id);
  if (b) b.onclick = (e) => { e.stopPropagation(); setSound(!soundOn); if (soundOn) sClick(); };
});
setSound(soundOn);          // ตั้งไอคอนให้ตรงกับค่าที่จำไว้
updateCloudBadge();
$('btn-home').onclick  = () => { sClick(); goHome(); };
