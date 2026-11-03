Set WshShell = CreateObject("WScript.Shell")
' Establecer el directorio de trabajo en la carpeta donde esta este archivo VBS
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptPosition)

' Ejecutar "npm run dev" de forma invisible (el parametro 0 oculta la ventana)
WshShell.Run "cmd.exe /c npm run dev", 0, False

' Esperar 2.5 segundos para dar tiempo a que el servidor local de Vite se inicie
WScript.Sleep 2500

' Abrir Chrome en modo aplicacion apuntando al puerto de desarrollo local (5173)
WshShell.Run "chrome.exe --app=http://localhost:5173", 1, False
