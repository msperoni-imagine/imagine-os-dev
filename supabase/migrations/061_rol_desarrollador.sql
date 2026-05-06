-- ============================================================
-- Migración 061: Rol "Desarrollador" (acceso global)
--
-- Añade un nuevo rol de sistema con nivel_acceso = 'global',
-- equivalente en permisos a Fundador / Socio / Administrador.
-- Pensado para perfiles técnicos que deben poder ver y editar
-- toda la información del holding.
-- ============================================================

INSERT INTO roles (id, nombre, descripcion, nivel_acceso) VALUES
  ('70000000-0000-0000-0000-000000000011', 'Desarrollador', 'Perfil técnico con acceso total a la plataforma', 'global')
ON CONFLICT (id) DO NOTHING;
