import { useEffect, useState } from "react";
import EmojiPicker from "./EmojiPicker";

export default function LinkModal({
  open,
  modalTitle,
  form,
  useEmoji,
  categories,
  activeCategory,
  selectedEmoji,
  randomEmoji,
  onClose,
  onChange,
  onUseEmojiChange,
  onCategoryChange,
  onEmojiSelect,
  onRandomEmoji,
  onSubmit,
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (!open || !useEmoji) {
      setEmojiPickerOpen(false);
      return;
    }

    setEmojiPickerOpen(true);
  }, [open, useEmoji]);

  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{modalTitle}</div>

        <div className="modal-field">
          <label className="modal-label" htmlFor="inputName">
            名称
          </label>
          <input
            className="modal-input"
            id="inputName"
            type="text"
            placeholder="例如 GitHub"
            value={form.name}
            onChange={(event) => onChange("name", event.target.value)}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label" htmlFor="inputUrl">
            URL
          </label>
          <input
            className="modal-input"
            id="inputUrl"
            type="url"
            placeholder="https://..."
            value={form.url}
            onChange={(event) => onChange("url", event.target.value)}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">图标来源</label>
          <div className="icon-source-toggle">
            <button
              type="button"
              className={`icon-source-btn ${!useEmoji ? "active" : ""}`}
              onClick={() => {
                onUseEmojiChange(false);
                setEmojiPickerOpen(false);
              }}
            >
              网站图标
            </button>
            <button
              type="button"
              className={`icon-source-btn ${useEmoji ? "active" : ""}`}
              onClick={() => {
                onUseEmojiChange(true);
                setEmojiPickerOpen(true);
              }}
            >
              Emoji
            </button>
          </div>
        </div>

        {useEmoji ? (
          <>
            <div className="modal-field">
              <label className="modal-label">选择 Emoji</label>
              <div className="emoji-picker-summary">
                <span className="selected-emoji-preview" aria-hidden="true">
                  {selectedEmoji}
                </span>
                <button
                  type="button"
                  className="toggle-emoji-picker-btn"
                  onClick={() => setEmojiPickerOpen((value) => !value)}
                >
                  {emojiPickerOpen ? "收起 Emoji" : "更换 Emoji"}
                </button>
              </div>
              {emojiPickerOpen ? (
                <EmojiPicker
                  categories={categories}
                  selectedEmoji={selectedEmoji}
                  onEmojiSelect={onEmojiSelect}
                />
              ) : null}
            </div>

            <div className="modal-field">
              <div className="random-emoji-row">
                <button type="button" className="random-emoji-btn" onClick={onRandomEmoji}>
                  随机一个
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div className="modal-field">
          <label className="modal-label" htmlFor="inputCat">
            分类
          </label>
          <input
            className="modal-input"
            id="inputCat"
            type="text"
            placeholder="例如 开发、设计、效率"
            value={form.cat}
            onChange={(event) => onChange("cat", event.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onClose}>
            取消
          </button>
          <button className="modal-btn confirm" onClick={onSubmit}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
