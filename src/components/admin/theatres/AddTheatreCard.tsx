"use client";

type Props = {
  onClick: () => void;
};

export default function AddTheatreCard({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="h-[240px] cursor-pointer rounded-2xl border-2 border-dashed border-neutral-300 flex items-center justify-center text-neutral-500 hover:border-black hover:text-black transition"
    >
      + Add Theatre
    </button>
  );
}
