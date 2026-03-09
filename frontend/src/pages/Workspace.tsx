import { useState, useEffect, useCallback } from "react";
import { fetcher, fetcherText } from "../api/client";
import "./Workspace.css";

interface WorkspaceItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number | null;
}

export default function Workspace() {
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [createType, setCreateType] = useState<"file" | "dir" | null>(null);
  const [createName, setCreateName] = useState("");
  const [deletePath, setDeletePath] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = currentPath ? `?path=${encodeURIComponent(currentPath)}` : "";
      const data = await fetcher<{ path: string; items: WorkspaceItem[] }>(`/workspace/list${q}`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => { loadList(); }, [loadList]);

  const breadcrumbs = currentPath ? ["", ...currentPath.split("/").filter(Boolean)] : [""];

  const handleOpen = async (item: WorkspaceItem) => {
    if (item.is_dir) {
      setCurrentPath(item.path);
      return;
    }
    setEditPath(item.path);
    setEditContent("");
    try {
      const q = `?path=${encodeURIComponent(item.path)}`;
      const text = await fetcherText(`/workspace/file${q}`);
      setEditContent(text);
    } catch (e) {
      alert(e instanceof Error ? e.message : "无法读取文件（可能为二进制）");
      setEditPath(null);
    }
  };

  const handleSave = async () => {
    if (editPath == null) return;
    setSaving(true);
    try {
      await fetcher(`/workspace/file?path=${encodeURIComponent(editPath)}`, {
        method: "PUT",
        body: JSON.stringify({ content: editContent }),
      });
      setEditPath(null);
      loadList();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    const name = createName.trim();
    const type = createType;
    if (!name || !type) return;
    setCreateType(null);
    setCreateName("");
    const newPath = currentPath ? `${currentPath}/${name}` : name;
    try {
      if (type === "dir") {
        await fetcher("/workspace/dir", { method: "POST", body: JSON.stringify({ path: newPath }) });
      } else {
        await fetcher(`/workspace/file?path=${encodeURIComponent(newPath)}`, {
          method: "PUT",
          body: JSON.stringify({ content: "" }),
        });
      }
      loadList();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    }
  };

  const handleDelete = async () => {
    if (deletePath == null) return;
    try {
      await fetcher(`/workspace?path=${encodeURIComponent(deletePath)}`, { method: "DELETE" });
      setDeletePath(null);
      if (currentPath === deletePath || (deletePath + "/").startsWith(currentPath + "/") || currentPath.startsWith(deletePath + "/")) {
        setCurrentPath("");
      }
      loadList();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    // 可加 toast
  };

  return (
    <div className="workspace-page workspace-twin">
      <div className="workspace-bg" aria-hidden />
      <div className="workspace-glow" aria-hidden />
      <div className="workspace-header">
        <h1>工作区文件</h1>
        <div className="workspace-toolbar">
          <button type="button" className="btn btn-frosted btn-sm" onClick={() => { setCreateType("file"); setCreateName(""); }}>新建文件</button>
          <button type="button" className="btn btn-frosted btn-sm" onClick={() => { setCreateType("dir"); setCreateName(""); }}>新建文件夹</button>
        </div>
      </div>
      <div className="workspace-breadcrumb">
        {breadcrumbs.map((part, i) => {
          const path = breadcrumbs.slice(0, i + 1).join("/");
          const label = i === 0 ? "根目录" : part;
          return (
            <span key={path || "root"}>
              <button type="button" className="breadcrumb-link" onClick={() => setCurrentPath(path)}>{label}</button>
              {i < breadcrumbs.length - 1 && <span className="breadcrumb-sep">/</span>}
            </span>
          );
        })}
      </div>
      {loading && <div className="loading">加载中...</div>}
      {error && <div className="workspace-error">{error}</div>}
      {!loading && !error && (
        <div className="workspace-table-wrap">
          <table className="workspace-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>大小</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="workspace-empty">当前目录为空</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.path}>
                    <td>
                      <button type="button" className="row-name-btn" onClick={() => handleOpen(item)}>
                        {item.is_dir ? "📁 " : "📄 "}{item.name}
                      </button>
                    </td>
                    <td>{item.is_dir ? "目录" : "文件"}</td>
                    <td className="col-mono">{item.size != null ? `${(item.size / 1024).toFixed(1)} KB` : "-"}</td>
                    <td className="col-actions">
                      <button type="button" className="btn btn-frosted btn-sm" onClick={() => copyPath(item.path)}>复制路径</button>
                      <button type="button" className="btn btn-frosted btn-sm btn-danger" onClick={() => setDeletePath(item.path)}>删除</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {createType && (
        <div className="modal-overlay" onClick={() => { setCreateType(null); setCreateName(""); }}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{createType === "dir" ? "新建文件夹" : "新建文件"}</h2>
              <button type="button" className="btn btn-ghost" onClick={() => { setCreateType(null); setCreateName(""); }}>×</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="workspace-input"
                placeholder={createType === "dir" ? "文件夹名" : "文件名"}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-frosted" onClick={() => { setCreateType(null); setCreateName(""); }}>取消</button>
              <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={!createName.trim()}>创建</button>
            </div>
          </div>
        </div>
      )}

      {editPath != null && (
        <div className="modal-overlay" onClick={() => setEditPath(null)}>
          <div className="modal modal-editor" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>编辑: {editPath}</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setEditPath(null)}>×</button>
            </div>
            <div className="modal-body">
              <textarea
                className="workspace-textarea"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-frosted" onClick={() => setEditPath(null)}>取消</button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {deletePath && (
        <div className="modal-overlay" onClick={() => setDeletePath(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>确认删除</h2>
              <button type="button" className="btn btn-ghost" onClick={() => setDeletePath(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>确定要删除 <code>{deletePath}</code> 吗？</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-frosted" onClick={() => setDeletePath(null)}>取消</button>
              <button type="button" className="btn btn-frosted btn-danger" onClick={handleDelete}>删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
