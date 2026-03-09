import { useState, useEffect } from "react";
import { fetcher } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import "./Profile.css";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [realName, setRealName] = useState("");
  const [contactType, setContactType] = useState<"phone" | "wechat">("wechat");
  const [contactValue, setContactValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
      setRealName(user.real_name ?? "");
      setContactType((user.contact_type === "phone" ? "phone" : "wechat") as "phone" | "wechat");
      setContactValue(user.contact_value ?? "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await fetcher("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName.trim() || undefined,
          real_name: realName.trim() || undefined,
          contact_type: contactType,
          contact_value: contactValue.trim() || undefined,
        }),
      });
      await refresh();
      setMessage({ type: "ok", text: "已保存" });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="profile-page">
      <h1>个人资料</h1>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-field">
          <label>用户名</label>
          <input type="text" value={user.username} disabled className="profile-input disabled" />
          <span className="profile-hint">用户名不可修改</span>
        </div>
        <div className="profile-field">
          <label>显示名称</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="用于界面展示的名称"
            className="profile-input"
            maxLength={64}
          />
        </div>
        <div className="profile-field">
          <label>实名</label>
          <input
            type="text"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            placeholder="真实姓名"
            className="profile-input"
            maxLength={64}
          />
        </div>
        <div className="profile-field">
          <label>联系方式类型</label>
          <select
            value={contactType}
            onChange={(e) => setContactType(e.target.value as "phone" | "wechat")}
            className="profile-input"
          >
            <option value="wechat">微信</option>
            <option value="phone">手机号</option>
          </select>
        </div>
        <div className="profile-field">
          <label>{contactType === "wechat" ? "微信号" : "手机号"}</label>
          <input
            type="text"
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            placeholder={contactType === "wechat" ? "微信号" : "手机号"}
            className="profile-input"
            maxLength={64}
          />
        </div>
        {message && (
          <div className={`profile-message ${message.type}`}>{message.text}</div>
        )}
        <button type="submit" className="btn btn-primary profile-submit" disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </button>
      </form>
    </div>
  );
}
