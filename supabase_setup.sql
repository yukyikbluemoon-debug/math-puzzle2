-- ============================================================
-- Math Battle RPG — Supabase setup
-- รันไฟล์นี้ใน Supabase Dashboard > SQL Editor > New query > Run
-- ปลอดภัยกับข้อมูลเดิม: ไม่ลบ ไม่แก้ตาราง accounts ที่มีอยู่
-- ============================================================

-- ------------------------------------------------------------
-- 0) เก็บกวาด: ลบ user ทดสอบที่เกิดจากการ probe ของ agent
--    (math_login สมัครอัตโนมัติ เลยมี __probe__ ค้างไว้ 1 แถว)
-- ------------------------------------------------------------
DELETE FROM accounts WHERE name = '__probe__';

-- ------------------------------------------------------------
-- 1) คอลัมน์เก็บความคืบหน้าของ RPG
--    ใช้ IF NOT EXISTS ทั้งหมด -> รันซ้ำกี่รอบก็ไม่พัง
-- ------------------------------------------------------------
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rpg_hero_id      int     DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rpg_gold         int     DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rpg_kills        int     DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rpg_best_combo   int     DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rpg_correct      int     DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rpg_wrong        int     DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rpg_area         int     DEFAULT 1;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rpg_hp           int     DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rpg_updated_at   timestamptz;

-- ------------------------------------------------------------
-- 2) RPC บันทึกความคืบหน้า — ตรวจ PIN ฝั่งเซิร์ฟเวอร์
--    SECURITY DEFINER = ทำงานข้าม RLS ได้ แต่ต้องผ่าน PIN เท่านั้น
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION math_save_score(
  p_name        text,
  p_pin         text,
  p_xp          int,
  p_level       int,
  p_hero_id     int  DEFAULT NULL,
  p_gold        int  DEFAULT NULL,
  p_kills       int  DEFAULT NULL,
  p_best_combo  int  DEFAULT NULL,
  p_correct     int  DEFAULT NULL,
  p_wrong       int  DEFAULT NULL,
  p_area        int  DEFAULT NULL,
  p_hp          int  DEFAULT NULL
)
RETURNS TABLE (id bigint, name text, xp int, level int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  -- ตรวจ PIN ก่อนเสมอ ไม่ตรง = ไม่ทำอะไร
  SELECT a.id INTO v_id
  FROM accounts a
  WHERE a.name = p_name AND a.pin = p_pin;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'invalid credentials';
  END IF;

  -- กันค่าเพี้ยน/ค่าติดลบจาก client ที่ถูกแก้
  IF p_xp    IS NULL OR p_xp    < 0 THEN RAISE EXCEPTION 'bad xp';    END IF;
  IF p_level IS NULL OR p_level < 1 THEN RAISE EXCEPTION 'bad level'; END IF;

  UPDATE accounts a SET
    -- กันคะแนนถอยหลัง (เปิดหลายแท็บ / เซฟช้ามาถึงทีหลัง)
    xp             = GREATEST(COALESCE(a.xp, 0),    p_xp),
    level          = GREATEST(COALESCE(a.level, 1), p_level),
    rpg_hero_id    = COALESCE(p_hero_id,    a.rpg_hero_id),
    rpg_gold       = COALESCE(p_gold,       a.rpg_gold),
    rpg_kills      = GREATEST(COALESCE(a.rpg_kills,0),      COALESCE(p_kills,0)),
    rpg_best_combo = GREATEST(COALESCE(a.rpg_best_combo,0), COALESCE(p_best_combo,0)),
    rpg_correct    = GREATEST(COALESCE(a.rpg_correct,0),    COALESCE(p_correct,0)),
    rpg_wrong      = GREATEST(COALESCE(a.rpg_wrong,0),      COALESCE(p_wrong,0)),
    rpg_area       = COALESCE(p_area, a.rpg_area),
    rpg_hp         = COALESCE(p_hp,   a.rpg_hp),
    rpg_updated_at = now()
  WHERE a.id = v_id;

  RETURN QUERY
    SELECT a.id, a.name, a.xp, a.level FROM accounts a WHERE a.id = v_id;
END;
$$;

-- ------------------------------------------------------------
-- 3) RPC โหลดเซฟกลับ (เล่นต่อข้ามเครื่องได้)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION math_load_rpg(p_name text, p_pin text)
RETURNS TABLE (
  xp int, level int, hero_id int, gold int, kills int,
  best_combo int, correct int, wrong int, area int, hp int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.xp, a.level, a.rpg_hero_id, a.rpg_gold, a.rpg_kills,
         a.rpg_best_combo, a.rpg_correct, a.rpg_wrong, a.rpg_area, a.rpg_hp
  FROM accounts a
  WHERE a.name = p_name AND a.pin = p_pin;
END;
$$;

-- ------------------------------------------------------------
-- 4) สิทธิ์: ให้ผู้เล่นที่ยังไม่ล็อกอิน (anon) เรียกได้
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION math_save_score(text,text,int,int,int,int,int,int,int,int,int,int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION math_load_rpg(text,text) TO anon, authenticated;

-- ------------------------------------------------------------
-- 5) ตรวจผล — ควรได้ 2 แถว และไม่มี __probe__ เหลือ
-- ------------------------------------------------------------
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('math_save_score','math_load_rpg')
ORDER BY routine_name;

SELECT count(*) AS probe_left FROM accounts WHERE name = '__probe__';
