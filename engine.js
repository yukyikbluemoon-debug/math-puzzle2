// ============================================
// Math Battle RPG — Pure Logic Engine
// ไม่มีการแตะ DOM เลย ทดสอบด้วย node ได้
// ============================================

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// ============================================
// Question System
// เลเวลต่ำ = เลขคณิตพื้นฐาน, เลเวลสูง = สมการ (สืบทอดจาก math-puzzle เดิม)
// ============================================
let _qid = 0;

function makeQ(o) {
  return Object.assign({ id: ++_qid }, o);
}

function questionTierForLevel(lv) {
  if (lv <= 2)  return 1; // + -  เลขน้อย
  if (lv <= 4)  return 2; // + - เลขใหญ่ขึ้น, × ตารางสูตรคูณ
  if (lv <= 7)  return 3; // × ÷
  if (lv <= 11) return 4; // x + a = b
  if (lv <= 15) return 5; // ax = b
  if (lv <= 20) return 6; // ax + b = c
  return 7;               // ax + b = cx + d
}

function generateQuestion(playerLevel) {
  const tier = questionTierForLevel(playerLevel);
  let a, b, c, d, x;

  switch (tier) {
    case 1: {
      if (Math.random() < 0.5) {
        a = randInt(1, 9); b = randInt(1, 9);
        return makeQ({ type:'add', tier, text:`${a} + ${b}`, answer:a+b,
                       hint:`นับต่อจาก ${a} ไปอีก ${b}` });
      }
      a = randInt(2, 12); b = randInt(1, a);
      return makeQ({ type:'sub', tier, text:`${a} - ${b}`, answer:a-b,
                     hint:`เอา ${b} ออกจาก ${a}` });
    }
    case 2: {
      const r = Math.random();
      if (r < 0.4) { a=randInt(10,49); b=randInt(10,49);
        return makeQ({type:'add',tier,text:`${a} + ${b}`,answer:a+b,hint:`บวกหลักหน่วยก่อน แล้วค่อยหลักสิบ`}); }
      if (r < 0.75) { a=randInt(20,80); b=randInt(5,a-1);
        return makeQ({type:'sub',tier,text:`${a} - ${b}`,answer:a-b,hint:`ลบหลักหน่วยก่อน ถ้าไม่พอให้ยืมหลักสิบ`}); }
      a=randInt(2,9); b=randInt(2,9);
      return makeQ({type:'mul',tier,text:`${a} × ${b}`,answer:a*b,hint:`สูตรคูณแม่ ${a}`});
    }
    case 3: {
      if (Math.random() < 0.5) {
        a = randInt(3, 15); b = randInt(3, 12);
        return makeQ({type:'mul',tier,text:`${a} × ${b}`,answer:a*b,
                      hint:`แยกเป็น ${a}×${b-(b%10||b)} ... หรือใช้สูตรคูณแม่ ${a}`});
      }
      b = randInt(2, 12); x = randInt(2, 12); a = b * x;
      return makeQ({type:'div',tier,text:`${a} ÷ ${b}`,answer:x,
                    hint:`${b} คูณอะไรได้ ${a} ?`});
    }
    case 4: {
      x = randInt(1, 15); a = randInt(1, 20); b = x + a;
      return makeQ({type:'eq1',tier,text:`x + ${a} = ${b}`,answer:x,
                    hint:`ย้าย +${a} ไปลบอีกฝั่ง → x = ${b} - ${a}`});
    }
    case 5: {
      a = randInt(2, 9); x = randInt(1, 12); b = a * x;
      return makeQ({type:'eq2',tier,text:`${a}x = ${b}`,answer:x,
                    hint:`นำ ${a} ไปหารทั้งสองฝั่ง → x = ${b} ÷ ${a}`});
    }
    case 6: {
      a = randInt(2, 6); x = randInt(1, 10); b = randInt(1, 10); c = a * x + b;
      return makeQ({type:'eq3',tier,text:`${a}x + ${b} = ${c}`,answer:x,
                    hint:`ย้าย +${b} ไปลบ → ${a}x = ${c-b} แล้วหารด้วย ${a}`});
    }
    default: {
      x = randInt(1, 8); b = randInt(1, 10);
      let tries = 0;
      do {
        a = randInt(2, 6); c = randInt(2, 6);
        while (c === a) c = randInt(2, 6);
        d = (a - c) * x + b;
        tries++;
      } while ((d < 1 || d > 30) && tries < 60);
      if (d < 1 || d > 30) { // fallback กัน edge case
        a = 5; c = 2; x = randInt(1,8); b = randInt(1,10); d = (a-c)*x + b;
      }
      return makeQ({type:'eq4',tier,text:`${a}x + ${b} = ${c}x + ${d}`,answer:x,
                    hint:`ย้าย ${c}x มาซ้าย, ย้าย ${b} ไปขวา → ${a-c}x = ${d-b}`});
    }
  }
}

// ============================================
// Player
// ============================================
function createPlayer(name, heroId) {
  const hero = HEROES.find(h => h.id === heroId) || HEROES[0];
  return {
    name, heroId: hero.id, heroImg: hero.img,
    level: 1, exp: 0,
    expToNext: BALANCE.expToNext(1),
    maxHp: BALANCE.playerMaxHP(1),
    hp: BALANCE.playerMaxHP(1),
    atk: BALANCE.playerATK(1),
    gold: 0,
    totalCorrect: 0, totalWrong: 0, monstersKilled: 0, bestCombo: 0,
    unlockedArea: 1
  };
}

