"use client";

import dynamic from "next/dynamic";
import React from "react";
import Background from "@/app/_components/Background";

// Import the Camera component dynamically so it only loads on the client
const Camera = dynamic(() => import("./_components/Camera"), {
  ssr: false,
});

export default function PhotoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <body className="relative overflow-hidden">
      <Background>
        <div className="relative z-20 flex px-5 flex-col items-center">
          <header className="w-full">
            <h1 className="text-4xl text-center mt-10">Photobooth</h1>
            {/* Render the Camera component only for /photo */}
            <Camera />
          </header>
          <main className="w-full">{children}</main>
        </div>
      </Background>
    </body>
  );
}
