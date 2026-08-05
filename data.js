// ============================================
// Math Battle RPG — Static Data
// รูปทั้งหมดอ้างอิง path จริงใน repo math-puzzle2
// ============================================

const HERO_FILES = [
  "Actor1_3","Actor1_4","Actor1_5","Actor1_6",
  "Actor2_1","Actor2_2","Actor2_3","Actor2_4","Actor2_5","Actor2_6","Actor2_7",
  "Actor3_1","Actor3_2","Actor3_3","Actor3_4"
];

const HERO_NAMES = [
  "อารอน","เบลล่า","ซีดริก","ไดอาน่า","อีธาน","ฟิโอน่า","แกเร็ธ","เฮเลน่า",
  "ไอแซค","จูเลีย","ไคเซอร์","ลีน่า","มาร์คัส","นอร่า","โอไรออน"
];

const HEROES = HERO_FILES.map((f, i) => ({
  id: i + 1,
  name: HERO_NAMES[i],
  img: `image/hero/${f}.png`
}));

// ---- Monster master list (91 ตัว จาก image/enemies) ----
const MONSTER_FILES = [
  "Berserker","Birdman","Blackknight","Caitsith","Captain","Crab","Crow","Darkelf",
  "Demon","Demon_metamorphosis","Demoncount","Demonpot","Dragon","Evilbook","Evilgod",
  "Foxman","Frilledlizard","Gatekeeper","Gnome","Goblin","God_of_light","Goddess",
  "Goddess_of_death","Hakutaku","Harpy","Hi_monster","Highking","Hydra","Ketos","Kraken",
  "Lich","Machinerybee","Matango","Mechascorpion","Medusa","Mercenary","Mimic","Oddegg",
  "Petitdevil","Plasma","SF_Agent","SF_Anaconda","SF_Armygorilla","SF_Armymonkey",
  "SF_Blueogre","SF_Boss","SF_Brownbear","SF_Cyborg","SF_Demon_of_universe","SF_Drone",
  "SF_Enmadaio","SF_Evilteddybear","SF_Hannyamask","SF_Hermit","SF_Jiangshi",
  "SF_Kamaitachi","SF_Kappa","SF_Madclown","SF_Madscientist","SF_Mafia","SF_Mechasphere",
  "SF_Phoenix","SF_Redogre","SF_Securityrobot","SF_Shadow","SF_Skullmask",
  "SF_Slaughterrobot","SF_Specialforces","SF_Talkingmuppet","SF_Timebomb","SF_Whitewolf",
  "SF_Will-o-the-wisp","SF_Will_o_the_wisp","SF_Wolf","SF_Workrobot","SF_Zombiedog",
  "Sailor","Salamander","Sandworm","Siren","Sorcerer","Stoneknight","Sylph","Tigerbunny",
  "Treant","Undine","Unicorn","Witch","Wolfman","Wraith","Zombie"
];

function prettyName(f) {
  return f.replace(/^SF_/, "").replace(/[_-]/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase());
}

