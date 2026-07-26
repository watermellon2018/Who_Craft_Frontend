import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import PathConstants from '../../routes/pathConstant';
import { getStoredUserToken } from '../../api/http';

/**
 * HOC that gates a page on the presence of an auth token.
 *
 * Source of truth is ``localStorage[userId]`` via ``getStoredUserToken``.
 * The legacy ``Cookies.get('id')`` check is gone — login/register only write
 * to localStorage now, and keeping both stores caused desync when one was
 * cleared by hand.
 */
function withAuth<P extends object>(Component: React.ComponentType<P>) {
    const WithAuth: React.FC<P> = (props) => {
        const navigate = useNavigate();
        const isLoggedIn = !!getStoredUserToken();

        useEffect(() => {
            if (!isLoggedIn) {
                navigate(PathConstants.AUTH);
            }
        }, [isLoggedIn, navigate]);

        return isLoggedIn ? <Component {...props} /> : null;
    };
    WithAuth.displayName = `withAuth(${Component.displayName || Component.name || 'Component'})`;
    return WithAuth;
}

export default withAuth;
