import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Estado, Git, Modo, Subida } from '../types'

// Al pulsar, en la conversación solo aparece un mensaje corto. Las reglas (commit sin coautoría, sin --force,
// comprobar la rama…) están en la skill del plugin (skills/commit-push), que Claude carga al leer este mensaje.
const corto = (repo: string, rama: string) => `Ejecutando acción del usuario: Commit + Push${rama ? ` (rama ${rama} de ${repo})` : ''}`

const modo = atom({ plugin: 'botones-commit', key: 'modo' } as const, 'show' as Modo)
const estado = atom({ plugin: 'botones-commit', key: 'estado' } as const, 'idle' as Estado)
const paso = atom({ plugin: 'botones-commit', key: 'paso' } as const, 0)
const subida = atom({ plugin: 'botones-commit', key: 'subida' } as const, { cambios: false, push: false, hash: '', fallo: '' } as Subida)
const git = atom({ plugin: 'botones-commit', key: 'git' } as const, { repo: '', rama: '', hash: '' } as Git)

const GRIS_FONDO = '#3a3a3c'
const ROJO = '#ff6b6b'
// «⠋ Comprobando...» y «⠋ Subiendo...»: spinner y los tres puntos se encienden uno a uno (cada ~0,5 s); los apagados son espacios de puntuación,
// del mismo ancho que un punto, para que el botón no cambie de tamaño
const puntos = (n: number) => {
  const k = Math.floor(n / 4) % 4

  return '.'.repeat(k) + '\u2008'.repeat(3 - k)
}
const GIRO = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// rama sin remota: Claude suele reintentar con «git push -u origin rama», y si ese push sale bien se olvida
const SIN_REMOTA = 'la rama no tiene remota'

// Por qué ha fallado un comando del turno, en una frase corta; '' si no ha fallado.
function motivoFallo(orden: string, salida: string, isError: boolean) {
  // «git add … && git commit … && git push» sin nada que guardar: el commit corta la cadena, pero no es un fallo
  if (/\bgit\b[^|;&]*\bcommit\b/.test(orden) && /nothing to commit|nothing added to commit/.test(salida)) return ''
  if (/\bgit\b[^|;&]*\bpush\b/.test(orden)) {
    if (/\[rejected\]|non-fast-forward|fetch first/.test(salida)) return 'origin tiene commits nuevos'
    if (/Permission denied|Authentication failed|could not read from remote|\b403\b/i.test(salida)) return 'sin acceso a GitHub'
    if (/has no upstream branch|--set-upstream/.test(salida)) return SIN_REMOTA
    if (isError || /\b(error|fatal):/.test(salida)) return 'falló el push'
  } else if (/\bgit\b[^|;&]*\bcommit\b/.test(orden)) {
    if (isError || /\b(error|fatal):/.test(salida)) return 'falló el commit'
  } else if (/\b(npm|pnpm|yarn)\b[^|;&]*\b(test|comprobar|lint|check)\b|\b(pytest|vitest|jest|eslint|tsc)\b/.test(orden)) {
    if (isError) return 'fallan las comprobaciones'
  }

  return ''
}

// Repositorio, rama y hash del directorio donde trabaja la sesión ahora (cambia al moverse entre carpetas),
// leídos siempre de git: nunca se supone un nombre. Devuelve lo leído ('' sin git) y solo escribe el
// estado si algo cambió, porque el vigía la llama cada 2 s.
// safe.directory=*: en Windows git se niega a leer repos de otro dueño o de otra unidad («dubious ownership»)
// y entonces no salía la rama; para leer la rama no hace falta esa protección
const GIT = ['git', '-c', 'safe.directory=*']

async function leerGit($: EngineInterface): Promise<Git> {
  let dato: Git = { repo: '', rama: '', hash: '' }
  try {
    const cwd = await $.session.cwd()
    const raiz = await $.process.run([...GIT, 'rev-parse', '--show-toplevel'], { cwd })
    // branch --show-current da la rama se llame como se llame (main, master, original…) y aunque el repo no tenga
    // commits todavía; '' con HEAD desacoplado
    const rama = await $.process.run([...GIT, 'branch', '--show-current'], { cwd })
    if (raiz.exitCode === 0) {
      const hash = (await $.process.run([...GIT, 'rev-parse', '--short', '--verify', '-q', 'HEAD'], { cwd })).stdout.trim()
      const repo = raiz.stdout.trim().replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
      dato = { repo, rama: rama.exitCode === 0 ? rama.stdout.trim() : '', hash }
    }
  } catch {
    // sin git aquí: sin repositorio ni rama
  }
  const antes = await read($, git)
  if (antes.repo !== dato.repo || antes.rama !== dato.rama || antes.hash !== dato.hash) {
    await update($, git, () => dato)
  }

  return dato
}

