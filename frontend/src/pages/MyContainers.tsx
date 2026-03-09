import { useState, useEffect } from "react";
import { fetcher } from "../api/client";
import "./MyContainers.css";

const PORT_LABELS: Record<number, string> = { 8888: "Jupyter", 6006: "TensorBoard", 8080: "Web" };

interface Container {
  id: number;
  name: string;
  container_id: string | null;
  gpu_ids: string;
  ssh_port: number;
  ssh_password?: string | null;
  extra_ports?: Record<string, number> | null;  // {"8888":30123,...}
  status: string;
  expires_at: string;
  owner_username: string;
  created_at: string;
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

  useEffect(() => {
    load();
  }, []);

  const canRenew = (c: Container) => {
    if (c.status !== "running") return false;
    const now = new Date();
    const exp = new Date(c.expires_at);
    const delta = (exp.getTime() - now.getTime()) / (1000 * 3600);
    return delta > 0 && delta <= 24; // 到期前 24 小时内
  };

  const handleRenew = async (id: number) => {
    setRenewing(id);
    try {
      await fetcher(`/leases/renew/${id}`, {
        method: "POST",
        body: JSON.stringify({ lease_days: 3 }),
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "续租失败");
    } finally {
      setRenewing(null);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="my-error">加载失败: {error}</div>;

  return (
    <div className="my-containers">
      <h1>我的容器</h1>
      {containers.length === 0 ? (
        <p className="empty">暂无容器，请到资源看板申请</p>
      ) : (
        <div className="container-list">
          {containers.map((c) => (
            <div key={c.id} className={`container-card status-${c.status}`}>
              <div className="container-header">
                <span className="container-name">{c.name}</span>
                <span className={`status-badge ${c.status}`}>
                  {c.status === "running" ? "运行中" : c.status === "stopped" ? "已停止" : "已清理"}
                </span>
              </div>
              <div className="container-info">
                <div>类型: {c.gpu_ids ? `GPU ${c.gpu_ids}` : "纯 CPU"}</div>
                <div>SSH 端口: {c.ssh_port}</div>
                {c.extra_ports && Object.keys(c.extra_ports).length > 0 && (
                  <div className="extra-ports">
                    <span className="label">服务端口:</span>
                    {Object.entries(c.extra_ports).map(([cp, hp]) => (
                      <span key={cp} className="port-item">
                        {PORT_LABELS[Number(cp)] || cp}:{hp}
                      </span>
                    ))}
                  </div>
                )}
                <div>到期: {new Date(c.expires_at).toLocaleString()}</div>
                {c.ssh_password && (
                  <div className="ssh-password">
                    <span className="label">SSH 密码:</span>
                    <code className="password">{c.ssh_password}</code>
                    <button
                      type="button"
                      className="btn-copy"
                      onClick={() => {
                        navigator.clipboard.writeText(c.ssh_password!);
                        // 简单反馈
                        const btn = document.activeElement as HTMLButtonElement;
                        if (btn) {
                          const orig = btn.textContent;
                          btn.textContent = "已复制";
                          setTimeout(() => { btn.textContent = orig; }, 800);
                        }
                      }}
                    >
                      复制
                    </button>
                  </div>
                )}
                {c.status === "running" && (
                  <div className="ssh-hint">
                    <code>ssh -p {c.ssh_port} root@服务器IP</code>
                  </div>
                )}
              </div>
              {canRenew(c) && (
                <button
                  className="btn btn-primary renew-btn"
                  onClick={() => handleRenew(c.id)}
                  disabled={renewing === c.id}
                >
                  {renewing === c.id ? "续租中..." : "续租 3 天"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
