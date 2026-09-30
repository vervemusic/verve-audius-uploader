import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import process from "process";
import "./styles.css";

const API_KEY = "68cd78f21e1f74ef80d07baa8f18ab31bc9d81b2";
const APP_NAME = "Verve Audius Uploader";

(globalThis as any).global = globalThis;
(globalThis as any).Buffer = Buffer;
(globalThis as any).process = process;

let sdkPromise: Promise<any> | null = null;

async function getSdk() {
  if (!sdkPromise) {
    sdkPromise = import("@audius/sdk").then(({ sdk }) =>
      sdk({
        apiKey: API_KEY,
        appName: APP_NAME,
        redirectUri: `${window.location.origin}/oauth/audius/callback`,
      })
    );
  }
  return sdkPromise;
}

function Callback() {
  const [message, setMessage] = useState("Finishing Audius sign-in…");

  useEffect(() => {
    (async () => {
      try {
        const audius = await getSdk();
        await audius.oauth.handleRedirect();
        setMessage("Signed in. You can close this window.");
        setTimeout(() => window.close(), 800);
      } catch (e: any) {
        setMessage(`Sign-in failed: ${e?.message ?? String(e)}`);
      }
    })();
  }, []);

  return <main className="card"><h1>Verve Music</h1><p>{message}</p></main>;
}

function App() {
  const [account, setAccount] = useState<any>(null);
  const [status, setStatus] = useState("Not connected.");
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Folk");
  const [description, setDescription] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [artwork, setArtwork] = useState<File | null>(null);

  async function refreshAccount() {
    try {
      const audius = await getSdk();
      if (await audius.oauth.isAuthenticated()) {
        const user = await audius.oauth.getUser();
        setAccount(user);
        setStatus(`Connected to ${user.name || user.handle}.`);
      }
    } catch {}
  }

  useEffect(() => { refreshAccount(); }, []);

  async function connect() {
    setBusy(true);
    setStatus("Opening Audius authorization…");
    try {
      const audius = await getSdk();
      await audius.oauth.login({ scope: "write", display: "popup" });
      await refreshAccount();
    } catch (e: any) {
      setStatus(`Audius connection failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!account) return setStatus("Connect Audius first.");
    if (!audio || !artwork || !title.trim() || !genre.trim()) {
      return setStatus("Title, genre, audio file and artwork are required.");
    }

    setBusy(true);
    setStatus("Uploading to Audius…");
    try {
      const audius = await getSdk();
      const createTrack = audius.tracks.createTrack.bind(audius.tracks) as any;
      const response = await createTrack({
        userId: account.id,
        audioFile: audio,
        imageFile: artwork,
        metadata: {
          title: title.trim(),
          genre: genre.trim(),
          description: description.trim() || null,
          isDownloadable: false
        }
      });
      const trackId = response?.trackId;
      setStatus(trackId ? `Published. Audius track ID: ${trackId}` : "Audius accepted the upload, but no track ID was returned.");
    } catch (e: any) {
      setStatus(`Upload failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="card">
      <div className="brand">VERVE MUSIC</div>
      <h1>Audius Uploader</h1>
      <p className="muted">First prove the connection and one release. Then the catalog pipeline can be automated.</p>

      <button onClick={connect} disabled={busy}>{account ? "Reconnect Audius" : "Connect Audius"}</button>
      <div className="status">{status}</div>

      <section>
        <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} /></label>
        <label>Genre<input value={genre} onChange={e=>setGenre(e.target.value)} /></label>
        <label>Description<textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)} /></label>
        <label>WAV / audio<input type="file" accept="audio/*,.wav,.flac,.aiff,.mp3" onChange={e=>setAudio(e.target.files?.[0] ?? null)} /></label>
        <label>Square artwork<input type="file" accept="image/*" onChange={e=>setArtwork(e.target.files?.[0] ?? null)} /></label>
        <button onClick={publish} disabled={busy || !account}>Publish to Audius</button>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  window.location.pathname === "/oauth/audius/callback" ? <Callback /> : <App />
);
