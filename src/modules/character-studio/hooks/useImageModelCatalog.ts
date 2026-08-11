import {useEffect, useState} from 'react';
import {characterApi} from '../api/characterApi';
import type {ImageModelCatalog} from '../types/character.types';

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
  }, [projectId]);

  return state;
}
