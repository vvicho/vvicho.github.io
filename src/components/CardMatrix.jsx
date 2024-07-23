import React from "react";
import '../styles/CardMatrix.css';
import CardWithControls from "./CardWithControls";
import { sortCards } from "../utils/SortAndFilters";

const IMAGE_PATH = '/cards';

export default function CardMatrix({ cardAmount, cardsData, size, callback, showControls }) {
    return <div className="cardMatrixContainer">
        {Object.keys(cardsData).map((key, _) =>
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
    </div>
}