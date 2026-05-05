export const CHARACTER_TREE_UPDATED_EVENT = 'character-studio:tree-updated';
export const CHARACTER_LIST_UPDATED_EVENT = 'character-studio:list-updated';
export const CHARACTER_DELETED_EVENT = 'character-studio:character-deleted';
export const CHARACTER_RENAMED_EVENT = 'character-studio:character-renamed';

export function notifyCharacterTreeUpdated() {
  window.dispatchEvent(new CustomEvent(CHARACTER_TREE_UPDATED_EVENT));
}

export function notifyCharacterListUpdated() {
  window.dispatchEvent(new CustomEvent(CHARACTER_LIST_UPDATED_EVENT));
}

export function notifyCharacterDeleted(characterId: string) {
  window.dispatchEvent(new CustomEvent(CHARACTER_DELETED_EVENT, {detail: {characterId}}));
}

export function notifyCharacterRenamed(characterId: string, name: string) {
  window.dispatchEvent(new CustomEvent(CHARACTER_RENAMED_EVENT, {detail: {characterId, name}}));
}
