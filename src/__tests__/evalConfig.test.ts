import { describe, it, expect, beforeEach } from 'vitest';
import {
    DEFAULT_EVALUATION_WEIGHTS,
    getEvaluationWeights,
    saveEvaluationWeights,
    calculateAttendanceGradeFromAbsenteeism,
} from '../lib/evalConfig';

describe('Configuración de Porcentajes de Evaluación', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('Retorna valores MEP por defecto cuando no hay configuración guardada', () => {
        expect(getEvaluationWeights()).toEqual(DEFAULT_EVALUATION_WEIGHTS);
    });

    it('Guarda y recupera configuración personalizada cuando suma 100%', () => {
        const custom = { asistencia: 10, cotidiano: 40, tareas: 15, examenes: 35 };
        saveEvaluationWeights(custom);
        expect(getEvaluationWeights()).toEqual(custom);
    });

    it('Vuelve a los valores por defecto si los datos guardados no suman 100%', () => {
        localStorage.setItem(
            'mep_2026_evaluation_weights',
            JSON.stringify({ asistencia: 10, cotidiano: 40, tareas: 10, examenes: 20 })
        );
        expect(getEvaluationWeights()).toEqual(DEFAULT_EVALUATION_WEIGHTS);
    });

    it('Escala la nota de asistencia manteniendo los tramos MEP para 5%', () => {
        expect(calculateAttendanceGradeFromAbsenteeism(0, 5)).toBe(5);
        expect(calculateAttendanceGradeFromAbsenteeism(9.9, 5)).toBe(5);
        expect(calculateAttendanceGradeFromAbsenteeism(15, 5)).toBe(4);
        expect(calculateAttendanceGradeFromAbsenteeism(25, 5)).toBe(3);
        expect(calculateAttendanceGradeFromAbsenteeism(35, 5)).toBe(2);
        expect(calculateAttendanceGradeFromAbsenteeism(45, 5)).toBe(1);
        expect(calculateAttendanceGradeFromAbsenteeism(50, 5)).toBe(0);
    });

    it('Escala la nota de asistencia manteniendo los tramos MEP para porcentaje personalizado (ej. 10%)', () => {
        expect(calculateAttendanceGradeFromAbsenteeism(5, 10)).toBe(10);
        expect(calculateAttendanceGradeFromAbsenteeism(15, 10)).toBe(8);
        expect(calculateAttendanceGradeFromAbsenteeism(25, 10)).toBe(6);
        expect(calculateAttendanceGradeFromAbsenteeism(35, 10)).toBe(4);
        expect(calculateAttendanceGradeFromAbsenteeism(45, 10)).toBe(2);
        expect(calculateAttendanceGradeFromAbsenteeism(55, 10)).toBe(0);
    });
});
