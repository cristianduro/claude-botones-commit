---
name: commit-push
description: Hace commit de los cambios con el usuario como único autor (sin coautoría de Claude) y sube la rama a GitHub. Solo cuando el usuario escribe /botones-commit:commit-push o pulsa el botón «Commit + Push».
disable-model-invocation: true
---

# Commit y push a petición del usuario

El usuario ha pulsado el botón «Commit + Push» (o escrito la orden): es su petición expresa de commit y push.

**Si el proyecto tiene su propia orden** (`.claude/skills/commit-push/SKILL.md` o `.claude/skills/commit/SKILL.md`) o reglas de commit en `CLAUDE.md`, léelas y síguelas en lugar de lo de abajo.

## Pasos

1. `git status --short` y `git diff --stat` (y `git diff` de lo necesario para entenderlo). Si no hay nada que guardar pero la rama va por delante de `origin`, pasa directamente al push; si tampoco, dilo y termina.
2. Añade los archivos por su nombre, nunca con `git add -A` a ciegas. Deja fuera lo que no sea del proyecto (compilaciones, temporales, credenciales, `.env`) y avisa.
3. Si el proyecto tiene comprobaciones (`npm test`, un script de lint…) y hay cambios de código sin comprobar en esta sesión, pásalas antes. Si fallan, no hay commit ni push: cuenta qué falla.
4. Mensaje en el idioma de los commits recientes del proyecto (`git log -5 --oneline`): primera línea corta (≤ 60 caracteres) y, si hay varios cambios, una lista breve de qué cambió. **Sin `Co-Authored-By: Claude…` ni «Generated with Claude Code»**: el autor es solo el usuario.
5. Commit con su configuración de git (sin cambiar `user.name`/`user.email`), mensaje por `git commit -F` o heredoc. Sin `--amend` ni `--no-verify`.
6. Push de la rama actual: `git push` si ya tiene rama remota, `git push -u origin <rama>` si no. **Nunca** `--force` ni `--force-with-lease`, ni a otra rama. Si el push se rechaza porque `origin` tiene commits nuevos, no fuerces ni mezcles: cuéntalo y déjalo al usuario.
7. Cuenta en dos o tres líneas: hash y mensaje del commit, rama y que está en GitHub.
