import { useRef } from "react";
import { InstructionsContent } from "./InstructionsContent.jsx";
import ModalBase from "./ModalBase.jsx";

const WelcomeModal = ({ isOpen, onClose }) => {
  const closeButtonRef = useRef(null);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="welcome-title"
      describedBy="welcome-description"
      initialFocusRef={closeButtonRef}
      sizeClass="max-w-2xl"
      backdropCanClose={false}
    >
      <h2 id="welcome-title" className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">
        Welcome to TickTackToto!
      </h2>
      <p id="welcome-description" className="text-gray-600 dark:text-gray-400 mb-6">
        Here's a quick guide to get you started:
      </p>

      <InstructionsContent />

      <div className="mt-8 flex justify-end">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="px-6 py-2 min-h-[44px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors active:scale-[0.98]"
        >
          Get Started
        </button>
      </div>
    </ModalBase>
  );
};

export default WelcomeModal;
