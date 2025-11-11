import React, { useEffect, useMemo, useRef, useState } from "react";
import '../styles/CardMatrix.css';
import CardWithControls from "./CardWithControls";

const IMAGE_PATH = `${import.meta.env.BASE_URL}cards`;

export default function CardMatrix({ cardAmount, cardsData, size, callback, showControls }) {
    const PAGE_SIZE = 60;
    const keys = useMemo(() => Object.keys(cardsData), [cardsData]);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const sentinelRef = useRef(null);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [keys.length]);

    useEffect(() => {
        if (!sentinelRef.current) return;
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setVisibleCount(prev => Math.min(prev + PAGE_SIZE, keys.length));
                    }
                });
            },
            { root: null, rootMargin: '400px', threshold: 0.01 }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [sentinelRef.current, keys.length]);

    const slice = keys.slice(0, visibleCount);

    return <div className="cardMatrixContainer">
        {slice.map((key, _) =>
            <CardWithControls
                showControls={showControls}
                uri={`${IMAGE_PATH}/${cardsData[key].cardSetCode}/${cardsData[key].parallelId}.png`}
                callback={callback}
                size={size}
                key={cardsData[key].parallelId}
                amount={cardAmount[key] ?? 0}
                cardId={key}
            />
        )}
        <div ref={sentinelRef} style={{ width: '100%', height: 1 }} />
    </div>
}