/**
 * Módulo de cálculos de notas para uso en la aplicación y testing aislado.
 */

export const validateGradeInput = (input: any): number => {
    if (input === null || input === undefined || input === '') return 0;
    if (typeof input === 'string' && input.trim() === '') return 0;
    
    const num = Number(input);
    
    if (isNaN(num)) throw new Error("Invalid input: must be a valid number");
    if (num < 0) return 0; // Rechazo números negativos ajustándolos a 0 (TC-IN-02)
    if (num > 100) throw new Error("Invalid input: cannot exceed 100"); // Limitar a 100 (TC-IN-03)
    
    return num;
};

export const calculatePeriodContribution = (grade: number): number => {
    const validGrade = validateGradeInput(grade);
    return Number((validGrade * 0.5).toFixed(2));
};

export const calculateAnnualGrade = (period1: any, period2: any): { finalGrade: number, status: string } => {
    const contrib1 = calculatePeriodContribution(period1);
    const contrib2 = calculatePeriodContribution(period2);
    
    const total = Math.round(contrib1 + contrib2);
    
    return {
        finalGrade: total,
        status: total >= 70 ? 'Aprobado' : (total >= 60 ? 'Aplazado' : 'Reprobado')
    };
};
