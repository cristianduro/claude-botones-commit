---
name: commit-push
description: Commit y push de los cambios pendientes en cada repositorio git de la sesión, con el usuario como único autor (sin coautoría de Claude). Úsala SIEMPRE que el usuario envíe «Ejecutando acción del usuario: Commit + Push» (el botón Commit + Push), o cuando escriba /botones-commit:commit-push.
argument-hint: "[rama]"
---

# Commit y push a petición del usuario

El usuario ha pulsado el botón «Commit + Push» (mensaje «Ejecutando acción del usuario: Commit + Push (rama X)») o ha escrito la orden: es su petición expresa de commit y push.

**Rama:** el mensaje trae entre paréntesis la rama que el botón mostraba para el directorio de trabajo principal (o va en los argumentos: `$ARGUMENTS`). Antes de nada, compruébala con `git rev-parse --abbrev-ref HEAD` en ese directorio: si no coincide, **no hagas nada** y avisa al usuario de la rama real.

**Si el proyecto tiene su propia orden** (`.claude/skills/commit-push/SKILL.md` o `.claude/skills/commit/SKILL.md`) o reglas de commit en `CLAUDE.md`, léelas y síguelas en lugar de lo de abajo.

Hazlo en **cada repositorio git de la sesión**: el directorio de trabajo principal y los directorios añadidos, uno por uno, cada uno con su commit y su push.

## Pasos

1. `git status --short` y `git diff --stat`. Si no hay nada que guardar pero la rama va por delante de `origin`, pasa al push; si tampoco, dilo y termina.
2. Añade los archivos por su nombre, nunca con `git add -A` a ciegas. Deja fuera compilaciones, temporales, credenciales y `.env`, y avisa.
3. Si el proyecto tiene comprobaciones (tests, lint) y hay código sin comprobar en esta sesión, pásalas antes. Si fallan, no hay commit ni push: cuenta qué falla.
4. Mensaje en el idioma de los commits recientes (`git log -5 --oneline`): primera línea corta (hasta 60 caracteres) y, si hay varios cambios, una lista breve. **Sin `Co-Authored-By: Claude…` ni «Generated with Claude Code»**: el autor es solo el usuario.
5. Commit con su configuración de git, sin cambiar `user.name` ni `user.email`, sin `--amend` ni `--no-verify`.
6. Push de la rama actual (`git push`, o `git push -u origin <rama>` si no tiene remota). **Nunca** `--force` ni `--force-with-lease`. Si se rechaza porque `origin` tiene commits nuevos, no fuerces ni mezcles: cuéntalo.
7. Cuenta en dos o tres líneas el hash, el mensaje, la rama y que está en GitHub.
