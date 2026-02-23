---
description: Cómo instalar y ejecutar el proyecto en una nueva computadora
---

1. Instalar Node.js desde [nodejs.org](https://nodejs.org/).
2. Copiar la carpeta del proyecto a la nueva computadora.
3. Abrir una terminal en la carpeta del proyecto.
4. Instalar las dependencias de Node.js:
```powershell
npm install
```
5. Si no existe el archivo `.env`, crearlo basado en `.env.example` y configurar las credenciales de Supabase.
6. Ejecutar la aplicación:
```powershell
npm run dev
```
7. Abrir el navegador en la dirección que indique la terminal (ej. `http://localhost:5173`).
