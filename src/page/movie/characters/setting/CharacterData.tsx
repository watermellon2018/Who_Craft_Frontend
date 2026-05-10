import React, {useEffect, useState} from 'react';
import {Button, Card, Col, Divider, Image, notification, Row, Spin, Steps} from 'antd';
import DashboardHeader from "../../../../modules/profile/components/DashboardHeader";
import './style.css'
import PersonalCharacterData from "./personalInfo";
import {AndroidOutlined, LinkedinOutlined, TwitterOutlined} from "@ant-design/icons";
import TextArea from "antd/es/input/TextArea";
import MotivationCharacterData from "./motivation";
import InsideCharacterData from "./personal";
import CompetionsCharacterData from "./competations";
import IdentifyCharacterData from "./identity";
import PsychologyCharacterData from "./psychologyData";
import {
    create_new_hero,
    select_info_hero_by_id,
} from "../../../../api/characters/basic";
import {useLocation, useNavigate} from "react-router-dom";
import {
    CompetitionI,
    IdentifyI,
    InsideI,
    MotivateI,
    PersonalDataI,
    PsyhoI,
    SettingHero
} from "../../../../api/characters/interfaceHero";
import {
    update_addit_data_hero, update_bio_data_hero,
    update_competition_data_hero, update_development_data_hero, update_identity_data_hero, update_image_data_hero,
    update_inside_data_hero,
    update_motivate_data_hero,
    update_personal_data_hero, update_psyho_data_hero, update_relationship_data_hero
} from "../../../../api/characters/updateSettings";
import {createCharacterFromTreeAPI} from "../../../../api/generation/characters/tree_structure";
import PathConstants from "../../../../routes/pathConstant";


