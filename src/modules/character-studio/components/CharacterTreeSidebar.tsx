import React, {useEffect, useRef, useState} from 'react';
import {Button, Empty, Modal, Spin, Tooltip, message} from 'antd';

const TREE_SIDEBAR_ICON_BUTTON_CLASS =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent ' +
  'text-[#dce1e8] transition-colors duration-150 ' +
  'hover:border-accent/40 hover:bg-accent/10 hover:text-accent ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

function TreeSidebarIconButton({
  ariaLabel,
  icon,
  onClick,
}: {
  ariaLabel: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={TREE_SIDEBAR_ICON_BUTTON_CLASS}
    >
      {icon}
    </button>
  );
}
import i18nInstance from '../../../i18n';
import {CloseOutlined, EditOutlined, FileImageOutlined, FolderAddOutlined, FolderOpenOutlined, FolderOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlusOutlined} from '@ant-design/icons';
import {DeleteHandler, NodeApi, RenameHandler, RowRendererProps, Tree, TreeApi} from 'react-arborist';
import {v4 as uuidv4} from 'uuid';

// Inner helpers run outside React render scope (callbacks fired after async
// work), so they read translations from the i18next instance directly rather
// than via useTranslation.
const tx = (key: string, opts?: Record<string, unknown>) => i18nInstance.t(key, opts) as string;
import {createCharacterFromTreeAPI, deleteCharacterFromTree, get_all_character_for_project, renameCharacterFromTree} from '../../../api/generation/characters/tree_structure';
import {characterApi} from '../api/characterApi';
import {StudioCharacter} from '../types/character.types';
import {CHARACTER_LIST_UPDATED_EVENT, CHARACTER_TREE_UPDATED_EVENT, notifyCharacterDeleted, notifyCharacterListUpdated, notifyCharacterRenamed, notifyCharacterTreeUpdated} from '../events';
import './CharacterTreeSidebar.css';

const TREE_ROW_HEIGHT = 34;
const MAX_TREE_HEIGHT = 720;

export interface CharacterTreeNode {
  id: string;
  key: string;
  name: string;
  is_folder?: boolean;
  character_id?: string | null;
  legacy_hero_id?: string | number | null;
  children?: CharacterTreeNode[];
  // Synthesized client-side from a StudioCharacter that has no
  // MenuFolder/ItemFolder row. Such nodes must NOT be deleted through the
  // tree API (there's no tree row to remove and the legacy view would
  // crash on UUID-vs-int FK mismatches); we delete the studio character
  // directly instead.
  __synthetic?: boolean;
}

interface CharacterTreeSidebarProps {
  projectId: string;
  selectedCharacterId?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectCharacter: (characterId: string) => void;
  onCreateCharacter?: (name: string, treeNodeId: string) => void;
  onDeletedCharacter?: (characterId: string) => void;
}

function getNodeParentId(node: NodeApi<CharacterTreeNode> | null) {
  const parent = node?.parent;
  return parent && parent.level !== -1 ? parent.data.id : null;
}

function getInsertParentId(tree: TreeApi<CharacterTreeNode>) {
  const focusedNode = tree.focusedNode;
  if (!focusedNode) {
    return null;
  }

  if (focusedNode.isOpen) {
    return focusedNode.id;
  }

  if (focusedNode.parent && !focusedNode.parent.isRoot) {
    return focusedNode.parent.id;
  }

  return null;
}

function getInsertIndex(tree: TreeApi<CharacterTreeNode>) {
  const focusedNode = tree.focusedNode;
  if (!focusedNode) {
    return tree.root.children?.length ?? 0;
  }

  if (focusedNode.isOpen) {
    return 0;
  }

  if (focusedNode.parent) {
    return focusedNode.childIndex + 1;
  }

  return 0;
}

function insertAtIndex(nodes: CharacterTreeNode[], index: number, node: CharacterTreeNode) {
  const nextNodes = [...nodes];
  nextNodes.splice(Math.max(0, Math.min(index, nextNodes.length)), 0, node);
  return nextNodes;
}

