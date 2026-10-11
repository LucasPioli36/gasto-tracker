-- Limpieza de datos · 2026-10-10
-- Correr en el SQL Editor de Supabase DESPUÉS de que el deploy con las categorías
-- Ahorro y Viajes esté en producción (si no, la app vieja las cuenta como gasto).
-- Todo va en una transacción: si algo falla, no se aplica nada.

BEGIN;

-- 0. Respaldo completo de expenses.
CREATE TABLE expenses_respaldo_20261010 AS SELECT * FROM expenses;

-- 1. Duplicados individuales: el mismo gasto cargado en Yo y en Pareja
--    (mismo usuario, fecha y monto). Se borra la copia individual; la de pareja queda.
DELETE FROM expenses WHERE user_id IS NOT NULL AND id IN (
  -- Lucas (9)
  '9eab85a9-f276-421f-9a35-63e7c00d5e4f', -- 2026-08-02  31964 Alquiler
  '1ba482f5-8183-48c4-8548-a539ad6c3b8d', -- 2026-08-02   8345 Surtido
  '8396ea84-44a2-47a2-ba3e-8fe5ac0493a3', -- 2026-08-02    500 Depósito de pareja
  '67b49638-dfc2-4262-95c2-aa9f62be53ce', -- 2026-08-09    318 Verdura
  'dc24b717-464b-41f6-b98e-8bc06a1ec057', -- 2026-08-09    325 Milanesa
  '1c620dc2-5ecf-4280-81a1-8e2e73f3edcd', -- 2026-08-30    800 Pollo
  'f601baab-b0dd-47d1-9bc7-073d9d442806', -- 2026-09-01  31964 Alquiler
  '015f7346-fd42-492e-bd44-70c219917847', -- 2026-09-03    877 (sin descripción)
  'f053afef-82d1-44be-b13d-4e7031e6d6e6', -- 2026-09-12   1032 (sin descripción) = Picada primavera
  -- Emi (4)
  '8f1b610a-e99a-4634-8998-bbc96d2a4adc', -- 2026-09-09   4328 Pago de luz = Ute
  '75125f61-1e87-4915-b5e9-f9a413b50c61', -- 2026-09-09   1650 Internet
  'f166625f-d408-46bc-8659-406bb0f6a920', -- 2026-09-09    774 Saneamiento
  'c1b451cc-d18d-4f34-af66-435aae907aca'  -- 2026-09-09   1491 Super
  -- REVISAR antes de sumar a la lista (no parecen el mismo gasto):
  -- '0e2498ca-1e00-4bb4-8075-c2021ada625e', -- Emi 2026-09-30 880 "Asociación de escribanos" (empresa) vs Pareja "Gloria"
  -- '81b9bdb5-e93b-467f-853a-4597064fe301', -- Lucas 2026-07-07 31964 Alquiler; el de Pareja es del 07-10 (sin asignar)
);

-- 2. Lo que no es gasto pasa a Ahorro (no cuenta en el límite).
UPDATE expenses SET category = 'ahorro' WHERE id IN (
  'ae586b42-6383-4b69-8a25-ffb8f3f098df', -- Lucas 2026-08-02 74000 Ahorro
  'e584954e-d2c2-4f19-8738-5b04e9fd4c7a'  -- Lucas 2026-09-01  5200 Deuda Emi
);

-- 3. Viajes: gasto real, pero fuera del día a día.
UPDATE expenses SET category = 'viajes' WHERE id IN (
  '0b8483cf-53bb-49d4-a351-f23107739e77', -- Lucas 2026-09-01 47148 Tarjeta de crédito viaje a Chile
  '61acb3b1-76b6-431b-bb09-f96d253fde13'  -- Lucas 2026-09-02 26400 Vacaciones
);

-- 5. UTE, OSE, internet y Gloria van a Servicios; Hogar queda para alquiler y cosas de la casa.
UPDATE expenses SET category = 'servicios' WHERE category = 'hogar' AND id IN (
  'ba99b929-d028-4c91-a0b0-4fb91e95be8f', -- 2026-07-07 1650 Internet
  'c4fbdbfd-80ac-4926-9783-5534c07a2e44', -- 2026-07-10 4825 Ute y saneamiento
  '920a2163-de76-46a8-84b9-23f0cece4745', -- 2026-07-10  730 Gloria
  '8199a816-189e-4720-8205-cf358727ce04', -- 2026-07-13  696 Ose
  '81fcbd6b-8c30-4a3e-837f-1744c8c75247', -- 2026-09-09 4328 Ute
  '89c4dcb6-402f-4eba-b572-48d6c76b4f39', -- 2026-09-09 1650 Internet
  'aed5e082-0f27-4956-8fd2-84eafebfd1ef'  -- 2026-09-09  774 Saneamiento
);

-- 4. Quién pagó los 25 gastos de pareja de julio ($64.776): se asigna desde la app
--    (lápiz → "¿Quién pagó?"), o acá si se acuerdan de todo junto:
-- UPDATE expenses SET created_by = (SELECT id FROM users WHERE name = 'Lucas')
--   WHERE couple_id IS NOT NULL AND created_by IS NULL AND id IN (...);

-- 6. Todo gasto de pareja nuevo tiene que tener quién lo cargó.
--    NOT VALID: se aplica desde ya a filas nuevas o editadas, sin fallar por las de julio.
--    Cuando julio esté asignado: ALTER TABLE expenses VALIDATE CONSTRAINT couple_expense_has_creator;
ALTER TABLE expenses
  ADD CONSTRAINT couple_expense_has_creator CHECK (couple_id IS NULL OR created_by IS NOT NULL) NOT VALID;

-- 7. couple_deposits ya no se usa, pero tiene 20 filas (jul–sep): se archiva en vez de borrarla.
ALTER TABLE couple_deposits RENAME TO couple_deposits_archivo_20261010;

-- Chequeo: tiene que dar 13 / 2 / 2 / 0
SELECT
  (SELECT count(*) FROM expenses_respaldo_20261010)
    - (SELECT count(*) FROM expenses)                                   AS borradas,
  (SELECT count(*) FROM expenses WHERE category = 'ahorro')             AS ahorro,
  (SELECT count(*) FROM expenses WHERE category = 'viajes')             AS viajes,
  (SELECT count(*) FROM expenses WHERE category = 'hogar'
     AND description ~* '(ute|ose|internet|gloria|saneamiento)')        AS servicios_en_hogar;

COMMIT;
