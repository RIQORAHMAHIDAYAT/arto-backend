-- Mencegah dua budget beririsan pada kategori yang sama milik satu user.
-- Ditegakkan di level database sehingga aman terhadap request konkuren
-- (menutup celah TOCTOU pada cek overlap di lapisan aplikasi).
--
-- btree_gist diperlukan agar tipe UUID bisa dipakai dalam constraint EXCLUDE.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_no_overlap"
  EXCLUDE USING gist (
    "user_id" WITH =,
    "category_id" WITH =,
    daterange("period_start"::date, "period_end"::date, '[]') WITH &&
  );
