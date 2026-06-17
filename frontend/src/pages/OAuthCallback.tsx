import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GOOGLE_OAUTH_CHANNEL } from "../lib/googleDrive";

export default function OAuthCallback() {
  const { t } = useTranslation("connect");
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const error = params.get("error");

    const expiresIn = params.get("expires_in");
    const channel = new BroadcastChannel(GOOGLE_OAUTH_CHANNEL);
    if (accessToken) {
      channel.postMessage({ access_token: accessToken, expires_in: expiresIn ? Number(expiresIn) : 3600 });
      setStatus("ok");
    } else {
      channel.postMessage({ error: error ?? "Ukjent feil" });
      setStatus("error");
    }
    channel.close();

    const timer = setTimeout(() => window.close(), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <p className="text-sm text-muted text-center">
        {status === "ok" && t("oauthSuccess")}
        {status === "error" && t("oauthError")}
      </p>
    </div>
  );
}
