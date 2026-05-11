-- ============================================================
-- Rebrand: rename the flagship Минск venue from "Bury Tennis Centre"
-- to a neutral, location-based name. The platform (OpenCourt.by) is
-- not tied to a single coach or club, so the seed data shouldn't be
-- either. Schema-equivalent rename — purely a label change.
-- ============================================================

update venues
set name = 'Tennis Park «Партизанский»'
where name = 'Bury Tennis Centre'
  and city = 'Минск';
