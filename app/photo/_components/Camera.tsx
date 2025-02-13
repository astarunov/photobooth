"use client";

import React, { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";

/** Helper: Convert pixels to mm (approx) for jsPDF. */
const pxToMm = (px: number) => px * 0.264583;

const Camera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTakingPhotos, setIsTakingPhotos] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  /************************************************
   * 1) Initialize Camera (4:3 preview for video) *
   ************************************************/
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
            aspectRatio: 4 / 3,
            width: { ideal: 640 },
            height: { ideal: 480 },
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

  /********************************************
   * 2) Capture a single 400×300 photo (4:3)  *
   ********************************************/
  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Desired final photo: 400 × 300 (to maintain 4:3 for your local usage)
    const TARGET_WIDTH = 400;
    const TARGET_HEIGHT = 300;
    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    const videoAspect = vidW / vidH;
    const targetAspect = TARGET_WIDTH / TARGET_HEIGHT;

    let srcX = 0;
    let srcY = 0;
    let srcW = vidW;
    let srcH = vidH;

    // Crop to maintain 4:3
    if (videoAspect > targetAspect) {
      // Video is wider; crop the sides
      const desiredWidth = vidH * targetAspect;
      srcX = (vidW - desiredWidth) / 2;
      srcW = desiredWidth;
    } else if (videoAspect < targetAspect) {
      // Video is taller; crop top/bottom
      const desiredHeight = vidW / targetAspect;
      srcY = (vidH - desiredHeight) / 2;
      srcH = desiredHeight;
    }

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

  /*************************************
   * 3) Countdown before each capture  *
   *************************************/
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

  /*********************************************
   * 4) Take 3 photos in a row with countdown  *
   *********************************************/
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

  /****************************************************************
   * 5) Generate PDF with each photo scaled to 200×150 inside PDF *
   ****************************************************************/
  const generatePdf = async () => {
    if (photos.length !== 3) return;

    /**
     * We want:
     * - Each photo: 200×150 px in the PDF
     * - 20 px margin left/right → total width = 240 px
     * - 20 px gap between photos (2 gaps for 3 photos => 40 px total)
     * - 90 px space at bottom
     * - total PDF height = 3×150 + 2×20 + 90 = 580 px
     */
    const pdfWidthPx = 240;
    const pdfHeightPx = 600;

    // Create jsPDF doc
    const doc = new jsPDF({
      unit: "mm",
      format: [pxToMm(pdfWidthPx), pxToMm(pdfHeightPx)],
    });

    // X = 20 px from left for each photo
    const xPosPx = 20;

    // Y positions for each photo:
    // 1st photo at y=0
    // 2nd photo at y=150 + 20 = 170
    // 3rd photo at y=170 + 150 + 20 = 340
    const positionsY = [20, 190, 360];

    // Add images to PDF
    photos.forEach((photo, i) => {
      doc.addImage(
        photo,
        "PNG",
        pxToMm(xPosPx),
        pxToMm(positionsY[i]),
        pxToMm(200), // scaled width
        pxToMm(150) // scaled height
      );
    });

    // Convert doc to Blob for download
    const blob = doc.output("blob");
    setPdfUrl(URL.createObjectURL(blob));
  };

  /*********************************************************
   * 6) Auto-generate PDF once we have exactly 3 new photos
   *********************************************************/
  useEffect(() => {
    if (photos.length === 3 && !pdfUrl) {
      generatePdf();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  /****************************************************
   * 7) Retake / clear photos & reset PDF link         *
   ****************************************************/
  const retakePhotos = () => {
    setPhotos([]);
    setPdfUrl(null);
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-pink-300 mt-6">Camera Preview</h2>
      {/* 
        4:3 container, max-w=300 for mobile. 
        aspect-[4/3] ensures we keep the ratio while responsive.
      */}
      <div className="relative w-full max-w-[300px] aspect-[4/3] overflow-hidden border border-gray-300">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {countdown !== null && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-4xl">
            {countdown}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="my-5 flex flex-col items-center">
        {pdfUrl ? (
          <>
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
          </>
        ) : (
          <button
            onClick={takePhotosWithCountdown}
            disabled={isTakingPhotos}
            className="w-[10vw] min-w-[125px] h-10 rounded-[1.25rem] border border-neutral-800 text-neutral-800 bg-white flex items-center justify-center font-bold"
          >
            Take Photo
          </button>
        )}
      </div>

      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="flex flex-col items-center">
          <h3 className="text-xl text-pink-300">Captured Photos</h3>
          <div className="no-scrollbar overflow-x-auto flex gap-2 my-3">
            {photos.map((photo, idx) => (
              <img
                key={idx}
                src={photo}
                alt={`Captured ${idx + 1}`}
                className="w-[100px] h-[75px] object-cover" // 4:3 thumbs
              />
            ))}
          </div>
        </div>
      )}

      {/* Hide scrollbars */}
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
