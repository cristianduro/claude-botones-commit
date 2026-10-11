export type Modo = 'show' | 'ask' | 'hidden'
// idle: listo · sent: pulsado, a la espera de que empiece el turno · running: el turno está en marcha
export type Estado = 'idle' | 'sent' | 'running'

declare module 'claude-code' {
  interface PluginState {
    'botones-commit': { modo: Modo; estado: Estado }
  }
}
