import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import "./Layout.css";
import { useAuth } from "../hooks/useAuth";

export default function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navItems = [
    { to: "/", label: "资源看板" },
    { to: "/my", label: "我的容器" },
    { to: "/workspace", label: "工作区" },
    { to: "/profile", label: "个人资料" },
    ...(user?.role === "admin" ? [{ to: "/admin", label: "管理" }] : []),
  ];

  return (
    <div className="layout">
      {/* 侧边栏 - 桌面端 */}
      <aside className="sidebar">
        <Link to="/" className="sidebar-logo">
          <span className="sidebar-logo-icon">⚡</span>
          Lab GPU
        </Link>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={loc.pathname === item.to ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <span className="user-name">{user?.display_name || user?.username}</span>
            <span className="user-role">{user?.role === "admin" ? "管理员" : "学生"}</span>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost" style={{ marginTop: "0.5rem", width: "100%" }}>
            退出登录
          </button>
        </div>
      </aside>

      {/* 移动端顶栏 */}
      <div className="layout-mobile-header">
        <Link to="/" className="sidebar-logo">
          ⚡ Lab GPU
        </Link>
        <nav className="layout-mobile-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={loc.pathname === item.to ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="layout-mobile-user">
          <span>{user?.display_name || user?.username}</span>
          <button onClick={handleLogout} className="btn btn-ghost" style={{ padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}>
            退出
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="main-wrap">
        <header className="header">
          <div className="header-inner">
            <Link to="/profile" className="header-user-link" title="个人资料">
              {user?.display_name || user?.username}
            </Link>
            <button onClick={handleLogout} className="btn btn-ghost">退出</button>
          </div>
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
