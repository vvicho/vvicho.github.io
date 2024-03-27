import React from "react";
import Card from "./Card";
import '../styles/CardMatrix.css';
import CardWithControls from "./CardWithControls";

export default function CardMatrix({ cardsData, size, callback, showControls }) {
    function returnCardWithControls() {
        // console.log(cardsData);

        return <div className="cardMatrixContainer">
            {Object.keys(cardsData).map((key, _) =>
                <CardWithControls
                    uri={cardsData[key].uri}
                    callback={callback}
                    size={size}
                    key={cardsData[key].cardId}
                    amount={cardsData[key].amount}
                    cardId={key}
                />
            )}
        </div>
    }

    if (showControls) {
        return returnCardWithControls();
    }

    return <div className="cardMatrixContainer">
        {Object.leys(cardsData).map((key, data) =>
            <Card
                uri={data.uri}
                callback={callback}
                size={size}
                key={data.uri}
            />
        )}
    </div>
}