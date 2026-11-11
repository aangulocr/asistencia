import { useState, useEffect } from 'react';

export interface EvaluationWeights {
    asistencia: number;
    cotidiano: number;
    tareas: number;
    examenes: number;
}

export const DEFAULT_EVALUATION_WEIGHTS: EvaluationWeights = {
    asistencia: 5,
    cotidiano: 35,
    tareas: 10,
    examenes: 50,
};

const STORAGE_KEY = 'mep_2026_evaluation_weights';
const CONFIG_EVENT = 'evaluation-weights-updated';

export function getEvaluationWeights(): EvaluationWeights {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_EVALUATION_WEIGHTS };
        const parsed = JSON.parse(raw);
        const asistencia = Number(parsed.asistencia);
        const cotidiano = Number(parsed.cotidiano);
        const tareas = Number(parsed.tareas);
        const examenes = Number(parsed.examenes);

        if (
            [asistencia, cotidiano, tareas, examenes].some(
                (v) => isNaN(v) || v < 0 || v > 100
            )
        ) {
            return { ...DEFAULT_EVALUATION_WEIGHTS };
        }

        const total = Number((asistencia + cotidiano + tareas + examenes).toFixed(2));
        if (Math.abs(total - 100) > 0.01) {
            return { ...DEFAULT_EVALUATION_WEIGHTS };
        }

        return { asistencia, cotidiano, tareas, examenes };
    } catch {
        return { ...DEFAULT_EVALUATION_WEIGHTS };
    }
}

export function saveEvaluationWeights(weights: EvaluationWeights): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
    window.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: weights }));
}

export function useEvaluationWeights(): EvaluationWeights {
    const [weights, setWeights] = useState<EvaluationWeights>(() => getEvaluationWeights());

    useEffect(() => {
        const handleUpdate = () => setWeights(getEvaluationWeights());
        window.addEventListener(CONFIG_EVENT, handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener(CONFIG_EVENT, handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, []);

    return weights;
}

/**
 * Calcula la nota obtenida en asistencia manteniendo los tramos oficiales MEP
 * (<10%, <20%, <30%, <40%, <50%, >=50%) escalados al porcentaje configurado.
 */
export function calculateAttendanceGradeFromAbsenteeism(
    absenteeismPercentage: number,
    maxAttendanceWeight: number
): number {
    let baseFactor = 0;
    if (absenteeismPercentage < 10) baseFactor = 1;       // 5 / 5
    else if (absenteeismPercentage < 20) baseFactor = 0.8; // 4 / 5
    else if (absenteeismPercentage < 30) baseFactor = 0.6; // 3 / 5
    else if (absenteeismPercentage < 40) baseFactor = 0.4; // 2 / 5
    else if (absenteeismPercentage < 50) baseFactor = 0.2; // 1 / 5
    else baseFactor = 0;

    return Number((baseFactor * maxAttendanceWeight).toFixed(2));
}
