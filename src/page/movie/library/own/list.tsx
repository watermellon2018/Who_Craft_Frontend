import React, { useCallback, useEffect, useState } from 'react';
import { Card, message } from 'antd';
import withAuth from '../../../../utils/auth/check_auth';
import DashboardHeader from '../../../../modules/profile/components/DashboardHeader';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import './style.css';
import {
  fetchProjectList,
  deleteProjectById,
} from '../../../../api/projects/projectList';
import type { ProjectListItem } from '../../../../api/projects/projectList';
import { backendAssetUrl } from '../../../../api/http';
import { useNavigate } from 'react-router-dom';
import {projectDashboardPath, projectEditPath} from '../../../../routes/pathConstant';
import {getApiStatus} from '../../../../api/errors';
import ProjectCardBadges from './ProjectCardBadges';
import InvitationsBlock from './InvitationsBlock';

export const ProjectListPage = () => {
  const [projectsList, setProjectList] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const navigate = useNavigate();

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const projects = await fetchProjectList();
      setProjectList(projects);
    } catch {
      setProjectList([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const deleteProject = async (id: number) => {
    try {
      await deleteProjectById(id);
      setProjectList((prev) => prev.filter((p) => p.id !== id));
      message.success('Проект удалён');
    } catch (requestError: unknown) {
      if (getApiStatus(requestError) === 403) {
        message.error('Удалить проект может только владелец');
      } else {
        message.error('Не удалось удалить проект');
      }
    }
  };

  const editProject = (projectId: number) => {
    navigate(projectEditPath(projectId));
  };

  const handleClickCard = (projectId: number) => {
    navigate(projectDashboardPath(projectId));
  };

  const coverFor = (project: ProjectListItem): string | null => {
    if (project.coverImageUrl) return backendAssetUrl(project.coverImageUrl);
    return null;
  };

  const activeProjects = projectsList.filter((project) => project.status !== 'archived');
  const archivedProjects = projectsList.filter((project) => project.status === 'archived');

  const renderProjectCards = (projects: ProjectListItem[]) => (
    <div className="grid grid-cols-4 gap-4 projects-div">
      {projects.map((project) => {
        const coverUrl = coverFor(project);
        const isOwner = project.currentUserRole === 'owner';
        return (
          <Card
            hoverable
            className="bottom-card"
            key={'my-movie-' + project.id}
            cover={
              <>
                {coverUrl ? (
                  <img
                    className="project-card-cover-image"
                    src={coverUrl}
                    alt={project.title}
                    onClick={() => handleClickCard(project.id)}
                  />
                ) : (
                  <button
                    type="button"
                    className="project-card-placeholder"
                    aria-label={`Открыть проект «${project.title}»`}
                    onClick={() => handleClickCard(project.id)}
                  >
                    <span className="project-card-placeholder-icon" aria-hidden="true">+</span>
                    <span>Обложка проекта</span>
                  </button>
                )}
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
  );

  return (
    <>
      <DashboardHeader title="" />
      <main className="app-main library-projects-page">
        <InvitationsBlock onAccepted={loadProjects} />
        {loading && (
          <div className="projects-state" role="status">
            <span className="projects-state-spinner" aria-hidden="true" />
            <h2>Загружаем проекты…</h2>
            <p>Это займёт всего несколько секунд.</p>
          </div>
        )}

        {!loading && loadError && (
          <div className="projects-state projects-state-error" role="alert">
            <h2>Не удалось загрузить проекты</h2>
            <p>Проверьте подключение и попробуйте ещё раз.</p>
            <button type="button" className="projects-retry-button" onClick={loadProjects}>
              Повторить
            </button>
          </div>
        )}

        {!loading && !loadError && projectsList.length === 0 && (
          <div className="projects-state projects-state-empty">
            <span className="projects-empty-icon" aria-hidden="true">+</span>
            <h2>У вас пока нет проектов</h2>
            <p>Создайте первый проект, и он появится в этой библиотеке.</p>
          </div>
        )}

        {!loading && !loadError && projectsList.length > 0 && (
          <>
            <section className="projects-active-section" aria-label="Активные проекты">
              {activeProjects.length > 0 ? renderProjectCards(activeProjects) : (
                <div className="projects-state projects-state-empty">
                  <h2>Активных проектов пока нет</h2>
                  <p>Архивные проекты доступны в разделе ниже.</p>
                </div>
              )}
            </section>

            {archivedProjects.length > 0 && (
              <details className="archived-projects">
                <summary className="archived-projects-summary">
                  <span>Архивные проекты</span>
                  <span
                    className="archived-projects-count"
                    aria-label={`Архивных проектов: ${archivedProjects.length}`}
                  >
                    {archivedProjects.length}
                  </span>
                </summary>
                <div className="archived-projects-content">
                  {renderProjectCards(archivedProjects)}
                </div>
              </details>
            )}
          </>
        )}
      </main>
    </>
  );
};

export default withAuth(ProjectListPage);
