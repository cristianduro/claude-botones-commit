# botones-commit

Un botón **Commit + Push ↑** encima del cuadro de texto de Claude Code. Al pulsarlo envía `/commit-push`, como si lo hubieras escrito.

- **✕** a su derecha lo cierra, pidiendo confirmación. Lo cerrado se recuerda entre sesiones.
- **`/commit-boton`** lo vuelve a mostrar.
- No gasta nada mientras está visible: solo cuenta el turno que lanza al pulsarlo.

## Requisito

Una orden `/commit-push` en el proyecto o en tu carpeta de usuario (`.claude/skills/commit-push/SKILL.md`). El plugin solo pone el botón; no incluye la orden.

## Instalación

En una sesión de Claude Code en terminal:

```
/plugin install botones-commit --marketplace <tu-usuario>/<este-repositorio>
```

Responde `y` a «Add marketplace?» y elige el ámbito (user). Queda activo al momento y en las sesiones siguientes.

Para probarlo sin instalar: `claude --plugin-dir <carpeta-del-repositorio>`.
