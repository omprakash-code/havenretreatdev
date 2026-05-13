"use client";

const announcementText =
  "HURRY UP !!! BOOK YOUR SLOTS IN ADVANCE AND ENJOY SPECIAL OFFERS. FOR DISCOUNTS, CALL US NOW! 928-928-9696";

export default function AnnouncementBar() {
  return (
    <div
      id="top-announcement-marquee"
      className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(90deg,rgba(8,8,8,0.78)_0%,rgba(30,20,6,0.82)_50%,rgba(8,8,8,0.78)_100%)] py-1 backdrop-blur-sm"
    >
      <div className="top-announcement-marquee__track">
        {[0, 1, 2].map((copyIndex) => (
          <div className="top-announcement-marquee__group" key={copyIndex}>
            <span className="top-announcement-marquee__item">
              {announcementText}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
