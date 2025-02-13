import Button from "@/app/_components/Button";

export default function Home() {
  return (
    <div className="relative h-screen w-screen flex flex-col items-center justify-center z-20">
      <h1 className="text-6xl md:text-9xl">Welcome!</h1>
      <p className="text-sm max-w-[50vw] md:max-w-[400px] text-center mb-20">
        After you press START, you’ll be redirected to the camera page. When you
        click Take Photo, three photos will be taken back‑to‑back, with three
        seconds for each shot—no pauses. Then, you’ll be able to see the shots
        you took below. Good luck!
      </p>
      <Button link="/photo" text="START" />
      <p className="absolute bottom-10 text-base">
        {" "}
        made by Artem <span className="text-pink-300">for Sofia</span>{" "}
      </p>
    </div>
  );
}
