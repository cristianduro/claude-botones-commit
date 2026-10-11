export type Modo = 'show' | 'ask' | 'hidden'
// idle: listo · sent: pulsado, a la espera de que empiece el turno · running: turno en marcha · done: acaba de subirse
export type Estado = 'idle' | 'sent' | 'running' | 'done'
export type Git = { rama: string; hash: string }

declare module 'claude-code' {
  interface PluginState {
    'botones-commit': { modo: Modo; estado: Estado; paso: number; git: Git }
  }
}
