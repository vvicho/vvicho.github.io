import React from "react";
import Card from "./Card";
import '../styles/CardExportScreen.css';
import CardWithControls from "./CardWithControls";

const IMAGE_PATH = `${import.meta.env.BASE_URL}cards`;

export default class CardExportScreen extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        const size = this.props.size ?? "180px";
        const cols = this.props.columns ?? 5;
        const hidden = this.props.visible !== true;
        return <div className={hidden ? "cardScreenContainer cardScreenHidden" : "cardScreenContainer"}
            style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
            {Object.keys(this.props.cardsData).map((key, _) =>
                <CardWithControls
                    showAmount={true}
                    showControls={false}
                    uri={`${IMAGE_PATH}/${this.props.cardsData[key].cardSetCode}/${this.props.cardsData[key].parallelId}.png`}
                    callback={() => { }}
                    size={size}
                    lazyLoad={false}
                    key={this.props.cardsData[key].parallelId}
                    amount={this.props.cardAmount[key] ?? 0}
                    cardId={key}
                />
            )}
        </div>
    }
}