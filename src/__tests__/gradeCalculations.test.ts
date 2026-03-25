import { describe, it, expect, vi } from 'vitest';
import { validateGradeInput, calculatePeriodContribution, calculateAnnualGrade } from '../lib/gradeCalculations';

describe('QA Test Plan: Registro de Notas - Asistencia App', () => {

    describe('1. Pruebas de Validación de Datos (Inputs)', () => {

        it('[TC-IN-01] Validar límites numéricos válidos', () => {
            expect(validateGradeInput(0)).toBe(0);
            expect(validateGradeInput(50)).toBe(50);
            expect(validateGradeInput(100)).toBe(100);
        });

        it('[TC-IN-02] Rechazo de valores numéricos negativos', () => {
            expect(validateGradeInput(-10)).toBe(0); // Según el plan, ajustado a 0
            expect(validateGradeInput(-1)).toBe(0);
        });

        it('[TC-IN-03] Rechazo de valores que excedan el límite (> 100)', () => {
            expect(() => validateGradeInput(105)).toThrow("Invalid input: cannot exceed 100");
            expect(() => validateGradeInput(101)).toThrow("Invalid input: cannot exceed 100");
        });

        it('[TC-IN-04] Manejo de caracteres alfanuméricos y especiales', () => {
            expect(() => validateGradeInput("ochenta")).toThrow("Invalid input: must be a valid number");
            expect(() => validateGradeInput("$")).toThrow("Invalid input: must be a valid number");
            expect(() => validateGradeInput("AB")).toThrow("Invalid input: must be a valid number");
        });

        it('[TC-IN-05] Manejo de campos vacíos o nulos', () => {
            expect(validateGradeInput("")).toBe(0);
            expect(validateGradeInput("  ")).toBe(0);
            expect(validateGradeInput(null)).toBe(0);
            expect(validateGradeInput(undefined)).toBe(0);
        });
    });

    describe('2. Pruebas de Lógica de Negocio y Cálculo', () => {

        it('[TC-BL-01] Ponderación del 50% exacta para el periodo', () => {
            expect(calculatePeriodContribution(80)).toBe(40);
            expect(calculatePeriodContribution(90)).toBe(45);
            expect(calculatePeriodContribution(100)).toBe(50);
            expect(calculatePeriodContribution(0)).toBe(0);
        });

        it('[TC-BL-02] Aprobación estándar (Total: 70)', () => {
            const { finalGrade, status } = calculateAnnualGrade(80, 60);
            expect(finalGrade).toBe(70);
            expect(status).toBe('Aprobado');
        });

        it('[TC-BL-03] Aprobación holgada', () => {
            const { finalGrade, status } = calculateAnnualGrade(90, 100);
            expect(finalGrade).toBe(95);
            expect(status).toBe('Aprobado');
        });

        it('[TC-BL-04] Reprobación estándar (Total: 65 => Aplazado)', () => {
            // Nota: En Costa Rica MEP, entre 60 y 69 es 'Aplazado', menor a 60 es 'Reprobado'
            const { finalGrade, status } = calculateAnnualGrade(50, 80);
            expect(finalGrade).toBe(65);
            expect(status).toBe('Aplazado');
        });

        it('[TC-BL-05] Reprobación severa', () => {
            const { finalGrade, status } = calculateAnnualGrade(40, 30);
            expect(finalGrade).toBe(35);
            expect(status).toBe('Reprobado');
        });

        it('[TC-BL-06] Límite exacto de aprobación (70 y 70)', () => {
            const { finalGrade, status } = calculateAnnualGrade(70, 70);
            expect(finalGrade).toBe(70);
            expect(status).toBe('Aprobado');
        });

        it('[TC-BL-07] Límite exacto de aprobación asimétrico', () => {
            const { finalGrade, status } = calculateAnnualGrade(69, 71);
            expect(finalGrade).toBe(70);
            expect(status).toBe('Aprobado');
        });

        it('[TC-BL-08] Nota mínima absoluta', () => {
            const { finalGrade, status } = calculateAnnualGrade(0, 0);
            expect(finalGrade).toBe(0);
            expect(status).toBe('Reprobado');
        });

        it('[TC-BL-09] Nota máxima absoluta', () => {
            const { finalGrade, status } = calculateAnnualGrade(100, 100);
            expect(finalGrade).toBe(100);
            expect(status).toBe('Aprobado');
        });

        it('[TC-BL-10] Redondeos: 69.5 => 70', () => {
            // P1: 69 => 34.5, P2: 70 => 35
            // Total = 69.5 -> Math.round -> 70 Aprobado
            const { finalGrade, status } = calculateAnnualGrade(69, 70);
            expect(finalGrade).toBe(70);
            expect(status).toBe('Aprobado');
        });
        
    });

});
