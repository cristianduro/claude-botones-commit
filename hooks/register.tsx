import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Estado, Git, Modo, Subida } from '../types'

// El botón lanza la orden del plugin (skills/commit-push), que lleva todas las reglas: en la conversación
// solo se ve «/botones-commit:commit-push rama=…». Si la orden no está, se envía el pedido escrito.
const ORDEN = 'botones-commit:commit-push'

const PEDIDO = `Haz commit y push de los cambios pendientes. Es mi petición expresa. Hazlo en cada repositorio git de esta sesión: el directorio de trabajo principal y los directorios añadidos, uno por uno, cada uno con su commit y su push.

Si este proyecto tiene su propia orden (.claude/skills/commit-push/SKILL.md o .claude/skills/commit/SKILL.md) o reglas de commit en CLAUDE.md, léelas y síguelas en lugar de lo de abajo.

1. git status --short y git diff --stat. Si no hay nada que guardar pero la rama va por delante de origin, pasa al push; si tampoco, dilo y termina.
2. Añade los archivos por su nombre, nunca con git add -A a ciegas. Deja fuera compilaciones, temporales, credenciales y .env, y avísame.
3. Si el proyecto tiene comprobaciones (tests, lint) y hay código sin comprobar en esta sesión, pásalas antes. Si fallan, no hay commit ni push: cuéntame qué falla.
4. Mensaje en el idioma de los commits recientes (git log -5 --oneline): primera línea corta (hasta 60 caracteres) y, si hay varios cambios, una lista breve. Sin Co-Authored-By de Claude ni "Generated with Claude Code": el autor soy solo yo.
5. Commit con mi configuración de git, sin cambiar user.name ni user.email, sin --amend ni --no-verify.
6. Push de la rama actual (git push, o git push -u origin <rama> si no tiene remota). Nunca --force ni --force-with-lease. Si se rechaza porque origin tiene commits nuevos, no fuerces ni mezcles: cuéntamelo.
7. Cuéntame en dos o tres líneas el hash, el mensaje, la rama y que está en GitHub.`

const modo = atom({ plugin: 'botones-commit', key: 'modo' } as const, 'show' as Modo)
const estado = atom({ plugin: 'botones-commit', key: 'estado' } as const, 'idle' as Estado)
const paso = atom({ plugin: 'botones-commit', key: 'paso' } as const, 0)
const subida = atom({ plugin: 'botones-commit', key: 'subida' } as const, { cambios: false, push: false, hash: '', fallo: '' } as Subida)
const git = atom({ plugin: 'botones-commit', key: 'git' } as const, { rama: '', hash: '' } as Git)

const GRIS_FONDO = '#3a3a3c'
const ROJO = '#ff6b6b'
const GIRO = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// Lanza la orden del plugin con la rama que se veía; si esta sesión no la tiene, envía el pedido escrito.
async function lanzar($: EngineInterface, rama: string) {
  const ordenes = await $.command.list()
  if (ordenes.some(c => c.name === ORDEN)) {
    await $.command.run({ command: ORDEN, args: `rama=${rama}` })

    return
  }
  await $.prompt.submit({
    text: `${PEDIDO}\n\nEl botón mostraba la rama «${rama}» en el directorio principal: si al empezar no es la rama actual, no hagas nada y avísame.`,
    asUser: true,
  })
}

// Por qué ha fallado un comando del turno, en una frase corta; '' si no ha fallado.
function motivoFallo(orden: string, salida: string, isError: boolean) {
  if (/\bgit\b[^|;&]*\bpush\b/.test(orden)) {
    if (/\[rejected\]|non-fast-forward|fetch first/.test(salida)) return 'origin tiene commits nuevos'
    if (/Permission denied|Authentication failed|could not read from remote|403/i.test(salida)) return 'sin acceso a GitHub'
    if (isError || /\b(error|fatal):/.test(salida)) return 'falló el push'
  } else if (/\bgit\b[^|;&]*\bcommit\b/.test(orden)) {
    if (/nothing to commit|nothing added to commit/.test(salida)) return ''
    if (isError || /\b(error|fatal):/.test(salida)) return 'falló el commit'
  } else if (/\b(npm|pnpm|yarn)\b[^|;&]*\b(test|comprobar|lint|check)\b|\b(pytest|vitest|jest|eslint|tsc)\b/.test(orden)) {
    if (isError) return 'fallan las comprobaciones'
  }

  return ''
}

