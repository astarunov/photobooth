import Link from "next/link";

interface ButtonProps {
  text: string;
  link: string;
}

export default function Button({ text, link }: ButtonProps) {
  return (
    <Link href={link}>
      <div className="w-[10vw] h-10 min-w-[125px] rounded-[1.25rem]  text-white bg-pink-200 flex items-center justify-center  font-bold">
        {text}
      </div>
    </Link>
  );
}
