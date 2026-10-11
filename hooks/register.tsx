import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Modo } from '../types'

const modo = atom({ plugin: 'botones-commit', key: 'modo' } as const, 'show' as Modo)

// Botón de commit + push sobre el cuadro de texto: envía /commit-push como si Cristian lo escribiera.
// La ✕ lo cierra (antes pregunta); /commit-boton lo vuelve a mostrar. Lo cerrado se recuerda entre sesiones.
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'commit-boton', description: 'Muestra otra vez el botón Commit + Push' })
    if ((await $.store.get('cerrado')) === true) {
      await update($, modo, () => 'hidden')
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

    // Los botones van a la izquierda; la ✕ queda pegada al borde derecho, y entre medias hay sitio para más botones.
    return (
      <Box marginBottom={1} gap={2} alignItems="center" width="100%">
        <Button
          key="push"
          label="Commit + Push ↑"
          variant="primary"
          onPress={() => void $.prompt.submit({ text: '/commit-push', asUser: true })}
        />
        <Box flexGrow={1} />
        <Button key="x" label="✕" plain dimColor onPress={() => update($, modo, () => 'ask')} />
      </Box>
    )
  })
}
