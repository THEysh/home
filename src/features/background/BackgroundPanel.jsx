import { useEffect, useRef, useState } from "react";
import CropPreview from "./CropPreview";

function BackgroundImageItem({ image, active, onSelect, cropProps }) {
  const imageRef = useRef(null);
  const [src, setSrc] = useState(image.thumbUrl || image.url);

  useEffect(() => {
    const displaySrc = image.url || image.displayUrl || image.originalUrl;
    if (!displaySrc || displaySrc === src) return;

    let cancelled = false;
    const preload = new Image();
    preload.onload = () => {
      if (!cancelled) setSrc(displaySrc);
    };
    preload.src = displaySrc;

    return () => {
      cancelled = true;
    };
  }, [image, src]);

  return (
    <div
      className={`bg-image-item ${active ? "active editing" : ""}`}
      onClick={() => {
        if (!active) onSelect();
      }}
    >
      <img ref={imageRef} src={src} alt="" loading="lazy" decoding="async" />
      {active ? (
        <CropPreview
          imageRef={imageRef}
          positionX={cropProps.positionX}
          positionY={cropProps.positionY}
          onPositionChange={cropProps.onPositionChange}
          onPositionCommit={cropProps.onPositionCommit}
        />
      ) : null}
    </div>
  );
}

export default function BackgroundPanel({
  open,
  images,
  currentBgFilename,
  onClose,
  onOpen,
  onUpload,
  onSelect,
  onDeleteCurrent,
  blur,
  dim,
  backgroundSettingsLoaded,
  isUploading,
  onBlurChange,
  onDimChange,
  cropProps,
  onRandomFavicon,
}) {
  const fileInputRef = useRef(null);
  const columns = [[], [], []];
  images.forEach((image, index) => {
    columns[index % 3].push(image);
  });

  return (
    <div className="bg-controls">
      <div
        className={`bg-panel ${open ? "open" : ""}`}
        onClick={(event) => event.target === event.currentTarget && onClose()}
      >
        <div className="bg-panel-header">
          <span className="bg-panel-title">背景图片管理</span>
          <button className="bg-panel-close" type="button" onClick={onClose}>
            ×
          </button>
        </div>

        <button
          className={`upload-btn ${isUploading ? "uploading" : ""}`}
          type="button"
          disabled={isUploading}
          onClick={() => {
            if (!isUploading) {
              fileInputRef.current?.click();
            }
          }}
        >
          {isUploading ? "上传中..." : "上传本地图片"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          disabled={isUploading}
          onChange={(event) => {
            const [file] = event.target.files || [];
            if (file) {
              void onUpload(file);
            }
            event.target.value = "";
          }}
        />

        <div className="bg-image-list">
          {images.length ? (
            columns.map((column, index) => (
              <div key={index} className="masonry-col">
                {column.map((image) => (
                  <BackgroundImageItem
                    key={image.filename}
                    image={image}
                    active={image.filename === currentBgFilename}
                    onSelect={() => onSelect(image)}
                    cropProps={cropProps}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="bg-no-images">暂无已上传的图片</div>
          )}
        </div>

        <button className="delete-current-btn" type="button" onClick={onDeleteCurrent}>
          删除当前图片
        </button>
      </div>

      <div className="button-group">
        <button className="bg-toggle-btn" type="button" title="管理背景" onClick={onOpen}>
          🖼
        </button>
        <button className="bg-toggle-btn" type="button" title="随机页面图标" onClick={onRandomFavicon}>
          🎉
        </button>
      </div>

      {backgroundSettingsLoaded ? (
        <div className="bg-sliders">
          <div className="slider-row">
            <span className="slider-label">模糊强度</span>
            <input
              type="range"
              className="blur-slider"
              min="0"
              max="40"
              value={blur}
              onChange={(event) => onBlurChange(Number(event.target.value))}
            />
          </div>
          <div className="slider-row">
            <span className="slider-label">遮罩强度</span>
            <input
              type="range"
              className="blur-slider"
              min="0"
              max="85"
              value={dim}
              onChange={(event) => onDimChange(Number(event.target.value))}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
