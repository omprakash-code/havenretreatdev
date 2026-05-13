"use client";

import { Splide, SplideSlide } from "@splidejs/react-splide";
import Image from "next/image";
import { Star } from "lucide-react";
import { useState } from "react";

/* Google Icon */
function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.3 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.3 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.4 35.1 26.8 36 24 36c-5.3 0-9.8-3.4-11.4-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.5 5.6-6.7 6.9l6.2 5.2C38.8 36.7 44 31.1 44 24c0-1.3-.1-2.7-.4-3.5z" />
        </svg>
    );
}

/* Review Type */
type ReviewMedia = {
    type: "image" | "video";
    src: string;
};

type Review = {
    name: string;
    timeAgo: string;
    text: string;
    media?: ReviewMedia[];
};


/* Reviews Data (example – add all yours here) */
const reviews: Review[] = [
    {
        name: "Vaishnavi Puri",
        timeAgo: "5 months ago",
        text:
            "I recently booked a proposal event with Haven Retreat and it turned out to be the most magical experience ever. From the moment we arrived, every detail was handled with perfection and care. The decor, lighting, and overall ambiance felt straight out of a fairytale. The food quality was exceptional in both taste and presentation, and hygiene standards were top-notch. I’m beyond glad I chose them for such an important milestone and would highly recommend them.",
        media: [
            { type: "image", src: "/media/site/home/reviews/vaishnavi-puri/1.webp" },
            { type: "image", src: "/media/site/home/reviews/vaishnavi-puri/2.webp" },
            { type: "image", src: "/media/site/home/reviews/vaishnavi-puri/3.webp" },
        ],
    },
    {
        name: "Reema",
        timeAgo: "a year ago",
        text:
            "Loved the entire concept of Haven Retreat. It’s a perfect place to enjoy special moments with your loved ones in complete privacy. The decorations were beautiful and the screen setup was simple and user-friendly. Recliners were comfortable and the staff was very helpful throughout. Snacks were reasonably priced and we created some truly memorable moments here.",
        media: [
            { type: "image", src: "/media/site/home/reviews/reema/1.webp" },
            { type: "image", src: "/media/site/home/reviews/reema/2.webp" },
            { type: "image", src: "/media/site/home/reviews/reema/3.webp" },
            { type: "image", src: "/media/site/home/reviews/reema/4.webp" },
            { type: "image", src: "/media/site/home/reviews/reema/5.webp" },
        ],
    },
    {
        name: "Veer Singh Dahiya",
        timeAgo: "7 months ago",
        text:
            "This private theatre experience completely exceeded my expectations. From plush seating to excellent sound and projection quality, everything felt premium and luxurious. What truly stood out was the attention to detail and personalized service provided by the team. Having an entire cinema to ourselves made the birthday celebration feel intimate yet grand. Definitely worth every penny and highly recommended.",
        media: [
            { type: "image", src: "/media/site/home/reviews/veer-singh-dahiya/1.webp" },
            { type: "image", src: "/media/site/home/reviews/veer-singh-dahiya/2.webp" },
        ],
    },
    {
        name: "Yash B",
        timeAgo: "a year ago",
        text:
            "The ambiance at Haven Retreat is top-notch. Each screening room is meticulously designed, boasting comfortable seating, state-of-the-art projection systems, and excellent acoustics. The attention to detail in the decor adds an air of sophistication, making it a perfect setting for an immersive cinematic experience. You can change room interior as per your occasion.",
        media: [
            { type: "image", src: "/media/site/home/reviews/yash-b/1.webp" },
            { type: "image", src: "/media/site/home/reviews/yash-b/2.webp" },
            { type: "image", src: "/media/site/home/reviews/yash-b/3.webp" },
            { type: "image", src: "/media/site/home/reviews/yash-b/4.webp" },
            { type: "image", src: "/media/site/home/reviews/yash-b/5.webp" },
        ],
    },
    {
        name: "Life of Paetoo",
        timeAgo: "a year ago",
        text:
            "Haven Retreat in Pitampura is truly a hidden gem for intimate movie-watching experiences. The cozy private theatre is perfect for birthdays, anniversaries, or romantic date nights. The in-house kitchen serves delicious snacks that add to the overall experience. The staff was extremely accommodating and ensured everything ran flawlessly. It’s a fantastic place to create unforgettable memories.",
        media: [
            { type: "image", src: "/media/site/home/reviews/life-of-paetoo/1.webp" },
            { type: "image", src: "/media/site/home/reviews/life-of-paetoo/2.webp" },
            { type: "image", src: "/media/site/home/reviews/life-of-paetoo/3.webp" },
            { type: "image", src: "/media/site/home/reviews/life-of-paetoo/4.webp" },
            { type: "image", src: "/media/site/home/reviews/life-of-paetoo/5.webp" },
            { type: "image", src: "/media/site/home/reviews/life-of-paetoo/6.webp" },
        ],
    },
    {
        name: "Satinderjit Kaur",
        timeAgo: "a year ago",
        text:
            "I had an amazing time at Haven Retreat with my loved ones. The private theatre space was beautifully decorated and created a very warm, intimate atmosphere. Their food and drink options were excellent, especially the super loaded garlic bread which was my favorite. Everything felt cozy, premium, and thoughtfully arranged. Perfect spot for a memorable celebration.",
        media: [
            { type: "image", src: "/media/site/home/reviews/satinderjit-kaur/1.webp" },
            { type: "image", src: "/media/site/home/reviews/satinderjit-kaur/2.webp" },
        ],
    },
    {
        name: "Pratik Kumar",
        timeAgo: "5 months ago",
        text:
            "We booked a private theatre room for my friend’s birthday and the experience was outstanding. The room easily accommodated our group and felt spacious and well-maintained. The vibe was cool and premium, making the celebration even better. The staff was polite, professional, and ensured everything went smoothly. Highly recommend this place for private gatherings and celebrations.",
        media: [
            { type: "image", src: "/media/site/home/reviews/pratik-kumar/1.webp" },
            { type: "image", src: "/media/site/home/reviews/pratik-kumar/2.webp" },
            { type: "image", src: "/media/site/home/reviews/pratik-kumar/3.webp" },
            { type: "image", src: "/media/site/home/reviews/pratik-kumar/4.webp" },
        ],
    },
    {
        name: "Rashmi Sharma",
        timeAgo: "a year ago",
        text:
            "It was a wonderful experience for me and my husband at Haven Retreat. The team made our special moment even more memorable with their efforts and attention to detail. The food served was very tasty and well-prepared. Everything from ambiance to service felt warm and welcoming. We truly enjoyed our time here and would love to visit again.",
        media: [
            { type: "image", src: "/media/site/home/reviews/rashmi-sharma/1.webp" },
            { type: "image", src: "/media/site/home/reviews/rashmi-sharma/2.webp" },
            { type: "image", src: "/media/site/home/reviews/rashmi-sharma/3.webp" },
            { type: "image", src: "/media/site/home/reviews/rashmi-sharma/4.webp" },
            { type: "image", src: "/media/site/home/reviews/rashmi-sharma/5.webp" },
            { type: "image", src: "/media/site/home/reviews/rashmi-sharma/6.webp" },
            { type: "image", src: "/media/site/home/reviews/rashmi-sharma/7.webp" },
        ],
    },
    {
        name: "Sandeep Saini",
        timeAgo: "a year ago",
        text:
            "Very good place for celebration parties like birthday anniversary family time staff is very professional and they provide welcome drinks when we enter and it was amazing a very sweet gesture it was i am really happy with service and the food is also to yumm and tempting.",
        media: [
            { type: "image", src: "/media/site/home/reviews/sandeep-saini/1.webp" },
            { type: "image", src: "/media/site/home/reviews/sandeep-saini/2.webp" },
            { type: "image", src: "/media/site/home/reviews/sandeep-saini/3.webp" },
            { type: "image", src: "/media/site/home/reviews/sandeep-saini/4.webp" },
        ],
    },
    {
        name: "Carry matt",
        timeAgo: "a year ago",
        text:
            "The theatre room itself was perfect for a couple. It was clean, comfortable, and equipped with top-notch amenities. The seating was plush and cozy, making it easy for everyone to relax and enjoy the movie. The staff at Haven Retreat were also a highlight of our visit. They were friendly, attentive, and ensured that we had everything we needed for a great celebration. Their excellent service added to the overall enjoyable experience.",
        media: [
            { type: "image", src: "/media/site/home/reviews/carry-matt/1.webp" },
        ],
    },
];


