export type Modo = 'show' | 'ask' | 'hidden'
// idle: listo · sent: pulsado, a la espera de que empiece el turno · running: turno en marcha · done: subido · none: no había nada que subir
export type Estado = 'idle' | 'sent' | 'running' | 'done' | 'none'
export type Git = { rama: string; hash: string }
// lo que el turno del botón ha hecho de verdad: si llegó a hacer push y el hash del último commit
export type Subida = { push: boolean; hash: string }

declare module 'claude-code' {
  interface PluginState {
    'botones-commit': { modo: Modo; estado: Estado; paso: number; git: Git; subida: Subida }
  }
}
