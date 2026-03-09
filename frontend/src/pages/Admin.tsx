import { useState, useEffect } from "react";
import { fetcher } from "../api/client";
import "./Admin.css";

interface User {
  id: number;
  username: string;
  display_name: string;
  real_name?: string;
  contact_type?: string;
  contact_value?: string;
  approved: boolean;
  role: string;
  created_at: string;
}

interface PendingUser {
  id: number;
  username: string;
  real_name: string;
  contact_type: string;
  contact_value: string;
  created_at: string;
}

interface Container {
  id: number;
  name: string;
  gpu_ids: string;
  ssh_port: number;
  extra_ports?: Record<string, number> | null;
  ssh_password?: string | null;
  status: string;
  expires_at: string;
  owner_username: string;
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", display_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = async () => {
    const data = await fetcher<User[]>("/admin/users");
    setUsers(data);
  };

  const loadPendingUsers = async () => {
    const data = await fetcher<PendingUser[]>("/admin/users/pending");
    setPendingUsers(data);
  };

  const loadContainers = async () => {
    const data = await fetcher<Container[]>("/admin/containers");
    setContainers(data);
  };

  useEffect(() => {
    loadUsers();
    loadPendingUsers();
    loadContainers();
  }, []);

  const handleApprove = async (userId: number) => {
    try {
      await fetcher(`/admin/users/${userId}/approve`, { method: "POST" });
      await loadUsers();
      await loadPendingUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetcher("/admin/users", {
        method: "POST",
        body: JSON.stringify(newUser),
      });
      setNewUser({ username: "", password: "", display_name: "" });
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setLoading(false);
    }
  };

  const forceStop = async (id: number) => {
    if (!confirm("确定要强制停止该容器吗？")) return;
    try {
      await fetcher(`/admin/containers/${id}/force-stop`, { method: "POST" });
      await loadContainers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  };

  const forceRemove = async (id: number) => {
    if (!confirm("确定要清理该容器吗？个人目录会保留。")) return;
    try {
      await fetcher(`/admin/containers/${id}/force-remove`, { method: "POST" });
      await loadContainers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div className="admin-page">
      <h1>管理后台</h1>

      <section className="admin-section">
        <h2>创建用户</h2>
        <form onSubmit={handleCreateUser} className="admin-form">
          <input
            placeholder="用户名"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            required
          />
          <input
            placeholder="显示名称（可选）"
            value={newUser.display_name}
            onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "创建中..." : "创建"}
          </button>
        </form>
        {error && <div className="form-error">{error}</div>}
      </section>

      <section className="admin-section">
        <h2>待审批用户</h2>
        {pendingUsers.length === 0 ? (
          <p className="admin-empty">暂无待审批用户</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>实名</th>
                <th>联系方式</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.real_name}</td>
                  <td>{u.contact_type === "wechat" ? "微信 " : "手机 "}{u.contact_value}</td>
                  <td>{new Date(u.created_at).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-small" onClick={() => handleApprove(u.id)}>通过</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section">
        <h2>用户列表</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>实名</th>
              <th>联系方式</th>
              <th>状态</th>
              <th>角色</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.real_name ?? "-"}</td>
                <td>{u.contact_value ? (u.contact_type === "wechat" ? "微信 " : "手机 ") + u.contact_value : "-"}</td>
                <td>{u.approved ? "已通过" : "待审批"}</td>
                <td>{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-section">
        <h2>全部容器</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>GPU</th>
              <th>SSH</th>
              <th>服务端口</th>
              <th>密码</th>
              <th>状态</th>
              <th>用户</th>
              <th>到期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.gpu_ids}</td>
                <td>{c.ssh_port}</td>
                <td>
                  {c.extra_ports
                    ? Object.entries(c.extra_ports).map(([k, v]) => `${k}→${v}`).join(" ")
                    : "-"}
                </td>
                <td>
                  {c.ssh_password ? (
                    <code title="点击复制" onClick={() => navigator.clipboard.writeText(c.ssh_password!)} style={{ cursor: "pointer" }}>
                      {c.ssh_password}
                    </code>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{c.status}</td>
                <td>{c.owner_username}</td>
                <td>{new Date(c.expires_at).toLocaleString()}</td>
                <td>
                  {c.status === "running" && (
                    <button className="btn btn-small" onClick={() => forceStop(c.id)}>
                      停止
                    </button>
                  )}
                  {(c.status === "stopped" || c.status === "running") && (
                    <button className="btn btn-small" onClick={() => forceRemove(c.id)}>
                      清理
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
