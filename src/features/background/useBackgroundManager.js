import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteBackground,
  getBackground,
  getImages,
  saveBackground,
  uploadBackground,
} from "../../services/api/background";

export function useBackgroundManager({ openAlert, openConfirm }) {
  const saveTimeoutRef = useRef(null);
  const [images, setImages] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [bgBlur, setBgBlur] = useState(18);
  const [bgDim, setBgDim] = useState(52);
  const [bgPositionX, setBgPositionX] = useState(50);
  const [bgPositionY, setBgPositionY] = useState(50);
  const [currentBgFilename, setCurrentBgFilename] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [backgroundSettingsLoaded, setBackgroundSettingsLoaded] = useState(false);

  const refreshImages = useCallback(async () => {
    try {
      const payload = await getImages();
      setImages(payload);
    } catch (error) {
      console.error("Failed to refresh images:", error);
    }
  }, []);

  useEffect(() => {
    getBackground()
      .then((background) => {
        if (!background) return;
        setBgBlur(background.blur ?? 18);
        setBgDim(background.dim ?? 52);
        setBgPositionX(background.positionX ?? 50);
        setBgPositionY(background.positionY ?? 50);
        setCurrentBgFilename(background.filename || "");
        if (background.url) {
          setBackgroundUrl(background.url);
          setBackgroundLoaded(true);
        }
      })
      .catch((error) => console.error("Failed to load background:", error))
      .finally(() => setBackgroundSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (panelOpen) {
      void refreshImages();
    }
  }, [panelOpen, refreshImages]);

  const scheduleBackgroundSave = useCallback(
    (next = {}) => {
      const payload = {
        filename: next.filename ?? currentBgFilename,
        blur: next.blur ?? bgBlur,
        dim: next.dim ?? bgDim,
        positionX: next.positionX ?? bgPositionX,
        positionY: next.positionY ?? bgPositionY,
      };

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveBackground(payload).catch((error) => console.error("Save background failed:", error));
      }, 300);
    },
    [bgBlur, bgDim, bgPositionX, bgPositionY, currentBgFilename],
  );

  function setBackgroundFromUrl(url, filename) {
    setBackgroundUrl(url);
    setBackgroundLoaded(Boolean(url));
    setCurrentBgFilename(filename || "");
  }

  async function handleUploadBackground(file) {
    setIsUploading(true);

    try {
      const payload = await uploadBackground(file);
      setImages((current) => {
        const nextItem = {
          filename: payload.filename,
          originalUrl: payload.originalUrl,
          url: payload.url,
          thumbUrl: payload.thumbUrl,
          uploadedAt: Date.now(),
        };

        return [nextItem, ...current.filter((image) => image.filename !== payload.filename)];
      });
      setBackgroundFromUrl(payload.url, payload.filename);
      setBgPositionX(50);
      setBgPositionY(50);
      scheduleBackgroundSave({ filename: payload.filename, positionX: 50, positionY: 50 });
      await refreshImages();

      if (payload.warning) {
        openAlert(`图片已上传，但处理时有提示：${payload.warning}`);
      }
    } catch (error) {
      console.error("Upload background failed:", error);
      openAlert(`上传失败：${error.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSelectBackground(image) {
    if (image.filename === currentBgFilename) {
      return;
    }

    const displayUrl = image.url || image.displayUrl || image.originalUrl;
    setBackgroundFromUrl(displayUrl, image.filename);
    setBgPositionX(50);
    setBgPositionY(50);
    scheduleBackgroundSave({ filename: image.filename, positionX: 50, positionY: 50 });
  }

  function handleDeleteCurrentBackground() {
    if (!currentBgFilename) {
      openAlert("请先选中一张图片。");
      return;
    }

    openConfirm(
      `确认删除当前背景图片“${currentBgFilename}”吗？`,
      async () => {
        try {
          await deleteBackground(currentBgFilename);
          setBackgroundFromUrl("", "");
          scheduleBackgroundSave({ filename: "" });
          await refreshImages();
        } catch (error) {
          console.error("Delete background failed:", error);
          openAlert(`删除失败：${error.message}`);
        }
      },
      "删除背景图片",
    );
  }

  return {
    images,
    panelOpen,
    setPanelOpen,
    isUploading,
    bgBlur,
    setBgBlur,
    bgDim,
    setBgDim,
    bgPositionX,
    setBgPositionX,
    bgPositionY,
    setBgPositionY,
    currentBgFilename,
    backgroundUrl,
    backgroundLoaded,
    backgroundSettingsLoaded,
    scheduleBackgroundSave,
    handleUploadBackground,
    handleSelectBackground,
    handleDeleteCurrentBackground,
  };
}
