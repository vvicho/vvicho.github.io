import React from "react";
import Card from "./Card";
import '../styles/CardWithControls.css';

export default function CardWithControls({
    uri,
    size,
    callback,
    cardId,
    amount,
    showControls,
    showAmount = showControls,
    lazyLoad = true
}
) {
    return (
        <div className='cardWithControlsContainer' style={{ width: size }}>
            {showAmount && (
                <div className='count'>{amount}</div>
            )}
            <Card uri={uri} size={size} callback={() => { }} key={cardId} lazy={lazyLoad} />
            {showControls && (
                <div className="controlsContainer">
                    <div className="extra">
                        <div onClick={() => callback(-1, cardId)} className="minus control">-</div>
                        <div onClick={() => callback(1, cardId)} className="add control">+</div>
                    </div>
                </div>
            )}
        </div>

    )
}