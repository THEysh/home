import { useMemo, useRef } from "react";

export default function EmojiPicker({
  categories,
  selectedEmoji,
  onEmojiSelect,
}) {
  const emojis = useMemo(() => {
    const merged = Object.values(categories || {}).flat();
    return [...new Set(merged)];
  }, [categories]);
  const selectedEmojiRef = useRef(null);

  return (
    <div className="emoji-picker-panel">
      <div className="emoji-grid">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            ref={selectedEmoji === emoji ? selectedEmojiRef : null}
            className={`emoji-btn ${selectedEmoji === emoji ? "selected" : ""}`}
            type="button"
            title={emoji}
            onClick={() => onEmojiSelect(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
