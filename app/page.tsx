import Button from "@/app/_components/Button";

export default function Home() {
  return (
    <div className="relative h-screen w-screen flex flex-col items-center justify-center z-20">
      <h1 className="text-6xl md:text-9xl">Photobooth</h1>
      <p className="text-sm max-w-[50vw] text-center mb-20">
        Capture the moment, cherish the magic, relive the love
      </p>
      <Button link="/welcome" text="START" />
      <p className="absolute bottom-10 text-base">
        {" "}
        made by Artem <span className="text-pink-300">with love</span>{" "}
      </p>
    </div>
  );
}
