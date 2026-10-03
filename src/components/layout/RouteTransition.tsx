import type {ReactNode} from 'react';
import {useLocation} from 'react-router-dom';

/** Enter the new route immediately; never retain an old form or workspace. */
export default function RouteTransition({children}:{children:ReactNode}) {
 const {pathname}=useLocation();
 return <div key={pathname} className="route-scene">{children}</div>;
}