function applyLevelStats(p) {
  p.maxHp = BALANCE.playerMaxHP(p.level);
  p.atk = BALANCE.playerATK(p.level);
  p.expToNext = BALANCE.expToNext(p.level);
}

// คืน array ของ level ที่เพิ่งได้ (รองรับ level ซ้อนหลายขั้น)
function gainExp(p, amount) {
  p.exp += amount;
  const gained = [];
  while (p.exp >= p.expToNext) {
    p.exp -= p.expToNext;
    p.level++;
    const prevMax = p.maxHp;
    applyLevelStats(p);
    p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - prevMax) + Math.round(p.maxHp * 0.3)); // level up ฟื้น HP
    gained.push(p.level);
    // ปลดล็อก area
    AREAS.forEach(ar => { if (p.level >= ar.unlockLv && ar.id > p.unlockedArea) p.unlockedArea = ar.id; });
  }
  return gained;
}

// ============================================
// Monster
// ============================================
function isBossLevel(lv) { return lv % 5 === 0; }

function createMonster(areaId, playerLevel, forceBoss) {
  if (forceBoss) {
    const b = BOSSES.reduce((best, cur) =>
      Math.abs(cur.lv - playerLevel) < Math.abs(best.lv - playerLevel) ? cur : best, BOSSES[0]);
    const lv = playerLevel;
    return {
      id: 'boss_' + b.file, name: b.name, isBoss: true, level: lv,
      img: `image/enemies/${b.file}.png`,
      maxHp: Math.round(BALANCE.monHP(lv) * BALANCE.bossHP),
      hp:    Math.round(BALANCE.monHP(lv) * BALANCE.bossHP),
      atk:   Math.round(BALANCE.monATK(lv) * BALANCE.bossATK),
      expReward:  Math.round(BALANCE.monEXP(lv) * BALANCE.bossEXP),
      goldReward: Math.round(BALANCE.monGold(lv) * BALANCE.bossGold)
    };
  }
  const area = AREAS.find(a => a.id === areaId) || AREAS[0];
  const file = pick(area.pool);
  // level มอนสเตอร์: อิงช่วงของ area แต่ขยับตามผู้เล่น ±1
  let lv = Math.max(area.minLv, Math.min(area.maxLv, playerLevel + randInt(-1, 1)));
  return {
    id: file, name: prettyName(file), isBoss: false, level: lv,
    img: `image/enemies/${file}.png`,
    maxHp: BALANCE.monHP(lv), hp: BALANCE.monHP(lv),
    atk: BALANCE.monATK(lv),
    expReward: BALANCE.monEXP(lv),
    goldReward: BALANCE.monGold(lv)
  };
}

// ============================================
// Battle System
// ============================================
function createBattle(player, areaId, forceBoss) {
  return {
    player,
    monster: createMonster(areaId, player.level, forceBoss),
    areaId,
    question: generateQuestion(player.level),
    combo: 0, turn: 1, status: 'ongoing'   // ongoing | victory | gameover
  };
}

function playerDamage(player, combo) {
  const base = player.atk;
  const mult = BALANCE.comboMult(combo);
  const variance = randInt(-1, 1);          // ความสุ่มเล็กน้อย ไม่ให้จำเจ
  return Math.max(1, Math.round(base * mult) + variance);
}

function monsterDamage(monster) {
  return Math.max(1, monster.atk + randInt(-1, 1));
}

// หัวใจของเกม: รับคำตอบ → คืนผลลัพธ์ของเทิร์นนั้น
function submitAnswer(battle, rawAnswer) {
  if (battle.status !== 'ongoing') return { ignored: true };

  const answer = parseInt(String(rawAnswer).trim(), 10);
  const correct = Number.isFinite(answer) && answer === battle.question.answer;
  const result = {
    correct, turn: battle.turn,
    expected: battle.question.answer,
    given: Number.isFinite(answer) ? answer : null,
    damage: 0, combo: 0, levelUps: [], rewards: null
  };

  if (correct) {
    battle.combo++;
    battle.player.totalCorrect++;
    if (battle.combo > battle.player.bestCombo) battle.player.bestCombo = battle.combo;
    const dmg = playerDamage(battle.player, battle.combo);
    battle.monster.hp = Math.max(0, battle.monster.hp - dmg);
    result.damage = dmg;
    result.target = 'monster';

    if (battle.monster.hp <= 0) {
      battle.status = 'victory';
      battle.player.monstersKilled++;
      const exp = battle.monster.expReward, gold = battle.monster.goldReward;
      battle.player.gold += gold;
      result.levelUps = gainExp(battle.player, exp);
      result.rewards = { exp, gold };
    }
  } else {
    battle.combo = 0;
    battle.player.totalWrong++;
    const dmg = monsterDamage(battle.monster);
    battle.player.hp = Math.max(0, battle.player.hp - dmg);
    result.damage = dmg;
    result.target = 'player';
    if (battle.player.hp <= 0) battle.status = 'gameover';
  }

  result.combo = battle.combo;
  if (battle.status === 'ongoing') {
    battle.turn++;
    battle.question = generateQuestion(battle.player.level);
  }
  result.status = battle.status;
  return result;
}

// export สำหรับ node test (ในเบราว์เซอร์จะข้ามบรรทัดนี้)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    randInt, generateQuestion, questionTierForLevel, createPlayer, gainExp,
    createMonster, createBattle, submitAnswer, isBossLevel, playerDamage, monsterDamage
  };
}
