import {useEffect, useState} from 'react';
import {characterApi} from '../api/characterApi';
import type {ImageModelCatalog} from '../types/character.types';
import {PERSONAL_API_SETTINGS_CHANGED} from '../../personal-api/api/personalApi';

interface ImageModelCatalogState {
  catalog: ImageModelCatalog | null;
  error: boolean;
  loading: boolean;
}

const initialState: ImageModelCatalogState = {
  catalog: null,
  error: false,
  loading: true,
};

export function useImageModelCatalog(projectId?: string | number): ImageModelCatalogState {
  const [state, setState] = useState(initialState);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(PERSONAL_API_SETTINGS_CHANGED, refresh);
    return () => window.removeEventListener(PERSONAL_API_SETTINGS_CHANGED, refresh);
  }, []);

  useEffect(() => {
    let active = true;
    setState(initialState);

    characterApi.getImageModelCatalog(projectId)
      .then((response) => {
        if (active) {
          setState({catalog: response.data, error: false, loading: false});
        }
      })
      .catch(() => {
        if (active) {
          setState({catalog: null, error: true, loading: false});
        }
      });

    return () => {
      active = false;
    };
  }, [projectId, revision]);

  return state;
}
