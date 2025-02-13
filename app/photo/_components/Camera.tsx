import React, { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";

const Camera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTakingPhotos, setIsTakingPhotos] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    const handleLoadedData = () => {
      videoRef.current?.play().catch((error) => {
        if (error.name === "AbortError") {
          console.warn("Video play aborted:", error);
        } else {
          console.error("Error playing video:", error);
        }
      });
    };

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            // Request a 4:3 aspect ratio (best effort)
            aspectRatio: 4 / 3,
            width: { ideal: 1280 }, // optional
            height: { ideal: 960 }, // optional
          },
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", handleLoadedData);
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    };

    initCamera();

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener("loadeddata", handleLoadedData);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  /**
   * Capture a photo from the video feed at exactly 600×450.
   * We compare the video's aspect ratio vs. 600/450 (1.3333).
   * Then crop from sides or top/bottom so the final image is 600×450.
   */
  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Desired final dimensions
    const TARGET_WIDTH = 600;
    const TARGET_HEIGHT = 450;
    const targetAspect = TARGET_WIDTH / TARGET_HEIGHT; // = 1.3333

    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    const videoAspect = vidW / vidH;

    // Set the canvas to 600x450
    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    let srcX = 0;
    let srcY = 0;
    let srcW = vidW;
    let srcH = vidH;

    if (videoAspect > targetAspect) {
      // Video is relatively wider than 4:3, so crop the left/right
      // We want the height to match exactly, so scale width
      const desiredWidth = vidH * targetAspect; // how wide we need for 4:3
      srcX = (vidW - desiredWidth) / 2;
      srcW = desiredWidth;
    } else if (videoAspect < targetAspect) {
      // Video is relatively taller than 4:3, so crop top/bottom
      const desiredHeight = vidW / targetAspect;
      srcY = (vidH - desiredHeight) / 2;
      srcH = desiredHeight;
    }

    // Draw the cropped region of the video onto the 600×450 canvas
    ctx.drawImage(
      video,
      srcX,
      srcY,
      srcW,
      srcH,
      0,
      0,
      TARGET_WIDTH,
      TARGET_HEIGHT
    );

    return canvas.toDataURL("image/png");
  };

  // Countdown logic: returns a promise that resolves after 3...2...1
  const runCountdown = () => {
    return new Promise<void>((resolve) => {
      let count = 3;
      setCountdown(count);
      const intervalId = setInterval(() => {
        count--;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(intervalId);
          setCountdown(null);
          resolve();
        }
      }, 1000);
    });
  };

  // Take 3 photos in sequence, each preceded by a countdown
  const takePhotosWithCountdown = async () => {
    if (isTakingPhotos) return;
    setIsTakingPhotos(true);
    setPhotos([]);
    setPdfUrl(null);

    for (let i = 0; i < 3; i++) {
      await runCountdown();
      const dataUrl = capturePhoto();
      if (dataUrl) {
        setPhotos((prev) => [...prev, dataUrl]);
      }
      // small delay
      await new Promise((r) => setTimeout(r, 500));
    }
    setIsTakingPhotos(false);
  };

  /**
   * Generate a PDF with each photo scaled down to 40% (scaleFactor = 0.4).
   * Each image is placed vertically.
   */
  const generatePdf = async () => {
    if (photos.length !== 3) return;

    const scaleFactor = 0.3; // 40%
    const conversionFactor = 0.264583; // px -> mm, approx for 96 DPI
    const marginH = 10;
    const marginV = 10;

    // Load each image to get original dimensions
    const loadedImages = await Promise.all(
      photos.map(
        (dataUrl) =>
          new Promise<{ data: string; width: number; height: number }>(
            (resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                resolve({
                  data: dataUrl,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
              };
              img.onerror = (err) => reject(err);
              img.src = dataUrl;
            }
          )
      )
    );

    // Convert dimensions to mm and apply scaleFactor
    const imageDimensions = loadedImages.map(({ data, width, height }) => {
      const wMM = width * conversionFactor * scaleFactor;
      const hMM = height * conversionFactor * scaleFactor;
      return { data, widthMM: wMM, heightMM: hMM };
    });

    const additionalGap = imageDimensions[0].heightMM / 2; // extra white space
    const maxWidthMM = Math.max(...imageDimensions.map((img) => img.widthMM));
    const totalImageHeight = imageDimensions.reduce(
      (sum, img) => sum + img.heightMM,
      0
    );
    const pageWidth = maxWidthMM + marginH * 2;
    const pageHeight =
      totalImageHeight + marginV * (imageDimensions.length + 1) + additionalGap;

    // Create PDF
    const doc = new jsPDF({ unit: "mm", format: [pageWidth, pageHeight] });

    let currentY = marginV;
    for (const { data, widthMM, heightMM } of imageDimensions) {
      const xPos = marginH + (maxWidthMM - widthMM) / 2; // center horizontally
      doc.addImage(data, "PNG", xPos, currentY, widthMM, heightMM);
      currentY += heightMM + marginV;
    }

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
  };

  // Auto-generate PDF once we have 3 photos
  useEffect(() => {
    if (photos.length === 3 && !pdfUrl) {
      generatePdf();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  const retakePhotos = () => {
    setPhotos([]);
    setPdfUrl(null);
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-pink-300 mt-6">Camera Preview</h2>

      {/* Container for the live video (force 600×450 display) */}
      <div
        style={{
          position: "relative",
          display: "inline-block",
          width: "600px",
          height: "450px",
          overflow: "hidden",
          border: "1px solid #ccc",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {countdown !== null && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "4rem",
              color: "white",
            }}
          >
            {countdown}
          </div>
        )}
      </div>

      {/* Photo-taking buttons / PDF link */}
      <div style={{ margin: "20px 0" }}>
        {pdfUrl ? (
          <div className="flex flex-col items-center">
            <a href={pdfUrl} download="photos.pdf">
              <button className="w-[10vw] min-w-[125px] h-10 rounded-[1.25rem] text-white bg-pink-200 flex items-center justify-center font-bold">
                Download PDF
              </button>
            </a>
            <button
              onClick={retakePhotos}
              className="w-[10vw] min-w-[125px] h-10 mt-4 rounded-[1.25rem] border border-neutral-800 text-neutral-800 bg-white flex items-center justify-center font-bold"
            >
              Retake Photos
            </button>
          </div>
        ) : (
          <button
            className="w-[10vw] min-w-[125px] h-10 rounded-[1.25rem] border border-neutral-800 text-neutral-800 bg-white flex items-center justify-center font-bold"
            onClick={takePhotosWithCountdown}
            disabled={isTakingPhotos}
          >
            Take Photo
          </button>
        )}
      </div>

      {/* Hidden canvas for capturing the image */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Thumbnails of captured photos */}
      {photos.length > 0 && (
        <div className="flex flex-col items-center">
          <h3 className="text-xl text-pink-300">Captured Photos</h3>
          <div
            className="no-scrollbar overflow-x-auto"
            style={{ display: "flex", gap: "10px", marginBottom: "8px" }}
          >
            {photos.map((photo, index) => (
              <img
                key={index}
                src={photo}
                alt={`Captured ${index + 1}`}
                style={{
                  width: "150px",
                  height: "112.5px",
                  objectFit: "cover",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hide scrollbars on mobile */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default Camera;