function insertTreeNode(nodes: CharacterTreeNode[], parentId: string | null, index: number, node: CharacterTreeNode): CharacterTreeNode[] {
  if (parentId === null) {
    return insertAtIndex(nodes, index, node);
  }

  return nodes.map((item) => {
    if (item.id === parentId) {
      return {...item, children: insertAtIndex(item.children || [], index, node)};
    }

    if (!item.children) {
      return item;
    }

    return {...item, children: insertTreeNode(item.children, parentId, index, node)};
  });
}

function updateTreeNode(nodes: CharacterTreeNode[], id: string, changes: Partial<CharacterTreeNode>): CharacterTreeNode[] {
  return nodes.map((item) => {
    const nextItem = item.id === id ? {...item, ...changes} : item;

    if (!nextItem.children) {
      return nextItem;
    }

    return {...nextItem, children: updateTreeNode(nextItem.children, id, changes)};
  });
}

function removeTreeNodes(nodes: CharacterTreeNode[], ids: Set<string>): CharacterTreeNode[] {
  return nodes
    .filter((item) => !ids.has(item.id))
    .map((item) => {
      if (!item.children) {
        return item;
      }

      return {...item, children: removeTreeNodes(item.children, ids)};
    });
}

function collectTreeNodes(nodes: CharacterTreeNode[], ids: Set<string>): CharacterTreeNode[] {
  const result: CharacterTreeNode[] = [];

  const visit = (node: CharacterTreeNode) => {
    if (ids.has(node.id)) {
      result.push(node);
      return;
    }

    node.children?.forEach(visit);
  };

  nodes.forEach(visit);
  return result;
}

function collectCharacterIds(nodes: CharacterTreeNode[]) {
  const ids = new Set<string>();

  const visit = (node: CharacterTreeNode) => {
    if (node.character_id) {
      ids.add(node.character_id);
    }
    node.children?.forEach(visit);
  };

  nodes.forEach(visit);
  return Array.from(ids);
}

function countTreeNodes(nodes: CharacterTreeNode[]) {
  let count = 0;

  const visit = (node: CharacterTreeNode) => {
    count += 1;
    node.children?.forEach(visit);
  };

  nodes.forEach(visit);
  return count;
}

function confirmDelete(nodes: CharacterTreeNode[]) {
  const firstCharacter = nodes.find((node) => !node.is_folder);
  const title = firstCharacter
    ? tx('characterStudio.tree.confirmDeleteCharacter', {name: firstCharacter.name})
    : tx('characterStudio.tree.confirmDeleteFolder', {name: nodes[0]?.name || ''});

  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title,
      content: nodes.length > 1 ? tx('characterStudio.tree.deletionWarning') : undefined,
      okText: tx('common.delete'),
      cancelText: tx('common.cancel'),
      okButtonProps: {danger: true},
      className: 'character-delete-confirm-modal',
      centered: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function waitForTreeNode(treeRef: React.MutableRefObject<TreeApi<CharacterTreeNode> | null>, nodeId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const node = treeRef.current?.get(nodeId);
    if (node) {
      return node;
    }

    await wait(50);
  }

  return null;
}

function stopTreeEvent(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function InlineNameEditor({node}: {node: NodeApi<CharacterTreeNode>}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus({preventScroll: true});
    input.select();

    const focusTimeout = window.setTimeout(() => {
      input.focus({preventScroll: true});
    }, 0);

    return () => window.clearTimeout(focusTimeout);
  }, [node.id]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={node.data.name}
      autoFocus
      onChange={stopTreeEvent}
      onPointerDownCapture={stopTreeEvent}
      onMouseDownCapture={stopTreeEvent}
      onClickCapture={stopTreeEvent}
      onPointerDown={stopTreeEvent}
      onMouseDown={stopTreeEvent}
      onClick={stopTreeEvent}
      onDoubleClick={stopTreeEvent}
      onFocus={(event) => {
        event.stopPropagation();
        event.currentTarget.select();
      }}
      onBlur={(event) => {
        event.stopPropagation();
        node.reset();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          node.reset();
        }
        if (event.key === 'Enter') {
          node.submit(event.currentTarget.value);
        }
      }}
      data-tree-editor="true"
      style={{
        minWidth: 0,
        flex: 1,
        color: '#ffffff',
        background: 'rgba(255, 255, 255, 0.08)',
        caretColor: 'var(--craft-accent)',
        border: '1px solid rgba(250, 176, 5, 0.55)',
        outline: 'none',
      }}
    />
  );
}

