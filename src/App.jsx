import { useEffect, useState } from "react";
import { BackgroundLayer, CustomModal } from "./components";
import { BackgroundPanel, useBackgroundManager } from "./features/background";
import { useEmojiLibrary } from "./features/emojis";
import { LinkModal, LinksSection, useLinksManager } from "./features/links";
import { SearchSection } from "./features/search";
import { useModalState } from "./hooks";
import { setEmojiFavicon } from "./utils/favicon";
import { createStars } from "./utils/stars";

const DEFAULT_FAVICON = "\u{1F50E}";
const DEFAULT_RANDOM_LINK_EMOJI = "\u{1F389}";

export default function App() {
  const [stars] = useState(() => createStars());
  const [engine, setEngine] = useState("google");
  const [query, setQuery] = useState("");

  const { modalState, openAlert, openConfirm } = useModalState();
  const {
    emojiCategories,
    activeCategory,
    setActiveCategory,
    tabEmojis,
    emojiLibraryLoaded,
    randomEmoji,
    randomizeTabEmojis,
  } = useEmojiLibrary();
  const {
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
  } = useBackgroundManager({ openAlert, openConfirm });
  const {
    linksOpen,
    setLinksOpen,
    links,
    linkEditorOpen,
    setLinkEditorOpen,
    linkForm,
    setLinkForm,
    useEmoji,
    setUseEmoji,
    editingLinkId,
    selectedEmoji,
    setSelectedEmoji,
    randomEmoji: selectedRandomEmoji,
    setRandomEmoji,
    openLinkEditor,
    handleLinkSubmit,
    handleDeleteLink,
  } = useLinksManager({ openAlert, openConfirm });

  useEffect(() => {
    setEmojiFavicon(DEFAULT_FAVICON);
  }, []);

  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === "Escape") {
        setLinkEditorOpen(false);
      }
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        document.querySelector(".search-input")?.focus();
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [setLinkEditorOpen]);

  function handleRandomFavicon() {
    setEmojiFavicon(randomEmoji(DEFAULT_FAVICON));
    randomizeTabEmojis();
  }

  function handleRandomLinkEmoji() {
    const picked = randomEmoji(DEFAULT_RANDOM_LINK_EMOJI);
    setSelectedEmoji(picked);
    setRandomEmoji(picked);
  }

  return (
    <>
      <BackgroundLayer
        imageUrl={backgroundUrl}
        loaded={backgroundLoaded}
        blur={bgBlur}
        dim={bgDim}
        positionX={bgPositionX}
        positionY={bgPositionY}
        stars={stars}
      />

      <BackgroundPanel
        open={panelOpen}
        images={images}
        currentBgFilename={currentBgFilename}
        onClose={() => setPanelOpen(false)}
        onOpen={() => setPanelOpen(true)}
        onUpload={handleUploadBackground}
        onSelect={handleSelectBackground}
        onDeleteCurrent={handleDeleteCurrentBackground}
        blur={bgBlur}
        dim={bgDim}
        backgroundSettingsLoaded={backgroundSettingsLoaded}
        isUploading={isUploading}
        onBlurChange={(value) => {
          setBgBlur(value);
          scheduleBackgroundSave({ blur: value });
        }}
        onDimChange={(value) => {
          setBgDim(value);
          scheduleBackgroundSave({ dim: value });
        }}
        cropProps={{
          positionX: bgPositionX,
          positionY: bgPositionY,
          onPositionChange: ({ positionX, positionY }) => {
            setBgPositionX(positionX);
            setBgPositionY(positionY);
          },
          onPositionCommit: () => scheduleBackgroundSave(),
        }}
        onRandomFavicon={handleRandomFavicon}
      />

      <main className="page">
        <SearchSection
          engine={engine}
          onEngineChange={setEngine}
          query={query}
          onQueryChange={setQuery}
          tabEmojis={tabEmojis}
          emojiLibraryLoaded={emojiLibraryLoaded}
        />

        <LinksSection
          open={linksOpen}
          links={links}
          onToggle={() => setLinksOpen((value) => !value)}
          onAdd={() => openLinkEditor()}
          onEdit={openLinkEditor}
          onDelete={handleDeleteLink}
        />
      </main>

      <LinkModal
        open={linkEditorOpen}
        modalTitle={editingLinkId ? "编辑快捷链接" : "添加快捷链接"}
        form={linkForm}
        useEmoji={useEmoji}
        categories={emojiCategories}
        activeCategory={activeCategory}
        selectedEmoji={selectedEmoji}
        randomEmoji={selectedRandomEmoji}
        onClose={() => setLinkEditorOpen(false)}
        onChange={(field, value) => setLinkForm((current) => ({ ...current, [field]: value }))}
        onUseEmojiChange={setUseEmoji}
        onCategoryChange={setActiveCategory}
        onEmojiSelect={setSelectedEmoji}
        onRandomEmoji={handleRandomLinkEmoji}
        onSubmit={handleLinkSubmit}
      />

      <CustomModal {...modalState} />
    </>
  );
}
