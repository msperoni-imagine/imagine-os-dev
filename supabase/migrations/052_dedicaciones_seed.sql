-- ============================================================
-- 052_dedicaciones_seed.sql
-- Seed de 20 dedicaciones de ejemplo para DME.
-- Mix de tipos (Facturable / No facturable / Interno / Formación),
-- estados (Borrador / Enviado / Aprobado) y personas.
-- Fechas: marzo y abril 2026 (mes en curso al 22-abr-2026).
-- ============================================================

INSERT INTO dedicaciones (
  persona_id, orden_trabajo_id, proyecto_id,
  fecha, horas, tipo, estado, aprobado_por_id, descripcion
) VALUES
  -- 1. Ainhoa B — Facturable, Aprobado
  ('90000000-0000-0000-0000-000000000047', '253a65cb-05c8-4db5-8d96-f44b15f955f8', '71fb2fcf-7099-4b17-940a-04f3f7439240',
   '2026-03-25', 6.0, 'Facturable', 'Aprobado', '90000000-0000-0000-0000-000000000042', 'Configuración inicial del flow de automatización'),
  -- 2. Ainhoa B — Facturable, Aprobado
  ('90000000-0000-0000-0000-000000000047', '253a65cb-05c8-4db5-8d96-f44b15f955f8', '71fb2fcf-7099-4b17-940a-04f3f7439240',
   '2026-03-26', 7.0, 'Facturable', 'Aprobado', '90000000-0000-0000-0000-000000000042', 'Tests de integración'),
  -- 3. Ainoha Castelló — Facturable, Enviado
  ('c00ac986-6fd3-4188-bc6f-70ebc63b3fbb', '042e2189-839f-41b0-8a4e-67837678e552', '378d506a-ff86-436c-8ae4-abb19e6db36c',
   '2026-03-30', 4.5, 'Facturable', 'Enviado', NULL, 'Revisión de webhooks'),
  -- 4. Alba C — Facturable, Aprobado
  ('90000000-0000-0000-0000-000000000013', '577cca33-81f4-4217-bc07-b0629d1dcc05', 'cb995ded-8bcc-4408-8fb2-388b02009a09',
   '2026-04-01', 8.0, 'Facturable', 'Aprobado', '90000000-0000-0000-0000-000000000042', 'Implementación del flujo A'),
  -- 5. Alba C — Facturable, Enviado
  ('90000000-0000-0000-0000-000000000013', '577cca33-81f4-4217-bc07-b0629d1dcc05', 'cb995ded-8bcc-4408-8fb2-388b02009a09',
   '2026-04-02', 6.0, 'Facturable', 'Enviado', NULL, 'Depuración del flujo A'),
  -- 6. Alba M — Facturable, Enviado
  ('90000000-0000-0000-0000-000000000050', 'fa61dd5c-cf0f-412e-813e-eee8af955dac', 'a2511295-7b70-44f4-948e-33bde3e1bd9b',
   '2026-04-03', 5.0, 'Facturable', 'Enviado', NULL, 'Setup automation VC'),
  -- 7. Alejandro R — Facturable, Aprobado
  ('90000000-0000-0000-0000-000000000008', 'a515b738-fc15-447d-aa22-9d11f6f03aed', '8ef63a9a-8df0-4095-b2f5-4799b4e97889',
   '2026-04-06', 7.0, 'Facturable', 'Aprobado', '90000000-0000-0000-0000-000000000042', 'Gestión bandeja prioritaria'),
  -- 8. Alejandro R — No facturable, Enviado
  ('90000000-0000-0000-0000-000000000008', 'a515b738-fc15-447d-aa22-9d11f6f03aed', '8ef63a9a-8df0-4095-b2f5-4799b4e97889',
   '2026-04-07', 6.0, 'No facturable', 'Enviado', NULL, 'Incidencia fuera de partida — extra goodwill'),
  -- 9. Alejo P — Facturable, Enviado
  ('90000000-0000-0000-0000-000000000048', 'cc7c93a3-a2e5-4526-8c07-7943d12c4b2a', '71fb2fcf-7099-4b17-940a-04f3f7439240',
   '2026-04-08', 4.0, 'Facturable', 'Enviado', NULL, 'Documentación del flujo'),
  -- 10. Alejo P — Facturable, Borrador
  ('90000000-0000-0000-0000-000000000048', 'a2dabcfe-8748-44ef-a208-2da6bf2ea8c2', '378d506a-ff86-436c-8ae4-abb19e6db36c',
   '2026-04-09', 8.0, 'Facturable', 'Borrador', NULL, 'Desarrollo endpoint'),
  -- 11. Alexandra D — Facturable, Aprobado
  ('90000000-0000-0000-0000-000000000042', '6ede27ab-3eab-40f5-8156-234cf416f339', '07effa4a-13d2-4cc3-8167-094b08f409c9',
   '2026-04-10', 6.0, 'Facturable', 'Aprobado', '90000000-0000-0000-0000-000000000042', 'QA del release'),
  -- 12. Alexandra D — Interno, Enviado (sin OT)
  ('90000000-0000-0000-0000-000000000042', NULL, NULL,
   '2026-04-13', 2.0, 'Interno', 'Enviado', NULL, 'Reunión interna de planificación semanal'),
  -- 13. Amparo M — Facturable, Enviado
  ('90000000-0000-0000-0000-000000000054', 'b9edf763-346e-4260-ae6b-c9542b494f4d', '4531f06e-25c0-4cb4-b86a-5dfaa35d6ef4',
   '2026-04-13', 8.0, 'Facturable', 'Enviado', NULL, 'Configuración CRM — fase 1'),
  -- 14. Amparo M — Facturable, Enviado
  ('90000000-0000-0000-0000-000000000054', 'b9edf763-346e-4260-ae6b-c9542b494f4d', '4531f06e-25c0-4cb4-b86a-5dfaa35d6ef4',
   '2026-04-14', 4.0, 'Facturable', 'Enviado', NULL, 'Tests CRM'),
  -- 15. Ainhoa B — Interno, Borrador (sin OT)
  ('90000000-0000-0000-0000-000000000047', NULL, NULL,
   '2026-04-15', 3.0, 'Interno', 'Borrador', NULL, 'Onboarding nuevo compañero'),
  -- 16. Alba C — Formación, Enviado (sin OT)
  ('90000000-0000-0000-0000-000000000013', NULL, NULL,
   '2026-04-16', 2.0, 'Formación', 'Enviado', NULL, 'Curso TypeScript avanzado'),
  -- 17. Alejandro R — Formación, Borrador (sin OT)
  ('90000000-0000-0000-0000-000000000008', NULL, NULL,
   '2026-04-17', 1.5, 'Formación', 'Borrador', NULL, 'Workshop Supabase RLS'),
  -- 18. Alba M — Facturable, Borrador
  ('90000000-0000-0000-0000-000000000050', '52a80fe6-5602-4a22-9488-c375f621294c', 'c0ad2aac-5d0d-411b-87c4-705fb30ba3d4',
   '2026-04-20', 6.0, 'Facturable', 'Borrador', NULL, 'Integración API cliente'),
  -- 19. Ainoha Castelló — No facturable, Borrador
  ('c00ac986-6fd3-4188-bc6f-70ebc63b3fbb', '042e2189-839f-41b0-8a4e-67837678e552', '378d506a-ff86-436c-8ae4-abb19e6db36c',
   '2026-04-20', 2.0, 'No facturable', 'Borrador', NULL, 'Ajuste fuera de partida'),
  -- 20. Alejo P — Interno, Borrador (sin OT)
  ('90000000-0000-0000-0000-000000000048', NULL, NULL,
   '2026-04-21', 4.0, 'Interno', 'Borrador', NULL, 'Revisión de documentación interna');
