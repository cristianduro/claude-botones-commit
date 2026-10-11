# botones-commit

Un botón encima del cuadro de texto de Claude Code que hace **commit y push** con un clic.

```
[⎇ main]  [Commit + Push ↑]                                           ✕
```

## Qué hace

Al pulsarlo lanza la orden del plugin `/botones-commit:commit-push rama=<rama>` (en la conversación solo se ve esa línea). La orden pide a Claude:

1. revisar los cambios pendientes de **cada repositorio git de la sesión** (el directorio principal y los añadidos);
2. pasar las comprobaciones del proyecto (tests, lint) si hay código sin comprobar;
3. hacer el commit con **tu usuario como único autor** (sin coautoría de Claude), con un mensaje en el idioma de tus commits;
4. hacer **push** de la rama, nunca con `--force`.

Si el proyecto tiene su propia orden (`.claude/skills/commit-push/` o `.claude/skills/commit/`) o reglas de commit en `CLAUDE.md`, las sigue en lugar de las suyas.

### Lo que verás en el botón

A la izquierda, la rama actual en gris: solo informa y no se pulsa. Se actualiza sola cada 2 s si cambias de rama. Al pulsar, el botón vuelve a mirar la rama: si ya no es la que se ve, no envía nada y te avisa para que la revises.

A su lado, el botón:

| Estado | Botón |
| --- | --- |
| En reposo | `⎇ main` `─●─ Commit + Push ↑` |
| Revisando los cambios (no responde a clics) | `⎇ main` `⠋ Comprobando` |
| Hay cambios: commit y push en marcha | `⎇ main` `⠋ Subiendo` |
| Subido (6 s) | `⎇ main` `✓ Subido 712c6b1` |
| No había nada que subir (6 s) | `⎇ main` `— Nada que subir` |
| Algo falló (hasta pulsar «Entendido») | `⎇ main` **`✕ No se pudo subir`** (rojo sobre gris) `origin tiene commits nuevos` `Entendido` |

Motivos que detecta: origin tiene commits nuevos, sin acceso a GitHub, falló el push, falló el commit, fallan las comprobaciones, la rama cambió, se interrumpió el turno, el turno acabó con un error.

- **✕** (a la derecha) cierra el botón; antes pide confirmación. Queda cerrado también en las sesiones siguientes.
- **`/commit-boton`** lo vuelve a mostrar.
- **`/botones-commit:commit-push`** hace lo mismo que el botón, escrito a mano.

**Coste:** el botón no gasta nada mientras está a la vista, y vigilar la rama cada 2 s tampoco: es un `git rev-parse` local, sin Claude. Solo cuenta el turno que lanza al pulsarlo, igual que si escribieras el pedido.

## Requisitos

- [Claude Code](https://claude.com/claude-code) instalado (la orden `claude` en el terminal).
- `git` configurado con tu nombre y correo, y acceso de push a tus repositorios.

## Instalar

Elige **una** de las dos formas. Las dos dejan el botón activo en el terminal y en la pestaña Code de la app de escritorio.

### A · Desde una terminal normal (PowerShell, cmd, bash…)

```bash
claude plugin marketplace add cristianduro/claude-botones-commit
```

```bash
claude plugin install botones-commit@botones-commit
```

### B · Desde una sesión de Claude Code en el terminal

```
/plugin install botones-commit --marketplace cristianduro/claude-botones-commit
```

Responde `y` a «Add marketplace?» y elige el ámbito **user** (para todos tus proyectos).

> La pestaña Code de la app de escritorio no acepta `/plugin`: usa la forma A o una sesión en el terminal. Una vez instalado con ámbito *user*, la app de escritorio también lo carga.

**Comprobar:** abre una sesión nueva; el botón aparece encima del cuadro de texto. También `claude plugin list` lo muestra.

## Actualizar

Cuando haya una versión nueva en GitHub:

```bash
claude plugin marketplace update botones-commit
```

```bash
claude plugin update botones-commit@botones-commit
```

Después, en la sesión abierta, escribe `/reload-plugins` (o abre una sesión nueva).

## Cerrar, mostrar, desactivar y desinstalar

| Quiero… | Cómo |
| --- | --- |
| Ocultar el botón un tiempo | Pulsa **✕** y confirma |
| Volver a verlo | Escribe `/commit-boton` |
| Desactivarlo sin borrarlo | `claude plugin disable botones-commit@botones-commit` |
| Activarlo otra vez | `claude plugin enable botones-commit@botones-commit` |
| Desinstalarlo | `claude plugin uninstall botones-commit@botones-commit` |
| Quitar también el marketplace | `claude plugin marketplace remove botones-commit` |

## Probarlo sin instalar

Clona el repositorio y arranca Claude Code con la carpeta como plugin:

```bash
git clone https://github.com/cristianduro/claude-botones-commit.git
```

```bash
claude --plugin-dir ./claude-botones-commit
```

## Si algo no va

- **No aparece el botón:** `claude plugin list` debe mostrar `botones-commit` activado. Si lo cerraste con ✕, escribe `/commit-boton`.
- **Pulso y no pasa nada:** si Claude está trabajando, el pedido espera a que acabe el turno en curso. Si al pulsar aparece «No se pudo enviar el commit + push», vuelve a intentarlo.
- **Se queda en «Comprobando» o «Subiendo»:** se libera solo a los 15 minutos; o escribe `/reload-plugins`.
- **No veo la versión nueva:** primero `claude plugin marketplace update botones-commit`, luego `claude plugin update …` y `/reload-plugins`.

## Contenido del repositorio

```
.claude-plugin/plugin.json        el plugin (nombre, versión)
.claude-plugin/marketplace.json   para instalarlo desde GitHub
hooks/register.tsx                el botón y sus estados
types/index.d.ts                  tipos del estado del botón
skills/commit-push/SKILL.md       la orden /botones-commit:commit-push
```
