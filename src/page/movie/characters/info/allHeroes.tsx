import React, {useEffect, useState} from 'react';
import {Button, Card, Checkbox, Layout, Radio, Select, Spin} from 'antd';
import {EditOutlined, DeleteOutlined, PlusOutlined} from '@ant-design/icons';
import {useLocation, useNavigate} from "react-router-dom";
import {delete_hero_by_id, get_all_heros_project} from "../../../../api/characters/basic";
import withAuth from "../../../../utils/auth/check_auth";
import pathConstant from "../../../../routes/pathConstant";
import DashboardHeader from "../../../../modules/profile/components/DashboardHeader";
import '../../../global.css';
import GraphEditor from "./graph";

interface HeroCard {
    id: string;
    key: string;
    // src: string;
    name: string;
    role: 'main' | 'seconder' | 'episode';
    src: string;
}

const AllHeroesPage = () => {
    const navigate = useNavigate();
    const [characterList, setCharacterList] = useState<HeroCard[]>([]);
    const location = useLocation();
    const { project_id } = location.state || {};
    const [isLoadData, setIsLoadData] = useState<boolean>(false);

    const [filterType, setFilterType] = useState<'main' | 'seconder' | 'episode' | 'none'>('none');
    const [sortType, setSortType] = useState<'role' | 'name'>('role');
    const [isHoveredCard, setIsHoveredCard] = useState<number>(0);

    const role2Index: Record<'main' | 'seconder' | 'episode', 1 | 2 | 3> = {
        'main': 1,
        'seconder': 2,
        'episode': 3,
    }

    useEffect(() => {

        const getAllHeros = async () => {
            try {
                const response: any = await get_all_heros_project(project_id);

                const data = response.data.map((hero:HeroCard) => ({
                    id: hero.id,
                    src: hero.src ? 'data:image/jpeg;base64,' + hero.src : 'https://placehold.co/195x147',
                    name: hero.name,
                    key: hero.name + hero.id,
                    role: hero.role,
                }));
                setCharacterList(data);

            } catch (error) {
                console.error('Ошибка при получении списка проектов:', error);
                setCharacterList([]);
            }
        };

        getAllHeros().then(() => setIsLoadData(true));
    }, []);

    const deleteProject = async (id: string) => {

        try {
            await delete_hero_by_id(project_id, id);
            const updatedList = characterList.filter(hero => hero.id !== id);
            setCharacterList(updatedList);
        } catch (error) {
            console.error('Ошибка при получении списка персонажей:', error);
            setCharacterList([]);
        }
    }

    const clickProjectHandle = () => {
        navigate(pathConstant.GENERATING, { state: { is_edit: false , project_id: project_id} })
    };

    const cardClickHandle = (id_character: string, imgUrl: string) => {
        navigate(pathConstant.SETTING_HERO,
            { state: { is_edit: true ,
                    project_id: project_id,
                    character_id: id_character,
                    imageUrl: imgUrl,
                } })
    };

    const sortByField = (array: HeroCard[], field: keyof HeroCard) => {
        return array.slice().sort((a, b) => {
            if (a[field] < b[field]) {
                return -1;
            }
            if (a[field] > b[field]) {
                return 1;
            }
            return 0;
        });
    };

    useEffect(() => {
        const sortedCharacterList = sortByField(characterList, sortType);
        setCharacterList(sortedCharacterList);
    }, [sortType]);

    const handleFilter = (e: any) => {
        setFilterType(e.target.value);
    }


    if (!isLoadData)
        return (<Spin />);

    return (
        <>
            <DashboardHeader title="" />
            <div className="project-page p-4 bg-gray-800 min-h-screen text-white">
                <div className='flex justify-between'>
                    <h1 className="text-xl min-h-200 font-bold mb-4">Список персонажей</h1>

                    <div className='flex'>

                        <p style={{lineHeight: '2.0', marginRight: '10px'}}>Сортировать по:</p>
                        <Select defaultValue={sortType}
                                onChange={setSortType}
                                style={{ width: 120, marginRight: '10px' }}>
                            <Select.Option value="role">роли</Select.Option>
                            <Select.Option value="name">имени</Select.Option>
                        </Select>

                        <Select
                            defaultValue="role"
                            style={{ width: 200 }}
                            dropdownRender={menu => (
                                <div>
                                    {menu}
                                    <Radio.Group defaultValue={filterType} style={{ padding: '8px 12px', width: '100%' }} onChange={handleFilter}>
                                        <Radio value="main">Главная</Radio>
                                        <Radio value="seconder">Второстепенная</Radio>
                                        <Radio value="episode">Эпизодическая</Radio>
                                        <Radio value="none">Отключить</Radio>
                                    </Radio.Group>
                                </div>
                            )}
                        >
                            <Select.Option value="role">Фильтр по роли</Select.Option>
                        </Select>
                        <Button className='ml-4' onClick={clickProjectHandle}>Добавить</Button>
                    </div>
                </div>

                <div className="p-2 div-card-seq grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {characterList.filter(item => filterType === 'none' ? true : item.role === filterType)
                        .map((character, index) => (
                        <Card
                            hoverable
                            className='effect-button-div bottom-card'
                            key={'my-movie-'+index}
                            cover={<>
                                <img
                                    className='fixed-size'
                                    src={character.src}
                                    onMouseEnter={() => setIsHoveredCard(index+1)}
                                    onMouseLeave={() => setIsHoveredCard(0)}
                                    // onClick={}
                                />
                                <div style={{
                                    position: 'absolute',
                                    top: -16,
                                    right: -10,
                                    backgroundColor: 'rgba(250, 176, 5, 0.7)',
                                    borderRadius: '10%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    color: 'white',
                                    fontSize: '16px'
                                }}>
                                    {role2Index[character.role]}
                                </div>
                                {isHoveredCard==(index+1) && (<div
                                    style={{backgroundColor: 'rgba(0, 0, 0, 0.3)'}}
                                    className="text-right absolute top-0 right-0">
                                    <EditOutlined
                                        onClick={() => cardClickHandle(character.id, character.src)}
                                        className="text-white text-xl p-2" />
                                    <DeleteOutlined
                                        onClick={() => deleteProject(character.id)}
                                        className="text-white text-xl p-2" />
                                </div>
                                )}
                            </>
                            }
                        >
                            <Card.Meta
                                className='pl-1'
                                description={character.name} />
                        </Card>
                    ))}
                </div>
                <div>
                    <h1 className="text-xl min-h-200 font-bold mb-4">Граф персонажей</h1>
                    <div>
                        <GraphEditor nodes={characterList} />
                    </div>
                </div>
            </div>
        </>
    );
};

export default withAuth(AllHeroesPage);
