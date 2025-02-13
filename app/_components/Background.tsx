"use client";
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

interface BackgroundProps {
  children: React.ReactNode;
}

interface BalloonItem {
  id: number;
  left: number; // Horizontal position as a percentage
  delay: number; // Delay before the animation starts (in seconds)
  duration: number; // Duration of the upward animation (in seconds)
}

const Balloon: React.FC<BalloonItem> = ({ left, delay, duration }) => {
  // Randomly choose one of the three images on mount.
  const randomImage = useMemo(() => {
    const images = ["/Baloons1.png", "/Baloons2.png", "/Baloons3.png"];
    return images[Math.floor(Math.random() * images.length)];
  }, []);

  return (
    <motion.img
      src={randomImage}
      alt="balloon"
      className="absolute"
      initial={{ bottom: "150%", opacity: 0.5 }}
      animate={{ bottom: -100, opacity: 1 }}
      transition={{ delay, duration, ease: "linear" }}
      style={{
        left: `${left}%`,
        width: "200px", // Adjust size as needed
        height: "auto",
      }}
    />
  );
};

export default function Background({ children }: BackgroundProps) {
  const [balloons, setBalloons] = useState<BalloonItem[]>([]);

  useEffect(() => {
    const spawnInterval = setInterval(() => {
      const id = Date.now() + Math.random();
      const left = Math.random() * 100; // Random horizontal position (0% to 100%)
      const delay = 0; // No delay before starting the animation
      const duration = 5 + Math.random() * 5; // Duration between 5 and 10 seconds
      const newBalloon: BalloonItem = { id, left, delay, duration };

      setBalloons((prev) => [...prev, newBalloon]);

      // Remove the balloon after its animation is complete
      setTimeout(() => {
        setBalloons((prev) => prev.filter((b) => b.id !== newBalloon.id));
      }, (delay + duration) * 1000);
    }, 1000); // Spawn a new balloon every second

    return () => clearInterval(spawnInterval);
  }, []);

  return (
    <div className="z-10 relative w-screen min-h-screen h-full overflow-hidden">
      {children}
      {balloons.map((balloon) => (
        <Balloon key={balloon.id} {...balloon} />
      ))}
    </div>
  );
}
