# Sistema de Control de Asistencia y Notas - MEP 2026

Este proyecto es una aplicación web profesional diseñada para automatizar la gestión administrativa de los docentes bajo la normativa MEP 2026. Permite el control total de asistencia, evaluaciones de trabajo cotidiano, tareas, exámenes y la generación de reportes consolidados.

## Características Principales

*   **Gestión de Estudiantes**: Registro automatizado con lógica de cédula y correo institucional MEP.
*   **Asistencia Inteligente**: Control diario con lecciones variables y cálculo automático del 5% basado en la escala oficial de ausentismo del MEP.
*   **Evaluación Continua**: Módulos para Trabajo Cotidiano (35%), Tareas (10%) y Exámenes (50%) con rúbricas detalladas.
*   **Reportes Consolidados**: Generación de "sábanas" de notas finales con exportación a Excel (CSV) y vista de impresión profesional.
*   **Interfaz Premium**: Diseño moderno, responsive y optimizado para una experiencia de usuario fluida.

## Requisitos Previos

1.  **Node.js**: Debe tener instalado Node.js (versión 18 o superior recomendada). Puede descargarlo en [nodejs.org](https://nodejs.org/).
2.  **Git** (Opcional): Para clonar el repositorio.

## Pasos para la Instalación

1.  **Obtener el Código**:
    *   Si usa Git: `git clone <url-del-repositorio>`
    *   Si tiene una carpeta: Copie la carpeta completa del proyecto (excepto la carpeta `node_modules`).

2.  **Instalar Dependencias**:
    Abra una terminal en la carpeta del proyecto y ejecute:
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno**:
    *   Cree un archivo llamado `.env` en la raíz del proyecto.
    *   Copie el contenido de `.env.example` al archivo `.env`.
    *   Reemplace los valores con sus credenciales de Supabase:
        ```env
        VITE_SUPABASE_URL=su_url_de_supabase
        VITE_SUPABASE_ANON_KEY=su_llave_anon_de_supabase
        ```

4.  **Ejecutar en Modo Desarrollo**:
    Para iniciar la aplicación localmente, ejecute:
    ```bash
    npm run dev
    ```
    La aplicación estará disponible usualmente en `http://localhost:5173`.

5.  **Construir para Producción** (Opcional):
    Si desea generar los archivos para desplegar en un servidor real:
    ```bash
    npm run build
    ```
    Esto creará una carpeta `dist` lista para ser servida.

## Notas Importantes
*   Asegúrese de que la base de datos de Supabase tenga las tablas necesarias ejecutando el script `supabase_schema.sql` en el SQL Editor de Supabase si es una base de datos nueva.
