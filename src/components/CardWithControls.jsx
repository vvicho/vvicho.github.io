import React, { useState } from "react";
import Card from "./Card";
import '../styles/CardWithControls.css';

export default function CardWithControls({ uri, size, callback, cardId, amount }) {
    return (
        <div className='cardWithControlsContainer'>
            <div className='count'>{amount}</div>
            <Card uri={uri} size={size} callback={() => { }} key={cardId} />
            <div className="controlsContainer">
                <div className="extra">
                    <div onClick={() => callback(-1, cardId)} className="minus control">-</div>
                    <div onClick={() => callback(1, cardId)} className="add control">+</div>
                </div>
            </div>
        </div>

    )
}