function CharacterTreeRow({node, attrs, innerRef, children}: RowRendererProps<CharacterTreeNode>) {
  return (
    <div
      {...attrs}
      ref={innerRef}
      onFocus={stopTreeEvent}
      onClick={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('[data-tree-editor="true"], [data-tree-action="true"]')) {
          event.stopPropagation();
          return;
        }

        node.handleClick(event);
      }}
    >
      {children}
    </div>
  );
}

function TreeNode({
  node,
  style,
  dragHandle,
  selectedCharacterId,
  onSelectCharacter,
  onCreateCharacter,
}: {
  node: NodeApi<CharacterTreeNode>;
  style: React.CSSProperties;
  dragHandle?: (element: HTMLDivElement | null) => void;
  selectedCharacterId?: string;
  onSelectCharacter: (characterId: string) => void;
  onCreateCharacter?: (name: string, treeNodeId: string) => void;
}) {
  const isSelectedCharacter = !!node.data.character_id && node.data.character_id === selectedCharacterId;
  const selectNode = () => {
    if (node.isInternal) {
      node.toggle();
      return;
    }

    if (node.data.character_id) {
      onSelectCharacter(node.data.character_id);
      return;
    }

    if (!node.data.is_folder) {
      onCreateCharacter?.(node.data.name, node.data.id);
    }
  };

  const renameNode = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    await node.edit();
  };

  const deleteNode = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    await node.tree.delete(node);
  };
  const labelStyle: React.CSSProperties = {
    minWidth: 0,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'inherit',
    background: 'transparent',
    border: 0,
    padding: '0 4px',
    textAlign: 'left',
  };
  const icon = node.isLeaf
    ? <FileImageOutlined style={{color: 'var(--craft-accent)'}} />
    : node.isOpen ? <FolderOpenOutlined /> : <FolderOutlined />;

  return (
    <div
      ref={node.isEditing ? undefined : dragHandle}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        paddingRight: 8,
        borderLeft: isSelectedCharacter ? '3px solid var(--craft-accent)' : '3px solid transparent',
        color: '#ffffff',
        background: isSelectedCharacter || node.state.isSelected ? 'linear-gradient(90deg, rgba(250, 176, 5, 0.2), rgba(250, 176, 5, 0.06))' : 'transparent',
        borderRadius: 4,
      }}
    >
      {node.isEditing ? (
        <div
          style={labelStyle}
          onPointerDown={stopTreeEvent}
          onMouseDown={stopTreeEvent}
          onClick={stopTreeEvent}
          data-tree-editor="true"
        >
          {icon}
          <InlineNameEditor node={node} />
        </div>
      ) : (
        <button
          type="button"
          onClick={selectNode}
          style={{...labelStyle, cursor: 'pointer'}}
        >
          {icon}
          <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
            {node.data.name}
          </span>
        </button>
      )}
      <span style={{display: 'inline-flex', gap: 4}} data-tree-action="true">
        <Tooltip title={tx('characterStudio.tree.renameAction')}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={renameNode} aria-label={tx('characterStudio.tree.renameAction')} />
        </Tooltip>
        <Tooltip title={tx('characterStudio.tree.removeFromTreeAction')}>
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={deleteNode} aria-label={tx('characterStudio.tree.removeFromTreeAction')} />
        </Tooltip>
      </span>
    </div>
  );
}

