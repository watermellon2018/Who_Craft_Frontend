import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import PathConstants from '../../routes/pathConstant';
import { getStoredUserToken } from '../../api/http';
import { currentReturnTo } from './returnTo';

/**
 * HOC that gates a page on the presence of an auth token.
 *
 * Source of truth is the access token returned by ``getStoredUserToken``.
 * The legacy ``Cookies.get('id')`` check is gone — login/register only write
 * to shared browser token storage now. Keeping cookies in parallel caused desync
 * when one credential source was cleared by hand.
 */
function withAuth<P extends object>(Component: React.ComponentType<P>) {
    const WithAuth: React.FC<P> = (props) => {
        const navigate = useNavigate();
        const location = useLocation();
        const isLoggedIn = !!getStoredUserToken();

        useEffect(() => {
            if (!isLoggedIn) {
                navigate(PathConstants.AUTH, {
                    replace: true,
                    state: { returnTo: currentReturnTo(location) },
                });
            }
        }, [isLoggedIn, location, navigate]);

        return isLoggedIn ? <Component {...props} /> : null;
    };
    WithAuth.displayName = `withAuth(${Component.displayName || Component.name || 'Component'})`;
    return WithAuth;
}

export default withAuth;
