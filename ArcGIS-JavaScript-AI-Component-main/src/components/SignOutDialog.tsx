import React from "react";

export interface SignOutDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * A simple confirmation dialog for signing out of the app session.
 */
export function SignOutDialog({ open, onClose, onConfirm }: SignOutDialogProps) {
  if (!open) return null;

  return (
    <calcite-dialog
      open
      overlay-positioning="fixed"
      heading="התנתקות"
      onCalciteDialogClose={onClose}
    >
      <div style={{ padding: "0.75rem 0" }}>
        האם ברצונך להתנתק מהפעלת האפליקציה הזו?
      </div>
      <calcite-button
        slot="footer-start"
        appearance="outline"
        kind="neutral"
        onClick={onClose}
      >
        ביטול
      </calcite-button>
      <calcite-button
        slot="footer-end"
        appearance="solid"
        kind="danger"
        onClick={onConfirm}
      >
        התנתקות
      </calcite-button>
    </calcite-dialog>
  );
}