export default function GoogleReviewsSection() {
    const [pauseOuter, setPauseOuter] = useState(true);

    return (
        <section className="py-10 sm:py-14 bg-section-light">
            <div className="max-w-7xl mx-auto px-3 sm:px-6">
                {/* Header */}
                <div className="text-center mb-4 sm:mb-10">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-black">
                        Loved by Our Guests on Google Reviews
                    </h2>
                    <p className="mt-3 text-sm sm:text-base text-gray-500">
                        Thousands of premium private theatre experiences
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2 sm:gap-3">
                        <span className="text-3xl sm:text-4xl font-bold">4.9</span>
                        <div className="flex">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                    key={i}
                                    size={22}
                                    className="fill-[#FFD700] text-[#FFD700]"
                                />
                            ))}
                        </div>
                        <span className="text-gray-500 text-sm sm:text-lg">· 394 reviews</span>
                    </div>
                </div>

                {/* MAIN REVIEW CAROUSEL */}
                <div className="review-main-carousel">
                    <Splide
                        options={{
                            mediaQuery: "max",
                            type: "loop",
                            perPage: 3,
                            gap: "1rem",
                            autoplay: !pauseOuter,
                            interval: 3500,
                            pauseOnHover: true,
                            pauseOnFocus: true,
                            arrows: true,
                            pagination: true,
                            autoHeight: false,
                            height: "auto",
                            breakpoints: {
                                768: { perPage: 1, gap: "0.75rem" },
                            },
                        }}
                    >
                        {reviews.map((review, index) => (
                            <SplideSlide key={index} className="h-full">
                                <ReviewCard
                                    review={review}
                                    onInnerInteract={(isActive) =>
                                        setPauseOuter(isActive)
                                    }
                                />
                            </SplideSlide>
                        ))}
                    </Splide>
                </div>
            </div>
        </section>
    );
}