// ---- Area System: แบ่ง 91 ตัวเป็น 6 โซนตามความแข็ง ----
const AREAS = [
  {
    id: 1, name: "ชายหาด", en: "Beach", icon: "🏖️", minLv: 1, maxLv: 3, unlockLv: 1,
    pool: ["Crab","Crow","Oddegg","Petitdevil","Sailor","Tigerbunny","Caitsith",
           "Frilledlizard","Gnome","Goblin","Harpy","Mimic","Matango"]
  },
  {
    id: 2, name: "ป่าลึก", en: "Forest", icon: "🌲", minLv: 3, maxLv: 7, unlockLv: 4,
    pool: ["Foxman","Wolfman","Treant","Sylph","Undine","Birdman","Machinerybee",
           "Witch","Sorcerer","Darkelf","Hakutaku","Unicorn","SF_Whitewolf","SF_Wolf",
           "SF_Brownbear","SF_Armymonkey","SF_Kappa"]
  },
  {
    id: 3, name: "ถ้ำมืด", en: "Cave", icon: "🕳️", minLv: 6, maxLv: 12, unlockLv: 8,
    pool: ["Zombie","Wraith","Lich","Skeleton","Stoneknight","Salamander","Sandworm",
           "Medusa","Evilbook","Demonpot","SF_Jiangshi","SF_Zombiedog","SF_Shadow",
           "SF_Skullmask","SF_Hannyamask","SF_Kamaitachi","SF_Hermit"]
      .filter(n => MONSTER_FILES.includes(n))
  },
  {
    id: 4, name: "ป้อมปราการ", en: "Fortress", icon: "🏰", minLv: 11, maxLv: 18, unlockLv: 13,
    pool: ["Berserker","Blackknight","Captain","Gatekeeper","Mercenary","Highking",
           "SF_Agent","SF_Specialforces","SF_Mafia","SF_Securityrobot","SF_Redogre",
           "SF_Blueogre","SF_Madclown","SF_Evilteddybear","SF_Talkingmuppet"]
  },
  {
    id: 5, name: "โรงงานเหล็ก", en: "Steel Works", icon: "⚙️", minLv: 17, maxLv: 26, unlockLv: 19,
    pool: ["Mechascorpion","SF_Cyborg","SF_Drone","SF_Mechasphere","SF_Workrobot",
           "SF_Slaughterrobot","SF_Madscientist","SF_Timebomb","Plasma","SF_Anaconda",
           "SF_Armygorilla","SF_Will-o-the-wisp","SF_Will_o_the_wisp","Hi_monster"]
  },
  {
    id: 6, name: "วิหารมังกร", en: "Dragon Sanctum", icon: "🐉", minLv: 25, maxLv: 40, unlockLv: 26,
    pool: ["Dragon","Hydra","Kraken","Ketos","Siren","Demon","Demon_metamorphosis",
           "Demoncount","Evilgod","Goddess","Goddess_of_death","God_of_light",
           "SF_Phoenix","SF_Enmadaio","SF_Boss","SF_Demon_of_universe"]
  }
];

// ---- Boss ทุก 5 เลเวล ----
const BOSSES = [
  { lv: 5,  file: "Kraken",              name: "ราชาปูทะเล" },
  { lv: 10, file: "Treant",              name: "เจ้าป่าโบราณ" },
  { lv: 15, file: "Lich",                name: "จอมเวทอมตะ" },
  { lv: 20, file: "Blackknight",         name: "อัศวินดำ" },
  { lv: 25, file: "SF_Slaughterrobot",   name: "เครื่องจักรสังหาร" },
  { lv: 30, file: "Dragon",              name: "มังกรเพลิง" },
  { lv: 35, file: "Evilgod",             name: "เทพอสูร" },
  { lv: 40, file: "SF_Demon_of_universe",name: "ปีศาจแห่งจักรวาล" }
];

// ============================================
// BALANCE — สูตรค่าสถานะ (ส่วนที่ยังคิดไม่ออก)
// ============================================
const BALANCE = {
  // ---- Player ----
  playerMaxHP:  lv => 80 + 20 * (lv - 1),          // Lv1=80, Lv5=160, Lv10=260
  playerATK:    lv => 10 + 3  * (lv - 1),          // Lv1=10, Lv5=22, Lv10=37
  expToNext:    lv => 60 + 40 * (lv - 1),          // Lv1=60, Lv5=220, Lv10=420

  // ---- Monster ----
  monHP:   lv => Math.round(38 + 24 * (lv - 1)),   // ผู้เล่นตอบถูก ~4 ครั้ง = ตาย 1 ตัว
  monATK:  lv => Math.round(6  + 2.2 * (lv - 1)),  // ผู้เล่นทนตอบผิดได้ ~12 ครั้ง
  monEXP:  lv => Math.round(18 + 9 * (lv - 1)),    // ~4 ตัว = 1 เลเวล
  monGold: lv => Math.round(5  + 4 * (lv - 1)),

  // ---- Boss ตัวคูณ ----
  bossHP: 3.2, bossATK: 1.5, bossEXP: 4, bossGold: 5,

  // ---- Combo → ตัวคูณดาเมจ ----
  comboMult: c => c <= 1 ? 1 : c === 2 ? 1.25 : c === 3 ? 1.5 : c === 4 ? 1.75 : 2.0
};
