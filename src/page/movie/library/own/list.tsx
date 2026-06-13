import React, { useEffect, useState } from 'react';
import { Card, message } from 'antd';
import withAuth from '../../../../utils/auth/check_auth';
import DashboardHeader from '../../../../modules/profile/components/DashboardHeader';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import './style.css';
import {
  fetchProjectList,
  deleteProjectById,
  ProjectListItem,
} from '../../../../api/projects/projectList';
import { backendAssetUrl } from '../../../../api/http';
import { useNavigate } from 'react-router-dom';
import PathConstants from '../../../../routes/pathConstant';
import ProjectCardBadges from './ProjectCardBadges';
import InvitationsBlock from './InvitationsBlock';

const PLACEHOLDER = 'https://placehold.co/195x147';

const ProjectListPage = () => {
  const [projectsList, setProjectList] = useState<ProjectListItem[]>([]);
  const navigate = useNavigate();

  const loadProjects = async () => {
    try {
      const projects = await fetchProjectList();
      setProjectList(projects);
    } catch {
      setProjectList([]);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const deleteProject = async (id: number) => {
    try {
      await deleteProjectById(id);
      setProjectList((prev) => prev.filter((p) => p.id !== id));
      message.success('Проект удалён');
    } catch (e: any) {
      if (e?.response?.status === 403) {
        message.error('Удалить проект может только владелец');
      } else {
        message.error('Не удалось удалить проект');
      }
    }
  };

  const editProject = (projectId: number) => {
    navigate(PathConstants.CREATE_PROJECT, {
      state: { project_id: projectId, is_edit: true },
    });
  };

  const handleClickCard = (projectId: number) => {
    navigate(PathConstants.PROJECT_PAGE, { state: { project_id: projectId } });
  };

  const coverFor = (project: ProjectListItem): string => {
    if (project.coverImageUrl) return backendAssetUrl(project.coverImageUrl);
    return PLACEHOLDER;
  };

  return (
    <>
      <DashboardHeader title="" />
      <main className="app-main library-projects-page text-white">
        <InvitationsBlock onAccepted={loadProjects} />
        <div className="grid grid-cols-4 gap-4 projects-div">
          {projectsList.map((project) => {
            const isOwner = project.currentUserRole === 'owner';
            return (
              <Card
                hoverable
                className="bottom-card"
                key={'my-movie-' + project.id}
                cover={
                  <>
                    <img
                      src={coverFor(project)}
                      alt={project.title}
                      onClick={() => handleClickCard(project.id)}
                    />
                    {/* Owner-only quick actions. Non-owners can't edit/delete the
                        project, so we hide the icons rather than show a 403. */}
                    {isOwner && (
                      <div className="text-right absolute top-1 right-0">
                        <EditOutlined
                          onClick={() => editProject(project.id)}
                          className="text-white text-xl p-2"
                        />
                        <DeleteOutlined
                          onClick={() => deleteProject(project.id)}
                          className="text-white text-xl p-2"
                        />
                      </div>
                    )}
                  </>
                }
              >
                <Card.Meta
                  description={
                    <div className="proj-card-meta">
                      <div className="proj-card-title">{project.title}</div>
                      <ProjectCardBadges project={project} />
                    </div>
                  }
                />
              </Card>
            );
          })}
        </div>
      </main>
    </>
  );
};

export default withAuth(ProjectListPage);
