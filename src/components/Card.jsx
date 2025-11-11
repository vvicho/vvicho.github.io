import React from "react";
import '../styles/Card.css';
import LazyImage from "./LazyImage";

export default function Card({ uri, size, callback, lazy = true }) {
    return (
        <div className="cardContainer" style={{ width: size }}>
            {lazy ? (
                <LazyImage onClick={() => callback()} className='cardImage' src={uri} style={{ width: '100%' }} />
            ) : (
                <img onClick={() => callback()} className='cardImage' src={uri} loading="eager" style={{ width: '100%', display: 'block' }} />
            )}
        </div >
    );
}