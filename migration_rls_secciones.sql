-- Corregir permisos de la tabla secciones para permitir creación automática
DROP POLICY IF EXISTS "Public read sections" ON secciones;
CREATE POLICY "Public full access sections" ON secciones FOR ALL USING (true) WITH CHECK (true);
