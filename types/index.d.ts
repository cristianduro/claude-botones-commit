export type Modo = 'show' | 'ask' | 'hidden'
// idle: listo · sent: pulsado, a la espera de que empiece el turno · running: turno en marcha · done: subido · none: no había nada que subir · error: algo falló (se queda hasta pulsar «Entendido»)
export type Estado = 'idle' | 'sent' | 'running' | 'done' | 'none' | 'error'
// el repositorio (carpeta raíz) del directorio de la sesión, su rama y su último commit, tal como los da git
export type Git = { repo: string; rama: string; hash: string }
// lo que el turno del botón ha hecho de verdad: si encontró cambios (add, commit o push), si llegó a subir algo, el hash del último commit y, si algo falló, el motivo
export type Subida = { cambios: boolean; push: boolean; hash: string; fallo: string }

declare module 'claude-code' {
  interface PluginState {
    'botones-commit': { modo: Modo; estado: Estado; paso: number; git: Git; subida: Subida }
  }
}
