import React, {useEffect, useMemo, useState} from 'react';
import HeaderComponent from "../../main/header";
import withAuth from "../../../utils/auth/check_auth";
import './style.css'
import CharactersCard from "./charactersCard";
import LocationsCard from "./locationsCard";
import MusicsCard from "./musicsCard";
import {useLocation, useNavigate} from "react-router-dom";
import {get_info_project} from "../../../api/projects/properties/project";
import {ProjectI} from "../../../api/projects/interface";
import {Button} from "antd";
import PathConstants from "../../../routes/pathConstant";

const ProjectPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { project_id } = location.state || {};
    const [project, setProject] = useState<ProjectI>();

    const toLibraryClick = () => {
        navigate(PathConstants.PROJECTS);
    }

    const toScriptPage = () => {
        navigate(PathConstants.SCRIPT_PAGE);
    }

    useEffect(() => {
        if (!project_id) {
            throw new Error('Страница проекта! Нет информации о текущем проекте');
        }

        const getProjectInfo = async () => {
            const projectInfoCache = localStorage.getItem('projectInfoCache');
            if (projectInfoCache) {
                const projectObj = JSON.parse(projectInfoCache);
                if (projectObj.id === project_id) {
                    setProject(projectObj);
                    return;
                }
            }

            const curProject = await get_info_project(project_id);
            if (curProject.status) {
                setProject(curProject.data);
                localStorage.setItem('projectInfoCache', JSON.stringify(curProject.data));
            }
        };

        getProjectInfo();
    }, [project_id]);


    const memoizedProject = useMemo(() => project, [project]);


    return (

        <>
            <HeaderComponent />
            <div className="project-page p-4 bg-gray-800 min-h-screen text-white">
                <div className='flex justify-between'>
                <div className="mb-4 ml-5">
                    <h1 className="text-3xl font-bold mb-4">Проект {memoizedProject?.title || ''}</h1>
                    Добавьте персонажей, локации и музыку
                </div>
                    <div>
                    <Button type='primary' style={{marginRight: '10px'}} onClick={toScriptPage}>К сценарию</Button>
                    <Button onClick={toLibraryClick}>В библиотеку</Button>
                </div>
            </div>

                <CharactersCard />
                <LocationsCard />
                <MusicsCard />
            </div>
        </>
    );
}

export default withAuth(ProjectPage);
