# botones-commit

Un botón **Commit + Push ↑** encima del cuadro de texto de Claude Code. Al pulsarlo envía a Claude, como si lo hubieras escrito tú, el pedido de hacer commit (tú como único autor, sin coautoría de Claude) y push de la rama, sin `--force`. Si el proyecto tiene su propio `.claude/skills/commit-push/` o reglas de commit en `CLAUDE.md`, las sigue. La misma orden está también como `/botones-commit:commit-push`.

- **✕** a su derecha lo cierra, pidiendo confirmación. Lo cerrado se recuerda entre sesiones.
- **`/commit-boton`** lo vuelve a mostrar.
- No gasta nada mientras está visible: solo cuenta el turno que lanza al pulsarlo.

## Instalación

En una sesión de Claude Code en terminal:

```
/plugin install botones-commit --marketplace <tu-usuario>/<este-repositorio>
```

Responde `y` a «Add marketplace?» y elige el ámbito (user). Queda activo al momento y en las sesiones siguientes.

Para probarlo sin instalar: `claude --plugin-dir <carpeta-del-repositorio>`.
