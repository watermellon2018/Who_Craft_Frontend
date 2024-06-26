// https://blog.logrocket.com/using-react-arborist-create-tree-components/
import {
    CloseOutlined,
    EditOutlined, FileImageOutlined,
    FolderOpenOutlined, FolderOutlined,
} from "@ant-design/icons";
import React from "react";
import {
    deleteCharacterFromTree,
    renameCharacterFromTree
} from "../../../../api/generation/characters/tree_structure";
import {NodeApi, TreeApi} from "react-arborist";

interface NodeProps {
    node: NodeApi;
    style: React.CSSProperties;
    dragHandle?: ((el: (HTMLDivElement | null)) => void) | undefined;
    tree: TreeApi<any>; // тип дерева можно заменить на конкретный, если известен
    setCurCharacter: (el: {id: string, name: string, is_folder: boolean }) => void;
}

const NodeTree: React.FC<NodeProps> = ({ node,
                                           style,
                                           dragHandle,
                                           tree,
                                           setCurCharacter
}) => {
    const handleClick = () => {
        if (node.isInternal) {
            node.toggle()
        }

        // скажем страницы, что сейчас мы на этом персонаже
        if (node.data.name !== ''){
            const curChar = {'id': node.data.id,
                'name': node.data.name,
                'is_folder': !node.isLeaf
            }
            setCurCharacter(curChar);
        }
    };

    const isNotSave = (storedValue: any, idTarget: string) => {
        for(let i = 0; i < storedValue.length; i+=1) {
            const id = storedValue[i][0];
            if(idTarget == id)
                return true;
            return false;
        }
    }


    const handleDelete = async () => {

        await tree.delete(node);

        const idNodeToDel: string = node.data.id;
        const project_id = JSON.parse(localStorage.getItem('projectInfoCache')!)['id']
        const curStateTreeLeaf = localStorage.getItem("treeLeaf_"+project_id)!;
        const storedValue = JSON.parse(curStateTreeLeaf);
        const isInsideCache = isNotSave(storedValue, idNodeToDel);
        if(isInsideCache){
            for (let i = 0; i < storedValue.length; i++) {
                const id = storedValue[i][0];
                if (idNodeToDel == id) {

                    storedValue.splice(i, 1);
                    const updatedValue = JSON.stringify(storedValue);
                    localStorage.setItem("treeLeaf_" + project_id, updatedValue);
                    break
                }
            }
        } else
            await deleteCharacterFromTree(idNodeToDel);

    };

    const handleEdit = async () => {
        const newValueNode = await node.edit();
        const isCancel = newValueNode['cancelled']

        if(!isCancel){
            const newName = newValueNode['value']
            const response = await renameCharacterFromTree(node.id, newName);
            if(response.status !== 200){
                console.log('Ошибка при переименовании. Статус '+response.status)
            }
        }
    }

    return (
        <div
             key={'div_block_tree_character_'+node.id}
             className={`flex justify-between node-container ${node.state.isSelected ? "bg-blue-100 bg-opacity-10" : ""}`}
             style={style}
             ref={dragHandle}>
            <div
                key={'div_content_tree_character_'+node.id}
                className="node-content"
                 onClick={handleClick}
            >
                {node.isLeaf ? (
                    <>
                        <span id={'span_arrow_tree_character_'+node.id} className="arrow"></span>
                        <span id={'span_icon_tree__character'+node.id} className="file-folder-icon">
                            <FileImageOutlined color="#6bc7f6" />
                        </span>
                    </>
                ) : (
                    <>
                        <span id={'span_arrow_tree_character_'+node.id} className="arrow">
                            {node.isOpen ? <FolderOpenOutlined /> : <FolderOutlined />}
                        </span>
                    </>
                )}

                <span id={'span_text_node_tree_character_'+node.id} className="node-text">
                    {node.isEditing ? (
                        <input
                            type="text"
                            defaultValue={node.data.name}
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={() => node.reset()}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") node.reset();
                                if (e.key === "Enter") node.submit(e.currentTarget.value);
                            }}
                            autoFocus
                        />
                    ) : (
                        <span id={'span_name_node_tree_character_'+node.id}>{node.data.name}</span>
                    )}

                </span>
            </div>

            <div className="file-actions">
                <div className="folderFileActions">
                    <button onClick={handleEdit} title="Rename...">
                        <EditOutlined />
                    </button>
                    <button onClick={handleDelete} title="Delete" style={{display: node.state.isSelected ? 'none' : 'inline-block'}}>
                        <CloseOutlined />
                    </button>
                </div>
            </div>

        </div>
    );
};

export default NodeTree;
