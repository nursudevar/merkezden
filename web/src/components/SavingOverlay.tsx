type SavingOverlayProps = {
  visible: boolean;
  text?: string;
};

export function SavingOverlay({ visible, text = "Kaydediliyor" }: SavingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="saving-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={text}
    >
      <div className="saving-overlay__content">
        <p className="saving-overlay__text">{text}</p>
        <div className="saving-overlay__spinner" aria-hidden />
      </div>
    </div>
  );
}
