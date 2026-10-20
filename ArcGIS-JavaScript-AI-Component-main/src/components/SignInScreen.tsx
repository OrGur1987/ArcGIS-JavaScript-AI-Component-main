import React from "react";

interface Props {
  authError: string | null;
  isSigningIn: boolean;
  oauthClientId: string | undefined;
  onSignIn: () => void;
}

export function SignInScreen({ authError, isSigningIn, oauthClientId, onSignIn }: Props) {
  const missingClientId = !oauthClientId;

  const handleClick = () => {
    if (missingClientId) return;
    onSignIn();
  };

  return (
    <div className="centered-screen">
      <div className="sign-in-panel">
        <calcite-panel heading="התחברות ל-ArcGIS">
          <div className="sign-in-body">
            <p className="sign-in-text">
              התחבר תחילה, ולאחר מכן תוכל לספק את מזהה פריט מפת האינטרנט.
            </p>
            <p className="sign-in-subtext">
              תועבר לדף ההתחברות הרשמי של ArcGIS.
            </p>
            {missingClientId && (
              <calcite-notice open kind="danger" style={{ marginBottom: "0.5rem" }}>
                <div slot="message">
                  חסר <code>VITE_ARCGIS_OAUTH_APP_ID</code>. הוסף אותו לקובץ <code>.env.local</code> והפעל מחדש.
                </div>
              </calcite-notice>
            )}
            {authError && (
              <calcite-notice open kind="danger" style={{ marginBottom: "0.5rem" }}>
                <div slot="message">{authError}</div>
              </calcite-notice>
            )}
            <div className="sign-in-button-row">
              <calcite-button
                appearance="solid"
                kind="brand"
                disabled={missingClientId || isSigningIn ? true : undefined}
                onClick={handleClick}
                style={{ minWidth: "180px" }}
              >
                {isSigningIn ? "מתחבר..." : "התחברות"}
              </calcite-button>
            </div>
          </div>
        </calcite-panel>
      </div>
    </div>
  );
}