// Botón de commit + push sobre el cuadro de texto: envía el pedido de commit + push como si Cristian lo escribiera.
// En blanco y negro: la etiqueta lleva la rama y cambia con el estado (reposo, comprobando, subiendo, subido con el hash, nada que subir); la rama va aparte, en gris y sin clic.
// La ✕ lo cierra (antes pregunta); /commit-boton lo vuelve a mostrar. Lo cerrado se recuerda entre sesiones.
export const register: Register = on => {
  let animacion: { cancel: () => void } | null = null
  let vigia: { cancel: () => void } | null = null
  // cuenta las pulsaciones: el temporizador de 15 min de una pulsación vieja no toca a la siguiente
  let pulsacion = 0

  // vigía: si cambias de rama (checkout, otra app…) el botón de la rama se entera en 2 s. Se arranca al empezar la
  // sesión y, si el plugin se cargó con la sesión ya empezada (sin session.start), en el primer pintado del botón
  const vigilar = ($: EngineInterface) => {
    if (vigia) {
      return
    }
    void leerGit($)
    vigia = $.clock.every(2000, () => leerGit($))
  }

  const parar = () => {
    animacion?.cancel()
    animacion = null
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'commit-boton', description: 'Muestra otra vez el botón Commit + Push' })
    if ((await $.store.get('cerrado')) === true) {
      await update($, modo, () => 'hidden')
    }
    vigia?.cancel()
    vigia = null
    vigilar($)

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
    // el hash sale del commit («[main abc1234] …», salvo con -q) o, mejor, del push («abc1234..def5678  main -> main»)
    const commit = /\[[^\]\s]+ ([0-9a-f]{7,40})\]/.exec(salida)
    const subio = /\bpush\b/.test(orden) && /\S+\s*->\s*\S+/.test(salida)
    const empujado = subio ? /[0-9a-f]{7,40}\.\.\.?([0-9a-f]{7,40})\s+\S+\s*->/.exec(salida) : null
    const hash = empujado?.[1] ?? commit?.[1]
    if (commit || subio) {
      await update($, subida, x => ({ ...x, push: x.push || subio, hash: hash ? hash.slice(0, 7) : x.hash, fallo: subio && x.fallo === SIN_REMOTA ? '' : x.fallo }))
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
      const { push, fallo, hash } = await read($, subida)
      if (push && !hash) {
        const actual = (await read($, git)).hash
        await update($, subida, x => ({ ...x, hash: actual }))
      }
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

    vigilar($)
    const fase = await read($, estado)
    const { repo, rama, hash: cabeza } = await read($, git)
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
      ? `${GIRO[n % GIRO.length]} ${cambios ? 'Subiendo' : 'Comprobando'}${puntos(n)}`
      : fase === 'done'
        ? `✓ Subido${hash ? ' ' + hash : ''}`
        : fase === 'none'
          ? '— Nada que subir'
          : '─●─ Commit + Push ↑'

    // A la izquierda, la rama (gris, solo informa) y el botón; la ✕ queda pegada al borde derecho.
    return (
      <Box marginBottom={1} gap={1} alignItems="center" width="100%">
        {/* siempre a la vista: mismo botón nativo que el de al lado, para que mida lo mismo; gris y pulsarlo no hace nada */}
        <Button
          key="rama"
          label={`⎇ ${!repo ? 'sin repositorio' : rama || `HEAD suelto${cabeza ? ' ' + cabeza : ''}`}`}
          variant="secondary"
          dimColor
          onPress={() => undefined}
        />
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
              if (!ahora.rama || ahora.rama !== rama || ahora.repo !== repo) {
                const fallo = !ahora.repo ? 'aquí no hay repositorio git' : !ahora.rama ? 'HEAD suelto: cámbiate a una rama' : `ahora es ${ahora.repo} · ${ahora.rama}`
                await update($, subida, () => ({ cambios: false, push: false, hash: '', fallo }))
                await update($, estado, () => 'error')
                return
              }
              await update($, subida, () => ({ cambios: false, push: false, hash: '', fallo: '' }))
              await update($, estado, () => 'sent')
              await update($, paso, () => 0)
              parar()
              animacion = $.clock.every(120, () => update($, paso, p => p + 1))
              // por si el turno no llega a empezar, el botón se libera solo a los 15 minutos
              const esta = ++pulsacion
              void $.clock.after(15 * 60 * 1000, () => {
                if (esta !== pulsacion) {
                  return
                }
                parar()
                return update($, estado, s => (s === 'sent' || s === 'running' ? 'idle' : s))
              })
              $.prompt.submit({ text: corto(repo, rama), asUser: true }).catch(async () => {
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
