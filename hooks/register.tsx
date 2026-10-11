import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Estado, Git, Modo } from '../types'

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
const antes = atom({ plugin: 'botones-commit', key: 'antes' } as const, '')
const git = atom({ plugin: 'botones-commit', key: 'git' } as const, { rama: '', hash: '' } as Git)

const GIRO = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// rama y hash actuales, para el marco
async function leerGit($: EngineInterface) {
  try {
    const rama = (await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
    const hash = (await $.process.run(['git', 'rev-parse', '--short', 'HEAD'])).stdout.trim()
    await update($, git, () => ({ rama, hash }))
  } catch {
    // sin git aquí: el marco se queda sin rama
  }
}

// Botón de commit + push sobre el cuadro de texto: envía el pedido de commit + push como si Cristian lo escribiera.
// En blanco y negro: la etiqueta lleva la rama y cambia con el estado (reposo, subiendo, subido con el hash, nada que subir).
// La ✕ lo cierra (antes pregunta); /commit-boton lo vuelve a mostrar. Lo cerrado se recuerda entre sesiones.
export const register: Register = on => {
  let animacion: { cancel: () => void } | null = null

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

    return next(e)
  })

  // El botón queda desactivado desde que se pulsa hasta que acaba el turno que lanza.
  on('turn.start', async ($, e, next) => {
    if ((await read($, estado)) === 'sent') {
      await update($, estado, () => 'running')
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if ((await read($, estado)) === 'running') {
      parar()
      await leerGit($)
      const { hash } = await read($, git)
      const previo = await read($, antes)
      await update($, estado, () => (hash && hash !== previo ? 'done' : 'none'))
      void $.clock.after(6000, () => update($, estado, () => 'idle'))
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
    const { rama, hash } = await read($, git)
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
      ? `${GIRO[n % GIRO.length]} Subiendo`
      : fase === 'done'
        ? `✓ Subido ${hash}`
        : fase === 'none'
          ? '— Nada que subir'
          : 'Commit + Push ↑'

    // El botón va a la izquierda; la ✕ queda pegada al borde derecho, y entre medias hay sitio para más botones.
    return (
      <Box marginBottom={1} gap={2} alignItems="center" width="100%">
        <Button
          key="push"
          label={rama ? `⎇ ${rama} · ${texto}` : texto}
          variant={fase === 'idle' ? 'primary' : 'secondary'}
          dimColor={fase !== 'idle'}
          onPress={async () => {
            // mientras trabaja o enseña el resultado, pulsar no hace nada
            if ((await read($, estado)) !== 'idle') {
              return
            }
            await update($, antes, () => hash)
            await update($, estado, () => 'sent')
            await update($, paso, () => 0)
            parar()
            animacion = $.clock.every(120, () => update($, paso, p => p + 1))
            // por si el turno no llega a empezar, el botón se libera solo a los 15 minutos
            void $.clock.after(15 * 60 * 1000, () => {
              parar()
              return update($, estado, s => (s === 'sent' || s === 'running' ? 'idle' : s))
            })
            $.prompt.submit({ text: PEDIDO, asUser: true }).catch(async () => {
              parar()
              await update($, estado, () => 'idle')
              $.ui.toast('No se pudo enviar el commit + push')
            })
          }}
        />
        <Box flexGrow={1} />
        <Button key="x" label="✕" plain dimColor onPress={() => update($, modo, () => 'ask')} />
      </Box>
    )
  })
}
