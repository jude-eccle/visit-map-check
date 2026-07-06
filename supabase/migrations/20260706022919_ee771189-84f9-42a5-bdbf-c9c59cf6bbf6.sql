
CREATE POLICY "public read map images" ON storage.objects FOR SELECT USING (bucket_id = 'map-images');
CREATE POLICY "public insert map images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'map-images');
CREATE POLICY "public delete map images" ON storage.objects FOR DELETE USING (bucket_id = 'map-images');
