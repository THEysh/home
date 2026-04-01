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
  const processingPollRef = useRef(null);
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
      return payload;
    } catch (error) {
      console.error("Failed to refresh images:", error);
      return [];
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
        setBackgroundFromImage(background, background.filename || "");
      })
      .catch((error) => console.error("Failed to load background:", error))
      .finally(() => setBackgroundSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (panelOpen) {
      void refreshImages();
    }
  }, [panelOpen, refreshImages]);

  useEffect(() => {
    const hasProcessing = images.some((image) => image.status === "processing");

    if (!hasProcessing) {
      if (processingPollRef.current) {
        clearInterval(processingPollRef.current);
        processingPollRef.current = null;
      }
      return;
    }

    if (!processingPollRef.current) {
      processingPollRef.current = setInterval(() => {
        void refreshImages();
      }, 1500);
    }
  }, [images, refreshImages]);

  useEffect(() => {
    return () => {
      if (processingPollRef.current) {
        clearInterval(processingPollRef.current);
        processingPollRef.current = null;
      }
    };
  }, []);

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

  function setBackgroundFromImage(image, filename) {
    const originalUrl = image?.originalUrl || image?.url || image?.displayUrl || "";
    setBackgroundUrl(originalUrl);
    setBackgroundLoaded(Boolean(originalUrl));
    setCurrentBgFilename(filename || "");
  }

  useEffect(() => {
    if (!currentBgFilename) {
      return;
    }

    const currentImage = images.find((image) => image.filename === currentBgFilename);
    if (!currentImage) {
      return;
    }

    const originalUrl = currentImage.originalUrl || currentImage.url || "";
    if (!originalUrl) {
      return;
    }

    if (backgroundUrl !== originalUrl) {
      setBackgroundFromImage(currentImage, currentImage.filename);
    }
  }, [backgroundUrl, currentBgFilename, images]);

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
          status: payload.status || "processing",
          errorMessage: payload.errorMessage || "",
          uploadedAt: Date.now(),
        };

        return [nextItem, ...current.filter((image) => image.filename !== payload.filename)];
      });
      setBackgroundFromImage(payload, payload.filename);
      setBgPositionX(50);
      setBgPositionY(50);
      scheduleBackgroundSave({ filename: payload.filename, positionX: 50, positionY: 50 });
      void refreshImages();

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

    setBackgroundFromImage(image, image.filename);
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
          setBackgroundFromImage(null, "");
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
