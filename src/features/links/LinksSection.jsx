function getFavicon(url) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  } catch {
    return null;
  }
}

function LinkCard({ link, onEdit, onDelete }) {
  const favicon = link.useEmoji ? null : getFavicon(link.url);
  const hostname = new URL(link.url).hostname.replace("www.", "");

  function openLink() {
    window.open(link.url, "_blank");
  }

  return (
    <div
      className="link-card"
      tabIndex={0}
      role="link"
      aria-label={`Open ${link.name}`}
      onClick={(event) => !event.target.closest(".card-action-btn") && openLink()}
      onKeyDown={(event) => {
        if (event.target.closest(".card-action-btn")) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLink();
        }
      }}
    >
      <div className="card-actions">
        <button
          className="card-action-btn edit"
          title="编辑"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          ✎
        </button>
        <button
          className="card-action-btn del"
          title="删除"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          🗑
        </button>
      </div>
      <div className="card-favicon">{favicon ? <img src={favicon} alt="" /> : link.icon}</div>
      <div className="card-name">{link.name}</div>
      <div className="card-url">{hostname}</div>
      {link.cat ? <span className="card-cat">{link.cat}</span> : null}
    </div>
  );
}

export default function LinksSection({ open, links, onToggle, onAdd, onEdit, onDelete }) {
  return (
    <div className="links-section">
      <button className={`links-toggle ${open ? "open" : ""}`} onClick={onToggle}>
        <span className="dot" />
        <span>{open ? "隐藏快捷链接" : "显示快捷链接"}</span>
        <svg className="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className={`links-grid-wrap ${open ? "open" : ""}`}>
        <div className="links-header">
          <span className="links-title">Quick Links</span>

        </div>
        <div className="links-grid">
          {links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onEdit={() => onEdit(link.id)}
              onDelete={() => onDelete(link.id)}
            />
          ))}
          <div className="link-card add-placeholder" onClick={onAdd}>
            <div className="add-placeholder-icon">＋</div>
            <div className="add-placeholder-text">添加链接</div>
          </div>
        </div>
      </div>
    </div>
  );
}
