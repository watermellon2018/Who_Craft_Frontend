export function canBypassUnsavedChangesAfterSelectedSceneSave(
  dirtySceneIds: readonly number[],
  selectedSceneId?: number,
): boolean {
  return dirtySceneIds.every((sceneId) => sceneId === selectedSceneId);
}
