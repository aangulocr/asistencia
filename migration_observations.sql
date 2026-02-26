-- Migration: Add 'observaciones' column to configuracion_diaria
ALTER TABLE configuracion_diaria ADD COLUMN observaciones TEXT;