// Rama y hash actuales del directorio de la sesión. Devuelve la rama leída ('' sin git) y solo
// escribe el estado si algo cambió, porque el vigía la llama cada 2 s.
async function leerGit($: EngineInterface) {
  let rama = ''
  let hash = ''
  try {
    const r = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
    if (r.exitCode === 0) {
      rama = r.stdout.trim()
      hash = (await $.process.run(['git', 'rev-parse', '--short', 'HEAD'])).stdout.trim()
    }
  } catch {
    // sin git aquí: sin rama
  }
  const antes = await read($, git)
  if (antes.rama !== rama || antes.hash !== hash) {
    await update($, git, () => ({ rama, hash }))
  }

  return rama
}

// Botón de commit + push sobre el cuadro de texto: envía el pedido de commit + push como si Cristian lo escribiera.
// En blanco y negro: la etiqueta lleva la rama y cambia con el estado (reposo, comprobando, subiendo, subido con el hash, nada que subir); la rama va aparte, en gris y sin clic.
// La ✕ lo cierra (antes pregunta); /commit-boton lo vuelve a mostrar. Lo cerrado se recuerda entre sesiones.
export const register: Register = on => {
  let animacion: { cancel: () => void } | null = null
  let vigia: { cancel: () => void } | null = null

  const parar = () => {
    animacion?.cancel()
    animacion = null
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'commit-boton', description: 'Muestra otra vez el botón Commit + Push' })
    if ((await $.store.get('cerrado')) === true) {
      await update($, modo, () => 'hidden')
    }
    void leerGit($)
    // vigía: si cambias de rama (checkout, otra app…) el botón de la rama se entera en 2 s
    vigia?.cancel()
    vigia = $.clock.every(2000, () => leerGit($))

    return next(e)
  })

  // El botón queda desactivado desde que se pulsa hasta que acaba el turno que lanza.
  on('turn.start', async ($, e, next) => {
    if ((await read($, estado)) === 'sent') {
      await update($, estado, () => 'running')
    }

    return next(e)
  })

  // Mientras corre el turno del botón, mira los comandos de git que lanza: si un push subió algo
  // (la salida trae «rama -> rama») y el hash del commit que lo acompaña («[rama abc1234] …»).
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const orden = typeof e.command === 'string' ? e.command : ''
    // en cuanto el turno añade, guarda o sube algo, hay cambios: el botón pasa de «Comprobando» a «Subiendo»
    if (/\bgit\b[^|;&]*\b(add|commit|push)\b/.test(orden) && (await read($, estado)) === 'running') {
      await update($, subida, x => ({ ...x, cambios: true }))
    }
    const r = await next(e)
    if ((await read($, estado)) !== 'running' || !('result' in r)) {
      return r
    }
    const salida = JSON.stringify(r.result ?? '')
    const fallo = motivoFallo(orden, salida, !!r.isError)
    if (fallo) {
      // se apunta el primer fallo del turno: es el que explica el resto
      await update($, subida, x => ({ ...x, fallo: x.fallo || fallo }))

      return r
    }
    if (!/\bgit\b/.test(orden) || r.isError) {
      return r
    }
    const commit = /\[[^\]\s]+ ([0-9a-f]{7,40})\]/.exec(salida)
    const subio = /\bpush\b/.test(orden) && /\S+\s*->\s*\S+/.test(salida)
    if (commit || subio) {
      await update($, subida, x => ({ ...x, push: x.push || subio, hash: commit?.[1]?.slice(0, 7) ?? x.hash }))
    }

    return r
  })

  on('turn.complete', async ($, e, next) => {
    if ((await read($, estado)) === 'running') {
      parar()
      await leerGit($)
      const cortado = e.reason === 'aborted' ? 'se interrumpió el turno' : e.reason === 'answer' ? '' : 'el turno acabó con un error'
      if (cortado) {
        await update($, subida, x => ({ ...x, fallo: x.fallo || cortado }))
      }
      const { push, fallo } = await read($, subida)
      await update($, estado, () => (fallo ? 'error' : push ? 'done' : 'none'))
      if (!fallo) {
        // el error se queda hasta pulsar «Entendido»; lo demás vuelve solo al reposo
        void $.clock.after(6000, () => update($, estado, s => (s === 'done' || s === 'none' ? 'idle' : s)))
      }
    }

    return next(e)
  })

  on('command.run', { command: 'commit-boton' }, async $ => {
    await $.store.delete('cerrado')
    await update($, modo, () => 'show')

    return { text: 'Botón Commit + Push visible otra vez.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const actual = await read($, modo)
    if (e.props.hasSurvey || actual === 'hidden') {
      return next(e)
    }

    const fase = await read($, estado)
    const { rama } = await read($, git)
    const { hash, cambios, fallo } = await read($, subida)
    const n = await read($, paso)
    const { Box, Button, Text } = $.ui.resolve(e)

    if (actual === 'ask') {
      return (
        <Box marginBottom={1} gap={2} alignItems="center">
          <Text>¿Cerrar el botón? Para recuperarlo: /commit-boton</Text>
          <Button
            key="si"
            label="Sí, cerrar"
            variant="primary"
            onPress={async () => {
              await $.store.set('cerrado', true)
              await update($, modo, () => 'hidden')
            }}
          />
          <Button key="no" label="No" onPress={() => update($, modo, () => 'show')} />
        </Box>
      )
    }

    const trabajando = fase === 'sent' || fase === 'running'
    const texto = trabajando
      ? `${GIRO[n % GIRO.length]} ${cambios ? 'Subiendo' : 'Comprobando'}`
      : fase === 'done'
        ? `✓ Subido${hash ? ' ' + hash : ''}`
        : fase === 'none'
          ? '— Nada que subir'
          : '─●─ Commit + Push ↑'

    // A la izquierda, la rama (gris, solo informa) y el botón; la ✕ queda pegada al borde derecho.
    return (
      <Box marginBottom={1} gap={1} alignItems="center" width="100%">
        {rama ? (
          // mismo botón nativo que el de al lado, para que mida lo mismo; gris y pulsarlo no hace nada
          <Button key="rama" label={`⎇ ${rama}`} variant="secondary" dimColor onPress={() => undefined} />
        ) : (
          <Text>{''}</Text>
        )}
        {fase === 'error' ? (
          // error: chip gris con el texto en rojo, el motivo al lado y «Entendido» para volver al reposo
          <Box gap={1} alignItems="center">
            <Box backgroundColor={GRIS_FONDO} paddingX={1}>
              <Text color={ROJO} bold>✕ No se pudo subir</Text>
            </Box>
            <Text dimColor>{fallo}</Text>
            <Button
              key="entendido"
              label="Entendido"
              variant="secondary"
              onPress={async () => {
                await update($, subida, () => ({ cambios: false, push: false, hash: '', fallo: '' }))
                await update($, estado, () => 'idle')
              }}
            />
          </Box>
        ) : (
          <Button
            key="push"
            label={texto}
            variant={fase === 'idle' ? 'primary' : 'secondary'}
            dimColor={fase !== 'idle'}
            onPress={async () => {
              // mientras trabaja o enseña el resultado, pulsar no hace nada
              if ((await read($, estado)) !== 'idle') {
                return
              }
              // la rama tiene que ser la que se ve: si ha cambiado, se actualiza y no se envía nada
              const ahora = await leerGit($)
              if (!ahora || ahora !== rama) {
                await update($, subida, () => ({ cambios: false, push: false, hash: '', fallo: ahora ? `la rama cambió a ${ahora}` : 'aquí no hay repositorio git' }))
                await update($, estado, () => 'error')
                return
              }
              await update($, subida, () => ({ cambios: false, push: false, hash: '', fallo: '' }))
              await update($, estado, () => 'sent')
              await update($, paso, () => 0)
              parar()
              animacion = $.clock.every(120, () => update($, paso, p => p + 1))
              // por si el turno no llega a empezar, el botón se libera solo a los 15 minutos
              void $.clock.after(15 * 60 * 1000, () => {
                parar()
                return update($, estado, s => (s === 'sent' || s === 'running' ? 'idle' : s))
              })
              lanzar($, rama).catch(async () => {
                parar()
                await update($, subida, x => ({ ...x, fallo: 'no se pudo enviar el pedido' }))
                await update($, estado, () => 'error')
              })
            }}
          />
        )}
        <Box flexGrow={1} />
        <Button key="x" label="✕" plain dimColor onPress={() => update($, modo, () => 'ask')} />
      </Box>
    )
  })
}
