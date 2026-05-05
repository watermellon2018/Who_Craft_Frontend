import React, {useEffect, useState} from 'react';
import {Card, Col, Divider as DivLine, Image, Row, Spin} from 'antd';
import {EditOutlined, DeleteOutlined, PlusOutlined} from '@ant-design/icons';
import {useLocation, useNavigate} from "react-router-dom";
import withAuth from "../../utils/auth/check_auth";
import HeaderComponent from "../main/header";
import {select_info_hero_by_id} from "../../api/characters/basic";
import PathConstants from "../../routes/pathConstant";
import {SettingHero} from "../../api/characters/interfaceHero";
import { Divider, Typography } from 'antd';


interface HeroCard {
    id: string;
    key: string;
    // src: string;
    name: string;
    src: string;
}


function convertValueRole2String(txt: string) {
    if (txt == "seconder")
        return "Второстепенный";
    else if (txt == "main")
        return "Главный"
    return "Эпиходический"
}
const HeroPage = () => {
    const { Title, Paragraph, Text, Link } = Typography;
    const location = useLocation();
    const navigate = useNavigate();
    const { project_id, character_id, imageUrl } = location.state || {};

    const [fullName, setFullName] = useState<string>('');
    const [infoHero, setInfoHero] = useState<any>();

    const [isLoad, setIsLoad] = useState<boolean>(false);

    useEffect(() => {
        const getCharactersInfo = async () => {
            try {
                const response = await select_info_hero_by_id(project_id, character_id);
                if (response.status == 200) {
                    return response.data
                }
            } catch (error) {
                console.error('Ошибка при получении информации о персонаже:', error);
            }
        };

        getCharactersInfo().then(data => {
            console.log(data);
            const nameHero = data.name;
            const middleName = data.middleName;
            const lastName = data.lastName;
            const name = lastName + ' ' + nameHero + ' ' + middleName
            setFullName(name);

            setInfoHero(data);
            setIsLoad(true);

        })
    }, []);


    return (
        <>
            <HeaderComponent />

            {isLoad ?
                <div className="min-w-full setting-hero-page p-4 bg-gray-800 min-h-screen text-white">
                    <h1 className="text-3xl font-bold mb-4">Персонаж {fullName}</h1>
                    <DivLine style={{ borderColor: 'rgba(250, 176, 5, 0.6)'}} />

                    <Row>
                        <Col span={10}>

                            <Image
                                src={imageUrl}
                                style={{width: '100%'}}
                            />
                        </Col>

                        <Col span={14}>
                            <div>

                                <Typography>
                                    <Title>Персональные качества</Title>

                                    <Paragraph>
                                        В разделе представлена краткая основная информация о персонаже.
                                        О дате рождения, какую роль испольнит в истории:
                                        главную, второстепенную или эпизодическую. А также
                                        представлена информация, откуда персонаж.
                                    </Paragraph>
                                    <Paragraph>
                                        {infoHero.dob !== "" && <>Дата рождения: {infoHero.dob}<br /></>}

                                        {infoHero.type !== "" && <>Роль персонажа: {convertValueRole2String(infoHero.type)}<br /></>}
                                        {infoHero.town !== "" && <>Откуда: {infoHero.town}<br /></>}
                                    </Paragraph>

                                    <Title level={2}>Роль в истории</Title>
                                    <Paragraph>
                                        {infoHero.forWhat !== "" && <>Для чего введен персонаж в историю: {infoHero.forWhat}<br /></>}
                                        {infoHero.goal !== "" && <>Цели: {infoHero.goal}<br /></>}
                                        {infoHero.philosophy !== "" && <>Психология персонажа: {infoHero.philosophy}<br /></>}
                                    </Paragraph>


                                    <Title level={2}>Внутренние качества</Title>
                                    <Paragraph>
                                        {infoHero.personalTraits !== "" && <>Личные чертны: {infoHero.personalTraits}<br /></>}
                                        {infoHero.character !== "" && <>Характер: {infoHero.character}<br /></>}
                                        {infoHero.strengthsWeaknesses !== "" && <>Сильные и слабые стороны: {infoHero.strengthsWeaknesses}<br /></>}
                                    </Paragraph>

                                    <Title level={2}>Компетенции</Title>
                                    <Paragraph>
                                        {infoHero.profession !== "" && <>Основной род деятельности: {infoHero.profession}<br /></>}
                                        {infoHero.hobby !== "" && <>Хобби: {infoHero.hobby}<br /></>}
                                        {infoHero.talents !== "" && <>Таланты: {infoHero.talents}<br /></>}
                                        {infoHero.mindInfo !== "" && <>Умственные способности: {infoHero.mindInfo}<br /></>}
                                        {infoHero.sportInfo !== "" && <>Физические способности: {infoHero.sportInfo}<br /></>}
                                    </Paragraph>

                                    <Title level={2}>Идентичность</Title>
                                    <Paragraph>
                                        {infoHero.appearance !== "" && <>Внешний вид: {infoHero.appearance}<br /></>}
                                        {infoHero.style !== "" && <>Стиль: {infoHero.style}<br /></>}
                                        {infoHero.complexs !== "" && <>Комплексы: {infoHero.complexs}<br /></>}
                                        {infoHero.speech !== "" && <>Особенности речи: {infoHero.speech}<br /></>}
                                    </Paragraph>

                                    <Title level={2}>Остальное</Title>
                                    <Paragraph>
                                        {infoHero.character !== "" && <>Психическое состояние: {infoHero.character}<br /></>}
                                        {infoHero.insideConflict !== "" && <>Внутренние конфликты: {infoHero.insideConflict}<br /></>}
                                        {infoHero.development !== "" && <>Развитие персонажа с течением истории: {infoHero.development}<br /></>}
                                        {infoHero.additInfo !== "" && <>Дополнительная информация: {infoHero.additInfo}<br /></>}
                                        {infoHero.relationship !== "" && <>Отношения с другими героями: {infoHero.relationship}<br /></>}
                                    </Paragraph>

                                    <Title level={2}>Биография</Title>
                                    <Paragraph>
                                        {infoHero.bio !== "" && <>{infoHero.bio}<br /></>}
                                    </Paragraph>
                                </Typography>
                            </div>
                        </Col>
                    </Row>

                    <DivLine style={{ borderColor: 'rgba(250, 176, 5, 0.6)'}} />
                    <h1 className="text-3xl font-bold mb-4">Галерея</h1>

                    Тут фотки

                    <DivLine style={{ borderColor: 'rgba(250, 176, 5, 0.6)'}} />
                    <h1 className="text-3xl font-bold mb-4">Граф</h1>
                    тут граф
                </div> : <></> }

        </>
    );
}

export default withAuth(HeroPage);
