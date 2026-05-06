-- ============================================================
-- 058_oportunidades_seed.sql
-- Seed de 12 oportunidades comerciales para DME, distribuidas en
-- las distintas etapas del pipeline.
-- ============================================================

INSERT INTO oportunidades (
  empresa_id, empresa_grupo_id, titulo, valor_estimado,
  probabilidad_pct, etapa, fecha_cierre_estimada, fecha_cierre_real,
  motivo_perdida, responsable_id, descripcion
) VALUES
  -- ── Prospección (4) ──
  ('b062e195-8500-4644-9af3-339ce81fb132', '10000000-0000-0000-0000-000000000002',
   'Rediseño web e-commerce', 25000, 30, 'Prospección', '2026-07-15', NULL, NULL,
   '90000000-0000-0000-0000-000000000007', 'Migración a nueva plataforma con mejoras UX y SEO'),
  ('7439a0eb-1f12-4d47-8930-f52a251aedca', '10000000-0000-0000-0000-000000000002',
   'Campaña de verano 2026', 18000, 40, 'Prospección', '2026-06-30', NULL, NULL,
   '90000000-0000-0000-0000-000000000008', 'Performance + creatividades para el lanzamiento de la línea estival'),
  ('54e8c43f-714f-4341-9021-0b537d5327a7', '10000000-0000-0000-0000-000000000002',
   'Branding internacional', 35000, 25, 'Prospección', '2026-09-15', NULL, NULL,
   '90000000-0000-0000-0000-000000000002', 'Estrategia de marca para entrada en mercados europeos'),
  ('38ee9fe2-ef18-4ba5-bbe3-e0ed5ba87561', '10000000-0000-0000-0000-000000000002',
   'Web corporativa', 12000, 50, 'Prospección', '2026-06-15', NULL, NULL,
   '90000000-0000-0000-0000-000000000003', 'Renovación completa de la web actual'),

  -- ── Propuesta enviada (3) ──
  ('b44c9bbe-d4c7-460b-b66c-60e365734874', '10000000-0000-0000-0000-000000000002',
   'Estrategia social media Q3', 9000, 60, 'Propuesta enviada', '2026-06-01', NULL, NULL,
   '90000000-0000-0000-0000-000000000007', 'Plan editorial y community management para 3 redes'),
  ('df0de655-aa82-43ef-9bb9-99b67412bc80', '10000000-0000-0000-0000-000000000002',
   'Performance marketing 2026', 48000, 65, 'Propuesta enviada', '2026-05-30', NULL, NULL,
   '90000000-0000-0000-0000-000000000008', 'Plan anual de paid media multicanal'),
  ('d7df95de-a47e-49f4-816f-0f202ca3395f', '10000000-0000-0000-0000-000000000002',
   'Lanzamiento de nuevo producto', 22000, 55, 'Propuesta enviada', '2026-06-15', NULL, NULL,
   '90000000-0000-0000-0000-000000000002', 'Campaña 360 para el lanzamiento del nuevo título'),

  -- ── Negociación (2) ──
  ('99ff91b0-25d3-49b5-bb6e-9b23aaf79a66', '10000000-0000-0000-0000-000000000002',
   'Migración CMS', 15000, 75, 'Negociación', '2026-05-20', NULL, NULL,
   '90000000-0000-0000-0000-000000000003', 'Cambio de WordPress a una plataforma headless'),
  ('b062e195-8500-4644-9af3-339ce81fb132', '10000000-0000-0000-0000-000000000002',
   'Email automation', 8000, 70, 'Negociación', '2026-05-15', NULL, NULL,
   '90000000-0000-0000-0000-000000000007', 'Setup de flujos de email + integración con CRM'),

  -- ── Verbal (1) ──
  ('54e8c43f-714f-4341-9021-0b537d5327a7', '10000000-0000-0000-0000-000000000002',
   'Catálogo digital', 30000, 90, 'Verbal', '2026-05-10', NULL, NULL,
   '90000000-0000-0000-0000-000000000002', 'Cliente confirmó por teléfono, pendiente firmar contrato'),

  -- ── Cerrada ganada (1) ──
  ('7439a0eb-1f12-4d47-8930-f52a251aedca', '10000000-0000-0000-0000-000000000002',
   'Web rediseño 2025', 22000, 100, 'Cerrada ganada', '2026-03-10', '2026-03-15', NULL,
   '90000000-0000-0000-0000-000000000008', 'Proyecto cerrado con éxito tras 3 meses de negociación'),

  -- ── Cerrada perdida (1) ──
  ('38ee9fe2-ef18-4ba5-bbe3-e0ed5ba87561', '10000000-0000-0000-0000-000000000002',
   'Plan SEO 2026', 10000, 0, 'Cerrada perdida', '2026-04-01', NULL, 'Presupuesto insuficiente del cliente este año',
   '90000000-0000-0000-0000-000000000003', 'Cliente decidió posponer la inversión a 2027');
