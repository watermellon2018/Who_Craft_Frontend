import React, {useState, useRef, useEffect} from 'react';
import {Button, Empty, Layout, Spin} from 'antd';
import NodeTree from './tree/node';
import {get_all_character_for_project} from '../../../api/generation/characters/tree_structure';

import ImageCanvas from "./canvas";
import DashboardHeader from '../../../modules/profile/components/DashboardHeader'
import MenuGeneration from "./generationMenu";
import {Tree} from "react-arborist";
import {generateImageAPI,
    generateImageUndefinedAPI,
    generateImage2ImgAPI} from '../../../api/characters'
import withAuth from "../../../utils/auth/check_auth";
import './style.css'
import CreaterWrapper from "./tree/createrWrapper";
import {useLocation, useNavigate} from "react-router-dom";
import PathConstants from "../../../routes/pathConstant";
import {get_image_by_id} from "../../../api/characters/basic";
import {openNotificationWithIcon} from "../../../utils/global/notification";
import {EditOutlined, SaveOutlined} from "@ant-design/icons";
const { Content, Sider } = Layout;

interface Character {
    id: string;
    key: string;
    name: string;
}

interface TreeHandle {
    hasOneSelection: boolean;
    selectedNodes: { data: { name: string; id: string } }[];
}

export const GenerationHeroPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { project_id } = location.state || {};
    // const is_edit = localStorage.getItem('is_edit') == 'true' || false;
    const [isEdit, setIsEdit] = useState<boolean>( localStorage.getItem('is_edit') == 'true' || false);

    const [collapsed, setCollapsed] = useState(false);
    const treeRef = useRef(null);
    const [data, setData] = useState<Character[]>([]);

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [imageGeneratedUrl, setImageGeneratedUrl] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isHeroSaved, setIsHeroSaved] = useState(false);
    const [isEmptySelected, setIsEmptySelected] = useState(false);

    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [curCharacter, setCurCharacter] = useState<{id: string,
        name: string,
        is_folder: boolean}>
    ({id: '', name: '', is_folder: true});

    /**
     * Выгрузка данных из базы - персонажи которые созданы
     * Выгружаем еще не сохраненных персонажей, но созданных из localStorage.
     * Объединяем их, чтобы отобразить на дереве
     * **/

    /** Объединяем созданных (в localStorage) и сохраненных персонажей из БД **/
    const mergeCharactersWithStoredData = (characters: Character[], storedData: Record<string, string>) => {
        const mergedData = [...characters];


        for (const value of Object.values(storedData)) {
            const id = value[0]
            const name = value[1]
            mergedData.push({ id, key: id, name });
        }
        return mergedData;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const response = await get_all_character_for_project(project_id);
                const characters = response.data;
                const storedTreeLeaf = localStorage.getItem("treeLeaf_"+project_id);
                if (storedTreeLeaf && data) {
                    const storedData = JSON.parse(storedTreeLeaf);
                    const mergedData = mergeCharactersWithStoredData(characters, storedData);
                    setData(mergedData);
                } else {
                    localStorage.setItem("treeLeaf_"+project_id, JSON.stringify([]));
                }
            } catch (error) {
                console.error('Error fetching characters:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            localStorage.removeItem('is_edit');
        };
    }, []);


    useEffect(() => {
        const url = location.state?.imageUrl || '';
        setImageGeneratedUrl(url);

        const curCharString = localStorage.getItem("curCharacter");
        if (curCharString) {
            const curChar = JSON.parse(curCharString);
            setCurCharacter(curChar)
            localStorage.removeItem('curCharacter')
        } else if (location.state.curCharacter) {
            setCurCharacter(location.state?.curCharacter);
        }

    }, []);

    const toggleCollapsed = () => {
        setCollapsed(!collapsed);
    };


    const onFinish = async (values: any) => {
        try {
            setIsGenerating(true);
            const response = (Object.keys(values).length > 2)
                ? await generateImageAPI(values)
                : await generateImageUndefinedAPI(values);
            const byteArray = response.data;
            const imageUrl = `data:image/png;base64,${byteArray}`;
            setImageGeneratedUrl(imageUrl);
            setIsGenerating(false);
        } catch (error) {
            setIsGenerating(false);
            setImageGeneratedUrl('');
            openNotificationWithIcon('Упс!',
                'Ошибка при генерации изображения. Что-то пошло не так',
                'error');
        }
    };

    const settingHeroHandle = () => {
        if (treeRef && treeRef.current && (treeRef.current as TreeHandle).hasOneSelection) {
            const selectedNode = (treeRef.current as TreeHandle).selectedNodes[0];
            const {name, id} = selectedNode.data;

            navigate(PathConstants.SETTING_HERO, {
                state: {
                    is_edit: isEdit,
                    project_id: project_id,
                    name: name,
                    id_leaf: id,
                    imageUrl: imageGeneratedUrl,
                    character_id: curCharacter.id,
                },
            });
        } else {
            console.error('Ошибка при передаче имени на другую страницу!');
        }
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                const idCurHero = curCharacter.id;
                const response = await get_image_by_id(project_id, idCurHero);
                if (response.data.status) {
                    setIsHeroSaved(true);
                    const byteArray = response.data.image;
                    const imageUrl = `data:image/png;base64,${byteArray}`;
                    setImageGeneratedUrl(imageUrl);
                } else {
                    setIsHeroSaved(false);
                    setIsGenerating(false);
                    setImageGeneratedUrl('');
                }
            } catch (error) {
                console.error('Error checking hero save:', error);
                setIsGenerating(false);
                setIsHeroSaved(false);
            }
        };

        if (curCharacter.id.length > 0) {
            fetchData();
        }
    }, [curCharacter, curCharacter.id]);

    const handleGenImage = () => {
        localStorage.setItem("curCharacter", JSON.stringify(curCharacter))
        // Перебросить на отдельную страничку для редактирования генерации
        navigate(PathConstants.EDIT_GEN_IMG, {
            state: {
                imageUrl: imageGeneratedUrl,
                project_id: project_id,
                is_edit: isEdit,
            },
        })
    }

    const topMenu = windowWidth > 1200 ? (
        <>
            <Button onClick={handleGenImage} className='mr-3'>Редактировать</Button>
            <Button onClick={settingHeroHandle} className='mr-3'>Сохранить</Button>
        </>
    ) : (
        <>
            <Button onClick={handleGenImage} className='mr-3' icon={<EditOutlined />} />
            <Button onClick={settingHeroHandle} className='mr-3' icon={<SaveOutlined />} />
        </>
    );

    // Так как запомнием персонажа, с которым работает пользователя, нужно очистить состояние
    // после того, как пользователь переключится на что-то другое и снимент все выделения
    useEffect(() => {
        if (isEmptySelected){
            setCurCharacter({id: '', name: '', is_folder: true});
        }
    }, [isEmptySelected]);

    return (
        <>

            <DashboardHeader title="" />
            <Layout style={{height: '100%'}}>

                <div>
                    <Sider  collapsible={false} onDoubleClick={toggleCollapsed} theme="dark"
                            className="h-screen flex flex-col select-none pt-4 pl-3 pr-1 pb-5"
                            collapsed={collapsed}
                            style={{height: '100%'}}
                    >
                        <div className="folderFileActions">
                            <CreaterWrapper projectId={project_id} treeRef={treeRef}/>
                        </div>
                        {isLoading ? (
                            <Tree height={600} className='tree sidebar-container' />
                        ) : (
                            <Tree
                                key='tree_characters'
                                height={600}
                                className='tree sidebar-container'
                                initialData={data}
                                ref={treeRef}>
                                {({ node, style, dragHandle, tree }) => {
                                    if(node.data.key == curCharacter.id)
                                        tree.props.selection = node.id;
                                    setIsEmptySelected(tree.hasNoSelection);

                                    return (
                                        <NodeTree node={node}
                                                  style={style}
                                                  dragHandle={dragHandle}
                                                  tree={tree}
                                                  setCurCharacter={setCurCharacter}
                                        />
                                    )
                                }}
                            </Tree>)}
                    </Sider>
                </div>

                <Layout>

                    <Content className="flex m-0 16px">
                        <div className="flex-grow p-5">
                            <div className='flex justify-between'>
                                <p style={{color: 'white', position: "relative"}}>
                                    Текущий персонаж: {curCharacter['name']}
                                </p>
                                <div className='flex'>
                                    {imageGeneratedUrl!='' && !isEmptySelected ?
                                        <div> {topMenu} </div>
                                        : <></>
                                    }
                                    <div>
                                        <Button onClick={() => navigate(PathConstants.PROJECT_PAGE,
                                            {state: {project_id: project_id}})}>
                                            В Мой проект
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 flex items-center justify-center">

                                {isGenerating ? <Spin /> :
                                    <>
                                        {
                                            isEmptySelected ?
                                                <Empty description='Выберите персонажа'
                                                       className='text-yellow' /> :
                                                <>
                                                    {curCharacter['name']
                                                    && imageGeneratedUrl == ''
                                                        ?
                                                        <Empty description='Персонаж не сгенерирован'
                                                               className='text-yellow'
                                                               image={Empty.PRESENTED_IMAGE_DEFAULT} /> :
                                                        <ImageCanvas imageUrl={imageGeneratedUrl} />
                                                    }
                                                </>
                                        }
                                    </>
                                }
                            </div>

                        </div>
                        {!curCharacter.is_folder ?
                            <MenuGeneration onFinish={onFinish} />
                            : <></>
                        }

                    </Content>
                </Layout>
            </Layout>
        </>
    );

}
export default withAuth(GenerationHeroPage);