/* SINGLE REVIEW CARD */
function ReviewCard({
    review,
    onInnerInteract,
}: {
    review: Review;
    onInnerInteract: (active: boolean) => void;
}) {
    const media = review.media ?? [];
    const hasMedia = media.length > 0;
    const hasSingleMedia = media.length === 1;
    const mediaHeightClass = "review-media-frame";

    return (
        <div className="relative h-full rounded-2xl border border-neutral-200 bg-white p-3 sm:p-5 flex flex-col">
            {/* Google Icon */}
            <div className="absolute top-4 right-4">
                <GoogleIcon />
            </div>

            {/* User */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-700">
                    {review.name.charAt(0)}
                </div>
                <div>
                    <p className="font-medium text-black text-xs sm:text-sm">
                        {review.name}
                    </p>
                    <p className="text-xs text-gray-500">
                        {review.timeAgo}
                    </p>
                </div>
            </div>

            {/* Stars */}
            <div className="flex mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                        key={i}
                        size={14}
                        className="fill-[#FFD700] text-[#FFD700]"
                    />
                ))}
            </div>

            {/* Review Text (fixed height) */}
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed line-clamp-4">
                {review.text}
            </p>

            {/* SINGLE MEDIA (no slider clone issue) */}
            {hasSingleMedia && media[0].type === "image" ? (
                <div className={`mt-3 sm:mt-4 overflow-hidden rounded-lg ${mediaHeightClass}`}>
                    <Image
                        src={media[0].src}
                        alt="Review media"
                        width={300}
                        height={180}
                        loading="lazy"
                        className="object-cover object-center w-full h-full"
                    />
                </div>
            ) : null}

            {hasSingleMedia && media[0].type === "video" ? (
                <div className={`mt-3 sm:mt-4 overflow-hidden rounded-lg ${mediaHeightClass}`}>
                    <video
                        src={media[0].src}
                        className="w-full h-full object-cover object-center"
                        muted
                        playsInline
                        loop
                        preload="metadata"
                    />
                </div>
            ) : null}

            {/* INNER IMAGE CAROUSEL */}
            {hasMedia && !hasSingleMedia && (
                <div
                    className={`review-inner-carousel mt-3 sm:mt-4 overflow-hidden rounded-lg ${mediaHeightClass}`}
                    onMouseEnter={() => onInnerInteract(true)}
                    onMouseLeave={() => onInnerInteract(false)}
                >
                    <Splide
                        options={{
                            type: "slide",
                            rewind: true,
                            perPage: 1,
                            arrows: true,
                            pagination: false,
                            autoplay: true,
                            interval: 4000,
                            pauseOnHover: true,
                            autoHeight: false,
                            height: "100%",
                        }}
                    >
                        {media.map((item, idx) => (
                            <SplideSlide key={idx}>
                                {item.type === "image" ? (
                                    <Image
                                        src={item.src}
                                        alt="Review media"
                                        width={300}
                                        height={180}
                                        loading="lazy"
                                        className="object-cover object-center w-full h-full"
                                    />
                                ) : (
                                    <video
                                        src={item.src}
                                        className="w-full h-full object-cover object-center"
                                        muted
                                        playsInline
                                        loop
                                        preload="metadata"
                                        onPlay={() => onInnerInteract(true)}
                                        onPause={() => onInnerInteract(false)}
                                    />
                                )}
                            </SplideSlide>
                        ))}
                    </Splide>
                </div>
            )}

        </div>
    );
}
