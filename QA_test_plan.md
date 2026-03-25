# QA Test Plan: Registro de Notas - Asistencia App

## 1. Contexto y Objetivos
Este documento define la estrategia y los casos de prueba automatizados para validar el cálculo de notas de los estudiantes, garantizando que cumplan con la lógica de negocio establecida:
- El año se divide en **dos periodos**.
- Cada periodo representa el **50%** de la nota final.
- La condición de aprobación es que la nota anual (suma de las notas ponderadas de ambos periodos) sea **>= 70**.

Las pruebas automatizadas se desarrollarán utilizando **Vitest** y **React Testing Library**, ya que es el estándar más adecuado para proyectos basados en Vite y React.

---

## 2. Casos de Prueba a Desarrollar

### 2.1 Pruebas de Validación de Datos (Inputs)
Asegurar la robustez del sistema frente a datos de entrada en formularios o cálculos de componentes.

- **[TC-IN-01] Validar límites numéricos válidos:** El sistema debe aceptar exclusivamente valores entre 0 y 100 en los campos de puntuación o porcentaje.
- **[TC-IN-02] Rechazo de valores numéricos negativos:** Ingresar un valor de nota igual a `-10` debe mostrar un error de validación o ser ajustado a 0.
- **[TC-IN-03] Rechazo de valores que excedan el límite:** Ingresar una nota de `105` o puntos mayores a los puntos totales debe ser marcado como inválido.
- **[TC-IN-04] Manejo de caracteres alfanuméricos y especiales:** El ingreso de texto (`"ochenta"`, `"AB"`) o símbolos (`"$"`, `"&"`) no debe romper la aplicación ni generar `NaN` en cálculos; el sistema debe prevenir el ingreso o arrojar validación en pantalla.
- **[TC-IN-05] Manejo de campos vacíos:** Si el usuario deja la calificación en blanco/nulo, el sistema debe tomarlo como 0 o exigir completarlo antes de guardar.

### 2.2 Pruebas de Lógica de Negocio y Cálculo
Verificar que la lógica de ponderación y el resultado final para "Aprobado", "Aplazado" o "Reprobado" funcionen correctamente. 

**Cálculo de Periodo (1er y 2do Periodo)**
- **[TC-BL-01] Ponderación del 50% exacta:** Si el estudiante obtiene un 80 final en el Periodo 1, el aporte al anual debe ser de 40.

**Aprobación (>= 70)**
- **[TC-BL-02] Aprobación estándar:** Periodo 1: 80 (Aporta 40), Periodo 2: 60 (Aporta 30). Total: 70 -> **Aprobado**.
- **[TC-BL-03] Aprobación holgada:** Periodo 1: 90, Periodo 2: 100. Total: 95 -> **Aprobado**.

**Reprobación (< 70)**
- **[TC-BL-04] Reprobación estándar:** Periodo 1: 50 (Aporta 25), Periodo 2: 80 (Aporta 40). Total: 65 -> **Reprobado**.
- **[TC-BL-05] Reprobación severa:** Periodo 1: 40, Periodo 2: 30. Total: 35 -> **Reprobado**.

**Casos Límite (Edge Cases)**
- **[TC-BL-06] Límite exacto de aprobación (70):** Periodo 1: 70, Periodo 2: 70. Total: 70 -> **Aprobado**.
- **[TC-BL-07] Límite exacto de aprobación asimétrico:** Periodo 1: 69, Periodo 2: 71. Total: 70 -> **Aprobado**.
- **[TC-BL-08] Nota mínima absoluta:** Periodo 1: 0, Periodo 2: 0. Total: 0 -> **Reprobado**.
- **[TC-BL-09] Nota máxima absoluta:** Periodo 1: 100, Periodo 2: 100. Total: 100 -> **Aprobado**.
- **[TC-BL-10] Redondeos:** Verificar casos donde la fracción decimal dé por ejemplo 69.5 -> El sistema asume 70 (Aprobado) o lo mantiene en 69.5 (Reprobado) según la regla específica de truncamiento/redondeo.

---

## 3. Estrategia de Implementación
1. **Instalación:** Instalar y configurar `vitest` + `@testing-library/react` + `jsdom`.
2. **Refactorización:** Si los cálculos (como promedios y aportes) se encuentran acoplados en los componentes de React, extraerlos a una función utilitaria en `src/lib/gradeCalculations.ts` para poder realizar *Unit Tests* puros.
3. **Desarrollo de Unit Tests:** Escribir los tests especificados para las funciones de cálculo.
4. **Desarrollo de Integration/Component Tests:** Escribir tests en los componentes (por ejemplo: formulario de Trabajo Cotidiano y Tablas de Reporte Final) para verificar el despliegue del color verde (Aprobado) y rojo (Reprobado).
5. **Ejecución y CI/CD:** Correr la suite hasta alcanzar éxito. Si se detectan bugs en el código actual (p. ej., un componente que ignora los redondeos), serán documentados y reparados autónomamente.
