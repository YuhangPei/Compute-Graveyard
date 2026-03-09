import { useState } from "react";
import { fetcher } from "../api/client";
import "./ApplyModal.css";

const SERVICE_LABELS: Record<number, string> = { 8888: "Jupyter", 6006: "TensorBoard", 8080: "Code Server" };

interface ApplyModalProps {
  freeGpus: number[];
  onClose: () => void;
  onSuccess: () => void;
}

interface CreatedContainer {
  ssh_port: number;
  ssh_password: string;
  extra_ports?: Record<number, number>;
}

export default function ApplyModal({ freeGpus, onClose, onSuccess }: ApplyModalProps) {
  const [cpuOnly, setCpuOnly] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [leaseDays, setLeaseDays] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedContainer | null>(null);

  const toggleGpu = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpuOnly && selected.length === 0) {
      setError("请选择至少一块 GPU，或勾选纯 CPU 容器");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetcher<CreatedContainer>("/containers/apply", {
        method: "POST",
        body: JSON.stringify({
          cpu_only: cpuOnly,
          gpu_ids: cpuOnly ? [] : selected,
          lease_days: leaseDays,
        }),
      });
      setCreated({
        ssh_port: res.ssh_port,
        ssh_password: res.ssh_password || "",
        extra_ports: res.extra_ports,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "申请失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setCreated(null);
    onSuccess();
  };

  if (created) {
    return (
      <div className="modal-overlay" onClick={handleDone}>
        <div className="modal modal-success" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>申请成功</h2>
            <button className="btn btn-ghost" onClick={handleDone}>×</button>
          </div>
          <div className="created-info">
            <p className="created-tagline">升华还是埋没，看自己的造化。</p>
            <p><strong>请妥善保存以下信息，关闭后可在「我的容器」中查看。</strong></p>
            <div className="created-row">
              <span>SSH 端口:</span>
              <code>{created.ssh_port}</code>
            </div>
            <div className="created-row">
              <span>SSH 密码:</span>
              <code>{created.ssh_password}</code>
              <button type="button" className="btn-copy" onClick={() => navigator.clipboard.writeText(created.ssh_password)}>
                复制
              </button>
            </div>
            {created.extra_ports && Object.keys(created.extra_ports).length > 0 && (
              <div className="extra-ports">
                <span className="label">服务端口映射:</span>
                {Object.entries(created.extra_ports).map(([cp, hp]) => (
                  <div key={cp} className="port-row">
                    {SERVICE_LABELS[Number(cp)] || cp}: 宿主机 <code>{hp}</code> → 容器 {cp}
                  </div>
                ))}
              </div>
            )}
            <p className="ssh-cmd">ssh -p {created.ssh_port} root@服务器IP</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={handleDone}>完成</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>申请 GPU 容器</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={cpuOnly} onChange={(e) => setCpuOnly(e.target.checked)} />
              纯 CPU 容器（无 GPU）
            </label>
          </div>
          {!cpuOnly && (
          <div className="form-group">
            <label>选择 GPU（可多选）</label>
            <div className="gpu-checkboxes">
              {freeGpus.length === 0 ? (
                <p className="no-free">暂无可用的 GPU</p>
              ) : (
                freeGpus.map((g) => (
                  <label key={g} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selected.includes(g)}
                      onChange={() => toggleGpu(g)}
                    />
                    GPU {g}
                  </label>
                ))
              )}
            </div>
          </div>
          )}
          <div className="form-group">
            <label>租期（天）</label>
            <div className="lease-days-row" role="group" aria-label="选择租期">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`lease-day-btn ${leaseDays === d ? "active" : ""}`}
                  onClick={() => setLeaseDays(d)}
                >
                  {d} 天
                </button>
              ))}
            </div>
          </div>
          <p className="modal-hint">
            SSH 与常用端口(Jupyter/TensorBoard/Web) 随机映射，密码自动分配；个人目录挂载至 /workspace
          </p>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (!cpuOnly && freeGpus.length === 0)}
            >
              {loading ? "申请中…" : "确认申请"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
