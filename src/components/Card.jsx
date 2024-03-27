import React from "react";
import '../styles/Card.css';

export default function Card({ uri, size, callback }) {
    return (
        <div className="cardContainer" style={{ width: size }}>
            <img onClick={() => callback()} className='cardImage' src={uri}></img>
        </div >
    );
}