
import { useNavigate } from "react-router-dom";
import { FiCpu } from "react-icons/fi";

interface AskAIButtonProps {
  /** Pre-filled question to inject into the AI Agent input */
  question?: string;

  /** Label shown on hover tooltip */
  label?: string;

  /** Position variant */
  variant?: "fixed" | "inline";

  /** Additional Tailwind classes */
  className?: string;
}

export function AskAIButton({
  question,
  label = "Ask AI",
  variant = "fixed",
  className = "",
}: AskAIButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    const params = question
      ? `?q=${encodeURIComponent(question)}`
      : "";

    navigate(`/ai-agent${params}`);
  };

  // Inline Ask AI button
  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={label}
        aria-label={label}
        className={`
          inline-flex items-center gap-1.5
          rounded-xl
          border border-violet-200 dark:border-violet-700/50
          bg-violet-50 dark:bg-violet-900/20
          px-3 py-1.5
          text-xs font-bold
          text-violet-700 dark:text-violet-400
          transition-colors
          hover:bg-violet-100 dark:hover:bg-violet-900/40
          ${className}
        `}
      >
        <FiCpu className="h-3.5 w-3.5" />
        <span>{label}</span>
      </button>
    );
  }

  // Fixed floating Ask AI button
  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      aria-label={label}
      className={`
        fixed
        bottom-[2rem] right-5
        z-[84]
        flex h-12 w-12
        items-center justify-center
        rounded-full
        bg-violet-600
        text-white
        shadow-xl shadow-violet-500/30
        transition-all duration-200
        hover:-translate-y-1
        hover:bg-violet-500
        active:scale-90
        md:bottom-12 md:right-6
        ${className}
      `}
    >
      <FiCpu className="h-5 w-5" />
    </button>
  );
}

export default AskAIButton;

