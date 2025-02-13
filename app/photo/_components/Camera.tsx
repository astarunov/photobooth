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
          video: true,
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

  // Capture a photo from the video feed using a hidden canvas
  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    }
    return null;
  };

  // Returns a promise that resolves after a countdown from 3 to 1
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

  // Loop through 3 iterations, running the countdown before each photo capture
  const takePhotosWithCountdown = async () => {
    if (isTakingPhotos) return;
    setIsTakingPhotos(true);
    setPhotos([]); // Clear previous photos if needed
    setPdfUrl(null); // Clear any previous PDF

    for (let i = 0; i < 3; i++) {
      await runCountdown();
      const photoData = capturePhoto();
      if (photoData) {
        setPhotos((prev) => [...prev, photoData]);
      }
      // Small delay after capture before starting next countdown
      await new Promise((r) => setTimeout(r, 500));
    }
    setIsTakingPhotos(false);
  };

  // Generate a PDF with 3 photos arranged vertically on one page.
  // All images are scaled uniformly by a factor (0.5) to be about 2 times smaller.
  // A white gap at the bottom equal to 1/2 of the first photo's height is added.
  const generatePdf = async () => {
    if (photos.length !== 3) return;

    const conversionFactor = 0.264583; // px to mm conversion (approx. for 96 DPI)
    const scaleFactor = 0.5; // scale images to 50% of their converted size
    const marginH = 10; // horizontal margin in mm
    const marginV = 10; // vertical margin in mm

    // Load each photo to get its natural dimensions (in pixels)
    const loadedImages = await Promise.all(
      photos.map(
        (photoData) =>
          new Promise<{ data: string; width: number; height: number }>(
            (resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                resolve({
                  data: photoData,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
              };
              img.onerror = (err) => reject(err);
              img.src = photoData;
            }
          )
      )
    );

    // Convert dimensions from pixels to mm and apply uniform scaling
    const imageDimensions = loadedImages.map(({ data, width, height }) => {
      const imgWidthMM = width * conversionFactor * scaleFactor;
      const imgHeightMM = height * conversionFactor * scaleFactor;
      return { data, widthMM: imgWidthMM, heightMM: imgHeightMM };
    });

    // Calculate additional white gap at the bottom: 1/2 of the first photo's height
    const additionalGap = imageDimensions[0].heightMM / 2;

    // Determine PDF page dimensions:
    // Page width: the maximum image width plus horizontal margins.
    // Page height: the sum of all image heights + vertical margins (top, between images, bottom) + the additional gap.
    const maxWidthMM = Math.max(...imageDimensions.map((img) => img.widthMM));
    const totalImageHeight = imageDimensions.reduce(
      (acc, curr) => acc + curr.heightMM,
      0
    );
    const pageWidth = maxWidthMM + marginH * 2;
    const pageHeight =
      totalImageHeight + marginV * (imageDimensions.length + 1) + additionalGap;

    const doc = new jsPDF({ unit: "mm", format: [pageWidth, pageHeight] });

    // Place images one below the other
    let currentY = marginV;
    imageDimensions.forEach(({ data, widthMM, heightMM }) => {
      // Center the image horizontally if its width is less than maxWidthMM.
      const xPos = marginH + (maxWidthMM - widthMM) / 2;
      doc.addImage(data, "PNG", xPos, currentY, widthMM, heightMM);
      currentY += heightMM + marginV;
    });

    // The bottom gap remains white (PDF background is white by default)
    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
  };

  // When the photos array updates, generate the PDF if we have 3 photos.
  useEffect(() => {
    if (photos.length === 3 && !pdfUrl) {
      generatePdf();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  // Reset state to allow retaking photos
  const retakePhotos = () => {
    setPhotos([]);
    setPdfUrl(null);
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-pink-300 mt-6">Camera Preview</h2>
      {/* Video container with countdown overlay */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            maxWidth: "600px",
            border: "1px solid #ccc",
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
      <div style={{ margin: "20px 0" }}>
        {pdfUrl ? (
          <div className="flex flex-col items-center">
            <a href={pdfUrl} download="photos.pdf">
              <button className="w-[10vw] min-w-[125px] h-10 rounded-[1.25rem]  text-white bg-pink-200 flex items-center justify-center font-bold">
                Download PDF
              </button>
            </a>
            <button
              onClick={retakePhotos}
              className="w-[10vw] h-10 min-w-[125px] mt-4 rounded-[1.25rem] border border-neutral-800 text-neutral-800 bg-white flex items-center justify-center font-bold"
            >
              Retake Photos
            </button>
          </div>
        ) : (
          <button
            className="w-[10vw] h-10 min-w-[125px] rounded-[1.25rem] border border-neutral-800 text-neutral-800 bg-white flex items-center justify-center font-bold"
            onClick={takePhotosWithCountdown}
            disabled={isTakingPhotos}
          >
            Take Photo
          </button>
        )}
      </div>
      {/* Hidden canvas used for capturing the image */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {photos.length > 0 && (
        <div className="flex flex-col items-center">
          <h3 className="text-xl text-pink-300">Captured Photos</h3>
          {/* Scrollable container for photos on mobile, scrollbar hidden */}
          <div
            className="no-scrollbar overflow-x-auto"
            style={{ display: "flex", gap: "10px", marginBottom: "8px" }}
          >
            {photos.map((photo, index) => (
              <img
                key={index}
                src={photo}
                alt={`Captured ${index + 1}`}
                style={{ width: "200px" }}
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
