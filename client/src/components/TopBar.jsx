import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TopBar() {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" />
          Lesion Scan Dashboard
        </Link>
        <div className="topbar-user">
          <span>
            Dr. {user.name}
            {user.hospital ? ` · ${user.hospital}` : ''}
          </span>
          <button className="btn ghost small" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <Outlet />
    </>
  );
}
