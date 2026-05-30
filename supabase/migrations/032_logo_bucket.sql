-- Migration 032: Criar bucket de logos no Supabase Storage
-- Data: 2026-05-30
-- Descrição: Bucket para armazenar logos de empresas com RLS

-- Criar bucket logos (público, para URLs públicas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 2097152, ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- RLS: Dono/Admin da empresa pode fazer upload
CREATE POLICY "logo_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND auth.jwt() ->> 'user_id' IS NOT NULL);

-- RLS: Dono/Admin pode atualizar
CREATE POLICY "logo_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos' AND auth.jwt() ->> 'user_id' IS NOT NULL)
  WITH CHECK (bucket_id = 'logos');

-- RLS: Dono/Admin pode deletar
CREATE POLICY "logo_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND auth.jwt() ->> 'user_id' IS NOT NULL);

-- RLS: Público pode ler (necessário para ver os logos)
CREATE POLICY "logo_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');
