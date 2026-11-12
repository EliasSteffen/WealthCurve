/** Ein Importer für alle: Vorladen (Hover) und `React.lazy` teilen sich so denselben Chunk und dasselbe Promise. */
export const loadVideoWorkspace = () =>
  import('../components/video/VideoWorkspace').then((m) => ({ default: m.VideoWorkspace }))

export const preloadVideoWorkspace = () => void loadVideoWorkspace()
