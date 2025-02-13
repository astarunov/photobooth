"use client";

import React, { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { useMediaQuery } from "@/app/hooks/useMediaQuery";

const Camera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isTakingPhotos, setIsTakingPhotos] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Detect if we're at least md (768px) wide for desktop
  const isDesktop = useMediaQuery("(min-width: 768px)");

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
            aspectRatio: 4 / 3, // best effort
            width: { ideal: 1280 },
            height: { ideal: 960 },
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
   * Capture a photo from the video feed at either 400×225 (mobile) or 600×400 (desktop).
   * We'll check `isDesktop` to decide final width & height for the capture.
   */
  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Decide final container size
    const TARGET_WIDTH = isDesktop ? 600 : 400;
    const TARGET_HEIGHT = isDesktop ? 400 : 225;
    const targetAspect = TARGET_WIDTH / TARGET_HEIGHT;

    const vidW = video.videoWidth;
    const vidH = video.videoHeight;
    const videoAspect = vidW / vidH;

    // Set canvas to final size
    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    let srcX = 0;
    let srcY = 0;
    let srcW = vidW;
    let srcH = vidH;

    if (videoAspect > targetAspect) {
      // Video is relatively wider, crop sides
      const desiredWidth = vidH * targetAspect;
      srcX = (vidW - desiredWidth) / 2;
      srcW = desiredWidth;
    } else if (videoAspect < targetAspect) {
      // Video is relatively taller, crop top/bottom
      const desiredHeight = vidW / targetAspect;
      srcY = (vidH - desiredHeight) / 2;
      srcH = desiredHeight;
    }

    // Draw cropped region
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

  // 3...2...1 countdown
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

  // Capture 3 photos in a row
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
      await new Promise((r) => setTimeout(r, 500));
    }
    setIsTakingPhotos(false);
  };

  /**
   * Generate PDF:
   *  - scaleFactor = 0.3 if desktop, else 0.6
   *  - images placed vertically
   */
  const generatePdf = async () => {
    if (photos.length !== 3) return;

    const scaleFactor = isDesktop ? 0.3 : 0.6; // dynamic scaling
    const conversionFactor = 0.264583; // px -> mm
    const marginH = 10;
    const marginV = 10;

    // Load each image
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

    // Convert to mm, scale accordingly
    const imageDimensions = loadedImages.map(({ data, width, height }) => {
      const wMM = width * conversionFactor * scaleFactor;
      const hMM = height * conversionFactor * scaleFactor;
      return { data, widthMM: wMM, heightMM: hMM };
    });

    const additionalGap = imageDimensions[0].heightMM / 2;
    const maxWidthMM = Math.max(...imageDimensions.map((img) => img.widthMM));
    const totalHeight = imageDimensions.reduce((sum, i) => sum + i.heightMM, 0);
    const pageWidth = maxWidthMM + marginH * 2;
    const pageHeight =
      totalHeight + marginV * (imageDimensions.length + 1) + additionalGap;

    const doc = new jsPDF({ unit: "mm", format: [pageWidth, pageHeight] });

    let currentY = marginV;
    for (const { data, widthMM, heightMM } of imageDimensions) {
      const xPos = marginH + (maxWidthMM - widthMM) / 2;
      doc.addImage(data, "PNG", xPos, currentY, widthMM, heightMM);
      currentY += heightMM + marginV;
    }

    const blob = doc.output("blob");
    setPdfUrl(URL.createObjectURL(blob));
  };

  // Whenever we have 3 photos, auto-generate PDF
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

  // Container uses Tailwind responsive classes:
  // default => 400×225
  // md => 600×400
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-pink-300 mt-6">Camera Preview</h2>
      <div className="relative inline-block overflow-hidden border border-gray-300 w-[400px] h-[225px] md:w-[600px] md:h-[400px]">
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

      {/* Hidden canvas */}
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
                className="w-[100px] h-[56.25px] md:w-[150px] md:h-[100px] object-cover"
              />
            ))}
          </div>
        </div>
      )}

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