export default function CharacterTreeSidebar({
  projectId,
  selectedCharacterId,
  collapsed = false,
  onToggleCollapse,
  onSelectCharacter,
  onCreateCharacter,
  onDeletedCharacter,
}: CharacterTreeSidebarProps) {
  const treeRef = useRef<TreeApi<CharacterTreeNode> | null>(null);
  const pendingNodeIdsRef = useRef<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<CharacterTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const treeHeight = Math.min(MAX_TREE_HEIGHT, Math.max(TREE_ROW_HEIGHT, countTreeNodes(treeData) * TREE_ROW_HEIGHT + 8));

  const loadTree = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // The legacy MenuFolder-backed tree is the source of truth for folder
      // hierarchy, but it gets out of sync with StudioCharacter rows (e.g.
      // create flows that didn't persist a MenuFolder, fixtures, or older
      // characters created before the tree-sync code existed). We fetch both
      // and merge any visible studio characters that aren't yet present in
      // the tree, so the sidebar reflects exactly the same set the gallery
      // shows — no drafts, no dangling tree-only ghosts.
      //
      // No status filter on the list call: by default the gallery endpoint
      // hides drafts on the server, which is exactly what we want here too.
      const [treeResponse, charactersResponse] = await Promise.all([
        get_all_character_for_project(projectId),
        characterApi.list(projectId),
      ]);
      const treeNodes: CharacterTreeNode[] = treeResponse;
      const studioCharacters: StudioCharacter[] = charactersResponse.data || [];

      // Build a lookup of which character_ids the gallery considers visible.
      // Any tree leaf whose character_id is NOT in this set is either a draft
      // or a dangling tree artifact — both should be hidden, even if the
      // backend tree endpoint forgot to filter them (defence in depth).
      const visibleCharacterIds = new Set(
        studioCharacters
          .filter((character) => character?.character_id)
          .map((character) => String(character.character_id)),
      );

      const seenCharacterIds = new Set<string>();
      const pruneTree = (nodes: CharacterTreeNode[]): CharacterTreeNode[] => {
        const result: CharacterTreeNode[] = [];
        nodes.forEach((node) => {
          const children = node.children ? pruneTree(node.children) : undefined;
          const isLeaf = !node.is_folder;
          if (isLeaf) {
            const characterId = node.character_id ? String(node.character_id) : null;
            // Hide leaves without a real character link, leaves linked to a
            // character that isn't visible (draft / deleted), and any
            // repeat of a character we've already shown in the tree.
            if (!characterId) return;
            if (!visibleCharacterIds.has(characterId)) return;
            if (seenCharacterIds.has(characterId)) return;
            seenCharacterIds.add(characterId);
          }
          result.push(children !== undefined ? {...node, children} : node);
        });
        return result;
      };

      const prunedTree = pruneTree(treeNodes);

      const orphans: CharacterTreeNode[] = studioCharacters
        .filter((character) => character?.character_id && !seenCharacterIds.has(String(character.character_id)))
        .map((character) => {
          seenCharacterIds.add(String(character.character_id));
          return {
            id: String(character.character_id),
            key: String(character.character_id),
            name: character.name || '—',
            is_folder: false,
            character_id: String(character.character_id),
            legacy_hero_id: null,
            __synthetic: true,
          };
        });

      setTreeData([...prunedTree, ...orphans]);
    } catch {
      setTreeData([]);
      message.error(tx('characterStudio.tree.reloadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    window.addEventListener(CHARACTER_TREE_UPDATED_EVENT, loadTree);
    window.addEventListener(CHARACTER_LIST_UPDATED_EVENT, loadTree);
    return () => {
      window.removeEventListener(CHARACTER_TREE_UPDATED_EVENT, loadTree);
      window.removeEventListener(CHARACTER_LIST_UPDATED_EVENT, loadTree);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const insertPendingNode = async (type: 'internal' | 'leaf') => {
    const tree = treeRef.current;
    if (!tree) {
      return null;
    }

    const id = uuidv4();
    const parentId = getInsertParentId(tree);
    const index = getInsertIndex(tree);
    const newNode: CharacterTreeNode = {
      id,
      key: id,
      name: '',
      is_folder: type === 'internal',
      children: type === 'internal' ? [] : undefined,
    };

    pendingNodeIdsRef.current.add(id);
    setTreeData((currentTreeData) => insertTreeNode(currentTreeData, parentId, index, newNode));

    return waitForTreeNode(treeRef, id);
  };

  const handleTreeRename: RenameHandler<CharacterTreeNode> = async ({id, name, node}) => {
    node.data.name = name;
    setTreeData((currentTreeData) => updateTreeNode(currentTreeData, id, {name}));

    if (pendingNodeIdsRef.current.has(id)) {
      return;
    }

    try {
      const response = await renameCharacterFromTree(id, name);
      const characterId = response.character_id || node.data.character_id;
      if (characterId) {
        notifyCharacterRenamed(characterId, name);
        notifyCharacterListUpdated();
      }
    } catch {
      message.error(tx('characterStudio.tree.renameError'));
      await loadTree();
    }
  };

  const handleTreeDelete: DeleteHandler<CharacterTreeNode> = async ({ids}) => {
    const idsToDelete = new Set(ids);
    const deletedNodes = collectTreeNodes(treeData, idsToDelete);
    const confirmed = await confirmDelete(deletedNodes);
    if (!confirmed) {
      return;
    }

    // Two delete paths:
    //   - Real MenuFolder/ItemFolder rows go through the legacy tree API,
    //     which also cascades to the linked StudioCharacter.
    //   - Synthetic orphan nodes (StudioCharacters with no tree row) have
    //     nothing to delete on the tree side — calling the tree API would
    //     either 404 or 500 on UUID-vs-int FK lookups. Delete the studio
    //     character directly instead.
    const persistedNodes = deletedNodes.filter((node) => !pendingNodeIdsRef.current.has(node.id));
    const treeDeleteNodes = persistedNodes.filter((node) => !node.__synthetic);
    const syntheticNodes = persistedNodes.filter((node) => node.__synthetic && node.character_id);

    try {
      await Promise.all(
        treeDeleteNodes.map((node) => deleteCharacterFromTree(node.id)),
      );

      await Promise.all(
        syntheticNodes.map((node) =>
          characterApi.delete(projectId, String(node.character_id)),
        ),
      );
    } catch {
      message.error(tx('characterStudio.tree.deleteError'));
      await loadTree();
      return;
    }

    ids.forEach((id) => pendingNodeIdsRef.current.delete(id));
    setTreeData((currentTreeData) => removeTreeNodes(currentTreeData, idsToDelete));
    collectCharacterIds(deletedNodes).forEach((characterId) => {
      notifyCharacterDeleted(characterId);
      onDeletedCharacter?.(characterId);
    });
    notifyCharacterListUpdated();
    notifyCharacterTreeUpdated();
  };

  const createFolder = async () => {
    const tree = treeRef.current;
    if (!tree || !projectId) return;

    let persisted = false;
    let nodeId: string | null = null;

    try {
      const node = await insertPendingNode('internal');
      if (!node) {
        throw new Error('Created folder node not found');
      }

      nodeId = node.id;
      const editResult = await tree.edit(node);
      const currentNode = tree.get(node.id);
      const editedName = editResult && !editResult.cancelled ? editResult.value : undefined;
      const name = (editedName ?? currentNode?.data.name ?? '').trim();
      if (editResult?.cancelled || !currentNode || !name) {
        await tree.delete(node.id);
        return;
      }

      await createCharacterFromTreeAPI(node.id, name, 'node', projectId, getNodeParentId(currentNode));

      pendingNodeIdsRef.current.delete(node.id);
      persisted = true;
      notifyCharacterTreeUpdated();
    } catch (error) {
      if (!persisted && nodeId) {
        await tree.delete(nodeId);
      }
      message.error(tx('characterStudio.tree.createFolderError'));
      return;
    }

    await loadTree();
  };

  const createCharacter = async () => {
    const tree = treeRef.current;
    if (!tree || !projectId) return;

    let persisted = false;
    let nodeId: string | null = null;

    try {
      const node = await insertPendingNode('leaf');
      if (!node) {
        throw new Error('Created character node not found');
      }

      nodeId = node.id;
      const editResult = await tree.edit(node);
      const currentNode = tree.get(node.id);
      const editedName = editResult && !editResult.cancelled ? editResult.value : undefined;
      const name = (editedName ?? currentNode?.data.name ?? '').trim();
      if (editResult?.cancelled || !currentNode || !name) {
        await tree.delete(node.id);
        return;
      }

      await createCharacterFromTreeAPI(node.id, name, 'leaf', projectId, getNodeParentId(currentNode));

      pendingNodeIdsRef.current.delete(node.id);
      persisted = true;
      notifyCharacterTreeUpdated();
      onCreateCharacter?.(name, node.id);
    } catch (error) {
      if (!persisted && nodeId) {
        await tree.delete(nodeId);
      }
      message.error(tx('characterStudio.tree.createCharacterError'));
      return;
    }

    await loadTree();
  };

  if (collapsed) {
    return (
      <aside className="character-tree-sidebar character-tree-sidebar--collapsed custom-scrollbar" style={{width: 58, height: '100%', minHeight: 0, background: '#111318', borderRight: '1px solid #30343d', padding: '12px 8px', overflow: 'hidden', scrollbarGutter: 'auto'}}>
        <Tooltip title={tx('characterStudio.tree.openTree')} overlayClassName="character-tree-sidebar__tooltip">
          <TreeSidebarIconButton
            ariaLabel={tx('characterStudio.tree.openTreeAria')}
            icon={<MenuUnfoldOutlined />}
            onClick={onToggleCollapse}
          />
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside className="character-tree-sidebar custom-scrollbar" style={{width: 280, height: '100%', minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', background: '#111318', borderRight: '1px solid #30343d', padding: 12, overflow: 'hidden', scrollbarGutter: 'auto'}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
        <div style={{color: '#ffffff', fontWeight: 600}}>{tx('characterStudio.tree.title')}</div>
        <div style={{display: 'flex', gap: 4}}>
          <Tooltip title={tx('characterStudio.tree.closeTree')} overlayClassName="character-tree-sidebar__tooltip">
            <TreeSidebarIconButton
              ariaLabel={tx('characterStudio.tree.closeTreeAria')}
              icon={<MenuFoldOutlined />}
              onClick={onToggleCollapse}
            />
          </Tooltip>
          <Tooltip title={tx('characterStudio.tree.createFolder')} overlayClassName="character-tree-sidebar__tooltip">
            <TreeSidebarIconButton
              ariaLabel={tx('characterStudio.tree.createFolder')}
              icon={<FolderAddOutlined />}
              onClick={createFolder}
            />
          </Tooltip>
          <Tooltip title={tx('characterStudio.tree.createCharacter')} overlayClassName="character-tree-sidebar__tooltip">
            <TreeSidebarIconButton
              ariaLabel={tx('characterStudio.tree.createCharacter')}
              icon={<PlusOutlined />}
              onClick={createCharacter}
            />
          </Tooltip>
        </div>
      </div>
      <div className="character-tree-sidebar__body custom-scrollbar" style={{minHeight: 0, overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'auto'}}>
        {loading
          ? <Spin />
          : (
            <>
            {treeData.length === 0 && <Empty description={tx('characterStudio.tree.emptyState')} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {treeData.length > 0 && (
              <Tree<CharacterTreeNode>
                ref={treeRef}
                data={treeData}
                onRename={handleTreeRename}
                onDelete={handleTreeDelete}
                renderRow={CharacterTreeRow}
                width="100%"
                height={treeHeight}
                rowHeight={TREE_ROW_HEIGHT}
                indent={18}
              >
                {(props) => (
                  <TreeNode
                    {...props}
                    selectedCharacterId={selectedCharacterId}
                    onSelectCharacter={onSelectCharacter}
                    onCreateCharacter={onCreateCharacter}
                  />
                )}
              </Tree>
            )}
            </>
          )}
      </div>
    </aside>
  );
}
