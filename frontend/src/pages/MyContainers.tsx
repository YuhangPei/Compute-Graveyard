import { useState, useEffect } from "react";
import { fetcher } from "../api/client";
import "./MyContainers.css";

const PORT_LABELS: Record<string, string> = { 8888: "Jupyter", 6006: "TensorBoard", 8080: "Code Server" };

interface Container {
  id: number;
  name: string;
  container_id: string | null;
  gpu_ids: string;
  ssh_port: number;
  ssh_password?: string | null;
  extra_ports?: Record<string, number> | null;
  status: string;
  expires_at: string;
  owner_username: string;
  created_at: string;
}

function copyAndFeedback(text: string, button: HTMLButtonElement) {
  navigator.clipboard.writeText(text);
  const orig = button.textContent;
  button.textContent = "已复制";
  setTimeout(() => { button.textContent = orig; }, 800);
}

export default function MyContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renewing, setRenewing] = useState<number | null>(null);

  const load = async () => {
    try {
      const data = await fetcher<Container[]>("/containers/my");
      setContainers(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const canRenew = (c: Container) => {
    if (c.status !== "running") return false;
    const delta = (new Date(c.expires_at).getTime() - Date.now()) / (1000 * 3600);
    return delta > 0 && delta <= 24;
  };

  const handleRenew = async (id: number) => {
    setRenewing(id);
    try {
      await fetcher(`/leases/renew/${id}`, { method: "POST", body: JSON.stringify({ lease_days: 3 }) });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "续租失败");
    } finally {
      setRenewing(null);
    }
  };

  const statusText = (s: string) => (s === "running" ? "运行中" : s === "stopped" ? "已停止" : "已清理");

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="my-error">加载失败: {error}</div>;

  return (
    <div className="my-containers my-containers-twin">
      <div className="my-containers-bg" aria-hidden />
      <div className="my-containers-glow" aria-hidden />
      <h1>我的容器</h1>
      {containers.length === 0 ? (
        <p className="empty">暂无容器，请到资源看板申请</p>
      ) : (
        <div className="container-table-wrap">
          <table className="container-table">
            <thead>
              <tr>
                <th>容器名</th>
                <th>状态</th>
                <th>类型</th>
                <th>SSH 端口</th>
                <th>服务端口</th>
                <th>到期时间</th>
                <th>SSH 密码</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr key={c.id} className={`status-${c.status}`}>
                  <td className="col-name">{c.name}</td>
                  <td><span className={`status-badge ${c.status}`}>{statusText(c.status)}</span></td>
                  <td>{c.gpu_ids ? `GPU ${c.gpu_ids}` : "纯 CPU"}</td>
                  <td className="col-mono">{c.ssh_port}</td>
                  <td className="col-ports">
                    {c.extra_ports && Object.keys(c.extra_ports).length > 0
                      ? Object.entries(c.extra_ports).map(([cp, hp]) => (
                          <span key={cp} className="port-item">{PORT_LABELS[Number(cp)] || cp}:{hp}</span>
                        ))
                      : "-"}
                  </td>
                  <td className="col-mono col-date">{new Date(c.expires_at).toLocaleString()}</td>
                  <td>
                    {c.ssh_password ? (
                      <span className="ssh-cell">
                        <code>{c.ssh_password}</code>
                        <button
                          type="button"
                          className="btn btn-frosted btn-copy"
                          onClick={(e) => copyAndFeedback(c.ssh_password!, e.currentTarget)}
                        >
                          复制
                        </button>
                      </span>
                    ) : "-"}
                  </td>
                  <td className="col-actions">
                    {c.status === "running" && c.extra_ports?.["8080"] && (
                      <a
                        href={`${window.location.protocol}//${window.location.hostname}:${c.extra_ports["8080"]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-frosted btn-sm"
                      >
                        打开 Code
                      </a>
                    )}
                    {c.status === "running" && (
                      <button
                        type="button"
                        className="btn btn-frosted btn-sm"
                        onClick={(e) => copyAndFeedback(`ssh -p ${c.ssh_port} root@服务器IP`, e.currentTarget)}
                      >
                        复制 SSH
                      </button>
                    )}
                    {canRenew(c) && (
                      <button
                        className="btn btn-frosted btn-sm renew-btn"
                        onClick={() => handleRenew(c.id)}
                        disabled={renewing === c.id}
                      >
                        {renewing === c.id ? "续租中…" : "续租 3 天"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
