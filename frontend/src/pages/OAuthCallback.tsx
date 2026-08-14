import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  allowRedirectReauth,
  blockRedirectReauth,
  clearPendingRedirectReauth,
  fetchAccountEmail,
  GOOGLE_OAUTH_CHANNEL,
  readPendingRedirectReauth,
} from "../lib/googleDrive";
import { persistDriveToken, setDriveAccountEmail } from "../lib/settings";

export default function OAuthCallback() {
  const { t } = useTranslation("connect");
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const error = params.get("error");
    const state = params.get("state") ?? undefined;
    const expiresIn = params.get("expires_in");

    // A popup and a hidden frame share this tab's sessionStorage, so the state
    // match — not the mere presence of a pending entry — is what identifies the
    // full-page redirect this document is the landing for.
    const pending = readPendingRedirectReauth();
    if (pending && state && pending.state === state) {
      clearPendingRedirectReauth();
      void (async () => {
        if (!accessToken) {
          setStatus("error");
          // Refused at top level too, so the frame was never the whole story.
          // Back off hard and let the visible reconnect modal take over.
          blockRedirectReauth();
          navigate(pending.returnTo, { replace: true });
          return;
        }
        await persistDriveToken(accessToken, expiresIn ? Number(expiresIn) : 3600);
        const email = await fetchAccountEmail(accessToken);
        if (email) await setDriveAccountEmail(email);
        allowRedirectReauth();
        setStatus("ok");
        navigate(pending.returnTo, { replace: true });
        // After the route change, so the listener no longer sees itself as
        // running inside the OAuth callback and skips its own sync.
        setTimeout(() => window.dispatchEvent(new Event("lommin:drive-token-updated")), 0);
      })();
      return;
    }

    const channel = new BroadcastChannel(GOOGLE_OAUTH_CHANNEL);
    if (accessToken) {
      channel.postMessage({
        access_token: accessToken,
        expires_in: expiresIn ? Number(expiresIn) : 3600,
        state,
      });
      setStatus("ok");
    } else {
      channel.postMessage({ error: error ?? "Ukjent feil", state });
      setStatus("error");
    }
    channel.close();

    const timer = setTimeout(() => window.close(), 1500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <p className="text-sm text-muted text-center">
        {status === "ok" && t("oauthSuccess")}
        {status === "error" && t("oauthError")}
      </p>
    </div>
  );
}
