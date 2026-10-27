import axios from "axios";
import { useEffect, useState } from "react";

export default function useFetchSplinecode() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    axios
      .get(`${import.meta.env.BASE_URL}${import.meta.env.VITE_SPLINE_URL}`, {
        signal: controller.signal,
        responseType: "blob",
        onDownloadProgress: ({ loaded, total }) =>
          setProgress(
            Math.min(100, (loaded / (total || import.meta.env.VITE_SPLINE_CONTENT_LENGTH)) * 100)
          ),
      })
      .then(({ data }) => {
        setProgress(100);
        objectUrl = window.URL.createObjectURL(data);
        setDataUrl(objectUrl);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          console.error("Unable to load the room scene", cause);
          setError("The room could not be loaded. Please refresh to try again.");
        }
      });
    return () => {
      controller.abort();
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return { dataUrl, progress, error };
}