const { Step } = Steps;
interface LocationState {
    is_edit?: boolean;
    project_id?: number;
    character_id?: string;
    name?: string;
    id_leaf?: string;
    imageUrl: string;
}
const CharacterData = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { is_edit, project_id, character_id, name, id_leaf, imageUrl } = location.state as LocationState || {};


    // Значения, которыми мы инициализируем формы при загрузке,
    // подтягивая данные с сервера
    // Затем используется для сохранения предыдущего состояния формы,
    // чтобы отправлять данные той формы, которую обновили и не обращаться ко многим БД
    const [formDataPersonalInit, setFormPersonalInit] = useState<PersonalDataI>();
    const [formDataMotivateInit, setFormMotivateInit] = useState<MotivateI>();
    const [formDataInsideHeroInit, setFormInsideHeroInit] = useState<InsideI>();
    const [formDataCompetitionInit, setFormCompetitionInit] = useState<CompetitionI>();
    const [formDataIdentifyInit, setFormIdentifyInit] = useState<IdentifyI>();
    const [formDataPsychologyInit, setFormPsychologyInit] = useState<PsyhoI>();

    const [developmentHeroTextInit, setDevelopmentHeroTextInit] = useState<string>('');
    const [additInfoTextInit, setAdditInfoTextInit] = useState<string>('');
    const [biographyTextInit, setBiographyTextInit] = useState<string>('');
    const [relationshipTextInit, setRelationshipTextInit] = useState<string>('');


    const [formDataPersonal, setFormPersonal] = useState<PersonalDataI>();
    const [formDataMotivate, setFormMotivate] = useState<MotivateI>();
    const [formDataInsideHero, setFormInsideHero] = useState<InsideI>();
    const [formDataCompetition, setFormCompetition] = useState<CompetitionI>();
    const [formDataIdentify, setFormIdentify] = useState<IdentifyI>();
    const [formDataPsychology, setFormPsychology] = useState<PsyhoI>();

    const [developmentHeroText, setDevelopmentHeroText] = useState<string>('');
    const [additInfoText, setAdditInfoText] = useState<string>('');
    const [biographyText, setBiographyText] = useState<string>('');
    const [relationshipText, setRelationshipText] = useState<string>('');

    const [isLoadData, setIsLoadData] = useState<boolean>(false);


    // При загрузке страницы выгружаем данные с сервера
    useEffect(() => {
        const getCharactersInfo = async () => {
            if (!is_edit)
                return;
            try {
                const response = await select_info_hero_by_id(project_id, character_id);
                if (response.status == 200) {
                    return response.data
                }
            } catch (error){
                console.error('Ошибка при получении информации о персонаже:', error);
            }
        };

        getCharactersInfo().then((data) => {

            const data1 = {
                type: data?.type || 'seconder',
                name: data?.name || name,
                lastName: data?.lastName || "",
                middleName: data?.middleName || "",
                dob: data?.dob || "",
                town: data?.town || "",
            };
            setFormPersonalInit(data1);

            const data2 = {
                forWhat: data?.forWhat || "",
                goal: data?.goal || "",
                philosophy: data?.philosophy || "",
            }
            setFormMotivateInit(data2)

            const data3 = {
                personalTraits: data?.personalTraits || "",
                character: data?.character || "",
                strengthsWeaknesses: data?.strengthsWeaknesses || "",
            }
            setFormInsideHeroInit(data3);

            const data4 = {
                profession: data?.profession || "",
                hobby: data?.hobby || "",
                talents: data?.talents || "",
                mindInfo: data?.mindInfo || "",
                sportInfo: data?.sportInfo || "",
            }
            setFormCompetitionInit(data4);

            const data5 = {
                appearance: data?.appearance || "",
                style: data?.style || "",
                complexs: data?.complexs || "",
                speech: data?.speech || ""
            }
            setFormIdentifyInit(data5);

            const data6 = {
                character: data?.character || "",
                insideConflict: data?.insideConflict || ""
            }
            setFormPsychologyInit(data6);

            const dev = data?.development || ""
            const addit = data?.additInfo || ""
            const bio = data?.biography || ""
            const rel = data?.relationship || ""
            setDevelopmentHeroTextInit(dev);
            setAdditInfoTextInit(addit);
            setBiographyTextInit(bio);
            setRelationshipTextInit(rel);



            // Так как выше это инициализация начального (прошлого состояния), которое
            // применяется лишь при сравнении сохранения, а не заполнении форму
            // необходимо заполнить значения, которые отвечают за форму
            setFormPersonal(data1);
            setFormMotivate(data2);
            setFormInsideHero(data3);
            setFormCompetition(data4);
            setFormIdentify(data5);
            setFormPsychology(data6);

            setDevelopmentHeroText(dev);
            setAdditInfoText(addit);
            setBiographyText(bio);
            setRelationshipText(rel);

            setIsLoadData(true);
        });

    }, [])


    const [currentRequiredF, setCurrentRequiredF] = useState<number>(0);
    const [currentStep, setCurrentStep] = useState<number>(0);

    const handleNextStepRequiredF = () => {
        setCurrentRequiredF(currentRequiredF + 1);
    };
    const handlePrevStepRequiredF = () => {
        setCurrentRequiredF(currentRequiredF - 1);
    };

    const handleNextStep = () => {
        setCurrentStep(currentStep + 1);
    };
    const handlePrevStep = () => {
        setCurrentStep(currentStep - 1);
    };

    const isEqual = (obj1: any, obj2: any): boolean => {
        // Сравниваем количество ключей у объектов
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (keys1.length !== keys2.length) {
            return false;
        }

        // Сравниваем значения свойств объектов
        for (const key of keys1) {
            if (obj1[key] !== obj2[key]) {
                return false;
            }
        }

        return true;
    }

    const createCreateNewHero = async (project_id: number) => {
        try {
            const data: SettingHero = {
                image: imageUrl,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                personal: formDataPersonal!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                motivate: formDataMotivate!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                insideHero: formDataInsideHero!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                competition: formDataCompetition!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                identify: formDataIdentify!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                psyho: formDataPsychology!,
                development: developmentHeroText,
                additInfo: additInfoText,
                bio: biographyText,
                relationship: relationshipText,
            }
            const response = await create_new_hero(data, project_id);
            if(response.status == 200){
                navigate(-1);
            }
            return response.data;
        } catch (error) {
            console.error('Ошибка при получении списка жанров:', error);
        }
    }


    const handleSaveSettingHero = () => {
        if (!is_edit) {
            if(project_id !== undefined){
                createCreateNewHero(project_id).then((data) => {
                        const heroID = data['heroId']
                        notification['success']({
                            message: 'Персонаж создан!',
                            description: 'Ура!',
                        });

                        // сохраняем персонажа в дереве
                        // удаляем из кэша, теперь герой будет подгружаться из БД
                        const project_id = JSON.parse(localStorage.getItem('projectInfoCache')!)['id']
                        const curStateTreeLeaf = localStorage.getItem("treeLeaf_"+project_id)!;
                        if(curStateTreeLeaf && id_leaf && curStateTreeLeaf.length > 0) {
                            const storedValue = JSON.parse(curStateTreeLeaf);

                            for (let i = 0; i < storedValue.length; i++) {
                                const id = storedValue[i][0];
                                if (id_leaf == id) {
                                    const leafData = storedValue[i]

                                    createCharacterFromTreeAPI(id_leaf, leafData[1], leafData[2], leafData[3], leafData[4], heroID).then(() => {
                                        storedValue.splice(i, 1);
                                        const updatedValue = JSON.stringify(storedValue);
                                        localStorage.setItem("treeLeaf_" + project_id, updatedValue);
                                    });
                                    break
                                }
                            }
                        }

                        navigate(-1);
                    }
                );
                return true;
            }
            notification['error']({
                message: 'Персонаж не создан!',
                description: 'Проблемы с созданием героя, похоже не создался проект!',
            });
            navigate(-1);
            return false;
        }

        const updateData = async (data: any,
                                  dataInit: any,
                                  updateFunction: (data: any, projectId: number | undefined, characterId: string | undefined) => Promise<any>,
                                  setInitFunction: React.Dispatch<React.SetStateAction<any>>) => {
            const isDifferent = typeof data === 'string' ? data !== dataInit : !isEqual(data, dataInit);
            if (isDifferent) {
                await updateFunction(data, project_id, character_id).then(() => {
                    setInitFunction(data);

                });
            }
        };
        update_image_data_hero(imageUrl, project_id, character_id).then(() => {
            updateData(formDataPersonal, formDataPersonalInit, update_personal_data_hero, setFormPersonalInit);
            updateData(formDataMotivate, formDataMotivateInit, update_motivate_data_hero, setFormMotivateInit);
            updateData(formDataInsideHero, formDataInsideHeroInit, update_inside_data_hero, setFormInsideHeroInit);
            updateData(formDataCompetition, formDataCompetitionInit, update_competition_data_hero, setFormCompetitionInit);
            updateData(formDataIdentify, formDataIdentifyInit, update_identity_data_hero, setFormIdentifyInit);
            updateData(formDataPsychology, formDataPsychologyInit, update_psyho_data_hero, setFormPsychologyInit);
            updateData(developmentHeroText, developmentHeroTextInit, update_development_data_hero, setDevelopmentHeroTextInit);
            updateData(additInfoText, additInfoTextInit, update_addit_data_hero, setAdditInfoTextInit);
            updateData(biographyText, biographyTextInit, update_bio_data_hero, setBiographyTextInit);
            updateData(relationshipText, relationshipTextInit, update_relationship_data_hero, setRelationshipTextInit);
            notification['success']({
                message: 'Информация о персонаже сохранена!',
                description: 'Ура!',
            });
            navigate(PathConstants.PROJECT_PAGE, {state: {project_id: project_id}});
        });
    }

    const handleBackStep = () => {
        navigate(-1);
    }

    const regenerateHero = () => {
        const curCharacter = {
            id: location.state.character_id,
            name: formDataPersonal?.name || '',
            is_folder: false,
        }

        localStorage.setItem('is_edit', 'true');
        navigate(PathConstants.GENERATING,
            {state: {
                    project_id: project_id,
                    regenerated: true,
                    imageUrl: imageUrl,
                    curCharacter: curCharacter,
                }})
    }


    return (
        <>
            <DashboardHeader title="" />


            <div className="min-w-full setting-hero-page p-4 bg-gray-800 min-h-screen text-white">
                <h1 className="text-3xl font-bold mb-4">Настройки информации о персонаже</h1>
                <Divider style={{ borderColor: 'rgba(250, 176, 5, 0.6)'}} />
                {!isLoadData ? <Spin /> : <>

                    <Row gutter={[16, 16]} className='mb-5'>
                        <Col style={{marginRight: '5px'}} span={7}>
                            <Image
                                src={imageUrl}
                                style={{width: '100%'}}
                            />
                            <p className='text-[#fab005] hover:text-white'
                               onClick={regenerateHero}
                            >
                                Перегенерировать персонажа
                            </p>
                        </Col>

                        <Col span={8}>
                            <h1 className="text-2xl font-bold mb-4">Личные данные</h1>
                            <Card className="card-form">
                                <div className="flex">
                                    <Steps size="small" direction="vertical" current={currentRequiredF}>
                                        <Step icon={<AndroidOutlined />} />
                                        <Step icon={<TwitterOutlined />} />
                                        <Step icon={<LinkedinOutlined />} />
                                    </Steps>
                                    <div className="form-data-character">
                                        {currentRequiredF === 0 && (
                                            <PersonalCharacterData formData={formDataPersonal}
                                                                   setFormData={setFormPersonal} />
                                        )}
                                        {currentRequiredF === 1 && (
                                            <MotivationCharacterData formData={formDataMotivate}
                                                                     setFormData={setFormMotivate} />
                                        )}
                                        {currentRequiredF === 2 && (
                                            <InsideCharacterData formData={formDataInsideHero}
                                                                 setFormData={setFormInsideHero} />
                                        )}
                                    </div>
                                </div>
                            </Card>

                            <div className="control-steps-div flex justify-end mt-3">
                                {currentRequiredF > 0 && (
                                    <Button className="min-w-100" style={{ marginRight: '8px' }} onClick={handlePrevStepRequiredF}>
                                        Назад
                                    </Button>
                                )}
                                {currentRequiredF < 2 && (
                                    <Button className="min-w-100" onClick={handleNextStepRequiredF}>
                                        Дальше
                                    </Button>
                                )}
                            </div>
                            <div className='relationship-info-card'>

                                <h1 className="text-2xl font-bold mb-4">Отношения с другими героями</h1>
                                <Card className="card-form ">
                                    <TextArea
                                        value={relationshipText}
                                        onChange={(e) => setRelationshipText(e.target.value)}
                                        rows={6}
                                    />
                                </Card>
                            </div>
                        </Col>

                        <Col span={8}>
                            <h1 className="text-2xl font-bold mb-4">Биография персонажа</h1>
                            <Card className="card-form biography-card" style={{height: '500px'}}>
                                <TextArea
                                    value={biographyText}
                                    onChange={(e) => setBiographyText(e.target.value)}
                                    name='biography-hero'
                                    placeholder='Напишите информацию о жизни персонажа'
                                    style={{height: '100%', width: '100%'}} />
                            </Card>
                        </Col>

                    </Row>


                    <Row gutter={[16, 16]}>
                        <Col>
                            <h1 className="text-2xl font-bold mb-4">Особенности</h1>
                            <Card className="card-form competitions">
                                <div className="flex">
                                    <Steps size="small" direction="vertical" current={currentStep}>
                                        <Step icon={<AndroidOutlined />} />
                                        <Step icon={<TwitterOutlined />} />
                                        <Step icon={<LinkedinOutlined />} />
                                    </Steps>
                                    <div className="form-data-character">
                                        {currentStep === 0 && (
                                            <CompetionsCharacterData
                                                formData={formDataCompetition}
                                                setFormData={setFormCompetition}
                                            />
                                        )}
                                        {currentStep === 1 && (
                                            <IdentifyCharacterData
                                                formData={formDataIdentify}
                                                setFormData={setFormIdentify}
                                            />
                                        )}
                                        {currentStep === 2 && (
                                            <PsychologyCharacterData
                                                formData={formDataPsychology}
                                                setFormData={setFormPsychology}
                                            />
                                        )}
                                    </div>
                                </div>

                            </Card>

                            <div className="control-steps-div flex justify-end mt-3">
                                {currentStep > 0 && (
                                    <Button className="min-w-100"
                                            style={{ marginRight: '8px' }}
                                            onClick={handlePrevStep}>
                                        Назад
                                    </Button>
                                )}
                                {currentStep < 2 && (
                                    <Button className="min-w-100" onClick={handleNextStep}>
                                        Дальше
                                    </Button>
                                )}
                            </div>
                        </Col>

                        <Col span={8}>
                            <h1 className="text-2xl font-bold mb-4">Развитие персонажа</h1>
                            <Card className="card-form biography-card" style={{height: '500px'}}>
                                <TextArea
                                    value={developmentHeroText}
                                    onChange={(e) => setDevelopmentHeroText(e.target.value)}
                                    name='development-hero'
                                    placeholder='Напишите информацию персонаже по мере развития развития истории'
                                    style={{height: '100%'}} />
                            </Card>
                        </Col>

                        <Col span={7}>
                            <div className='additional-info-card'>
                                <h1 className="text-2xl font-bold mb-4">Дополнительная информация</h1>

                                <Card className="card-form ">
                                    <TextArea
                                        value={additInfoText}
                                        onChange={(e) => setAdditInfoText(e.target.value)}
                                        rows={16} />
                                </Card>
                            </div>



                            <div className="justify-end flex mt-3">
                                <Button className="min-w-150 mr-5" type="primary" onClick={handleBackStep}>
                                    Назад
                                </Button>
                                <Button className="min-w-150" type="primary" onClick={handleSaveSettingHero}>
                                    Сохранить настройки
                                </Button>
                            </div>
                        </Col>
                    </Row>

                </>
                }
            </div>
        </>
    );
}

export default CharacterData;
