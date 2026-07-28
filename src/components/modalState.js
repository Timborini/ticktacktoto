let openModalCount = 0;

export const trackModalOpen = () => {
  openModalCount += 1;
  return () => {
    openModalCount = Math.max(0, openModalCount - 1);
  };
};

/** True while any ModalBase dialog is open (used to gate global shortcuts). */
export const isAnyModalOpen = () => openModalCount > 0;
